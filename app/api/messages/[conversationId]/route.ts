import { createHash } from 'node:crypto'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../../lib/supabase'
import { buildSecurityContext, checkRateLimit, logSecurityEvent } from '../../../../lib/security'
import { createNotification } from '../../../../lib/notifications'
import { isBlockedRelationship } from '../../../../lib/social-guards'

async function createSupabaseServerClient(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  const resolvedCookieStore = cookieStore ?? await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => resolvedCookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: async (cookieArray: Array<{ name: string; value: string; options?: any }>) => {
          cookieArray.forEach((cookie) => {
            resolvedCookieStore.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) })
          })
        },
      },
    }
  )
}

async function getCurrentUser(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  const supabase = await createSupabaseServerClient(cookieStore)
  const store = cookieStore ?? await cookies()
  const ownerSessionCookie = store.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)

  let user = ownerSession?.user
  if (!user) {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      throw new Error('Unauthorized')
    }
    user = authUser
  }

  return user
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toProfileId(value: string) {
  if (isUuid(value)) {
    return value
  }

  const hash = createHash('sha256').update(value).digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${['8', '9', 'a', 'b'][parseInt(hash.slice(16, 17), 16) % 4]}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

async function ensureProfileExists(client: any, userId: string, metadata?: { username?: string; full_name?: string }) {
  const profileId = toProfileId(userId)
  const baseUsername = (metadata?.username || `user-${profileId.slice(0, 8)}`).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
  const fullName = metadata?.full_name || baseUsername

  const { data: existingProfile, error: lookupError } = await client
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (lookupError && lookupError.code !== 'PGRST116') {
    throw lookupError
  }

  if (existingProfile) {
    return profileId
  }

  const { data: profileByUsername, error: usernameLookupError } = await client
    .from('profiles')
    .select('id')
    .ilike('username', baseUsername)
    .maybeSingle()

  if (usernameLookupError && usernameLookupError.code !== 'PGRST116') {
    throw usernameLookupError
  }

  if (profileByUsername) {
    return profileByUsername.id
  }

  const { error: insertError } = await client.from('profiles').upsert({
    id: profileId,
    username: baseUsername,
    full_name: fullName,
  }, { onConflict: 'id' })

  if (insertError) {
    if (insertError.code === '23505' && /username/i.test(insertError.message || '')) {
      const { data: fallbackProfile, error: fallbackLookupError } = await client
        .from('profiles')
        .select('id')
        .ilike('username', baseUsername)
        .maybeSingle()

      if (!fallbackLookupError && fallbackProfile) {
        return fallbackProfile.id
      }
    }

    throw insertError
  }

  return profileId
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const resolvedParams = await params
  const user = await getCurrentUser()
  const supabase = supabaseAdmin ?? await createSupabaseServerClient()

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, participant_1, participant_2')
    .eq('id', resolvedParams.conversationId)
    .maybeSingle()

  if (conversationError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const participantIds = [conversation.participant_1, conversation.participant_2].filter(Boolean)
  if (!participantIds.includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const otherParticipantId = participantIds.find((participantId) => String(participantId) !== String(user.id))
  if (otherParticipantId && await isBlockedRelationship(user.id, String(otherParticipantId), supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      conversation_id,
      content,
      created_at,
      sender_id,
      image_url,
      is_read,
      sender_profile:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)
    `)
    .eq('conversation_id', resolvedParams.conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: conversationWithProfiles } = await supabase
    .from('conversations')
    .select(`
      id,
      participant_1,
      participant_2,
      last_message,
      last_message_at,
      participant_1_profile:profiles!conversations_participant_1_fkey(id, username, full_name, avatar_url),
      participant_2_profile:profiles!conversations_participant_2_fkey(id, username, full_name, avatar_url)
    `)
    .eq('id', resolvedParams.conversationId)
    .maybeSingle()

  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', resolvedParams.conversationId)
    .neq('sender_id', user.id)

  return NextResponse.json({ messages, user_id: user.id, conversation: conversationWithProfiles })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const resolvedParams = await params
  const user = await getCurrentUser()
  const supabase = supabaseAdmin ?? await createSupabaseServerClient()

  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({ request, userId: user.id, keyPrefix: 'message-send', maxRequests: 20, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'message-rate-limit-hit', { userId: user.id, ...context, key: rateLimit.key })
    return NextResponse.json({ error: 'Too many messages sent. Please slow down.' }, { status: 429 })
  }

  const { content, image_url } = await request.json()

  if (!content?.trim() && !image_url) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, participant_1, participant_2')
    .eq('id', resolvedParams.conversationId)
    .maybeSingle()

  if (conversationError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const participantIds = [conversation.participant_1, conversation.participant_2].filter(Boolean)
  if (!participantIds.includes(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const otherParticipantId = participantIds.find((participantId) => String(participantId) !== String(user.id))
  if (otherParticipantId && await isBlockedRelationship(user.id, String(otherParticipantId), supabase)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const senderProfileId = await ensureProfileExists(supabase, user.id, {
    username: user.user_metadata?.username || user.email?.split('@')[0],
    full_name: user.user_metadata?.full_name || user.email || 'Zivona User',
  })

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: resolvedParams.conversationId,
      sender_id: senderProfileId,
      content,
      image_url
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('conversations')
    .update({
      last_message: content || 'Sent a photo',
      last_message_at: new Date().toISOString()
    })
    .eq('id', resolvedParams.conversationId)

  if (otherParticipantId && String(otherParticipantId) !== String(user.id)) {
    await createNotification({
      userId: String(otherParticipantId),
      type: 'message',
      title: 'New message',
      body: 'You received a new message.',
      payload: { conversationId: resolvedParams.conversationId },
    }).catch(() => undefined)
  }

  return NextResponse.json({ message: data, user_id: user.id })
}

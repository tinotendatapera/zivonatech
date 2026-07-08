import { createHash } from 'node:crypto'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'
import { isBlockedRelationship } from '../../../lib/social-guards'

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

  const { data: existingProfileById, error: lookupError } = await client
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .maybeSingle()

  if (lookupError && lookupError.code !== 'PGRST116') {
    throw lookupError
  }

  if (existingProfileById) {
    return profileId
  }

  const { data: existingProfileByUsername, error: usernameLookupError } = await client
    .from('profiles')
    .select('id')
    .ilike('username', baseUsername)
    .maybeSingle()

  if (usernameLookupError && usernameLookupError.code !== 'PGRST116') {
    throw usernameLookupError
  }

  if (existingProfileByUsername) {
    return existingProfileByUsername.id
  }

  let candidateUsername = baseUsername
  let lastError: any = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error: insertError } = await client.from('profiles').upsert({
      id: profileId,
      username: candidateUsername,
      full_name: fullName,
    }, { onConflict: 'id' })

    if (!insertError) {
      return profileId
    }

    lastError = insertError

    if (insertError?.code === '23505' && /username/i.test(insertError.message || '')) {
      candidateUsername = `${baseUsername}-${profileId.slice(0, 6)}`
      continue
    }

    throw insertError
  }

  throw lastError
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    const supabase = supabaseAdmin ?? await createSupabaseServerClient()

    // Normalize user ID to profile ID, same as POST endpoint does
    const normalizedUserId = await ensureProfileExists(supabaseAdmin ?? supabase, user.id, {
      username: user.user_metadata?.username || user.email?.split('@')[0],
      full_name: user.user_metadata?.full_name || user.email || 'Zivona User',
    })

    const conversationsClient = (supabaseAdmin ?? supabase).from('conversations')
    const { data: conversations, error } = await conversationsClient
      .select(`
        *,
        participant_1_profile:profiles!conversations_participant_1_fkey(id, username, full_name, avatar_url),
        participant_2_profile:profiles!conversations_participant_2_fkey(id, username, full_name, avatar_url)
      `)
      .or(`participant_1.eq.${normalizedUserId},participant_2.eq.${normalizedUserId}`)
      .order('last_message_at', { ascending: false })

    if (error) {
      return NextResponse.json({ conversations: [], error: error.message, user_id: normalizedUserId }, { status: 500 })
    }

    return NextResponse.json({ conversations: conversations ?? [], user_id: normalizedUserId })
  } catch (error: any) {
    return NextResponse.json({ conversations: [], error: error?.message || 'Unable to load conversations', user_id: '' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const supabase = supabaseAdmin ?? await createSupabaseServerClient()

    const { other_user_id } = await request.json()

    if (!other_user_id || other_user_id === user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    const normalizedCurrentUserId = await ensureProfileExists(supabaseAdmin ?? supabase, user.id, {
      username: user.user_metadata?.username || user.email?.split('@')[0],
      full_name: user.user_metadata?.full_name || user.email || 'Zivona User',
    })
    const normalizedOtherUserId = await ensureProfileExists(supabaseAdmin ?? supabase, other_user_id, {
      username: String(other_user_id).replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    })

    if (await isBlockedRelationship(normalizedCurrentUserId, normalizedOtherUserId, supabaseAdmin ?? supabase)) {
      return NextResponse.json({ error: 'You cannot start a conversation with this user' }, { status: 403 })
    }

    const { data: existing, error: existingError } = await (supabaseAdmin?.from('conversations') ?? supabase.from('conversations'))
      .select('id')
      .or(
        `and(participant_1.eq.${normalizedCurrentUserId},participant_2.eq.${normalizedOtherUserId}),and(participant_1.eq.${normalizedOtherUserId},participant_2.eq.${normalizedCurrentUserId})`
      )
      .maybeSingle()

    if (existingError && existingError.code !== 'PGRST116') {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ conversation_id: existing.id })
    }

    const conversationParticipantIds = [normalizedCurrentUserId, normalizedOtherUserId]
    if (!conversationParticipantIds.includes(normalizedCurrentUserId) || !conversationParticipantIds.includes(normalizedOtherUserId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await (supabaseAdmin?.from('conversations') ?? supabase.from('conversations'))
      .insert({
        participant_1: normalizedCurrentUserId,
        participant_2: normalizedOtherUserId
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ conversation_id: data.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create conversation' }, { status: 500 })
  }
}

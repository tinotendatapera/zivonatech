import { createHash } from 'node:crypto'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit, buildSecurityContext, logSecurityEvent } from '../../../lib/security'
import { resolveReactionAction, sumReactionCounts } from '../../../lib/engagement.ts'

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

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const dbClient = supabaseAdmin ?? supabase

  const ownerSessionCookie = cookieStore.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)
  let user = ownerSession?.user

  if (!user) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const authenticatedUser = userData?.user

    if (userError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser
  }

  const normalizedUserId = await ensureProfileExists(dbClient, user.id, {
    username: String(user.user_metadata?.username ?? user.email?.split('@')[0] ?? ''),
    full_name: String(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''),
  })

  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({ request, userId: normalizedUserId, keyPrefix: 'reactions', maxRequests: 60, windowMs: 60000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'reactions-rate-limit-hit', { userId: user.id, ...context })
    return NextResponse.json({ error: 'Too many reactions. Please slow down.' }, { status: 429 })
  }

  try {
    const { post_id, comment_id, reaction_type } = await request.json()

    if (!reaction_type || !['like', 'love', 'haha', 'wow', 'sad', 'angry'].includes(reaction_type)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    if (!post_id && !comment_id) {
      return NextResponse.json({ error: 'post_id or comment_id is required' }, { status: 400 })
    }

    if (!supabaseAdmin && !supabase) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Check if post/comment exists
    if (post_id) {
      const { data: post, error: postError } = await dbClient
        .from('posts')
        .select('id')
        .eq('id', post_id)
        .maybeSingle()

      if (postError || !post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
    }

    if (comment_id) {
      const { data: comment, error: commentError } = await dbClient
        .from('comments')
        .select('id')
        .eq('id', comment_id)
        .maybeSingle()

      if (commentError || !comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
      }
    }

    const { data: existingReactions, error: existingReactionLookupError } = await dbClient
      .from('reactions')
      .select('id, reaction_type')
      .eq('user_id', normalizedUserId)
      .eq(post_id ? 'post_id' : 'comment_id', post_id || comment_id)
      .order('created_at', { ascending: false })

    if (existingReactionLookupError) {
      return NextResponse.json({ error: existingReactionLookupError.message || 'Failed to inspect existing reactions' }, { status: 500 })
    }

    const existingReactionType = existingReactions?.[0]?.reaction_type ?? null
    const action = resolveReactionAction(existingReactionType, reaction_type)

    if (action === 'remove') {
      const { error: deleteError } = await dbClient
        .from('reactions')
        .delete()
        .eq('user_id', normalizedUserId)
        .eq(post_id ? 'post_id' : 'comment_id', post_id || comment_id)

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 })
      }
    } else if (action === 'replace') {
      const reactionIds = (existingReactions || []).map((reaction: { id: string }) => reaction.id)
      if (reactionIds.length > 0) {
        const { error: deleteError } = await dbClient
          .from('reactions')
          .delete()
          .in('id', reactionIds)

        if (deleteError) {
          return NextResponse.json({ error: 'Failed to replace reaction' }, { status: 500 })
        }
      }

      const { error: insertError } = await dbClient
        .from('reactions')
        .insert({
          user_id: normalizedUserId,
          post_id: post_id || null,
          comment_id: comment_id || null,
          reaction_type,
        })

      if (insertError) {
        return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
      }
    } else {
      const reactionIds = (existingReactions || []).map((reaction: { id: string }) => reaction.id)
      if (reactionIds.length > 0) {
        const { error: deleteError } = await dbClient
          .from('reactions')
          .delete()
          .in('id', reactionIds)

        if (deleteError) {
          return NextResponse.json({ error: 'Failed to clear existing reactions' }, { status: 500 })
        }
      }

      const { error: insertError } = await dbClient
        .from('reactions')
        .insert({
          user_id: normalizedUserId,
          post_id: post_id || null,
          comment_id: comment_id || null,
          reaction_type,
        })

      if (insertError) {
        return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
      }
    }

    const { data: reactionCounts, error: countError } = await dbClient
      .from('reactions')
      .select('reaction_type')
      .eq(post_id ? 'post_id' : 'comment_id', post_id || comment_id)

    if (countError) {
      return NextResponse.json({ error: countError.message || 'Failed to count reactions' }, { status: 500 })
    }

    const counts: Record<string, number> = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    }

    reactionCounts?.forEach((r: { reaction_type: string }) => {
      counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1
    })

    const totalReactions = sumReactionCounts(counts)
    const targetTable = post_id ? 'posts' : 'comments'
    const targetId = post_id || comment_id
    const { error: updateCountError } = await dbClient
      .from(targetTable)
      .update({ likes_count: totalReactions })
      .eq('id', targetId)

    if (updateCountError) {
      console.error('Failed to sync reaction count', updateCountError)
    }

    return NextResponse.json({
      reacted: action === 'add' || action === 'replace',
      reactions: counts,
      total_reactions: totalReactions,
    })
  } catch (error: any) {
    console.error('Reaction error:', error)
    return NextResponse.json({ error: error.message || 'Failed to process reaction' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const dbClient = supabaseAdmin ?? supabase

  const ownerSessionCookie = cookieStore.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)
  let user = ownerSession?.user

  if (!user) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const authenticatedUser = userData?.user

    if (userError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser
  }

  const normalizedUserId = await ensureProfileExists(dbClient, user.id, {
    username: String(user.user_metadata?.username ?? user.email?.split('@')[0] ?? ''),
    full_name: String(user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? ''),
  })

  try {
    const url = new URL(request.url)
    const post_id = url.searchParams.get('post_id')
    const comment_id = url.searchParams.get('comment_id')

    if (!post_id && !comment_id) {
      return NextResponse.json({ error: 'post_id or comment_id is required' }, { status: 400 })
    }

    let query = dbClient.from('reactions').select('reaction_type, user_id')

    if (post_id) {
      query = query.eq('post_id', post_id)
    }
    if (comment_id) {
      query = query.eq('comment_id', comment_id)
    }

    const { data: reactions, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count reactions by type
    const reactionCounts: Record<string, number> = {
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
    }

    const userReactions: string[] = []

    reactions?.forEach((reaction: any) => {
      reactionCounts[reaction.reaction_type]++
      if (reaction.user_id === normalizedUserId) {
        userReactions.push(reaction.reaction_type)
      }
    })

    return NextResponse.json({
      reactions: reactionCounts,
      userReactions,
    })
  } catch (error: any) {
    console.error('Get reactions error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch reactions' }, { status: 500 })
  }
}

import { createHash } from 'node:crypto'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../../lib/supabase'
import { buildSecurityContext, checkRateLimit, logSecurityEvent } from '../../../../lib/security'
import { createNotification } from '../../../../lib/notifications'

function isSchemaFallbackError(message?: string) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('column') || normalized.includes('permission denied')
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
  const rateLimit = await checkRateLimit({ request, userId: normalizedUserId, keyPrefix: 'like-action', maxRequests: 50, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'like-rate-limit-hit', { userId: user.id, ...context, key: rateLimit.key })
    return NextResponse.json({ error: 'Too many interactions. Please slow down.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const post_id = body?.post_id
  const comment_id = body?.comment_id

  if (!post_id && !comment_id) {
    return NextResponse.json({ error: 'Missing post_id or comment_id' }, { status: 400 })
  }

  const targetTable = comment_id ? 'comments' : 'posts'
  const targetKey = comment_id ? 'comment_id' : 'post_id'
  const targetId = comment_id ?? post_id

  try {
    const { data: targetData, error: targetError } = await dbClient
      .from(targetTable)
      .select('*')
      .eq('id', targetId)
      .maybeSingle()

    if (targetError || !targetData) {
      return NextResponse.json({ error: targetError?.message || 'Target not found' }, { status: 404 })
    }

    const commentLikesCountColumn = targetData ? Object.prototype.hasOwnProperty.call(targetData, 'likes_count') : false
    const existingLikeQuery = dbClient
      .from('likes')
      .select('id')
      .eq('user_id', normalizedUserId)
      .eq(targetKey, targetId)
      .maybeSingle()

    const { data: existingLike, error: existingError } = await existingLikeQuery

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    if (existingLike) {
      const { error: deleteError } = await dbClient
        .from('likes')
        .delete()
        .eq('user_id', normalizedUserId)
        .eq(targetKey, targetId)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      if (commentLikesCountColumn) {
        const { error: updateError } = await dbClient
          .from(targetTable)
          .update({ likes_count: Math.max(0, (targetData.likes_count ?? 0) - 1) })
          .eq('id', targetId)

        if (updateError && !isSchemaFallbackError(updateError.message)) {
          return NextResponse.json({ error: updateError.message }, { status: 500 })
        }
      }

      const { count, error: countError } = await dbClient
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq(targetKey, targetId)

      if (countError && !isSchemaFallbackError(countError.message)) {
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }

      const persistedCount = typeof count === 'number' ? count : (targetData?.likes_count ?? 0)
      return NextResponse.json({ liked: false, likes_count: persistedCount })
    }

    const { error: insertError } = await dbClient
      .from('likes')
      .insert({
        user_id: normalizedUserId,
        [targetKey]: targetId,
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    if (commentLikesCountColumn) {
      const { error: updateError } = await dbClient
        .from(targetTable)
        .update({ likes_count: (targetData.likes_count ?? 0) + 1 })
        .eq('id', targetId)

      if (updateError && !isSchemaFallbackError(updateError.message)) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    }

    const { count, error: countError } = await dbClient
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq(targetKey, targetId)

    if (countError && !isSchemaFallbackError(countError.message)) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    const persistedCount = typeof count === 'number' ? count : (targetData?.likes_count ?? 0)
    const targetOwnerId = targetData?.user_id ?? targetData?.owner_id ?? null
    if (targetOwnerId && String(targetOwnerId) !== String(normalizedUserId)) {
      await createNotification({
        userId: String(targetOwnerId),
        type: 'like',
        title: 'New like',
        body: 'Someone liked your content.',
        payload: { actorId: normalizedUserId, targetType: comment_id ? 'comment' : 'post', targetId },
      }).catch(() => undefined)
    }
    return NextResponse.json({ liked: true, likes_count: persistedCount })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to toggle like' }, { status: 500 })
  }
}

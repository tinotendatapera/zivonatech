import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../../lib/supabase'
import { createFallbackComment, deleteFallbackComment, getFallbackComments, getFallbackLikeState, updateFallbackComment } from '../../../../lib/social-store'
import { buildSecurityContext, checkRateLimit, logSecurityEvent } from '../../../../lib/security'
import { createNotification } from '../../../../lib/notifications'

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

async function authenticateUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const cookieStore = await cookies()
  const ownerSessionCookie = cookieStore.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)
  let user = ownerSession?.user

  if (!user) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    const authenticatedUser = userData?.user

    if (userError || !authenticatedUser) {
      return null
    }

    user = authenticatedUser
  }

  return user
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const postId = url.searchParams.get('post_id')
  const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'recent'
  const page = Math.max(1, Number(url.searchParams.get('page') || 1))
  const limit = Math.min(100, Math.max(10, Number(url.searchParams.get('limit') || 50)))

  if (!postId) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  const fallbackComments = await getFallbackComments(postId)
  const sortComments = (comments: any[]) => {
    const normalized = [...comments]
    normalized.sort((left, right) => {
      if (sort === 'top') {
        const leftScore = (Number(left.likes_count ?? 0) * 2) + (Number(left.reply_count ?? 0) * 1.5)
        const rightScore = (Number(right.likes_count ?? 0) * 2) + (Number(right.reply_count ?? 0) * 1.5)
        if (leftScore !== rightScore) {
          return rightScore - leftScore
        }
      }

      return (right.created_at ?? '').localeCompare(left.created_at ?? '')
    })

    return normalized
  }

  if (!supabaseAdmin) {
    const sortedComments = sortComments(fallbackComments)
    const start = (page - 1) * limit
    return NextResponse.json({
      comments: sortedComments.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: sortedComments.length,
        hasMore: start + limit < sortedComments.length,
      },
    })
  }

  const query = supabaseAdmin
    .from('comments')
    .select(`
      *,
      profiles (
        id,
        username,
        full_name,
        avatar_url,
        is_verified
      )
    `)
    .eq('post_id', postId)

  if (sort === 'top') {
    query.order('likes_count', { ascending: false }).order('created_at', { ascending: false })
  } else {
    query.order('created_at', { ascending: true })
  }

  const { data: comments, error } = await query

  if (error) {
    const sortedComments = sortComments(fallbackComments)
    const start = (page - 1) * limit
    return NextResponse.json({
      comments: sortedComments.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: sortedComments.length,
        hasMore: start + limit < sortedComments.length,
      },
    })
  }

  const commentsWithFallbackLikes = await Promise.all((comments ?? []).map(async (comment: any) => {
    const fallbackLikeState = typeof comment.likes_count === 'number'
      ? { liked: false, likes_count: comment.likes_count }
      : await getFallbackLikeState('comment', comment.id, comment.user_id)

    return {
      ...comment,
      likes_count: fallbackLikeState.likes_count,
      reply_count: 0,
    }
  }))

  const sortedComments = sortComments(commentsWithFallbackLikes)
  const start = (page - 1) * limit

  return NextResponse.json({
    comments: sortedComments.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total: sortedComments.length,
      hasMore: start + limit < sortedComments.length,
    },
  })
}

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const user = await authenticateUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({ request, userId: user.id, keyPrefix: 'comment-create', maxRequests: 20, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'comment-rate-limit-hit', { userId: user.id, ...context, key: rateLimit.key })
    return NextResponse.json({ error: 'Too many comments created. Please slow down.' }, { status: 429 })
  }

  const { post_id, content, parent_comment_id } = await request.json().catch(() => ({}))
  if (!post_id || !content?.trim()) {
    return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
  }

  const commentClient = supabaseAdmin?.from('comments') ?? supabase.from('comments')
  const insertPayload: Record<string, any> = {
    post_id,
    user_id: user.id,
    content: content.trim(),
  }

  if (parent_comment_id) {
    insertPayload.parent_comment_id = parent_comment_id
  }

  let comment: any = null
  let commentError: any = null

  try {
    const result = await commentClient
      .insert(insertPayload)
      .select(`
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url,
          is_verified
        )
      `)
      .single()

    comment = result.data
    commentError = result.error

    if (commentError && /parent_comment_id|column/i.test(commentError.message || '')) {
      const fallbackPayload = {
        post_id,
        user_id: user.id,
        content: content.trim(),
      }

      const fallbackResult = await commentClient
        .insert(fallbackPayload)
        .select(`
          *,
          profiles (
            id,
            username,
            full_name,
            avatar_url,
            is_verified
          )
        `)
        .single()

      comment = fallbackResult.data
      commentError = fallbackResult.error
    }
  } catch (error: any) {
    commentError = error
  }

  if (commentError) {
    const fallbackComment = await createFallbackComment(post_id, user.id, content.trim(), parent_comment_id ?? null)
    return NextResponse.json({ comment: fallbackComment })
  }

  const postClient = supabaseAdmin?.from('posts') ?? supabase.from('posts')
  const { data: postData, error: postFetchError } = await postClient
    .select('*')
    .eq('id', post_id)
    .maybeSingle()

  if (!postFetchError && postData && postData.user_id && String(postData.user_id) !== String(user.id)) {
    await createNotification({
      userId: String(postData.user_id),
      type: 'comment',
      title: 'New comment',
      body: 'Someone commented on your post.',
      payload: { postId: post_id },
    }).catch(() => undefined)
  }

  if (!postFetchError && postData && Object.prototype.hasOwnProperty.call(postData, 'comments_count')) {
    await postClient
      .update({ comments_count: (postData.comments_count ?? 0) + 1 })
      .eq('id', post_id)
  }

  return NextResponse.json({ comment })
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const user = await authenticateUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { comment_id, post_id, content } = await request.json().catch(() => ({}))
  if (!comment_id || !content?.trim()) {
    return NextResponse.json({ error: 'Comment content is required' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    const updated = await updateFallbackComment(comment_id, content.trim())
    return NextResponse.json({ comment: { id: comment_id, content: updated.content, post_id } })
  }

  const commentClient = supabaseAdmin.from('comments')
  const { data, error } = await commentClient
    .update({ content: content.trim() })
    .eq('id', comment_id)
    .eq('user_id', user.id)
    .select(`
      *,
      profiles (
        id,
        username,
        full_name,
        avatar_url,
        is_verified
      )
    `)
    .single()

  if (error) {
    const updated = await updateFallbackComment(comment_id, content.trim())
    return NextResponse.json({ comment: { id: comment_id, content: updated.content, post_id } })
  }

  return NextResponse.json({ comment: data })
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const user = await authenticateUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { comment_id, post_id } = await request.json().catch(() => ({}))
  if (!comment_id) {
    return NextResponse.json({ error: 'Missing comment_id' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    await deleteFallbackComment(comment_id)
    return NextResponse.json({ success: true })
  }

  const { error } = await supabaseAdmin
    .from('comments')
    .delete()
    .eq('id', comment_id)
    .eq('user_id', user.id)

  if (error) {
    await deleteFallbackComment(comment_id)
    return NextResponse.json({ success: true })
  }

  if (post_id) {
    const { data: postData, error: postFetchError } = await supabaseAdmin
      .from('posts')
      .select('*')
      .eq('id', post_id)
      .maybeSingle()

    if (!postFetchError && postData && Object.prototype.hasOwnProperty.call(postData, 'comments_count')) {
      await supabaseAdmin
        .from('posts')
        .update({ comments_count: Math.max(0, (postData.comments_count ?? 0) - 1) })
        .eq('id', post_id)
    }
  }

  return NextResponse.json({ success: true })
}

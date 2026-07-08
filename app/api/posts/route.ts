import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit, buildSecurityContext, logSecurityEvent } from '../../../lib/security'
import { getCachedValue, invalidateCache, setCachedValue } from '../../../lib/cache'
import { getBlockedUserIds } from '../../../lib/social-guards'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
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

// GET all posts
export async function GET() {
  const cachedPosts = await getCachedValue<any[]>('posts:feed:latest')
  if (cachedPosts) {
    return NextResponse.json({ posts: cachedPosts })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const currentUser = await getAuthenticatedUser()
  const userId = currentUser?.id

  const [postsResult, groupPostsResult] = await Promise.all([
    supabaseAdmin
      .from('posts')
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
      .order('created_at', { ascending: false })
      .limit(50),
    userId
      ? supabaseAdmin
          .from('group_members')
          .select('group_id')
          .eq('user_id', userId)
          .eq('status', 'active')
      : null,
  ])

  const { data: posts, error } = postsResult
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const memberships = groupPostsResult?.data ?? []
  const groupIds = memberships.map((membership: any) => membership.group_id).filter(Boolean)
  const blockedUserIds = new Set<string>(await getBlockedUserIds(userId))
  let groupPosts: any[] = []

  if (groupIds.length > 0) {
    const { data: groupPostsData } = await supabaseAdmin
      .from('group_posts')
      .select(`
        *,
        profiles (
          id,
          username,
          full_name,
          avatar_url,
          is_verified
        ),
        groups (id, name, slug, privacy)
      `)
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(50)

    groupPosts = (groupPostsData ?? []).map((post: any) => ({
      ...post,
      group_post: true,
      views_count: 0,
      likes_count: 0,
      comments_count: 0,
    }))
  }

  const postsWithCounts = (posts ?? []).map((post: any) => ({
    ...post,
    views_count: post.views_count ?? post.view_count ?? 0,
    likes_count: post.likes_count ?? 0,
    comments_count: post.comments_count ?? 0,
  }))

  const combinedPosts = [...postsWithCounts, ...groupPosts]
    .filter((post: any) => !blockedUserIds.has(String(post.user_id)))
    .sort((left, right) => (right.created_at || '').localeCompare(left.created_at || ''))

  await setCachedValue('posts:feed:latest', combinedPosts, 45_000)

  return NextResponse.json({ posts: combinedPosts })
}

// CREATE a post
export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)

  // Get authenticated user
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({ request, userId: user.id, keyPrefix: 'post-create', maxRequests: 10, windowMs: 60_000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'post-rate-limit-hit', { userId: user.id, ...context, key: rateLimit.key })
    return NextResponse.json({ error: 'Too many posts created. Please slow down.' }, { status: 429 })
  }

  const { content, image_url, post_type, group_id } = await request.json()

  if (!content?.trim() && !image_url) {
    return NextResponse.json({ error: 'Post content or image is required' }, { status: 400 })
  }

  const insertPayload: Record<string, any> = {
    user_id: user.id,
    content: content?.trim() || '',
    image_url,
    post_type: post_type || 'text',
  }

  if (group_id) {
    insertPayload.group_id = group_id
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await invalidateCache('posts:feed')

  return NextResponse.json({ post: data })
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { post_id, content } = await request.json().catch(() => ({}))
  if (!post_id || !content?.trim()) {
    return NextResponse.json({ error: 'Post content is required' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .update({ content: content.trim() })
    .eq('id', post_id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    await invalidateCache('posts:feed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await invalidateCache('posts:feed')

  return NextResponse.json({ post: data })
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { post_id } = await request.json().catch(() => ({}))
  if (!post_id) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { error } = await supabaseAdmin
    .from('posts')
    .delete()
    .eq('id', post_id)
    .eq('user_id', user.id)

  if (error) {
    await invalidateCache('posts:feed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await invalidateCache('posts:feed')

  return NextResponse.json({ success: true })
}

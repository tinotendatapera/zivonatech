import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

function isSchemaFallbackError(message?: string) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('column') || normalized.includes('permission denied')
}

async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: async (cookieArray: Array<{ name: string; value: string; options?: any }>) => {
          cookieArray.forEach((cookie) => {
            cookieStore.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) })
          })
        },
      },
    },
  )
}

function formatBookmarkTime(value?: string | null) {
  if (!value) return 'Recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function toBookmarkPayload(post: any, bookmarkRow: any) {
  if (!post) return null

  const authorId = post.user_id ?? post.author_id

  return {
    id: post.id,
    bookmark_id: bookmarkRow?.id,
    content: post.content ?? '',
    image_url: post.image_url ?? null,
    time: formatBookmarkTime(post.created_at ?? bookmarkRow?.created_at),
    author: {
      id: authorId,
      username: post.author?.username ?? 'user',
      full_name: post.author?.full_name ?? 'Unknown',
      avatar_url: post.author?.avatar_url ?? null,
    },
    likes_count: post.likes_count ?? 0,
    comments_count: post.comments_count ?? 0,
    shares_count: post.shares_count ?? 0,
    bookmarked: true,
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const dbClient = supabaseAdmin ?? supabase

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ bookmarks: [] }, { status: 401 })
  }

  const { data: bookmarkRows, error: bookmarkError } = await dbClient
    .from('bookmarks')
    .select('id, post_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (bookmarkError) {
    if (isSchemaFallbackError(bookmarkError.message)) {
      return NextResponse.json({ bookmarks: [] })
    }

    return NextResponse.json({ error: bookmarkError.message }, { status: 500 })
  }

  const postIds = (bookmarkRows ?? []).map((row: any) => row.post_id).filter(Boolean)
  if (postIds.length === 0) {
    return NextResponse.json({ bookmarks: [] })
  }

  const { data: posts, error: postsError } = await dbClient
    .from('posts')
    .select('id, user_id, author_id, created_at, content, image_url, tags, likes_count, comments_count, shares_count')
    .in('id', postIds)

  if (postsError) {
    if (isSchemaFallbackError(postsError.message)) {
      return NextResponse.json({ bookmarks: [] })
    }

    return NextResponse.json({ error: postsError.message }, { status: 500 })
  }

  const authorIds = Array.from(new Set((posts ?? []).map((post: any) => post.user_id ?? post.author_id).filter(Boolean)))
  const profilesById = new Map<string, any>()

  if (authorIds.length > 0) {
    const { data: profiles, error: profilesError } = await dbClient
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', authorIds)

    if (!profilesError && profiles) {
      profiles.forEach((profile: any) => profilesById.set(profile.id, profile))
    }
  }

  const postLookup = new Map<string, any>()
  ;(posts ?? []).forEach((post: any) => {
    const authorId = post.user_id ?? post.author_id
    postLookup.set(post.id, {
      ...post,
      author: profilesById.get(authorId),
    })
  })

  const bookmarks = (bookmarkRows ?? [])
    .map((bookmarkRow: any) => toBookmarkPayload(postLookup.get(bookmarkRow.post_id), bookmarkRow))
    .filter(Boolean)

  return NextResponse.json({ bookmarks })
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const dbClient = supabaseAdmin ?? supabase

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const postId = body?.post_id

  if (!postId) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  const { data: existingBookmark, error: existingError } = await dbClient
    .from('bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', postId)
    .maybeSingle()

  if (existingError) {
    if (isSchemaFallbackError(existingError.message)) {
      return NextResponse.json({ bookmarked: false, error: 'Bookmarks are unavailable right now.' }, { status: 500 })
    }

    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  if (existingBookmark) {
    const { error: deleteError } = await dbClient
      .from('bookmarks')
      .delete()
      .eq('id', existingBookmark.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ bookmarked: false })
  }

  const { error: insertError } = await dbClient
    .from('bookmarks')
    .insert({ user_id: user.id, post_id: postId })

  if (insertError) {
    if (isSchemaFallbackError(insertError.message)) {
      return NextResponse.json({ bookmarked: false, error: 'Bookmarks are unavailable right now.' }, { status: 500 })
    }

    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ bookmarked: true })
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient()
  const dbClient = supabaseAdmin ?? supabase

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const postId = body?.post_id

  if (!postId) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  const { error } = await dbClient
    .from('bookmarks')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', postId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

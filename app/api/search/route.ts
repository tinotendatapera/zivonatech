import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''

    if (!query || !supabaseAdmin) {
      return NextResponse.json({ users: [], posts: [], hashtags: [] })
    }

    const [profilesResult, postsResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%,bio.ilike.%${query}%`)
        .limit(8),
      supabaseAdmin
        .from('posts')
        .select('id, content, created_at, likes_count, comments_count')
        .or(`content.ilike.%${query}%,content.ilike.%#${query}%`)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    const hashtags = Array.from(new Set((query.match(/#[\w-]+/g) || []).map((tag) => tag.toLowerCase())))

    return NextResponse.json({
      users: profilesResult.data ?? [],
      posts: postsResult.data ?? [],
      hashtags,
    })
  } catch (error: any) {
    return NextResponse.json({ users: [], posts: [], hashtags: [], error: error?.message || 'Unable to search' }, { status: 500 })
  }
}

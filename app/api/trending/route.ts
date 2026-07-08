import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

function extractHashtags(content: string) {
  return Array.from(new Set((content.match(/#[\w-]+/g) || []).map((tag) => tag.toLowerCase())))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lookbackHours = Number(searchParams.get('hours') || '24')
    const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('posts')
        .select('content, created_at, likes_count, comments_count, views_count')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!error && data) {
        const counts = new Map<string, { count: number; score: number }>()

        for (const row of data) {
          for (const tag of extractHashtags(String(row.content || ''))) {
            const entry = counts.get(tag) || { count: 0, score: 0 }
            entry.count += 1
            entry.score += Number(row.likes_count || 0) * 2 + Number(row.comments_count || 0) * 3 + Number(row.views_count || 0) * 0.1
            counts.set(tag, entry)
          }
        }

        const topics = Array.from(counts.entries())
          .map(([tag, value]) => ({
            tag,
            posts: `${value.count} ${value.count === 1 ? 'post' : 'posts'}`,
            score: Math.round(value.score),
          }))
          .sort((left, right) => right.score - left.score)
          .slice(0, 8)

        if (topics.length > 0) {
          return NextResponse.json({ topics, windowHours: lookbackHours })
        }
      }
    }

    return NextResponse.json({
      topics: [
        { tag: '#design', posts: '24 posts', score: 24 },
        { tag: '#fashion', posts: '18 posts', score: 18 },
        { tag: '#ai', posts: '15 posts', score: 15 },
        { tag: '#food', posts: '11 posts', score: 11 },
      ],
      windowHours: lookbackHours,
    })
  } catch (error: any) {
    return NextResponse.json({ topics: [], error: error?.message || 'Unable to load trending topics' }, { status: 500 })
  }
}

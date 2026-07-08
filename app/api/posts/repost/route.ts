import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { checkRateLimit, buildSecurityContext, logSecurityEvent } from '../../../../lib/security'

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

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({ request, userId: user.id, keyPrefix: 'repost', maxRequests: 30, windowMs: 60000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'repost-rate-limit-hit', { userId: user.id, ...context })
    return NextResponse.json({ error: 'Too many reposts. Please slow down.' }, { status: 429 })
  }

  try {
    const { post_id } = await request.json()
    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Check if post exists (include reposts_count)
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .select('id, reposts_count')
      .eq('id', post_id)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if already reposted
    const { data: existingRepost } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('repost_of_id', post_id)
      .eq('user_id', user.id)
      .single()

    if (existingRepost) {
      // Remove the repost
      const { error: deleteError } = await supabaseAdmin
        .from('posts')
        .delete()
        .eq('id', existingRepost.id)

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to remove repost' }, { status: 500 })
      }

      // Decrement reposts count on original post
      await supabaseAdmin
        .from('posts')
        .update({ reposts_count: post.reposts_count - 1 })
        .eq('id', post_id)

      return NextResponse.json({ reposted: false })
    } else {
      // Create repost
      const { error: insertError } = await supabaseAdmin
        .from('posts')
        .insert({
          user_id: user.id,
          content: '',
          repost_of_id: post_id,
          is_repost: true,
          post_type: 'text'
        })

      if (insertError) {
        return NextResponse.json({ error: 'Failed to create repost' }, { status: 500 })
      }

      // Increment reposts count on original post
      await supabaseAdmin
        .from('posts')
        .update({ reposts_count: (post.reposts_count || 0) + 1 })
        .eq('id', post_id)

      return NextResponse.json({ reposted: true })
    }
  } catch (error: any) {
    console.error('Repost error:', error)
    return NextResponse.json({ error: error.message || 'Failed to process repost' }, { status: 500 })
  }
}

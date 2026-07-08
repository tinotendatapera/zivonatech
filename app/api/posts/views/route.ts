import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

function isSchemaFallbackError(message?: string) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('column') || normalized.includes('permission denied')
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
  const { post_id } = await request.json().catch(() => ({}))

  if (!post_id) {
    return NextResponse.json({ error: 'Missing post_id' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: postData, error: postError } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('id', post_id)
    .maybeSingle()

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  if (!postData) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const currentViews = Object.prototype.hasOwnProperty.call(postData, 'views_count')
    ? (postData.views_count ?? 0)
    : Object.prototype.hasOwnProperty.call(postData, 'view_count')
      ? (postData.view_count ?? 0)
      : 0

  const updatePayload = Object.prototype.hasOwnProperty.call(postData, 'views_count')
    ? { views_count: currentViews + 1 }
    : Object.prototype.hasOwnProperty.call(postData, 'view_count')
      ? { view_count: currentViews + 1 }
      : null

  if (!updatePayload) {
    return NextResponse.json({ error: 'Unsupported post view column schema' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .update(updatePayload)
    .eq('id', post_id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updatedViews = Object.prototype.hasOwnProperty.call(data ?? {}, 'views_count')
    ? (data?.views_count ?? 0)
    : Object.prototype.hasOwnProperty.call(data ?? {}, 'view_count')
      ? (data?.view_count ?? 0)
      : currentViews + 1

  return NextResponse.json({ views_count: updatedViews })
}

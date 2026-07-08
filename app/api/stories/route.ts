import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'

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
    if (userError || !userData?.user) return null
    user = userData.user
  }

  return user
}

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const now = new Date().toISOString()
    if (supabaseAdmin) {
      await supabaseAdmin.from('stories').delete().lt('expires_at', now)
    }

    const { data, error } = await supabaseAdmin
      .from('stories')
      .select('id, user_id, content, media_url, expires_at, created_at')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stories: data ?? [] })
  } catch (error: any) {
    return NextResponse.json({ stories: [], error: error?.message || 'Unable to load stories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = await createSupabaseServerClient(cookieStore)
    const user = await authenticateUser(supabase)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content, media_url } = await request.json().catch(() => ({}))
    if (!content?.trim() && !media_url) {
      return NextResponse.json({ error: 'Story content or media is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabaseAdmin
      .from('stories')
      .insert({
        user_id: user.id,
        content: content?.trim() || '',
        media_url: media_url ?? null,
        expires_at: expiresAt,
      })
      .select('id, user_id, content, media_url, expires_at, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ story: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create story' }, { status: 500 })
  }
}

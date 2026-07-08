import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie } from '../../../../lib/supabase'

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

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = await createSupabaseServerClient(cookieStore)
    const ownerSessionCookie = cookieStore.get(OWNER_SESSION_COOKIE_NAME)
    const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)

    if (!ownerSession?.refresh_token) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 401 })
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: ownerSession.access_token ?? '',
      refresh_token: ownerSession.refresh_token,
    })

    if (error || !data.session) {
      return NextResponse.json({ error: 'Unable to refresh session' }, { status: 401 })
    }

    return NextResponse.json({ session: data.session })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to refresh session' }, { status: 500 })
  }
}

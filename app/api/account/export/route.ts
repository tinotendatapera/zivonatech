import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'

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

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = await createSupabaseServerClient(cookieStore)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ export: null })
    }

    const [profile, posts, messages, listings, consents] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('posts').select('*').eq('user_id', user.id),
      supabaseAdmin.from('messages').select('*').eq('sender_id', user.id),
      supabaseAdmin.from('listings').select('*').eq('user_id', user.id),
      supabaseAdmin.from('user_consents').select('*').eq('user_id', user.id),
    ])

    return NextResponse.json({
      export: {
        profile: profile.data,
        posts: posts.data ?? [],
        messages: messages.data ?? [],
        listings: listings.data ?? [],
        consents: consents.data ?? [],
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to export data' }, { status: 500 })
  }
}

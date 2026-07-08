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

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = await createSupabaseServerClient(cookieStore)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    await supabaseAdmin.from('profiles').update({
      username: `deleted-user-${user.id.slice(0, 8)}`,
      full_name: 'Deleted user',
      email: null,
      avatar_url: null,
      bio: null,
      location: null,
      phone: null,
      address: null,
      country: null,
    }).eq('id', user.id)

    await supabaseAdmin.auth.admin.deleteUser(user.id)

    await supabaseAdmin.from('posts').delete().eq('user_id', user.id)
    await supabaseAdmin.from('comments').delete().eq('user_id', user.id)
    await supabaseAdmin.from('listings').delete().eq('user_id', user.id)
    await supabaseAdmin.from('messages').delete().eq('sender_id', user.id)
    await supabaseAdmin.from('notifications').delete().eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to delete account' }, { status: 500 })
  }
}

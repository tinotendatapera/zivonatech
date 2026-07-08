import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
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
      return NextResponse.json({ summary: { totalEvents: 0, topEvents: [] } })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('event_name')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ summary: { totalEvents: 0, topEvents: [] } })
    }

    const counts = new Map<string, number>()
    for (const entry of data || []) {
      const event = String(entry.event_name || 'unknown')
      counts.set(event, (counts.get(event) || 0) + 1)
    }

    const topEvents = Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([event, count]) => ({ event, count }))

    return NextResponse.json({ summary: { totalEvents: data?.length || 0, topEvents } })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load analytics' }, { status: 500 })
  }
}

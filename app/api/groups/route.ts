import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

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
      return NextResponse.json({ groups: [] })
    }

    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false })

    if (groupsError) {
      return NextResponse.json({ error: groupsError.message }, { status: 500 })
    }

    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from('group_members')
      .select('group_id, role, status')
      .eq('user_id', user.id)

    if (membershipsError) {
      return NextResponse.json({ error: membershipsError.message }, { status: 500 })
    }

    const membershipMap = new Map((memberships ?? []).map((membership: any) => [membership.group_id, membership]))
    const normalizedGroups = (groups ?? []).map((group: any) => ({
      ...group,
      membership: membershipMap.get(group.id) ?? null,
    }))

    return NextResponse.json({ groups: normalizedGroups })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}))
    const name = String(body?.name || '').trim()
    const description = String(body?.description || '').trim()
    const privacy = ['public', 'private', 'invite_only'].includes(String(body?.privacy || 'public')) ? String(body?.privacy || 'public') : 'public'
    const slug = String(body?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim()

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
    }

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({
        owner_id: user.id,
        name,
        slug,
        description,
        privacy,
      })
      .select()
      .single()

    if (groupError) {
      return NextResponse.json({ error: groupError.message }, { status: 500 })
    }

    await supabaseAdmin.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
      role: 'admin',
      status: 'active',
    })

    return NextResponse.json({ group })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create group' }, { status: 500 })
  }
}

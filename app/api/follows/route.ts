import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'
import { createNotification } from '../../../lib/notifications'

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

async function getCurrentUser(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  const supabase = await createSupabaseServerClient(cookieStore)
  const store = cookieStore ?? await cookies()
  const ownerSessionCookie = store.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)

  let user = ownerSession?.user
  if (!user) {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      throw new Error('Unauthorized')
    }
    user = authUser
  }

  return user
}

async function getCounts(client: any, profileId: string) {
  const [{ count: followersCount = 0 }, { count: followingCount = 0 }] = await Promise.all([
    client.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', profileId),
    client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
  ])

  return { followers: Number(followersCount ?? 0), following: Number(followingCount ?? 0) }
}

async function syncProfileCounts(client: any, profileId: string) {
  const counts = await getCounts(client, profileId)

  await client
    .from('profiles')
    .update({
      followers_count: counts.followers,
      following_count: counts.following,
    })
    .eq('id', profileId)

  return counts
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'both'

    if (!supabaseAdmin) {
      return NextResponse.json({ following: [], followers: [], counts: { followers: 0, following: 0 } })
    }

    const client = supabaseAdmin.from('follows')
    if (type === 'followers') {
      const { data, error } = await client.select('follower_id').eq('followed_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ followers: (data ?? []).map((row: any) => row.follower_id).filter(Boolean) })
    }

    if (type === 'following') {
      const { data, error } = await client.select('followed_id').eq('follower_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ following: (data ?? []).map((row: any) => row.followed_id).filter(Boolean) })
    }

    const { data, error } = await client.select('*').eq('follower_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ following: (data ?? []).map((row: any) => row.followed_id).filter(Boolean), counts: await getCounts(supabaseAdmin, user.id) })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load follow data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = await request.json().catch(() => ({}))
    const targetUserId = String(body?.target_user_id || '').trim()

    if (!targetUserId || targetUserId === user.id) {
      return NextResponse.json({ error: 'Invalid target user' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ ok: false, following: false, counts: { followers: 0, following: 0 } })
    }

    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('followed_id', targetUserId)
      .maybeSingle()

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 })
    }

    let following = false
    if (existing) {
      await supabaseAdmin.from('follows').delete().eq('id', existing.id)
    } else {
      await supabaseAdmin.from('follows').insert({ follower_id: user.id, followed_id: targetUserId })
      following = true
      await createNotification({
        userId: targetUserId,
        type: 'follow',
        title: 'New follower',
        body: 'Someone started following you.',
        payload: { actorId: user.id, followerId: user.id },
      }).catch(() => undefined)
    }

    const [targetCounts, viewerCounts] = await Promise.all([
      syncProfileCounts(supabaseAdmin, targetUserId),
      syncProfileCounts(supabaseAdmin, user.id),
    ])

    return NextResponse.json({ ok: true, following, counts: targetCounts, targetUserId, viewerCounts })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update follow state' }, { status: 500 })
  }
}

import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'
import { getCachedValue, invalidateCache, setCachedValue } from '../../../lib/cache'

async function createNotificationRecord({
  userId,
  type,
  title,
  body,
  payload,
}: {
  userId: string
  type: string
  title?: string
  body: string
  payload?: Record<string, any>
}) {
  if (!supabaseAdmin) {
    return null
  }

  const insertPayload: Record<string, any> = {
    user_id: userId,
    type,
    is_read: false,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert(insertPayload)
    .select('id, user_id, type, is_read, created_at')
    .single()

  if (error) {
    throw error
  }

  return data
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

function normalizeNotificationType(type: string) {
  switch (type) {
    case 'like':
    case 'comment':
    case 'follow':
    case 'message':
    case 'marketplace':
    case 'mention':
      return type
    default:
      return 'system'
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    const cacheKey = `notifications:${user.id}`
    const cached = await getCachedValue<Array<Record<string, any>>>(cacheKey)
    if (cached) {
      return NextResponse.json({ notifications: cached, user_id: user.id })
    }

    let notifications: Array<Record<string, any>> = []
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('id, user_id, type, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error) {
        notifications = data ?? []
      }
    }

    await setCachedValue(cacheKey, notifications, 30_000)
    return NextResponse.json({ notifications, user_id: user.id })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load notifications' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = await request.json().catch(() => ({}))
    const type = normalizeNotificationType(String(body?.type || 'system'))
    const targetUserId = body?.user_id ? String(body.user_id) : user.id

    if (!body?.text && !body?.body) {
      return NextResponse.json({ error: 'Notification text is required' }, { status: 400 })
    }

    const created = await createNotificationRecord({
      userId: targetUserId,
      type,
      title: body?.title ? String(body.title) : undefined,
      body: String(body?.text ?? body?.body ?? ''),
      payload: body?.payload && typeof body.payload === 'object' ? body.payload : {},
    })

    await invalidateCache(`notifications:${targetUserId}`)
    return NextResponse.json({ ok: true, notification: created, type, targetUserId })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create notification' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()
    const { notification_id } = await request.json().catch(() => ({}))

    if (!notification_id) {
      return NextResponse.json({ error: 'Notification id is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await invalidateCache(`notifications:${user.id}`)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to mark notification as read' }, { status: 500 })
  }
}

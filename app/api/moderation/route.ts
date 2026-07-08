import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
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

function detectSpam(text: string) {
  const normalized = text.toLowerCase()
  const suspiciousKeywords = ['buy now', 'click here', 'free money', 'crypto', 'guaranteed', 'spam', 'scam']
  const matches = suspiciousKeywords.filter((keyword) => normalized.includes(keyword))
  return matches.length > 0
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const body = await request.json().catch(() => ({}))
    const targetType = String(body?.target_type || 'post')
    const reason = String(body?.reason || 'other')
    const description = String(body?.description || '')

    if (!body?.target_id) {
      return NextResponse.json({ error: 'Target id is required' }, { status: 400 })
    }

    const contentText = `${description} ${body?.content || ''}`.trim()
    const autoFlag = detectSpam(contentText)
    const payload = {
      reporter_id: user.id,
      target_type: targetType,
      target_id: body.target_id,
      reason,
      description,
      status: autoFlag ? 'flagged' : 'queued',
      auto_flagged: autoFlag,
      created_at: new Date().toISOString(),
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ ok: true, report: payload })
    }

    const { error } = await supabaseAdmin.from('moderation_reports').insert(payload)
    if (error) {
      return NextResponse.json({ ok: true, report: payload, warning: error.message })
    }

    return NextResponse.json({ ok: true, report: payload })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to submit report' }, { status: 500 })
  }
}

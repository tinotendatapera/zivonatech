import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { randomBytes } from 'node:crypto'
import { supabaseAdmin } from '../../../../lib/supabase'
import { checkRateLimit, buildSecurityContext, logSecurityEvent } from '../../../../lib/security'

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
  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({
    request,
    keyPrefix: 'password-reset',
    maxRequests: 3,
    windowMs: 60_000,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many reset requests. Please try again later.' }, { status: 429 })
  }

  try {
    const { email } = await request.json().catch(() => ({}))
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: userData, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/reset-password`,
    })

    if (error) {
      await logSecurityEvent('warn', 'password-reset-request-failed', { email, ...context, error: error.message })
      return NextResponse.json({ success: true })
    }

    if (supabaseAdmin) {
      const token = randomBytes(24).toString('hex')
      await supabaseAdmin.from('password_reset_tokens').insert({
        email,
        token,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used: false,
      })
    }

    await logSecurityEvent('info', 'password-reset-request', { email, ...context })
    return NextResponse.json({ success: true, message: 'If the account exists, a reset link was sent.' })
  } catch (error: any) {
    await logSecurityEvent('error', 'password-reset-request-exception', { error: error?.message, ...context })
    return NextResponse.json({ success: true, message: 'If the account exists, a reset link was sent.' })
  }
}

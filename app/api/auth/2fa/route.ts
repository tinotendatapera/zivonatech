import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { createHmac, randomBytes, createHash } from 'node:crypto'
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

function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const segment = randomBytes(2).toString('hex').toUpperCase()
    return `ZIV-${segment}`
  })
}

function hashValue(value: string) {
  return createHash('sha256').update(value.trim().toUpperCase()).digest('hex')
}

function generateTotp(secret: string, window = 0) {
  const timeStep = 30
  const counter = Math.floor(Date.now() / 1000 / timeStep) + window
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  buffer.writeUInt32BE(counter % 0x100000000, 4)

  const digest = createHmac('sha1', Buffer.from(secret, 'hex')).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0xf
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff)

  return (binary % 1_000_000).toString().padStart(6, '0')
}

function verifyTotp(secret: string, code: string) {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false

  return [-1, 0, 1].some((window) => generateTotp(secret, window) === normalized)
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = await createSupabaseServerClient(cookieStore)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, code } = await request.json().catch(() => ({}))
    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    if (action === 'status') {
      const { data, error } = await supabaseAdmin
        .from('two_factor_secrets')
        .select('enabled, secret, recovery_codes')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        return NextResponse.json({ enabled: false })
      }

      return NextResponse.json({ enabled: Boolean(data?.enabled) })
    }

    if (action === 'setup') {
      const secret = randomBytes(20).toString('hex')
      const recoveryCodes = generateRecoveryCodes()

      await supabaseAdmin.from('two_factor_secrets').upsert({
        user_id: user.id,
        secret,
        enabled: false,
        recovery_codes: recoveryCodes.map((code) => hashValue(code)),
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      return NextResponse.json({
        success: true,
        secret,
        recoveryCodes,
        qrCode: `otpauth://totp/Zivona:${user.email}?secret=${secret}&issuer=Zivona`,
      })
    }

    if (action === 'verify') {
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ error: 'Verification code is required' }, { status: 400 })
      }

      const { data, error } = await supabaseAdmin
        .from('two_factor_secrets')
        .select('secret, enabled, recovery_codes')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data?.secret) {
        return NextResponse.json({ error: '2FA setup not found' }, { status: 400 })
      }

      const recoveryCodes = Array.isArray((data as any)?.recovery_codes) ? (data as any).recovery_codes : []
      const normalizedCode = code.trim().toUpperCase()
      const isValidCode = verifyTotp(data.secret, code)
      const isValidRecoveryCode = recoveryCodes.some((storedCode: unknown) => {
        if (typeof storedCode !== 'string') return false
        return storedCode === normalizedCode || hashValue(normalizedCode) === storedCode
      })

      if (!isValidCode && !isValidRecoveryCode) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }

      await supabaseAdmin.from('two_factor_secrets').update({
        enabled: true,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      return NextResponse.json({ success: true, enabled: true })
    }

    if (action === 'disable') {
      await supabaseAdmin.from('two_factor_secrets').update({
        enabled: false,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      return NextResponse.json({ success: true, enabled: false })
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to process 2FA request' }, { status: 500 })
  }
}

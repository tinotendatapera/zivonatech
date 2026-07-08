import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: async (cookieArray: Array<{ name: string; value: string; options?: any }>) => {
          cookieArray.forEach((cookie) => {
            cookieStore.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) })
          })
        },
      },
    },
  )
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const orderId = String(body?.order_id || '').trim()
  const rating = Number(body?.rating || 5)
  const comment = String(body?.comment || '').trim()

  if (!orderId) {
    return NextResponse.json({ error: 'Order id is required' }, { status: 400 })
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('checkout_orders')
    .select('id, buyer_id, seller_id')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Order not found' }, { status: 404 })
  }

  const revieweeId = order.buyer_id === user.id ? order.seller_id : order.buyer_id
  const { error } = await supabaseAdmin.from('transaction_reviews').insert({
    order_id: order.id,
    reviewer_id: user.id,
    reviewee_id: revieweeId,
    rating: Number.isFinite(rating) ? Math.max(1, Math.min(5, rating)) : 5,
    comment,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

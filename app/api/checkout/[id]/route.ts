import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { createNotification } from '../../../../lib/notifications'

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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const params = await context.params
  const { data: order, error } = await supabaseAdmin
    .from('checkout_orders')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ order })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const params = await context.params
  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || '').trim()

  const { data: order, error: lookupError } = await supabaseAdmin
    .from('checkout_orders')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (lookupError || !order) {
    return NextResponse.json({ error: lookupError?.message || 'Order not found' }, { status: 404 })
  }

  if (action === 'mark-paid' && order.seller_id === user.id) {
    if (String(order.payment_provider || '').toLowerCase() === 'stripe') {
      return NextResponse.json({ error: 'Stripe payments must be confirmed via webhook' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('checkout_orders')
      .update({ status: 'paid', escrow_status: 'held' })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin.from('payment_events').insert({
      order_id: order.id,
      event_type: 'paid',
      payload: { actor_id: user.id },
    })

    await createNotification({
      userId: order.buyer_id,
      type: 'marketplace',
      title: 'Marketplace update',
      body: 'Your order was marked as paid.',
      payload: { orderId: order.id },
    }).catch(() => undefined)

    return NextResponse.json({ success: true, order: { ...order, status: 'paid', escrow_status: 'held' } })
  }

  if (action === 'release-escrow' && order.seller_id === user.id) {
    const { error } = await supabaseAdmin
      .from('checkout_orders')
      .update({ status: 'completed', escrow_status: 'released' })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabaseAdmin.from('payment_events').insert({
      order_id: order.id,
      event_type: 'escrow_released',
      payload: { actor_id: user.id },
    })

    await createNotification({
      userId: order.buyer_id,
      type: 'marketplace',
      title: 'Marketplace update',
      body: 'Escrow was released for your order.',
      payload: { orderId: order.id },
    }).catch(() => undefined)

    return NextResponse.json({ success: true, order: { ...order, status: 'completed', escrow_status: 'released' } })
  }

  if (action === 'open-dispute' && (order.buyer_id === user.id || order.seller_id === user.id)) {
    const { error } = await supabaseAdmin.from('transaction_disputes').insert({
      order_id: order.id,
      opened_by: user.id,
      reason: String(body?.reason || 'other'),
      status: 'open',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}

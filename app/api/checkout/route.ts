import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabaseAdmin } from '../../../lib/supabase'
import { createNotification } from '../../../lib/notifications'

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
  const listingId = String(body?.listing_id || '').trim()

  if (!listingId) {
    return NextResponse.json({ error: 'Listing id is required' }, { status: 400 })
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from('listings')
    .select('id, user_id, title, price, currency')
    .eq('id', listingId)
    .maybeSingle()

  if (listingError) {
    return NextResponse.json({ error: listingError.message }, { status: 500 })
  }

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  if (listing.user_id === user.id) {
    return NextResponse.json({ error: 'You cannot purchase your own listing' }, { status: 400 })
  }

  const { data: existingOrder } = await supabaseAdmin
    .from('checkout_orders')
    .select('id, status, escrow_status')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .in('status', ['pending', 'paid'])
    .maybeSingle()

  if (existingOrder) {
    return NextResponse.json({ order: existingOrder, message: 'A checkout for this listing is already in progress.' })
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('checkout_orders')
    .insert({
      buyer_id: user.id,
      seller_id: listing.user_id,
      listing_id: listingId,
      amount: Number(listing.price ?? 0),
      currency: listing.currency || 'USD',
      status: 'pending',
      escrow_status: 'pending',
    })
    .select()
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Unable to create checkout' }, { status: 500 })
  }

  await supabaseAdmin.from('payment_events').insert({
    order_id: order.id,
    event_type: 'checkout_started',
    payload: { listing_id: listingId, seller_id: listing.user_id },
  })

  await createNotification({
    userId: listing.user_id,
    type: 'marketplace',
    title: 'New marketplace order',
    body: 'A new order was created for your listing.',
    payload: { orderId: order.id, listingId },
  }).catch(() => undefined)

  let paymentProvider = 'manual-escrow'
  let paymentIntentId: string | null = null
  let clientSecret: string | null = null

  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(listing.price ?? 0) * 100),
      currency: String(listing.currency || 'USD').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_id: order.id,
        listing_id: listingId,
        buyer_id: user.id,
      },
    })

    paymentProvider = 'stripe'
    paymentIntentId = paymentIntent.id
    clientSecret = paymentIntent.client_secret

    await supabaseAdmin.from('checkout_orders').update({ payment_intent_id: paymentIntent.id }).eq('id', order.id)
  }

  return NextResponse.json({
    order: {
      ...order,
      listing_title: listing.title,
      seller_id: listing.user_id,
      checkout_url: `/marketplace/${listingId}`,
      payment_provider: paymentProvider,
      payment_intent_id: paymentIntentId,
      client_secret: clientSecret,
    },
    message: paymentProvider === 'stripe'
      ? 'Stripe payment intent created. Complete payment to secure escrow.'
      : 'Secure checkout created. The seller can confirm the payment and release funds from escrow.',
  })
}

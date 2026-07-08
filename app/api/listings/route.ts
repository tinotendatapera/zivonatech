import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { getFallbackListingViewCount } from '../../../lib/social-store'

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

function isSchemaFallbackError(message?: string) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('column') || normalized.includes('permission denied')
}

async function getPrivacySettingsForUsers(userIds: string[]) {
  if (!supabaseAdmin || userIds.length === 0) return new Map<string, any>()

  const { data, error } = await supabaseAdmin
    .from('profile_privacy')
    .select('profile_id, account_is_private, show_location, allow_messages, allow_marketplace_contact')
    .in('profile_id', userIds)

  if (error || !data) return new Map<string, any>()

  return new Map(data.map((row: any) => [row.profile_id, row]))
}

function applyPrivacyToListing(listing: any, viewerUserId?: string | null, privacy?: any) {
  const isOwner = Boolean(viewerUserId && listing?.user_id && listing.user_id === viewerUserId)
  const isPrivateSeller = Boolean(privacy?.account_is_private) && !isOwner

  return {
    ...listing,
    location: isPrivateSeller && privacy?.show_location === false ? 'Location hidden' : listing.location || 'Zimbabwe',
    profiles: {
      ...(listing.profiles ?? {}),
      full_name: isPrivateSeller ? 'Private seller' : listing.profiles?.full_name ?? 'Unknown seller',
      username: isPrivateSeller ? 'private' : listing.profiles?.username ?? 'seller',
      allow_messages: !isPrivateSeller ? Boolean(privacy?.allow_messages ?? true) : false,
      allow_marketplace_contact: !isPrivateSeller ? Boolean(privacy?.allow_marketplace_contact ?? true) : false,
    },
  }
}

// GET all listings (with optional category/search filters)
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')

  const { data: viewerData } = await supabase.auth.getUser()
  const viewerUserId = viewerData?.user?.id

  let query = supabase
    .from('listings')
    .select(`
      *,
      profiles (
        id,
        username,
        full_name,
        avatar_url,
        is_verified,
        street_score
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data: listings, error } = await query

  if (error) {
    if (isSchemaFallbackError(error.message)) {
      return NextResponse.json({ listings: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const privacyMap = await getPrivacySettingsForUsers((listings ?? []).map((listing: any) => listing.user_id).filter(Boolean))
  const normalizedListings = (listings ?? []).map((listing: any) => {
    const privacy = privacyMap.get(listing.user_id)
    const baseListing = applyPrivacyToListing(listing, viewerUserId, privacy)
    return {
      ...baseListing,
      views_count: typeof baseListing.views_count === 'number'
        ? baseListing.views_count
        : typeof baseListing.view_count === 'number'
          ? baseListing.view_count
          : getFallbackListingViewCount(listing.id),
    }
  })

  return NextResponse.json({ listings: normalizedListings })
}

// CREATE a listing
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, price, currency, category, condition, images, location } = body

  if (!title || typeof price !== 'number' || !category) {
    return NextResponse.json({ error: 'Title, price and category are required' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  if (!existingProfile) {
    const username =
      user.user_metadata?.username ||
      user.email?.split('@')[0] ||
      `user-${user.id.slice(0, 8)}`
    const full_name = user.user_metadata?.full_name || username

    const { error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        username,
        email: user.email,
        full_name,
      })

    if (createProfileError) {
      return NextResponse.json({ error: createProfileError.message }, { status: 500 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('listings')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || '',
      price,
      currency: currency || 'USD',
      category,
      condition: condition || 'new',
      images: Array.isArray(images) ? images.slice(0, 6) : [],
      location: location?.trim() || 'Zimbabwe',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ listing: data })
}

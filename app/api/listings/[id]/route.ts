import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase'
import { getFallbackListingViewCount, incrementFallbackListingView } from '../../../../lib/social-store'

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

async function getPrivacySettingsForUser(userId: string) {
  if (!supabaseAdmin) return null

  const { data } = await supabaseAdmin
    .from('profile_privacy')
    .select('account_is_private, show_location, allow_messages, allow_marketplace_contact')
    .eq('profile_id', userId)
    .maybeSingle()

  return data
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

function getListingViewsCount(listing: any, fallbackCount = 0) {
  if (typeof listing?.views_count === 'number') return listing.views_count
  if (typeof listing?.view_count === 'number') return listing.view_count
  return fallbackCount
}

async function incrementListingViewCount(listingId: string) {
  if (!listingId || !supabaseAdmin) {
    return incrementFallbackListingView(listingId)
  }

  try {
    const { data: currentListing, error: currentError } = await supabaseAdmin
      .from('listings')
      .select('id, views_count, view_count')
      .eq('id', listingId)
      .maybeSingle()

    if (currentError) {
      return incrementFallbackListingView(listingId)
    }

    if (!currentListing) {
      return incrementFallbackListingView(listingId)
    }

    const currentViews = typeof currentListing.views_count === 'number'
      ? currentListing.views_count
      : typeof currentListing.view_count === 'number'
        ? currentListing.view_count
        : 0

    const updatePayload = Object.prototype.hasOwnProperty.call(currentListing, 'views_count')
      ? { views_count: currentViews + 1 }
      : Object.prototype.hasOwnProperty.call(currentListing, 'view_count')
        ? { view_count: currentViews + 1 }
        : null

    if (!updatePayload) {
      return incrementFallbackListingView(listingId)
    }

    const { data, error } = await supabaseAdmin
      .from('listings')
      .update(updatePayload)
      .eq('id', listingId)
      .select('id, views_count, view_count')
      .maybeSingle()

    if (error) {
      return incrementFallbackListingView(listingId)
    }

    const updatedViews = typeof data?.views_count === 'number'
      ? data.views_count
      : typeof data?.view_count === 'number'
        ? data.view_count
        : currentViews + 1

    return { views_count: updatedViews }
  } catch {
    return incrementFallbackListingView(listingId)
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient()

  const params = await context.params
  const { data: viewerData } = await supabase.auth.getUser()
  const viewerUserId = viewerData?.user?.id

  const viewCountResult = await incrementListingViewCount(params.id)

  const { data: listing, error } = await supabase
    .from('listings')
    .select(`
      *,
      profiles (
        id,
        username,
        full_name,
        avatar_url,
        is_verified,
        street_score,
        created_at
      )
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  const privacy = listing?.user_id ? await getPrivacySettingsForUser(listing.user_id) : null
  const fallbackViewsCount = getFallbackListingViewCount(params.id)
  const normalizedListing = {
    ...applyPrivacyToListing(listing, viewerUserId, privacy),
    views_count: typeof viewCountResult?.views_count === 'number'
      ? viewCountResult.views_count
      : getListingViewsCount(listing, fallbackViewsCount),
  }

  return NextResponse.json({ listing: normalizedListing })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient()

  const params = await context.params
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData?.user
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

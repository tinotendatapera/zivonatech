import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'
import { getCachedValue, invalidateCache, setCachedValue } from '../../../lib/cache'
import { getBlockedUserIds, getFollowerCounts, getFollowedUserIds, isBlockedRelationship, sanitizeProfileForViewer } from '../../../lib/social-guards'
import { getAuthenticatedUserFromRequest } from '../../../lib/auth-session'

function sanitizeText(value?: string | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeUsername(value?: string | null) {
  const sanitized = (sanitizeText(value) ?? '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-')
  return sanitized.replace(/^-+|-+$/g, '')
}

function buildFallbackProfile({
  fallbackProfileId,
  fallbackUsername,
  fallbackFullName,
  email,
  privacySettings,
}: {
  fallbackProfileId: string
  fallbackUsername: string
  fallbackFullName: string
  email?: string | null
  privacySettings?: Record<string, unknown>
}) {
  return {
    id: fallbackProfileId,
    username: fallbackUsername,
    full_name: fallbackFullName,
    email,
    avatar_url: null,
    cover_url: null,
    bio: '',
    location: '',
    role: '',
    is_verified: false,
    followers: 0,
    following: 0,
    privacy_settings: privacySettings ?? {},
  }
}

function isSchemaFallbackError(message?: string) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('column') || normalized.includes('permission denied')
}

function normalizePrivacySettings(body?: any) {
  const privacy = body?.privacy_settings && typeof body.privacy_settings === 'object' ? body.privacy_settings : {}

  return {
    account_is_private: Boolean(privacy.account_is_private ?? body?.account_is_private ?? false),
    show_email: Boolean(privacy.show_email ?? body?.show_email ?? false),
    show_phone: Boolean(privacy.show_phone ?? body?.show_phone ?? false),
    show_location: Boolean(privacy.show_location ?? body?.show_location ?? true),
    allow_messages: Boolean(privacy.allow_messages ?? body?.allow_messages ?? true),
    allow_marketplace_contact: Boolean(privacy.allow_marketplace_contact ?? body?.allow_marketplace_contact ?? true),
  }
}

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
    }
  )
}

async function getPrivacySettingsForUser(userId: string) {
  const defaults = {
    account_is_private: false,
    show_email: false,
    show_phone: false,
    show_location: true,
    allow_messages: true,
    allow_marketplace_contact: true,
  }

  if (!supabaseAdmin) return defaults

  const { data, error } = await supabaseAdmin
    .from('profile_privacy')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle()

  if (error) {
    if (isSchemaFallbackError(error.message)) {
      return defaults
    }
    return defaults
  }

  if (!data) return defaults

  return {
    account_is_private: Boolean(data.account_is_private),
    show_email: Boolean(data.show_email),
    show_phone: Boolean(data.show_phone),
    show_location: Boolean(data.show_location),
    allow_messages: Boolean(data.allow_messages),
    allow_marketplace_contact: Boolean(data.allow_marketplace_contact),
  }
}

async function savePrivacySettingsForUser(userId: string, privacySettings: ReturnType<typeof normalizePrivacySettings>) {
  if (!supabaseAdmin) return null

  try {
    const { error } = await supabaseAdmin
      .from('profile_privacy')
      .upsert({
        profile_id: userId,
        ...privacySettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' })

    if (error && isSchemaFallbackError(error.message)) {
      return null
    }

    return error
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const dbClient = supabaseAdmin ?? supabase
  const cookieStore = await cookies()
  const ownerSessionCookie = cookieStore.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)

  let user = ownerSession?.user

  if (!user) {
    const authUser = await getAuthenticatedUserFromRequest(request, supabase as any)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = authUser
  }

  const { searchParams } = new URL(request.url)
  const requestedProfileId = searchParams.get('id') || searchParams.get('userId')
  const requestedUsername = searchParams.get('username')
  const targetUserId = requestedProfileId || requestedUsername || user.id
  const cacheKey = `profile:${targetUserId}:${user.id}`
  const cachedProfile = await getCachedValue<any>(cacheKey)
  if (cachedProfile) {
    return NextResponse.json({
      profile: cachedProfile,
      privacy_settings: cachedProfile.privacy_settings ?? {},
    })
  }

  let profileQuery = dbClient
  .from('profiles')
  .select('id, username, full_name, email, avatar_url, cover_url, bio, location, role, is_verified, created_at')

  if (requestedProfileId) {
    profileQuery = profileQuery.eq('id', requestedProfileId)
  } else if (requestedUsername) {
    profileQuery = profileQuery.eq('username', requestedUsername)
  } else {
    profileQuery = profileQuery.eq('id', user.id)
  }

  let profile: any = null
  let profileError: any = null

  try {
    const response = await profileQuery.maybeSingle()
    profile = response.data
    profileError = response.error
  } catch (error) {
    profileError = error
  }

  const privacySettings = await getPrivacySettingsForUser(profile?.id || targetUserId)
  const targetProfileId = profile?.id || targetUserId
  const isOwner = targetProfileId === user.id
  const [followerCounts, viewerBlockedIds, viewerFollowedIds] = await Promise.all([
    getFollowerCounts(targetProfileId),
    getBlockedUserIds(user.id),
    getFollowedUserIds(user.id),
  ])
  const isBlocked = viewerBlockedIds.has(targetProfileId) || Boolean(await isBlockedRelationship(user.id, targetProfileId, dbClient))
  const isFollowing = Boolean(viewerFollowedIds.includes(targetProfileId))

  if (!isOwner && isBlocked) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const fallbackProfileId = requestedProfileId || requestedUsername || user.id
  const fallbackUsername = sanitizeUsername(requestedUsername || user.user_metadata?.username || user.email?.split('@')[0]) || `user-${fallbackProfileId.slice(0, 8)}`
  const fallbackFullName = requestedProfileId || requestedUsername
    ? 'User profile'
    : (user.user_metadata?.full_name || user.email?.split('@')[0] || 'New user')

  if (profileError && !isSchemaFallbackError(profileError?.message)) {
    console.error('Profile lookup failed, using fallback profile', profileError)
  }

  const responseProfile = profile ?? buildFallbackProfile({
    fallbackProfileId,
    fallbackUsername,
    fallbackFullName,
    email: user.email,
    privacySettings,
  })

  const filteredProfile = sanitizeProfileForViewer(responseProfile, user.id, privacySettings, {
    isOwner,
    isFollowing,
    isBlocked,
  })
  const profileWithCounts = {
    ...filteredProfile,
    followers: followerCounts.followers,
    following: followerCounts.following,
  }

  const safePrivacySettings = isOwner ? privacySettings : {}
  await setCachedValue(cacheKey, { ...profileWithCounts, privacy_settings: safePrivacySettings }, 60_000)

  return NextResponse.json({
    profile: profileWithCounts,
    privacy_settings: safePrivacySettings,
  })
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient()

  const user = await getAuthenticatedUserFromRequest(request, supabase as any)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const fullName = sanitizeText(body.full_name) ?? sanitizeText(user.user_metadata?.full_name) ?? user.email?.split('@')[0] ?? 'New user'
  const username = sanitizeUsername(body.username ?? user.user_metadata?.username ?? user.email?.split('@')[0]) || `user-${user.id.slice(0, 8)}`
  const bio = sanitizeText(body.bio)
  const location = sanitizeText(body.location)
  const role = sanitizeText(body.role)
  const avatarUrl = sanitizeText(body.avatar_url)
  const coverUrl = sanitizeText(body.cover_url)
  const privacySettings = normalizePrivacySettings(body)

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        username,
        full_name: fullName,
        bio,
        location,
        role,
        avatar_url: avatarUrl,
        cover_url: coverUrl,
      },
      { onConflict: 'id' }
    )
    .select('id, username, full_name, email, avatar_url, cover_url, bio, location, role, is_verified, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await savePrivacySettingsForUser(user.id, privacySettings)
  await invalidateCache(`profile:${user.id}`)

  return NextResponse.json({ profile: { ...data, privacy_settings: privacySettings } })
}

import { supabaseAdmin } from './supabase'

export type PrivacySettings = Record<string, any>

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export async function getBlockedUserIds(viewerId?: string | null, client: any = supabaseAdmin) {
  const blockedIds = new Set<string>()

  if (!viewerId || !client) {
    return blockedIds
  }

  try {
    const { data, error } = await client
      .from('user_blocks')
      .select('blocker_id, blocked_user_id')
      .or(`blocker_id.eq.${viewerId},blocked_user_id.eq.${viewerId}`)

    if (error) {
      return blockedIds
    }

    for (const row of data ?? []) {
      if (row?.blocker_id && row.blocker_id !== viewerId) {
        blockedIds.add(String(row.blocker_id))
      }
      if (row?.blocked_user_id && row.blocked_user_id !== viewerId) {
        blockedIds.add(String(row.blocked_user_id))
      }
    }
  } catch {
    return blockedIds
  }

  return blockedIds
}

export async function isBlockedRelationship(viewerId?: string | null, targetId?: string | null, client: any = supabaseAdmin) {
  if (!viewerId || !targetId || !client) {
    return false
  }

  try {
    const { data, error } = await client
      .from('user_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${viewerId},blocked_user_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_user_id.eq.${viewerId})`)
      .maybeSingle()

    return !error && Boolean(data)
  } catch {
    return false
  }
}

export async function getFollowedUserIds(viewerId?: string | null, client: any = supabaseAdmin) {
  if (!viewerId || !client) {
    return []
  }

  try {
    const { data, error } = await client
      .from('follows')
      .select('followed_id')
      .eq('follower_id', viewerId)

    if (error) {
      return []
    }

    return (data ?? []).map((row: any) => String(row.followed_id)).filter(Boolean)
  } catch {
    return []
  }
}

export async function getFollowerCounts(profileId?: string | null, client: any = supabaseAdmin) {
  if (!profileId || !client) {
    return { followers: 0, following: 0 }
  }

  try {
    const [{ count: followerCount = 0 }, { count: followingCount = 0 }] = await Promise.all([
      client.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', profileId),
      client.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
    ])

    return {
      followers: Number(followerCount ?? 0),
      following: Number(followingCount ?? 0),
    }
  } catch {
    return { followers: 0, following: 0 }
  }
}

export function sanitizeProfileForViewer(
  profile: Record<string, any> | null | undefined,
  viewerId?: string | null,
  privacySettings?: PrivacySettings,
  options?: { isOwner?: boolean; isFollowing?: boolean; isBlocked?: boolean }
) {
  if (!profile || !isRecord(profile)) {
    return profile
  }

  const payload = { ...profile }
  const privacy = isRecord(privacySettings) ? privacySettings : {}
  const isOwner = Boolean(options?.isOwner)
  const isFollowing = Boolean(options?.isFollowing)
  const isPrivateProfile = Boolean(privacy.account_is_private) && !isOwner && !isFollowing

  if (options?.isBlocked) {
    return {
      ...payload,
      id: payload.id,
      username: 'private',
      full_name: 'Private profile',
      avatar_url: null,
      bio: null,
      location: null,
      email: null,
      role: null,
      privacy_settings: {},
    }
  }

  if (isPrivateProfile) {
    delete payload.email
    delete payload.phone
    delete payload.address
    delete payload.location
    delete payload.role
    delete payload.privacy_settings
  } else {
    if (!privacy.show_email) {
      delete payload.email
    }
    if (!privacy.show_location) {
      delete payload.location
    }
    if (!privacy.show_phone) {
      delete payload.phone
    }
    delete payload.address
    delete payload.privacy_settings
  }

  return payload
}

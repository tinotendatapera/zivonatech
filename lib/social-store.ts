interface StoryRecord {
  id: string
  user_id: string
  content: string
  created_at: string
  expires_at: string
  media_url?: string | null
  deleted?: boolean
}

interface SocialStore {
  likes: Record<string, string[]>
  views: Record<string, number>
  posts: Record<string, { content: string; deleted?: boolean }>
  comments: Record<string, { id: string; post_id?: string; user_id?: string; content: string; parent_comment_id?: string | null; created_at?: string; deleted?: boolean }>
  commentIdsByPost: Record<string, string[]>
  stories: StoryRecord[]
}

const socialStoreKey = '__zivona_social_store__'
const profileStorageKeyPrefix = '__zivona_profile_store__'
const followStorageKeyPrefix = '__zivona_follow_store__'
const activeAccountStorageKey = '__zivona_active_account__'

type StoredProfileData = {
  id?: string
  username?: string | null
  full_name?: string | null
  bio?: string | null
  location?: string | null
  role?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  followers?: number
  following?: number
  updated_at?: string
}

type FollowState = {
  followedUserIds: string[]
  updated_at?: string
}

type FollowRelationshipStore = {
  followers: string[]
  following: string[]
}

function getStore(): SocialStore {
  const globalScope = globalThis as typeof globalThis & { [socialStoreKey]?: SocialStore }
  if (!globalScope[socialStoreKey]) {
    globalScope[socialStoreKey] = {
      likes: {},
      views: {},
      posts: {},
      comments: {},
      commentIdsByPost: {},
      stories: [],
    }
  }

  return globalScope[socialStoreKey]!
}

function buildTargetKey(targetType: 'post' | 'comment', targetId: string) {
  return `${targetType}:${targetId}`
}

function getScopedStorageKey(prefix: string, userId?: string | null) {
  const explicitUserId = userId?.trim()
  const rememberedUserId = typeof window !== 'undefined'
    ? window.localStorage.getItem(activeAccountStorageKey)?.trim()
    : ''
  const normalizedUserId = explicitUserId || rememberedUserId || 'anonymous'

  if (typeof window !== 'undefined' && explicitUserId) {
    window.localStorage.setItem(activeAccountStorageKey, explicitUserId)
  }

  return `${prefix}:${normalizedUserId}`
}

function readBrowserJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const rawValue = window.localStorage.getItem(key)
    return rawValue ? (JSON.parse(rawValue) as T) : fallback
  } catch {
    return fallback
  }
}

function writeBrowserJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage write failures
  }
}

export function getStoredProfile(userId?: string | null): StoredProfileData | null {
  return readBrowserJson<StoredProfileData | null>(getScopedStorageKey(profileStorageKeyPrefix, userId), null)
}

export function saveStoredProfile(profile: StoredProfileData | null | undefined, userId?: string | null) {
  if (!profile) return null

  const storageKey = getScopedStorageKey(profileStorageKeyPrefix, userId)
  const existingProfile = readBrowserJson<StoredProfileData | null>(storageKey, null)
  const nextProfile = {
    ...(existingProfile ?? {}),
    ...profile,
    updated_at: new Date().toISOString(),
  }

  writeBrowserJson(storageKey, nextProfile)
  return nextProfile
}

export function clearStoredProfile(userId?: string | null) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getScopedStorageKey(profileStorageKeyPrefix, userId))
}

function getRelationshipStore(userId?: string | null): FollowRelationshipStore {
  const storageKey = getScopedStorageKey(followStorageKeyPrefix, userId)

  if (typeof window === 'undefined') {
    return { followers: [], following: [] }
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey)
    if (!rawValue) {
      return { followers: [], following: [] }
    }

    const parsed = JSON.parse(rawValue) as Partial<FollowRelationshipStore> & Partial<FollowState>
    return {
      followers: parsed.followers ?? [],
      following: parsed.following ?? [],
    }
  } catch {
    return { followers: [], following: [] }
  }
}

function writeRelationshipStore(store: FollowRelationshipStore, userId?: string | null) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getScopedStorageKey(followStorageKeyPrefix, userId), JSON.stringify(store))
  } catch {
    // ignore storage write failures
  }
}

export function getStoredFollowState(userId?: string | null): FollowState & { followersCount: number; followingCount: number } {
  const store = getRelationshipStore(userId)

  return {
    followedUserIds: store.following,
    followersCount: store.followers.length,
    followingCount: store.following.length,
  }
}

export function isStoredFollowingUser(userId: string, targetUserId: string) {
  return getStoredFollowState(userId).followedUserIds.includes(targetUserId)
}

export function toggleStoredFollowUser(currentUserId?: string | null, targetUserId?: string | null) {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
    const fallback = getStoredFollowState(currentUserId)
    return {
      followedUserIds: fallback.followedUserIds,
      isFollowing: false,
      followersCount: fallback.followersCount,
      followingCount: fallback.followingCount,
    }
  }

  const currentUserStore = getRelationshipStore(currentUserId)
  const targetUserStore = getRelationshipStore(targetUserId)
  const isFollowing = currentUserStore.following.includes(targetUserId)

  const nextFollowingForCurrentUser = isFollowing
    ? currentUserStore.following.filter((value) => value !== targetUserId)
    : [...currentUserStore.following, targetUserId]

  const nextFollowersForTargetUser = isFollowing
    ? targetUserStore.followers.filter((value) => value !== currentUserId)
    : [...targetUserStore.followers, currentUserId]

  const nextCurrentUserStore = { ...currentUserStore, following: nextFollowingForCurrentUser }
  const nextTargetUserStore = { ...targetUserStore, followers: nextFollowersForTargetUser }

  writeRelationshipStore(nextCurrentUserStore, currentUserId)
  writeRelationshipStore(nextTargetUserStore, targetUserId)

  return {
    followedUserIds: nextFollowingForCurrentUser,
    isFollowing: !isFollowing,
    followersCount: nextFollowersForTargetUser.length,
    followingCount: nextFollowingForCurrentUser.length,
  }
}

export async function getFallbackLikeState(targetType: 'post' | 'comment', targetId: string, userId: string) {
  const store = getStore()
  const key = buildTargetKey(targetType, targetId)
  const current = store.likes[key] ?? []
  return {
    liked: current.includes(userId),
    likes_count: current.length,
  }
}

export async function toggleFallbackLike(targetType: 'post' | 'comment', targetId: string, userId: string) {
  const store = getStore()
  const key = buildTargetKey(targetType, targetId)
  const current = store.likes[key] ?? []
  const liked = current.includes(userId)
  const nextUsers = liked
    ? current.filter((value) => value !== userId)
    : [...current, userId]

  store.likes[key] = nextUsers

  return {
    liked: !liked,
    likes_count: nextUsers.length,
  }
}

export async function incrementFallbackView(postId: string) {
  const store = getStore()
  const nextViews = (store.views[postId] ?? 0) + 1
  store.views[postId] = nextViews

  return { views_count: nextViews }
}

export async function incrementFallbackListingView(listingId: string) {
  const store = getStore()
  const nextViews = (store.views[`listing:${listingId}`] ?? 0) + 1
  store.views[`listing:${listingId}`] = nextViews

  return { views_count: nextViews }
}

export function getFallbackViewCount(postId: string) {
  const store = getStore()
  return store.views[postId] ?? 0
}

export function getFallbackListingViewCount(listingId: string) {
  const store = getStore()
  return store.views[`listing:${listingId}`] ?? 0
}

export async function updateFallbackPost(postId: string, content: string) {
  const store = getStore()
  store.posts[postId] = { content, deleted: false }
  return { id: postId, content }
}

export async function deleteFallbackPost(postId: string) {
  const store = getStore()
  store.posts[postId] = { content: '', deleted: true }
  return { success: true }
}

export async function createFallbackComment(postId: string, userId: string, content: string, parentCommentId?: string | null) {
  const store = getStore()
  const commentId = `fallback-comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()

  store.comments[commentId] = {
    id: commentId,
    post_id: postId,
    user_id: userId,
    content,
    parent_comment_id: parentCommentId ?? null,
    created_at: createdAt,
    deleted: false,
  }

  const currentIds = store.commentIdsByPost[postId] ?? []
  if (!currentIds.includes(commentId)) {
    store.commentIdsByPost[postId] = [...currentIds, commentId]
  }

  return {
    id: commentId,
    post_id: postId,
    user_id: userId,
    content,
    parent_comment_id: parentCommentId ?? null,
    created_at: createdAt,
    likes_count: 0,
    profiles: {
      id: userId,
      username: 'you',
      full_name: 'You',
      avatar_url: '',
      is_verified: false,
    },
  }
}

export async function getFallbackComments(postId: string) {
  const store = getStore()
  const commentIds = store.commentIdsByPost[postId] ?? []

  return commentIds
    .map((commentId) => store.comments[commentId])
    .filter(Boolean)
    .filter((comment) => !comment?.deleted)
    .map((comment) => ({
      id: comment!.id,
      post_id: comment!.post_id,
      user_id: comment!.user_id,
      content: comment!.content,
      parent_comment_id: comment!.parent_comment_id ?? null,
      created_at: comment!.created_at,
      likes_count: 0,
      profiles: {
        id: comment!.user_id,
        username: 'you',
        full_name: 'You',
        avatar_url: '',
        is_verified: false,
      },
    }))
    .sort((left, right) => (left.created_at ?? '').localeCompare(right.created_at ?? ''))
}

export async function updateFallbackComment(commentId: string, content: string) {
  const store = getStore()
  const existing = store.comments[commentId]
  store.comments[commentId] = {
    ...(existing ?? { id: commentId }),
    content,
    deleted: false,
  }
  return { id: commentId, content }
}

export async function deleteFallbackComment(commentId: string) {
  const store = getStore()
  const existing = store.comments[commentId]
  store.comments[commentId] = {
    ...(existing ?? { id: commentId }),
    content: '',
    deleted: true,
  }
  return { success: true }
}

export async function createFallbackStory(userId: string, content: string, mediaUrl?: string | null) {
  const store = getStore()
  const storyId = `fallback-story-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const story: StoryRecord = {
    id: storyId,
    user_id: userId,
    content,
    created_at: createdAt,
    expires_at: expiresAt,
    media_url: mediaUrl ?? null,
    deleted: false,
  }

  store.stories = [story, ...store.stories.filter((item) => item.id !== storyId)]

  return {
    ...story,
    profiles: {
      id: userId,
      username: 'you',
      full_name: 'You',
      avatar_url: '',
      is_verified: false,
    },
  }
}

export async function getFallbackStories() {
  const store = getStore()
  const now = new Date().toISOString()

  return store.stories
    .filter((story) => !story.deleted && story.expires_at > now)
    .sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''))
    .map((story) => ({
      ...story,
      profiles: {
        id: story.user_id,
        username: 'you',
        full_name: 'You',
        avatar_url: '',
        is_verified: false,
      },
    }))
}

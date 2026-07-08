/**
 * Real-time data fetching from Supabase
 * All demo/fake data has been removed - data is now fetched from the database
 */

import { supabaseClient } from './supabase'

export type User = {
  id: string
  name: string
  username: string
  color: string
  verified?: boolean
  role: string
  bio: string
  location: string
  followers: number
  following: number
  cover: string
  avatar_url?: string
}

export type Post = {
  id: string
  authorId: string
  time: string
  content: string
  image?: string
  tags?: string[]
  likes: number
  comments: number
  shares: number
  liked?: boolean
  bookmarked?: boolean
}

export type Product = {
  id: string
  title: string
  price: number
  category: string
  image: string
  images?: string[]
  location: string
  sellerId: string
  condition: string
  description: string
  featured?: boolean
  saved?: boolean
  createdAgo: string
}

export type Conversation = {
  id: string
  userId: string
  lastMessage: string
  time: string
  unread: number
  online: boolean
}

export type ChatMessage = {
  id: string
  conversationId: string
  fromMe: boolean
  text?: string
  image?: string
  time: string
}

export type NotificationItem = {
  id: string
  type: "like" | "comment" | "follow" | "marketplace" | "message" | "system"
  userId?: string
  text: string
  time: string
  read: boolean
}

// Brand gradient palette for initials avatars
const GRADS = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-violet-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-violet-600",
  "from-indigo-500 to-blue-600",
  "from-teal-500 to-emerald-600",
]

/**
 * Fetch all users from database
 */
export async function fetchUsers(): Promise<User[]> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return []
  }

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .order('followers', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching users:', error)
      return []
    }

    return data?.map((profile: any) => ({
      id: profile.id,
      name: profile.full_name || profile.username,
      username: profile.username,
      color: GRADS[Math.abs(profile.id.charCodeAt(0)) % GRADS.length],
      verified: profile.is_verified || false,
      role: profile.role || 'Creator',
      bio: profile.bio || '',
      location: profile.location || '',
      followers: profile.followers || 0,
      following: profile.following || 0,
      cover: profile.cover_image || '/images/covers/cover-1.png',
      avatar_url: profile.avatar_url,
    })) || []
  } catch (error) {
    console.error('Fetch users error:', error)
    return []
  }
}

/**
 * Fetch current authenticated user
 */
export async function fetchCurrentUser(): Promise<User | null> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return null
  }

  try {
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession()
    
    if (sessionError || !sessionData?.session?.user) {
      console.warn('No authenticated session')
      return null
    }

    const userId = sessionData.session.user.id
    
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      console.error('Error fetching current user:', error)
      return null
    }

    return {
      id: profile.id,
      name: profile.full_name || profile.username,
      username: profile.username,
      color: GRADS[Math.abs(profile.id.charCodeAt(0)) % GRADS.length],
      verified: profile.is_verified || false,
      role: profile.role || 'Creator',
      bio: profile.bio || '',
      location: profile.location || '',
      followers: profile.followers || 0,
      following: profile.following || 0,
      cover: profile.cover_image || '/images/covers/cover-1.png',
      avatar_url: profile.avatar_url,
    }
  } catch (error) {
    console.error('Fetch current user error:', error)
    return null
  }
}

/**
 * Fetch user by ID
 */
export async function fetchUserById(id: string): Promise<User | null> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return null
  }

  try {
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !profile) {
      return null
    }

    return {
      id: profile.id,
      name: profile.full_name || profile.username,
      username: profile.username,
      color: GRADS[Math.abs(profile.id.charCodeAt(0)) % GRADS.length],
      verified: profile.is_verified || false,
      role: profile.role || 'Creator',
      bio: profile.bio || '',
      location: profile.location || '',
      followers: profile.followers || 0,
      following: profile.following || 0,
      cover: profile.cover_image || '/images/covers/cover-1.png',
      avatar_url: profile.avatar_url,
    }
  } catch (error) {
    console.error('Fetch user by ID error:', error)
    return null
  }
}

/**
 * Fetch all posts
 */
export async function fetchPosts(): Promise<Post[]> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return []
  }

  try {
    const { data, error } = await supabaseClient
      .from('posts')
      .select(`
        *,
        author:author_id(id, full_name, username)
      `)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching posts:', error)
      return []
    }

    return data?.map((post: any) => ({
      id: post.id,
      authorId: post.author_id,
      time: formatTime(post.created_at),
      content: post.content,
      image: post.image_url,
      tags: post.tags || [],
      likes: post.likes_count || 0,
      comments: post.comments_count || 0,
      shares: post.shares_count || 0,
    })) || []
  } catch (error) {
    console.error('Fetch posts error:', error)
    return []
  }
}

/**
 * Fetch posts by user ID
 */
export async function fetchPostsByUserId(userId: string): Promise<Post[]> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return []
  }

  try {
    const { data, error } = await supabaseClient
      .from('posts')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user posts:', error)
      return []
    }

    return data?.map((post: any) => ({
      id: post.id,
      authorId: post.author_id,
      time: formatTime(post.created_at),
      content: post.content,
      image: post.image_url,
      tags: post.tags || [],
      likes: post.likes_count || 0,
      comments: post.comments_count || 0,
      shares: post.shares_count || 0,
    })) || []
  } catch (error) {
    console.error('Fetch user posts error:', error)
    return []
  }
}

/**
 * Fetch bookmarked posts
 */
export async function fetchBookmarkedPosts(): Promise<Post[]> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return []
  }

  try {
    const { data: sessionData } = await supabaseClient.auth.getSession()
    if (!sessionData?.session?.user?.id) return []

    const { data, error } = await supabaseClient
      .from('bookmarks')
      .select(`
        post:post_id(
          id,
          author_id,
          created_at,
          content,
          image_url,
          tags,
          likes_count,
          comments_count,
          shares_count
        )
      `)
      .eq('user_id', sessionData.session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bookmarks:', error)
      return []
    }

    return data?.map((bookmark: any) => {
      const post = bookmark.post
      return {
        id: post.id,
        authorId: post.author_id,
        time: formatTime(post.created_at),
        content: post.content,
        image: post.image_url,
        tags: post.tags || [],
        likes: post.likes_count || 0,
        comments: post.comments_count || 0,
        shares: post.shares_count || 0,
        bookmarked: true,
      }
    }) || []
  } catch (error) {
    console.error('Fetch bookmarks error:', error)
    return []
  }
}

/**
 * Fetch all listings/products
 */
export async function fetchListings(): Promise<Product[]> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return []
  }

  try {
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Error fetching listings:', error)
      return []
    }

    return data?.map((listing: any) => ({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      category: listing.category,
      image: listing.image_url,
      images: listing.images || [],
      location: listing.location || '',
      sellerId: listing.seller_id,
      condition: listing.condition || 'New',
      description: listing.description,
      featured: listing.is_featured || false,
      createdAgo: formatTime(listing.created_at),
    })) || []
  } catch (error) {
    console.error('Fetch listings error:', error)
    return []
  }
}

/**
 * Fetch listing by ID
 */
export async function fetchListingById(id: string): Promise<Product | null> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return null
  }

  try {
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      title: data.title,
      price: data.price,
      category: data.category,
      image: data.image_url,
      images: data.images || [],
      location: data.location || '',
      sellerId: data.seller_id,
      condition: data.condition || 'New',
      description: data.description,
      featured: data.is_featured || false,
      createdAgo: formatTime(data.created_at),
    }
  } catch (error) {
    console.error('Fetch listing error:', error)
    return null
  }
}

/**
 * Fetch trending topics from analytics
 */
export async function fetchTrendingTopics() {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return []
  }

  try {
    const { data, error } = await supabaseClient
      .from('trending_topics')
      .select('*')
      .order('post_count', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error fetching trending:', error)
      return []
    }

    return data?.map((topic: any) => ({
      tag: topic.tag,
      posts: `${formatCount(topic.post_count)} posts`,
    })) || []
  } catch (error) {
    console.error('Fetch trending error:', error)
    return []
  }
}

/**
 * Fetch user's real-time presence/online status
 */
export async function fetchUserPresence(userId: string): Promise<boolean> {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return false
  }

  try {
    const { data, error } = await supabaseClient
      .from('user_presence')
      .select('is_online')
      .eq('user_id', userId)
      .single()

    if (error) {
      return false
    }

    return data?.is_online || false
  } catch (error) {
    return false
  }
}

/**
 * Update user's online status (call when user becomes active/inactive)
 */
export async function updateUserPresence(userId: string, isOnline: boolean) {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return
  }

  try {
    await supabaseClient
      .from('user_presence')
      .upsert({
        user_id: userId,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
      })
  } catch (error) {
    console.error('Update presence error:', error)
  }
}

/**
 * Subscribe to real-time presence changes
 */
export function subscribeToPresence(userId: string, callback: (isOnline: boolean) => void) {
  if (!supabaseClient) {
    console.error('Supabase client not available (server context)')
    return null
  }

  const subscription = supabaseClient
    .channel(`presence:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_presence',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(Boolean((payload as { new?: { is_online?: boolean } }).new?.is_online))
      }
    )
    .subscribe()

  return subscription
}

// Utility functions
export const marketplaceCategories = [
  "All",
  "Fashion",
  "Electronics",
  "Home",
  "Beauty",
  "Art",
  "Vehicles",
  "Services",
]

// Stub/placeholder data for build-time compatibility
// NOTE: Components should fetch real data at runtime via API
export const users: User[] = []
export const posts: Post[] = []
export const products: Product[] = []
export const conversations: Conversation[] = []
export const notifications: NotificationItem[] = []
export const trendingTopics: Array<{ tag: string; posts: string }> = []
export const testimonials: any[] = []
export const stories: any[] = []

// Stub function for user lookup
export function userById_UNUSED_STUB(id: string): User | undefined {
  return undefined
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K"
  return String(n)
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
  
  return date.toLocaleDateString()
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

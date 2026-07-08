type FeedPost = {
  id: string
  user_id?: string
  created_at?: string
  content?: string
  image_url?: string
  likes_count?: number
  comments_count?: number
  views_count?: number
  shares_count?: number
  watch_time_ms?: number
  completion_rate?: number
  profiles?: {
    id?: string
    username?: string
    full_name?: string
    avatar_url?: string
    is_verified?: boolean
  }
  [key: string]: any
}

export function rankFeedPosts(posts: FeedPost[], currentUserId?: string, followedUserIds: string[] = []) {
  const followedSet = new Set(followedUserIds)
  const now = Date.now()

  const scoredPosts = posts
    .map((post) => {
      const createdAt = post.created_at ? new Date(post.created_at).getTime() : now
      const ageHours = Math.max(1, (now - createdAt) / (1000 * 60 * 60))
      const likes = Number(post.likes_count ?? 0)
      const comments = Number(post.comments_count ?? 0)
      const views = Number(post.views_count ?? 0)
      const shares = Number(post.shares_count ?? 0)
      const watchTimeMs = Number(post.watch_time_ms ?? 0)
      const completionRate = Number(post.completion_rate ?? 0)

      const engagementScore = likes * 1.4 + comments * 2.2 + views * 0.18 + shares * 2.8 + watchTimeMs / 60000 * 0.75 + completionRate * 3.2
      const followBoost = followedSet.has(post.user_id ?? '') ? 2.4 : 0
      const recencyBoost = ageHours < 6 ? 1.5 : ageHours < 24 ? 0.9 : 0.45
      const freshnessDecay = Math.exp(-ageHours / 24)
      const coldStartBoost = engagementScore < 3 ? 0.8 : 0
      const personalisationBoost = currentUserId && post.user_id === currentUserId ? 0.5 : 0
      const diversityBoost = post.group_post ? 0.4 : 0
      const score = engagementScore * 0.65 + followBoost + recencyBoost * 1.3 + freshnessDecay * 1.2 + coldStartBoost + personalisationBoost + diversityBoost

      return { ...post, score, ageHours }
    })
    .filter((post) => Boolean(post.id))

  const seenIds = new Set<string>()
  const seenContent = new Set<string>()

  const dedupedPosts = scoredPosts.filter((post) => {
    if (seenIds.has(post.id)) return false
    seenIds.add(post.id)

    const normalizedContent = `${post.content || ''}`.trim().toLowerCase()
    if (normalizedContent) {
      if (seenContent.has(normalizedContent)) return false
      seenContent.add(normalizedContent)
    }

    return true
  })

  const uniqueAuthors = new Set<string>()
  const diversified = dedupedPosts.sort((left, right) => right.score - left.score).reduce<FeedPost[]>((acc, post) => {
    const authorId = post.user_id || ''
    if (authorId && uniqueAuthors.size >= 3 && uniqueAuthors.has(authorId)) {
      return acc
    }
    if (authorId) {
      uniqueAuthors.add(authorId)
    }
    acc.push(post)
    return acc
  }, [])

  return diversified.sort((left, right) => right.score - left.score)
}

export function paginateFeedPosts(posts: FeedPost[], page = 1, limit = 20) {
  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedLimit = Math.min(50, Math.max(5, Number(limit) || 20))
  const start = (normalizedPage - 1) * normalizedLimit

  return {
    items: posts.slice(start, start + normalizedLimit),
    page: normalizedPage,
    limit: normalizedLimit,
    total: posts.length,
  }
}

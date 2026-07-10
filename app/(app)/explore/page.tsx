"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Sparkles, TrendingUp, MessageCircle, UserRoundPlus, Clock3, Send, Flame } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar } from "@/components/user-avatar"
import { useAuth } from "@/components/auth/auth-state"

type Topic = { tag: string; posts: string; score: number }
type Creator = {
  id: string
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  role?: string | null
  latestPostAt?: string | null
  postCount?: number
  is_verified?: boolean | null
}

const categoryMap: Array<{ key: 'news' | 'sports' | 'entertainment' | 'for-you'; label: string; keywords: string[] }> = [
  { key: 'for-you', label: 'For You', keywords: [] },
  { key: 'news', label: 'News', keywords: ['news', 'world', 'update', 'breaking', 'politics'] },
  { key: 'sports', label: 'Sports', keywords: ['sports', 'game', 'match', 'team', 'fitness'] },
  { key: 'entertainment', label: 'Entertainment', keywords: ['music', 'film', 'movie', 'tv', 'art', 'culture'] },
]

function getCategoryForTopic(tag: string) {
  const normalized = tag.replace(/^#/, '').toLowerCase()
  if (categoryMap.find((category) => category.key === 'news' && category.keywords.some((keyword) => normalized.includes(keyword)))) return 'news'
  if (categoryMap.find((category) => category.key === 'sports' && category.keywords.some((keyword) => normalized.includes(keyword)))) return 'sports'
  if (categoryMap.find((category) => category.key === 'entertainment' && category.keywords.some((keyword) => normalized.includes(keyword)))) return 'entertainment'
  return 'for-you'
}

function timeAgo(value?: string | null) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'for-you' | 'trending' | 'news' | 'sports' | 'entertainment'>('for-you')
  const [trendingTopics, setTrendingTopics] = useState<Topic[]>([])
  const [creatorPool, setCreatorPool] = useState<Creator[]>([])
  const [followingIds, setFollowingIds] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<{ users: any[]; posts: any[]; hashtags: string[] }>({ users: [], posts: [], hashtags: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadExplore() {
      try {
        const [trendsRes, postsRes, profilesRes, followsRes] = await Promise.all([
          fetch('/api/trending?hours=72'),
          fetch('/api/posts'),
          fetch('/api/profiles'),
          fetch('/api/follows?type=following'),
        ])

        if (trendsRes.ok) {
          const data = await trendsRes.json().catch(() => ({}))
          setTrendingTopics(Array.isArray(data.topics) ? data.topics : [])
        }

        const currentFollowing = followsRes.ok ? await followsRes.json().then((data) => (Array.isArray(data.following) ? data.following : [])).catch(() => []) : []
        setFollowingIds(currentFollowing)

        const postsData = postsRes.ok ? await postsRes.json().catch(() => ({})) : {}
        const profilesData = profilesRes.ok ? await profilesRes.json().catch(() => ({})) : {}

        const recentAuthors = new Map<string, Creator>()
        for (const post of Array.isArray(postsData.posts) ? postsData.posts : []) {
          const author = post.profiles || {}
          if (!author.id) continue
          if (String(author.id) === String(user?.id)) continue
          if (currentFollowing.includes(String(author.id))) continue

          const existing = recentAuthors.get(String(author.id))
          const nextPostCount = (existing?.postCount ?? 0) + 1
          recentAuthors.set(String(author.id), {
            id: String(author.id),
            username: author.username,
            full_name: author.full_name,
            avatar_url: author.avatar_url,
            is_verified: author.is_verified,
            role: author.role,
            bio: author.bio,
            latestPostAt: existing?.latestPostAt && existing.latestPostAt > post.created_at ? existing.latestPostAt : post.created_at,
            postCount: nextPostCount,
          })
        }

        for (const profile of Array.isArray(profilesData.profiles) ? profilesData.profiles : []) {
          if (!profile?.id) continue
          if (String(profile.id) === String(user?.id)) continue
          if (currentFollowing.includes(String(profile.id))) continue
          if (!recentAuthors.has(String(profile.id))) {
            recentAuthors.set(String(profile.id), {
              id: String(profile.id),
              username: profile.username,
              full_name: profile.full_name,
              avatar_url: profile.avatar_url,
              is_verified: profile.is_verified,
              role: profile.role,
              bio: profile.bio,
              latestPostAt: null,
              postCount: 0,
            })
          }
        }

        setCreatorPool(Array.from(recentAuthors.values()).slice(0, 12))
      } catch (error) {
        console.error('Error loading explore data:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadExplore()
  }, [user?.id])

  useEffect(() => {
    const query = search.trim()
    if (!query) {
      setSearchResults({ users: [], posts: [], hashtags: [] })
      return
    }

    const controller = new AbortController()
    async function searchExplore() {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setSearchResults({ users: data.users || [], posts: data.posts || [], hashtags: data.hashtags || [] })
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Explore search failed:', error)
        }
      }
    }

    void searchExplore()
    return () => controller.abort()
  }, [search])

  async function refreshFollowing() {
    try {
      const res = await fetch('/api/follows?type=following')
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      setFollowingIds(Array.isArray(data.following) ? data.following : [])
    } catch (error) {
      console.error('Error loading follow state:', error)
    }
  }

  const visibleTopics = useMemo(() => {
    const query = search.trim().toLowerCase()
    const selectedCategory = activeTab === 'for-you' || activeTab === 'trending' ? null : activeTab
    return trendingTopics.filter((topic) => {
      const topicCategory = getCategoryForTopic(topic.tag)
      const matchesCategory = !selectedCategory || topicCategory === selectedCategory
      const matchesQuery = !query || topic.tag.toLowerCase().includes(query)
      return matchesCategory && matchesQuery
    })
  }, [activeTab, search, trendingTopics])

  const visibleCreators = useMemo(() => {
    const query = search.trim().toLowerCase()
    const pool = creatorPool.filter((creator) => {
      const haystack = `${creator.full_name || ''} ${creator.username || ''} ${creator.bio || ''} ${creator.role || ''}`.toLowerCase()
      return !query || haystack.includes(query)
    })

    return pool.filter((creator) => !followingIds.includes(creator.id))
  }, [creatorPool, followingIds, search])

  const visibleCategories = useMemo(() => {
    const categories = new Map<string, { label: string; count: number; topic?: Topic }>()
    for (const topic of visibleTopics) {
      const category = getCategoryForTopic(topic.tag)
      const meta = categoryMap.find((entry) => entry.key === category)
      if (!meta) continue

      const existing = categories.get(category) || { label: meta.label, count: 0, topic: topic }
      categories.set(category, {
        label: meta.label,
        count: existing.count + 1,
        topic: existing.topic || topic,
      })
    }

    return Array.from(categories.entries()).map(([key, value]) => ({ key, ...value }))
  }, [visibleTopics])

  const suggestions = useMemo(() => {
    if (!search.trim()) return []
    const topicSuggestions = trendingTopics.filter((topic) => topic.tag.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 4)
    const creatorSuggestions = visibleCreators.filter((creator) => `${creator.full_name || ''} ${creator.username || ''}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 4)
    return [...topicSuggestions, ...creatorSuggestions]
  }, [search, trendingTopics, visibleCreators])

  async function handleMessageUser(userId: string) {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: userId }),
      })

      if (!res.ok) {
        console.error('Error creating conversation:', res.status, res.statusText)
        return
      }

      const data = await res.json().catch(() => ({}))
      if (data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    }
  }

  async function handleToggleFollow(userId: string) {
    if (!user?.id) return

    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: userId }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Unable to update follow state')
      }

      await refreshFollowing()
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  const selectedTabTopics = activeTab === 'trending' ? trendingTopics : visibleTopics

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              <Sparkles className="size-4" /> Discover creators and conversations
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Explore what’s moving across Zivona.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Search creators, products, and tags. Browse live trends and active accounts around your network.</p>
          </div>
          <div className="w-full max-w-xl space-y-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search creators, products, tags"
                className="h-8 border-0 bg-transparent px-0 shadow-none"
              />
            </div>
            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion: any) => (
                  <button
                    key={suggestion.tag || suggestion.id || suggestion.username}
                    onClick={() => setSearch(suggestion.tag || suggestion.username || suggestion.full_name || '')}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                  >
                    {suggestion.tag || suggestion.username || suggestion.full_name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="mt-6">
          <TabsList className="grid h-auto grid-cols-5 rounded-full bg-muted p-1">
            <TabsTrigger value="for-you" className="rounded-full">For You</TabsTrigger>
            <TabsTrigger value="trending" className="rounded-full">Trending</TabsTrigger>
            <TabsTrigger value="news" className="rounded-full">News</TabsTrigger>
            <TabsTrigger value="sports" className="rounded-full">Sports</TabsTrigger>
            <TabsTrigger value="entertainment" className="rounded-full">Entertainment</TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-6">
          <RailSection
            title="Trending topics"
            description={activeTab === 'news' ? 'Live news-related activity' : activeTab === 'sports' ? 'Live sports chatter' : activeTab === 'entertainment' ? 'Live entertainment chatter' : 'Ranked by recent post engagement'}
            icon={<TrendingUp className="size-4 text-primary" />}
          >
            {loading ? <RailSkeleton /> : selectedTabTopics.length > 0 ? selectedTabTopics.map((topic) => (
              <TopicCard key={topic.tag} topic={topic} />
            )) : <EmptyRail label="No live trending topics right now." />}
          </RailSection>

          <RailSection
            title="Creators to follow"
            description="Active users you do not already follow"
            icon={<UserRoundPlus className="size-4 text-primary" />}
          >
            {loading ? <RailSkeleton creator /> : visibleCreators.length > 0 ? visibleCreators.map((creator) => (
              <CreatorCard key={creator.id} creator={creator} onFollow={handleToggleFollow} onMessage={handleMessageUser} />
            )) : <EmptyRail label="No new creators available right now." />}
          </RailSection>

          <RailSection
            title="Popular categories"
            description="Trending content grouped by topic"
            icon={<Flame className="size-4 text-primary" />}
          >
            {loading ? <RailSkeleton category /> : visibleCategories.length > 0 ? visibleCategories.map((category) => (
              <CategoryCard key={category.key} category={category} />
            )) : <EmptyRail label="No category data yet." />}
          </RailSection>
        </div>

        <aside className="space-y-6">
          <Card className="border-border bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Quick search results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {search.trim() ? (
                searchResults.users.length || searchResults.posts.length || searchResults.hashtags.length ? (
                  <div className="space-y-3 text-sm">
                    {searchResults.hashtags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {searchResults.hashtags.slice(0, 8).map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                      </div>
                    ) : null}
                    <p className="text-muted-foreground">Found live matches across creators, posts, and tags.</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No results yet. Try a different creator, product, or tag.</p>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Start typing to search the live database.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Live activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTabTopics.slice(0, 4).map((topic) => (
                <div key={topic.tag} className="rounded-2xl border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium text-foreground">{topic.tag}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{topic.posts}</span>
                    <span>Score {topic.score}</span>
                  </div>
                </div>
              ))}
              {selectedTabTopics.length === 0 ? <p className="text-sm text-muted-foreground">No live activity in this section yet.</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function RailSection({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="border-border bg-background/80 shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-3 min-w-max">{children}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function RailSkeleton({ creator = false, category = false }: { creator?: boolean; category?: boolean }) {
  return (
    <>
      {[1, 2, 3].map((item) => (
        <div key={item} className="min-w-[240px] animate-pulse rounded-3xl border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
          <div className="mt-4 h-12 rounded-2xl bg-muted" />
        </div>
      ))}
    </>
  )
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <div className="min-w-[220px] rounded-3xl border border-border bg-muted/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{topic.tag}</p>
          <p className="text-xs text-muted-foreground">{topic.posts}</p>
        </div>
        <TrendingUp className="size-4 text-primary" />
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Engagement score</span>
        <span>{topic.score}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(20, topic.score))}%` }} />
      </div>
    </div>
  )
}

function CreatorCard({ creator, onFollow, onMessage }: { creator: Creator; onFollow: (userId: string) => void; onMessage: (userId: string) => void }) {
  return (
    <div className="min-w-[250px] rounded-3xl border border-border bg-muted/25 p-4">
      <div className="flex items-center gap-3">
        <UserAvatar user={{ id: creator.id, name: creator.full_name || creator.username || 'User', username: creator.username || 'user', avatar_url: creator.avatar_url || undefined }} size="md" ring />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{creator.full_name || 'Zivona User'}</div>
          <div className="truncate text-xs text-muted-foreground">@{creator.username || 'user'}</div>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{creator.bio || creator.role || 'Active creator on Zivona'}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        <span>{creator.latestPostAt ? `Active ${timeAgo(creator.latestPostAt)}` : 'No recent post date'}</span>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => onFollow(creator.id)} className="h-9 flex-1 rounded-full">
          Follow
        </Button>
        <Button variant="outline" onClick={() => onMessage(creator.id)} className="h-9 rounded-full px-3">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: { label: string; count: number; topic?: Topic } }) {
  return (
    <div className="min-w-[220px] rounded-3xl border border-border bg-muted/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{category.label}</p>
          <p className="text-xs text-muted-foreground">{category.count} live topics</p>
        </div>
        <Badge variant="secondary" className="rounded-full">Live</Badge>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{category.topic?.tag || 'No topic available yet'}</p>
    </div>
  )
}

function EmptyRail({ label }: { label: string }) {
  return <div className="min-w-[260px] rounded-3xl border border-dashed border-border bg-background/60 p-6 text-sm text-muted-foreground">{label}</div>
}

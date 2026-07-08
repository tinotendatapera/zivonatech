"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-state"
import { Search, Sparkles, TrendingUp, MessageCircle, Clock3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"
import { formatCount } from "@/lib/data"
import StoryCreator from "@/components/StoryCreator"

export default function ExplorePage() {
  const router = useRouter()
  const { user } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [trendingTopics, setTrendingTopics] = useState<any[]>([])
  const [stories, setStories] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [searchResults, setSearchResults] = useState<{ users: any[]; posts: any[]; hashtags: string[] }>({ users: [], posts: [], hashtags: [] })
  const [loading, setLoading] = useState(true)
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([])

  async function refreshFollowing() {
    try {
      const res = await fetch('/api/follows?type=following')
      if (!res.ok) return

      const data = await res.json().catch(() => ({}))
      setFollowedUserIds(Array.isArray(data.following) ? data.following : [])
    } catch (error) {
      console.error('Error loading follow state:', error)
    }
  }

  useEffect(() => {
    void refreshFollowing()
  }, [user?.id])

  async function refreshStories() {
    try {
      const res = await fetch('/api/stories')
      if (!res.ok) return

      const data = await res.json()
      setStories(data.stories || [])
    } catch (error) {
      console.error('Error refreshing stories:', error)
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, trendsRes, storiesRes] = await Promise.all([
          fetch('/api/profiles'),
          fetch('/api/trending'),
          fetch('/api/stories')
        ])

        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.profiles || [])
        }

        if (trendsRes.ok) {
          const data = await trendsRes.json()
          setTrendingTopics(data.topics || [])
        }

        if (storiesRes.ok) {
          const data = await storiesRes.json()
          setStories(data.stories || [])
        }

        await refreshFollowing()
      } catch (error) {
        console.error('Error loading explore data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const query = search.trim()
    if (!query) {
      return
    }

    const controller = new AbortController()
    async function searchExplore() {
      try {
        const [usersRes, trendsRes, searchRes] = await Promise.all([
          fetch(`/api/profiles?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
          fetch(`/api/trending?hours=24`, { signal: controller.signal }),
          fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }),
        ])
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.profiles || [])
        }
        if (trendsRes.ok) {
          const data = await trendsRes.json()
          setTrendingTopics(data.topics || [])
        }
        if (searchRes.ok) {
          const data = await searchRes.json()
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

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users

    return users.filter((profile) => {
      const haystack = `${profile.full_name || ''} ${profile.username || ''} ${profile.role || ''} ${profile.location || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [users, search])

  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []

    const byTopic = trendingTopics.filter((topic) => topic.tag.toLowerCase().includes(query)).slice(0, 3)
    const byUser = users.filter((profile) => `${profile.full_name || ''} ${profile.username || ''}`.toLowerCase().includes(query)).slice(0, 3)

    return [...byTopic, ...byUser]
  }, [search, trendingTopics, users])

  async function handleMessageUser(userId: string) {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: userId })
      })

      if (!res.ok) {
        console.error('Error creating conversation:', res.status, res.statusText)
        return
      }

      try {
        const data = await res.json()
        if (data.conversation_id) {
          router.push(`/messages/${data.conversation_id}`)
        }
      } catch (parseError) {
        console.error('Error parsing conversation response:', parseError)
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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
              <Sparkles className="size-4" /> Discover creators and products
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Explore what’s moving across Zivona.</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Search conversations, people, and products that match your interests.
            </p>
          </div>
          <div className="flex w-full max-w-md flex-col gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search creators, products, tags"
                className="h-8 border-0 bg-transparent px-0 shadow-none"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={`${suggestion.tag || suggestion.username || suggestion.id}`}
                      onClick={() => setSearch(suggestion.tag || suggestion.username || suggestion.full_name || '')}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
                    >
                      {suggestion.tag || suggestion.username || suggestion.full_name}
                    </button>
                  ))}
                </div>
              ) : null}
              <StoryCreator onStoryCreated={() => void refreshStories()} />
            </div>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {stories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Stories will appear here when they are shared.</p>
          ) : stories.map((story) => (
            <div key={story.id} className="rounded-2xl border border-border bg-muted/40 p-3 min-w-[180px]">
              <div className="flex items-center gap-2">
                <UserAvatar user={story.profiles || story} size="sm" />
                <div>
                  <div className="text-sm font-medium">{story.profiles?.full_name || 'Creator'}</div>
                  <div className="text-xs text-muted-foreground">{story.content?.slice(0, 48) || 'New story'}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3" /> Expires soon
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trending topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trendingTopics.map((topic) => (
              <div key={topic.tag} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  <span className="font-medium">{topic.tag}</span>
                </div>
                <span className="text-sm text-muted-foreground">{topic.posts}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Creators to follow</CardTitle>
            <Link href="/profile" className="text-sm text-primary">See all</Link>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {filteredUsers.slice(0, 4).map((user) => (
              <div key={user.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <UserAvatar user={user} size="sm" />
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">@{user.username}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{user.role}</p>
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span>{formatCount(user.followers)} followers</span>
                  <Badge variant="secondary">{user.location}</Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => handleMessageUser(user.id)}
                    variant="outline"
                    className="flex-1 justify-center rounded-xl"
                  >
                    <MessageCircle className="mr-2 size-4" /> Message
                  </Button>
                  <Button
                    variant={followedUserIds.includes(user.id) ? 'default' : 'secondary'}
                    className="rounded-xl"
                    onClick={() => handleToggleFollow(user.id)}
                  >
                    {followedUserIds.includes(user.id) ? 'Following' : 'Follow'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {search.trim() ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {searchResults.hashtags.length > 0 ? (
              <div>
                <div className="mb-2 text-sm font-medium">Hashtags</div>
                <div className="flex flex-wrap gap-2">
                  {searchResults.hashtags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {searchResults.users.length > 0 ? (
              <div>
                <div className="mb-2 text-sm font-medium">People</div>
                <div className="space-y-2">
                  {searchResults.users.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar user={profile} size="sm" />
                        <div>
                          <div className="text-sm font-medium">{profile.full_name || profile.username}</div>
                          <div className="text-xs text-muted-foreground">@{profile.username}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={`/profile/${encodeURIComponent(profile.id)}`} className="text-sm text-primary">View</Link>
                        <Button
                          size="sm"
                          variant={followedUserIds.includes(profile.id) ? 'default' : 'secondary'}
                          onClick={() => handleToggleFollow(profile.id)}
                        >
                          {followedUserIds.includes(profile.id) ? 'Following' : 'Follow'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {searchResults.posts.length > 0 ? (
              <div>
                <div className="mb-2 text-sm font-medium">Posts</div>
                <div className="space-y-2">
                  {searchResults.posts.map((post) => (
                    <div key={post.id} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                      {post.content?.slice(0, 140) || 'Shared post'}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Popular categories</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {['Design', 'Fashion', 'AI', 'Food', 'Music', 'Tech', 'Art'].map((item) => (
            <Button key={item} variant="outline" className="rounded-full">
              {item}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

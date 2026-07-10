"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Search, Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { SocialPostCard, type SocialPost } from "@/components/social/post-card"

export default function BookmarksPage() {
  const [savedPosts, setSavedPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function loadBookmarks() {
      try {
        const res = await fetch('/api/bookmarks')
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setSavedPosts(Array.isArray(data.bookmarks) ? data.bookmarks : [])
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadBookmarks()
  }, [])

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return savedPosts

    return savedPosts.filter((post) => {
      const author = post.author || post.profiles || {}
      const haystack = [post.content, author.full_name, author.username, ...(post.tags || [])].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [savedPosts, search])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
          <p className="text-sm text-muted-foreground">Saved posts from your live feed, filtered from the database only.</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/feed">Back to feed</Link>
        </Button>
      </div>

      <Card className="border-border bg-background/80 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bookmarked posts"
              className="h-8 border-0 bg-transparent px-0 shadow-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
            Loading bookmarks...
          </div>
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <SocialPostCard key={post.id} post={post} mode="feed" />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
            {savedPosts.length === 0 ? 'No bookmarked posts yet. Save posts from your feed to build a library here.' : 'No bookmarks match your search.'}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-3xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <span>Keep a curated library of ideas, inspiration, and products.</span>
        <Button asChild variant="ghost" className="h-auto px-0 text-primary">
          <Link href="/explore" className="inline-flex items-center gap-1">
            Explore more <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bookmark, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BookmarksPage() {
  const [savedPosts, setSavedPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadBookmarks() {
      try {
        const res = await fetch('/api/bookmarks')
        if (res.ok) {
          const data = await res.json()
          setSavedPosts(data.bookmarks || [])
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error)
      } finally {
        setLoading(false)
      }
    }

    loadBookmarks()
  }, [])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
          <p className="text-sm text-muted-foreground">Save what matters and come back to it later.</p>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/feed">Back to feed</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {savedPosts.length > 0 ? (
            savedPosts.map((post) => {
              const author = post.author || { full_name: 'Unknown', username: 'user' }
              return (
                <div key={post.bookmark_id || post.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{author.full_name || 'Unknown'}</div>
                      <div className="text-sm text-muted-foreground">{post.time || 'Recently'}</div>
                    </div>
                    <Bookmark className="size-4 text-primary" />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{post.content}</p>
                  {author.username ? (
                    <p className="mt-1 text-xs text-muted-foreground">@{author.username}</p>
                  ) : null}
                </div>
              )
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {loading ? 'Loading bookmarks...' : 'No saved posts yet. Bookmark a post from your feed to keep it handy.'}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
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

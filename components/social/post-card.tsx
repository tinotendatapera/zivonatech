"use client"

import Link from "next/link"
import { Bookmark, Heart, MessageCircle, Repeat2, Image as ImageIcon, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { UserAvatar, VerifiedBadge } from "@/components/user-avatar"
import { cn } from "@/lib/utils"

type PostAuthor = {
  id?: string | null
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  is_verified?: boolean | null
}

export type SocialPost = {
  id: string
  user_id?: string | null
  content?: string | null
  created_at?: string | null
  image_url?: string | null
  video_url?: string | null
  likes_count?: number | null
  comments_count?: number | null
  shares_count?: number | null
  reposts_count?: number | null
  bookmarked?: boolean
  profiles?: PostAuthor | null
  author?: PostAuthor | null
  tags?: string[] | null
}

type PostCardProps = {
  post: SocialPost
  mode?: "feed" | "compact"
  showBookmark?: boolean
  onBookmarkToggle?: (postId: string) => void | Promise<void>
  bookmarked?: boolean
}

function formatPostTime(value?: string | null) {
  if (!value) return 'Recently'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60_000))
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function profileHref(profileId?: string | null) {
  return profileId ? `/profile/${profileId}` : '#'
}

export function SocialPostCard({
  post,
  mode = 'feed',
  showBookmark = false,
  onBookmarkToggle,
  bookmarked,
}: PostCardProps) {
  const author = post.profiles ?? post.author ?? {}
  const displayName = author.full_name || 'Zivona User'
  const handle = author.username || 'user'
  const avatarUser = {
    id: author.id || post.user_id || post.id,
    name: displayName,
    username: handle,
    avatar_url: author.avatar_url || undefined,
    color: 'from-violet-600 to-blue-600',
  }

  const isCompact = mode === 'compact'
  const totalLikes = Number(post.likes_count ?? 0)
  const totalComments = Number(post.comments_count ?? 0)
  const totalShares = Number(post.shares_count ?? post.reposts_count ?? 0)
  const totalStats = totalLikes + totalComments + totalShares

  return (
    <Card className="overflow-hidden border-border bg-background/80 shadow-sm">
      <CardContent className={cn('p-4', isCompact && 'p-3')}>
        <div className="flex items-start gap-3">
          <Link href={profileHref(author.id)} className="shrink-0 transition hover:opacity-80">
            <UserAvatar user={avatarUser as any} size={isCompact ? 'sm' : 'md'} ring />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={profileHref(author.id)} className="truncate text-sm font-semibold text-foreground transition hover:text-primary">
                    {displayName}
                  </Link>
                  {author.is_verified ? <VerifiedBadge className="size-4" /> : null}
                  <span className="truncate text-xs text-muted-foreground">@{handle}</span>
                  <span className="text-xs text-muted-foreground">· {formatPostTime(post.created_at)}</span>
                </div>
                {post.tags?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0 text-[11px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
              {showBookmark ? (
                <button
                  type="button"
                  onClick={() => void onBookmarkToggle?.(post.id)}
                  className={cn(
                    'rounded-full p-2 transition hover:bg-primary/10 hover:text-primary',
                    bookmarked ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark post'}
                >
                  <Bookmark className="size-4" />
                </button>
              ) : null}
            </div>

            {post.content ? <p className={cn('mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/90', isCompact && 'text-[13px]')}>{post.content}</p> : null}

            {post.image_url ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/30">
                <img src={post.image_url} alt="Post attachment" className="max-h-[360px] w-full object-cover" />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Heart className="size-3.5" /> {totalLikes}</span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> {totalComments}</span>
              <span className="inline-flex items-center gap-1"><Repeat2 className="size-3.5" /> {totalShares}</span>
              <span className="inline-flex items-center gap-1"><Sparkles className="size-3.5" /> {totalStats}</span>
              {post.video_url ? <span className="inline-flex items-center gap-1"><ImageIcon className="size-3.5" /> Video</span> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

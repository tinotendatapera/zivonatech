"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar, VerifiedBadge } from "@/components/user-avatar"
import { useAuth } from "@/components/auth/auth-state"
import { SocialPostCard, type SocialPost } from "@/components/social/post-card"
import { formatCount } from "@/lib/data"
import { MapPin, Sparkles, CalendarDays, PencilLine } from "lucide-react"

type ProfileData = {
  id: string
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  bio?: string | null
  location?: string | null
  role?: string | null
  is_verified?: boolean | null
  followers?: number | null
  following?: number | null
  created_at?: string | null
}

type ProfileViewProps = {
  userId?: string | null
}

function formatJoinedDate(value?: string | null) {
  if (!value) return 'Joined recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Joined recently'
  return `Joined ${date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

export function ProfileView({ userId }: ProfileViewProps) {
  const { user } = useAuth()
  const targetUserId = userId || user?.id || ''
  const isOwnProfile = Boolean(user?.id && targetUserId && String(user.id) === String(targetUserId))

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [replies, setReplies] = useState<any[]>([])
  const [likes, setLikes] = useState<SocialPost[]>([])
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'likes'>('posts')
  const [editingBio, setEditingBio] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [savingBio, setSavingBio] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (!targetUserId) return

      setLoading(true)
      try {
        const [profileRes, postsRes, repliesRes, likesRes] = await Promise.all([
          fetch(targetUserId === user?.id || !userId ? '/api/profile' : `/api/profile?id=${encodeURIComponent(targetUserId)}`),
          fetch(`/api/posts?author_id=${encodeURIComponent(targetUserId)}`),
          fetch(`/api/posts/comments?user_id=${encodeURIComponent(targetUserId)}`),
          fetch(`/api/posts?liked_by=${encodeURIComponent(targetUserId)}`),
        ])

        if (profileRes.ok) {
          const profileData = await profileRes.json().catch(() => ({}))
          if (profileData.profile) {
            setProfile(profileData.profile)
            setBioDraft(profileData.profile.bio || '')
          }
        }

        if (postsRes.ok) {
          const postsData = await postsRes.json().catch(() => ({}))
          setPosts(Array.isArray(postsData.posts) ? postsData.posts : [])
        }

        if (repliesRes.ok) {
          const repliesData = await repliesRes.json().catch(() => ({}))
          setReplies(Array.isArray(repliesData.comments) ? repliesData.comments : [])
        }

        if (likesRes.ok) {
          const likesData = await likesRes.json().catch(() => ({}))
          setLikes(Array.isArray(likesData.posts) ? likesData.posts : [])
        }
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [targetUserId, user?.id, userId])

  const profileUser = useMemo(() => {
    if (!profile) return null

    return {
      id: profile.id,
      name: profile.full_name || profile.username || 'User',
      username: profile.username || 'user',
      avatar_url: profile.avatar_url || undefined,
      color: 'from-violet-600 to-blue-600',
    }
  }, [profile])

  async function handleSaveBio() {
    if (!isOwnProfile || !profile) return

    setSavingBio(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioDraft }),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.profile) {
          setProfile((current) => current ? { ...current, ...data.profile } : data.profile)
          setBioDraft(data.profile.bio || '')
          setEditingBio(false)
        }
      }
    } finally {
      setSavingBio(false)
    }
  }

  const mediaPosts = posts.filter((post) => Boolean(post.image_url || post.video_url))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <Card className="overflow-hidden border-border bg-background/80 shadow-sm">
        <div className="relative h-44 bg-gradient-to-r from-primary/35 via-brand-blue/20 to-accent/20">
          {profile?.cover_url ? <img src={profile.cover_url} alt="Profile cover" className="h-full w-full object-cover" /> : null}
        </div>
        <CardContent className="relative px-4 pb-4 pt-0 sm:px-6">
          <div className="-mt-11 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <UserAvatar user={profileUser as any} src={profile?.avatar_url || undefined} size="xl" ring className="border-4 border-background" />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">{profile?.full_name || 'User'}</h1>
                  {profile?.is_verified ? <VerifiedBadge className="size-5" /> : null}
                </div>
                <p className="text-sm text-muted-foreground">@{profile?.username || 'user'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isOwnProfile ? (
                <Button asChild className="rounded-full">
                  <Link href="/edit-profile">Edit Profile</Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground/90">{profile?.bio || 'No bio yet.'}</p>
                  </div>
                  {isOwnProfile ? (
                    <Button type="button" variant="ghost" className="h-8 rounded-full px-3 text-sm" onClick={() => setEditingBio((value) => !value)}>
                      <PencilLine className="mr-2 size-4" />
                      {editingBio ? 'Close' : 'Edit bio'}
                    </Button>
                  ) : null}
                </div>

                {isOwnProfile && editingBio ? (
                  <div className="mt-4 space-y-3">
                    <Textarea value={bioDraft} onChange={(event) => setBioDraft(event.target.value)} className="min-h-[120px] bg-background" placeholder="Tell people about yourself" />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditingBio(false)}>
                        Cancel
                      </Button>
                      <Button type="button" className="rounded-full" onClick={() => void handleSaveBio()} disabled={savingBio}>
                        {savingBio ? 'Saving...' : 'Save bio'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Sparkles className="size-4" /> {profile?.role || 'Creator'}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-4" /> {profile?.location || 'Location not set'}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" /> {formatJoinedDate(profile?.created_at)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <div className="rounded-3xl border border-border bg-background/70 p-4">
                  <div className="text-2xl font-semibold tracking-tight text-foreground">{formatCount(profile?.followers ?? 0)}</div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                </div>
                <div className="rounded-3xl border border-border bg-background/70 p-4">
                  <div className="text-2xl font-semibold tracking-tight text-foreground">{formatCount(profile?.following ?? 0)}</div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Card className="border-border bg-background/70">
                <CardContent className="space-y-3 p-4">
                  <Button asChild variant="outline" className="w-full justify-start rounded-full">
                    <Link href="/messages">Open messages</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start rounded-full">
                    <Link href="/explore">Discover creators</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start rounded-full">
                    <Link href="/bookmarks">Saved posts</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-4">
        <TabsList className="grid h-auto grid-cols-4 rounded-full bg-muted p-1">
          <TabsTrigger value="posts" className="rounded-full">Posts</TabsTrigger>
          <TabsTrigger value="replies" className="rounded-full">Replies</TabsTrigger>
          <TabsTrigger value="media" className="rounded-full">Media</TabsTrigger>
          <TabsTrigger value="likes" className="rounded-full">Likes</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading posts...</div> : posts.length > 0 ? posts.map((post) => <SocialPostCard key={post.id} post={post} />) : <EmptyState label="No posts yet." />}
        </TabsContent>

        <TabsContent value="replies" className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading replies...</div> : replies.length > 0 ? replies.map((reply) => <ReplyCard key={reply.id} reply={reply} />) : <EmptyState label="No replies yet." />}
        </TabsContent>

        <TabsContent value="media" className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading media...</div> : mediaPosts.length > 0 ? mediaPosts.map((post) => <SocialPostCard key={post.id} post={post} />) : <EmptyState label="No media posts yet." />}
        </TabsContent>

        <TabsContent value="likes" className="space-y-3">
          {loading ? <div className="text-sm text-muted-foreground">Loading likes...</div> : likes.length > 0 ? likes.map((post) => <SocialPostCard key={post.id} post={post} />) : <EmptyState label="No liked posts yet." />}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">{label}</div>
}

function ReplyCard({ reply }: { reply: any }) {
  const author = reply.profiles || {}
  return (
    <Card className="border-border bg-background/80 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <UserAvatar user={{ id: author.id, name: author.full_name || author.username, username: author.username, avatar_url: author.avatar_url }} size="sm" ring />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">{author.full_name || 'Zivona User'}</span>
              <span className="text-muted-foreground">@{author.username || 'user'}</span>
              <span className="text-muted-foreground">· {reply.created_at ? new Date(reply.created_at).toLocaleDateString() : 'Recently'}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-foreground/90">{reply.content}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

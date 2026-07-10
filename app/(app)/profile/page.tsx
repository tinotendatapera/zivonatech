"use client"

import Link from "next/link"
import { MapPin, Sparkles, UserRoundPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-state"
import { formatCount } from "@/lib/data"
import { getStoredProfile, saveStoredProfile } from "@/lib/social-store"

function ProfilePageContent() {
  const { user } = useAuth()
  const requestedUserId = user?.id || null
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [recentPosts, setRecentPosts] = useState<any[]>([])
  const [followers, setFollowers] = useState(0)
  const [following, setFollowing] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  
  const profileUser = useMemo(() => {
    const resolvedName = displayName || (user?.userMetadata?.full_name ? String(user.userMetadata.full_name) : user?.email || 'User')
    const resolvedUsername = username || (user?.userMetadata?.username ? String(user.userMetadata.username) : 'user')
    const resolvedRole = role || (user?.userMetadata?.role ? String(user.userMetadata.role) : 'member')

    return {
      name: resolvedName,
      username: resolvedUsername,
      role: resolvedRole,
      bio,
      location,
      followers,
      following,
      cover: coverUrl || '',
    }
  }, [coverUrl, user, bio, displayName, followers, following, location, role, username])

  async function refreshFollowingState() {
    if (!user?.id) return

    try {
      const res = await fetch('/api/follows?type=following')
      if (!res.ok) return

      const data = await res.json().catch(() => ({}))
      const followingIds = Array.isArray(data.following) ? data.following : []
      setIsFollowing(followingIds.includes(requestedUserId || user.id))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const loadProfile = async () => {
      const targetUserId = requestedUserId || user?.id
      const storedProfile = !requestedUserId ? getStoredProfile(user?.id) : null
      if (storedProfile) {
        setAvatarUrl(storedProfile.avatar_url || null)
        setCoverUrl(storedProfile.cover_url || null)
        setDisplayName(storedProfile.full_name || '')
        setUsername(storedProfile.username || '')
        setRole(storedProfile.role || '')
        setBio(storedProfile.bio || '')
        setLocation(storedProfile.location || '')
        setFollowers(storedProfile.followers || 0)
        setFollowing(storedProfile.following || 0)
      }

      try {
        const profileUrl = requestedUserId ? `/api/profile?id=${encodeURIComponent(requestedUserId)}` : '/api/profile'
        const res = await fetch(profileUrl)
        const data = await res.json()
        if (data.profile) {
          setAvatarUrl(data.profile.avatar_url || null)
          setCoverUrl(data.profile.cover_url || null)
          setDisplayName(data.profile.full_name || '')
          setUsername(data.profile.username || '')
          setRole(data.profile.role || '')
          setBio(data.profile.bio || '')
          setLocation(data.profile.location || '')
          setFollowers(data.profile.followers || 0)
          setFollowing(data.profile.following || 0)
          saveStoredProfile(data.profile, targetUserId)
        }

        await refreshFollowingState()

        const postsRes = await fetch('/api/posts')
        if (postsRes.ok) {
          const postsData = await postsRes.json().catch(() => ({}))
          const allPosts = Array.isArray(postsData.posts) ? postsData.posts : []
          setRecentPosts(
            allPosts
              .filter((post: any) => String(post.user_id) === String(targetUserId))
              .sort((left: any, right: any) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
              .slice(0, 3)
          )
        }
      } catch {
        // ignore
      }
    }

    void loadProfile()
  }, [requestedUserId, user?.id])

  async function handleToggleFollow() {
    if (!user?.id) return

    const targetUserId = requestedUserId || user.id

    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Unable to update follow state')
      }

      setIsFollowing(Boolean(data.following))
      if (data.counts) {
        setFollowers(Number(data.counts.followers ?? 0))
        setFollowing(Number(data.counts.following ?? 0))
      }

      await refreshFollowingState()
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <Card className="overflow-hidden">
        <div className="h-36 bg-gradient-to-r from-primary/30 via-brand-blue/20 to-accent/20">
          {coverUrl ? (
            <img src={coverUrl} alt="Profile cover" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <CardContent className="relative px-4 pb-4 sm:px-6">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3">
              <UserAvatar user={profileUser as any} src={avatarUrl || undefined} size="xl" ring />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">{profileUser.name}</h1>
                  <Badge variant="secondary">Verified</Badge>
                </div>
                <p className="text-sm text-muted-foreground">@{profileUser.username}</p>
              </div>
            </div>
            {user?.id && user.id !== requestedUserId ? (
              <Button className="rounded-full" onClick={handleToggleFollow}>
                <UserRoundPlus className="size-4" />
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-sm text-muted-foreground">{profileUser.bio}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="size-4" /> {profileUser.location}</span>
                <span className="inline-flex items-center gap-1"><Sparkles className="size-4" /> {profileUser.role}</span>
              </div>
            </div>
            <div className="flex gap-4 rounded-2xl border border-border bg-muted/50 p-3 text-sm">
              <div>
                <div className="font-semibold">{formatCount(profileUser.followers)}</div>
                <div className="text-muted-foreground">Followers</div>
              </div>
              <div>
                <div className="font-semibold">{formatCount(profileUser.following)}</div>
                <div className="text-muted-foreground">Following</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentPosts.length > 0 ? (
                recentPosts.map((post) => (
                  <div key={post.id} className="rounded-xl border border-border p-3">
                    <div className="text-sm text-muted-foreground">{post.time || post.created_at}</div>
                    <p className="mt-1 text-sm">{post.content}</p>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">No posts yet</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-start rounded-xl">
              <Link href="/messages">Open messages</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start rounded-xl">
              <Link href="/marketplace">View marketplace</Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start rounded-xl">
              <Link href="/settings">Account settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="mx-auto flex max-w-5xl px-4 py-8 text-sm text-muted-foreground">Loading profile...</div>}>
      <ProfilePageContent />
    </Suspense>
  )
}

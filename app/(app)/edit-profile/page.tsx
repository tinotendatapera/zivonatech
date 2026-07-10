"use client"

import { Camera, Save, Upload, ImagePlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-state"
// Current user data will be fetched via API
import { UserAvatar } from "@/components/user-avatar"
import { getStoredProfile, saveStoredProfile } from "@/lib/social-store"
import { supabase } from "@/supabase"

export default function EditProfilePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const profileUser = useMemo(() => ({
    id: user?.id || '',
    name: displayName,
    username,
    role,
    bio,
    location,
    avatar_url: avatarUrl,
    cover: coverUrl || '/images/covers/cover-1.png',
    color: 'from-violet-600 to-blue-600',
    followers: 0,
    following: 0,
    verified: false,
  }), [avatarUrl, bio, coverUrl, displayName, location, role, username, user?.id])

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return
      setLoading(true)

      const storedProfile = getStoredProfile(user?.id)
      if (storedProfile) {
        setDisplayName(storedProfile.full_name || '')
        setUsername(storedProfile.username || '')
        setBio(storedProfile.bio || '')
        setLocation(storedProfile.location || '')
        setRole(storedProfile.role || '')
        setAvatarUrl(storedProfile.avatar_url || null)
        setCoverUrl(storedProfile.cover_url || null)
      }

      try {
        const res = await fetch('/api/profile')
        if (!res.ok) {
          console.error('Error loading profile:', res.status, res.statusText)
          return
        }

        const data = await res.json()
        if (data.profile) {
          const nextProfile = data.profile
          setDisplayName(nextProfile.full_name || '')
          setUsername(nextProfile.username || '')
          setBio(nextProfile.bio || '')
          setLocation(nextProfile.location || '')
          setRole(nextProfile.role || '')
          setAvatarUrl(nextProfile.avatar_url || null)
          setCoverUrl(nextProfile.cover_url || null)
          saveStoredProfile(nextProfile, user?.id)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadProfile()
  }, [user?.id])

  async function saveProfileToServer(profilePayload: {
    full_name: string
    username: string
    bio: string
    location: string
    role: string
    avatar_url: string | null
    cover_url: string | null
  }, options?: { successMessage?: string; errorMessage?: string }) {
    if (!user?.id) return false

    saveStoredProfile(profilePayload, user?.id)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload),
      })

      let data: any = null
      try {
        data = await res.json()
      } catch (error) {
        console.error('Error parsing save profile response:', error)
      }

      if (!res.ok || data?.error) {
        setStatus(options?.errorMessage || 'Saved locally. Server sync needs a working Supabase session.')
        return false
      }

      saveStoredProfile({ ...(profilePayload as any), ...(data?.profile || {}) }, user?.id)
      if (options?.successMessage) {
        setStatus(options.successMessage)
      }
      return true
    } catch (error: any) {
      setStatus(options?.errorMessage || error.message || 'Saved locally. Please try again when the server is reachable.')
      return false
    }
  }

  async function uploadImage(file: File, type: 'avatar' | 'cover') {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData,
    })

    let data: any = null
    try {
      data = await res.json()
    } catch (error) {
      console.error('Error parsing upload response:', error)
    }

    if (!res.ok || data?.error) {
      throw new Error(data?.error || 'Upload failed')
    }

    const nextAvatarUrl = type === 'avatar' ? data.url : avatarUrl
    const nextCoverUrl = type === 'cover' ? data.url : coverUrl
    const profilePayload = {
      full_name: displayName,
      username,
      bio,
      location,
      role,
      avatar_url: nextAvatarUrl,
      cover_url: nextCoverUrl,
    }

    if (type === 'avatar') {
      setAvatarUrl(nextAvatarUrl)
    } else {
      setCoverUrl(nextCoverUrl)
    }

    await saveProfileToServer(profilePayload, {
      successMessage: type === 'avatar' ? 'Profile photo uploaded successfully' : 'Cover photo uploaded successfully',
      errorMessage: 'Image uploaded locally, but profile sync needs a working Supabase session.',
    })
  }

  async function removeImage(type: 'avatar' | 'cover') {
    const nextAvatarUrl = type === 'avatar' ? null : avatarUrl
    const nextCoverUrl = type === 'cover' ? null : coverUrl

    if (type === 'avatar') {
      setAvatarUrl(nextAvatarUrl)
    } else {
      setCoverUrl(nextCoverUrl)
    }

    await saveProfileToServer({
      full_name: displayName,
      username,
      bio,
      location,
      role,
      avatar_url: nextAvatarUrl,
      cover_url: nextCoverUrl,
    }, {
      successMessage: type === 'avatar' ? 'Profile photo removed' : 'Cover photo removed',
      errorMessage: 'Image removal was saved locally, but the server sync needs a working Supabase session.',
    })
  }

  async function handleSave() {
    if (!user?.id) return
    setSaving(true)
    setStatus(null)

    const profilePayload = {
      full_name: displayName,
      username,
      bio,
      location,
      role,
      avatar_url: avatarUrl,
      cover_url: coverUrl,
    }

    try {
      const success = await saveProfileToServer(profilePayload, {
        successMessage: 'Profile updated successfully',
        errorMessage: 'Saved locally. Server sync needs a working Supabase session.',
      })

      if (!success) {
        setStatus('Saved locally. Server sync needs a working Supabase session.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit profile</h1>
        <p className="text-sm text-muted-foreground">Update your cover, bio, and visible details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar user={profileUser as any} src={avatarUrl || undefined} size="lg" ring />
                <div>
                  <div className="font-medium">Profile photo</div>
                  <div className="text-sm text-muted-foreground">Choose a clear image that represents you.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium">
                  <ImagePlus className="size-4" />
                  Upload avatar
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void uploadImage(file, 'avatar')
                    }}
                  />
                </label>
                {avatarUrl ? (
                  <button onClick={() => void removeImage('avatar')} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
                    <Trash2 className="size-4" /> Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">Cover photo</div>
                <div className="text-sm text-muted-foreground">Add a polished backdrop that reflects your brand.</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium">
                  <Camera className="size-4" />
                  Upload cover
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void uploadImage(file, 'cover')
                    }}
                  />
                </label>
                {coverUrl ? (
                  <button onClick={() => void removeImage('cover')} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground">
                    <Trash2 className="size-4" /> Remove
                  </button>
                ) : null}
              </div>
            </div>
            {coverUrl ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-border">
                <img src={coverUrl} alt="Cover preview" className="h-32 w-full object-cover" />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Display name</label>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Username</label>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Bio</label>
            <Textarea value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-28" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Location</label>
              <Input value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Role</label>
              <Input value={role} onChange={(event) => setRole(event.target.value)} />
            </div>
          </div>

          {status ? (
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              {status}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button className="rounded-full" onClick={handleSave} disabled={saving || loading}>
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

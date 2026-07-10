"use client"

import { Suspense } from "react"
import { ProfileView } from "@/components/social/profile-view"

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="mx-auto flex max-w-5xl px-4 py-8 text-sm text-muted-foreground">Loading profile...</div>}>
      <ProfileView />
    </Suspense>
  )
}

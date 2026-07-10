"use client"

import { Suspense } from "react"
import { use } from "react"
import { ProfileView } from "@/components/social/profile-view"

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)

  return (
    <Suspense fallback={<div className="mx-auto flex max-w-5xl px-4 py-8 text-sm text-muted-foreground">Loading profile...</div>}>
      <ProfileView userId={userId} />
    </Suspense>
  )
}

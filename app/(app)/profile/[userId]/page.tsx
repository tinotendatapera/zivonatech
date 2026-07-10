import { Suspense } from "react"
import { ProfileView } from "@/components/social/profile-view"

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params

  return (
    <Suspense fallback={<div className="mx-auto flex max-w-5xl px-4 py-8 text-sm text-muted-foreground">Loading profile...</div>}>
      <ProfileView userId={userId} />
    </Suspense>
  )
}

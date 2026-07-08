import Image from "next/image"
import { BadgeCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { initials, type User } from "@/lib/data"

const sizeMap: Record<string, string> = {
  xs: "size-7 text-[10px]",
  sm: "size-9 text-xs",
  md: "size-11 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-2xl",
}

type AvatarUser = Partial<User> & {
  name?: string
  username?: string
  avatar?: string
  avatar_url?: string
  color?: string
}

type AvatarProps = {
  user?: AvatarUser
  name?: string
  color?: string
  src?: string
  size?: keyof typeof sizeMap
  className?: string
  ring?: boolean
}

export function UserAvatar({
  user,
  name,
  color,
  src,
  size = "md",
  className,
  ring,
}: AvatarProps) {
  const displayName = user?.name ?? user?.username ?? name ?? "User"
  const gradient = user?.color ?? color ?? "from-violet-600 to-blue-600"
  const avatarSrc = src ?? user?.avatar_url ?? user?.avatar

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-semibold text-white select-none",
        gradient,
        size ? sizeMap[size] : null,
        ring && "ring-2 ring-background",
        className,
      )}
    >
      {avatarSrc ? (
        <Image
          src={avatarSrc || "/placeholder.svg"}
          alt={displayName}
          fill
          className="object-cover"
        />
      ) : (
        initials(displayName)
      )}
    </span>
  )
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      className={cn("text-primary fill-primary/15", className)}
      aria-label="Verified"
    />
  )
}

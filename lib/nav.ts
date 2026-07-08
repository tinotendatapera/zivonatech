import {
  Home,
  Compass,
  ShoppingBag,
  MessageCircle,
  Bell,
  Bookmark,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  badge?: number
}

export const mainNav: NavItem[] = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { label: "Messages", href: "/messages", icon: MessageCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  { label: "Profile", href: "/profile", icon: User },
]

export const bottomNav: NavItem[] = [
  { label: "Home", href: "/feed", icon: Home },
  { label: "Explore", href: "/explore", icon: Compass },
  { label: "Sell", href: "/marketplace", icon: ShoppingBag },
  { label: "Chats", href: "/messages", icon: MessageCircle },
  { label: "Profile", href: "/profile", icon: User },
]

export const settingsNav: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
}

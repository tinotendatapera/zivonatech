"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, PenSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/user-avatar"
import { useCompose } from "@/components/app/compose-provider"
import { mainNav, settingsNav } from "@/lib/nav"
import { useAuth } from "@/components/auth/auth-state"
import { initials } from "@/lib/data"
import LanguageSwitcher from "@/components/ui/language-switcher"

export function AppSidebar() {
  const pathname = usePathname()
  const { open } = useCompose()
  const { user, signOut } = useAuth()
  const items = [...mainNav, settingsNav]

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-sidebar/95 px-4 py-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] lg:flex">
      <Link href="/feed" className="px-2">
        <Logo />
      </Link>

      <div className="mt-3 px-2">
        <LanguageSwitcher />
      </div>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/feed" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}

        <Button onClick={open} className="mt-4 rounded-xl" size="lg">
          <PenSquare className="size-4" />
          Create post
        </Button>
      </nav>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border p-2.5">
        <UserAvatar user={user ? { id: user.id, name: user.email || 'User', username: user.email || 'user', color: 'from-violet-600 to-blue-600' } : undefined} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{user?.email || 'User'}</div>
          <div className="truncate text-xs text-muted-foreground">
            {user ? "Signed in" : "Sign in"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Log out"
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  )
}

"use client"

import Link from "next/link"
import { Bell, Search } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import LanguageSwitcher from "@/components/ui/language-switcher"

export function MobileTopbar() {
  return (
    <header className="glass sticky top-0 z-40 flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
      <Link href="/feed" aria-label="Zivona home">
        <Logo size="sm" />
      </Link>
      <div className="flex items-center gap-1">
        <Link
          href="/explore"
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Search className="size-5" />
        </Link>
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary" />
        </Link>
        <ThemeToggle />
        <div className="hidden sm:flex">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}

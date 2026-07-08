"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { bottomNav } from "@/lib/nav"

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {bottomNav.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/feed" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <item.icon className="size-6" />
              {item.badge ? (
                <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
                  {item.badge}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

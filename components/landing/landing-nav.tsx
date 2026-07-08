"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { ZivonaLogo } from "@/components/brand/logo"

const links = [
  { label: "Features", href: "#features" },
  { label: "Marketplace", href: "#showcase" },
  { label: "Testimonials", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
]

export function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:pt-4">
      <div className="glass mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-border/60 px-3 py-2.5 shadow-sm">
        <Link href="/" className="pl-1">
          <ZivonaLogo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button
            asChild
            variant="ghost"
            className="hidden h-10 px-4 sm:inline-flex"
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="h-10 px-5">
            <Link href="/register">Get started</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="glass mx-auto mt-2 max-w-6xl rounded-2xl border border-border/60 p-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-border/60 px-1 pt-2">
            <Button asChild variant="outline" className="h-10 flex-1">
              <Link href="/login">Log in</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  )
}

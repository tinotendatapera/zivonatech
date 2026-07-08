import Link from "next/link"
import type { ReactNode } from "react"
import { Logo } from "@/components/brand/logo"

const highlights = [
  "Share your story with a beautiful feed",
  "Sell products in a built-in marketplace",
  "Message customers and collaborators",
]

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden brand-gradient p-12 text-primary-foreground lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-background/10 blur-2xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_42%)]" />
        <Link href="/">
          <Logo className="text-primary-foreground" />
        </Link>
        <div>
          <h2 className="text-balance text-4xl font-bold leading-tight tracking-tight">
            Create. Connect. Grow.
          </h2>
          <ul className="mt-8 space-y-3">
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="flex size-6 items-center justify-center rounded-full bg-background/20 text-sm">
                  ✓
                </span>
                {h}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">
          © {new Date().getFullYear()} Zivona Technologies
        </p>
      </div>

      <div className="flex items-center justify-center bg-background/80 p-6 sm:p-10">
        <div className="w-full max-w-sm rounded-3xl border border-border/70 bg-card/80 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.35)] sm:p-8">
          <div className="mb-8 lg:hidden">
            <Link href="/">
              <Logo />
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

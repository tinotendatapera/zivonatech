"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Showcase() {
  return (
    <section className="bg-secondary/40 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Loved by creators across the continent
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Join a growing community turning their passion into a living.
          </p>
        </div>

        <div className="mt-14 rounded-3xl border border-border/70 bg-card/80 p-8 text-left shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Live platform</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">Built around real community activity, not placeholder content.</h3>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Every post, message, listing, and profile update flows through your Supabase project so the experience stays connected to the database.
          </p>
        </div>

        <div className="mt-16 overflow-hidden rounded-3xl brand-gradient p-10 text-center text-primary-foreground md:p-16">
          <h3 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
            Ready to create, connect, and grow?
          </h3>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-lg leading-relaxed text-primary-foreground/85">
            It&apos;s free to get started. Build your presence and your business
            on Zivona today.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 rounded-full bg-background text-foreground hover:bg-background/90"
          >
            <Link href="/register">Create your account</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

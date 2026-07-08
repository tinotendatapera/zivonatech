"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const stats = [
  { label: "Creators", value: "120K+" },
  { label: "Products listed", value: "48K+" },
  { label: "Countries", value: "30+" },
]

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-brand-emerald/10 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-16 md:grid-cols-2 md:pb-24 md:pt-24">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-3 py-1 text-sm text-muted-foreground shadow-sm"
          >
            <Sparkles className="size-3.5 text-primary" />
            Africa&apos;s all-in-one super-app
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 text-pretty text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl"
          >
            Create. Connect. <span className="text-gradient">Grow.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mt-5 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            One platform to share your story, build your network, and sell what
            you make. Social, marketplace, and messaging — powered by Zivona.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.18 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" className="rounded-full">
              <Link href="/register">
                Get started free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/feed">Explore the app</Link>
            </Button>
          </motion.div>

          <div className="mt-10 flex flex-wrap gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-sm">
                <div className="text-xl font-bold tracking-tight">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="relative"
        >
          <div className="animate-float overflow-hidden rounded-3xl border border-border shadow-2xl shadow-primary/10">
            <Image
              src="/images/hero-people.png"
              alt="People using Zivona"
              width={720}
              height={880}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="glass absolute -bottom-5 -left-5 hidden rounded-2xl border border-border p-4 shadow-lg sm:block">
            <div className="text-sm font-medium">New sale</div>
            <div className="text-xs text-muted-foreground">Ankara Tote — ₦18,500</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

"use client"

import { motion } from "framer-motion"
import {
  Users,
  ShoppingBag,
  MessageCircle,
  Sparkles,
  ShieldCheck,
  Globe2,
} from "lucide-react"
import { Card } from "@/components/ui/card"

const features = [
  {
    icon: Users,
    title: "Social feed",
    desc: "Share posts, follow creators, and build community with a feed that puts your story first.",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    desc: "List products in minutes and reach buyers across the continent with secure checkout.",
  },
  {
    icon: MessageCircle,
    title: "Real-time chat",
    desc: "Message friends, customers, and collaborators without ever leaving the app.",
  },
  {
    icon: Sparkles,
    title: "AI assistant",
    desc: "Draft posts, write product descriptions, and get smart suggestions powered by AI.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & safety",
    desc: "Verified profiles and protected payments keep every interaction safe.",
  },
  {
    icon: Globe2,
    title: "Built for Africa",
    desc: "Local currencies, languages, and payment methods designed for the way you work.",
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Everything you need in one place
        </h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          Zivona brings together the tools creators and entrepreneurs use every
          day — no more juggling five different apps.
        </p>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: i * 0.05 }}
          >
            <Card className="group h-full rounded-2xl border-border/70 bg-card/80 p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

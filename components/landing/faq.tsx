"use client"

import { ChevronDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const faqs = [
  {
    question: "What makes Zivona different?",
    answer: "It combines social publishing, marketplace commerce, and messaging in one premium experience designed for creators and entrepreneurs.",
  },
  {
    question: "Can I use it on mobile?",
    answer: "Yes. The experience is optimized for phones, tablets, laptops, and large screens with responsive layouts and touch-friendly interactions.",
  },
  {
    question: "Is it suitable for businesses?",
    answer: "Absolutely. Verified profiles, trusted transactions, and a polished interface are built for both personal brands and growing companies.",
  },
  {
    question: "Do you support dark mode?",
    answer: "Yes. Zivona includes a polished light and dark mode experience with consistent tokens and accessibility-friendly contrast.",
  },
]

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">Frequently asked questions</h2>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          A clean and thoughtful product experience with the questions founders and creators ask most.
        </p>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        {faqs.map((item) => (
          <Card key={item.question} className="rounded-2xl border-border">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
              <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

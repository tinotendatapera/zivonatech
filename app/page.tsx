import { LandingNav } from "@/components/landing/landing-nav"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { Showcase } from "@/components/landing/showcase"
import { FAQ } from "@/components/landing/faq"
import { LandingFooter } from "@/components/landing/landing-footer"

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <Showcase />
        <FAQ />
      </main>
      <LandingFooter />
    </div>
  )
}

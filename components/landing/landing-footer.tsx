import Link from "next/link"
import { ZivonaLogo } from "@/components/brand/logo"

const columns = [
  {
    title: "Product",
    links: ["Social Feed", "Marketplace", "Messaging", "Zivona AI", "Jobs"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Press", "Blog", "Contact"],
  },
  {
    title: "Resources",
    links: ["Help Center", "Community", "Developers", "Status", "Guides"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Cookies", "Licenses", "Security"],
  },
]

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <ZivonaLogo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Africa&apos;s all-in-one digital ecosystem. Create. Connect. Grow.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Zivona Technologies
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l}>
                    <Link
                      href="#"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Zivona Technologies. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with care across the continent.
          </p>
        </div>
      </div>
    </footer>
  )
}

import Image from "next/image"
import { cn } from "@/lib/utils"

export function ZivonaMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative inline-flex items-center justify-center overflow-hidden rounded-xl shadow-sm", className)} aria-hidden="true">
      <Image src="/zivona.png" alt="Zivona logo" width={96} height={96} className="h-full w-full object-contain" priority />
    </div>
  )
}

const sizes = {
  sm: { mark: "size-10", text: "text-base" },
  md: { mark: "size-12", text: "text-lg" },
  lg: { mark: "size-16", text: "text-2xl" },
}

export function Logo({
  className,
  size = "md",
  showText = true,
}: {
  className?: string
  size?: keyof typeof sizes
  showText?: boolean
}) {
  const s = sizes[size]
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ZivonaMark className={s.mark} />
      {showText && (
        <span className={cn("font-semibold tracking-tight", s.text)}>Zivona</span>
      )}
    </span>
  )
}

export const ZivonaLogo = Logo

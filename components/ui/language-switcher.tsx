"use client"

import { useI18n } from "@/lib/i18n"
import { useState } from "react"

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <div className={className}>
      <select
        aria-label={t('Language')}
        value={locale}
        onChange={(e) => setLocale(e.target.value as any)}
        className="rounded-full border border-border bg-transparent px-3 py-1 text-sm"
      >
        <option value="en">English</option>
        <option value="sn-ZLS">ZLS</option>
      </select>
    </div>
  )
}

export default LanguageSwitcher

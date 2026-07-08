"use client"

import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import en from "../locales/en.json"
import sn from "../locales/sn-ZLS.json"

type Locale = "en" | "sn-ZLS"

const LOCALE_KEY = "zivona_locale"

const messages: Record<Locale, Record<string, string>> = {
  en,
  "sn-ZLS": sn,
}

const I18nContext = createContext({
  locale: "en" as Locale,
  setLocale: (l: Locale) => {},
  t: (k: string) => k,
})

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem(LOCALE_KEY)
      return (stored as Locale) || "en"
    } catch {
      return "en"
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_KEY, locale)
    } catch {}
  }, [locale])

  const setLocale = (l: Locale) => setLocaleState(l)

  const t = useMemo(() => {
    return (key: string) => {
      return messages[locale]?.[key] ?? messages.en[key] ?? key
    }
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export default I18nProvider

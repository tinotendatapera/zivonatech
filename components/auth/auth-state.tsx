"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/supabase"

type AuthUser = {
  id: string
  email: string | null
  userMetadata?: Record<string, unknown>
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (!isMounted) return
      setUser(
        data.session?.user
          ? {
              id: data.session.user.id,
              email: data.session.user.email ?? null,
              userMetadata: data.session.user.user_metadata,
            }
          : null,
      )
      setLoading(false)
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      setUser(
        session?.user
          ? {
              id: session.user.id,
              email: session.user.email ?? null,
              userMetadata: session.user.user_metadata,
            }
          : null,
      )
      setLoading(false)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const router = useRouter()

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signOut: async () => {
      const { error } = await supabase.auth.signOut()
      if (!error) {
        router.push("/login")
      }
    },
  }), [user, loading, router])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }
  return context
}

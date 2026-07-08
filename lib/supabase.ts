/**
 * Supabase Client Configuration
 * Demo/fake credentials removed - using only real Supabase authentication
 */

import { createClient } from "@supabase/supabase-js"
import { supabase as sharedSupabase } from "../supabase"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, "") ?? ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""
const isBrowser = typeof window !== "undefined"

export const OWNER_SESSION_COOKIE_NAME = "zivona-owner-session"

/**
 * Client-side Supabase client
 * Reuses the shared browser client to avoid duplicate GoTrueClient instances.
 */
export const supabaseClient = isBrowser ? sharedSupabase : null

/**
 * Server-side Supabase admin client
 * Uses service role key for admin operations (server-only)
 */
export const supabaseAdmin = !isBrowser && supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

/**
 * Get current authenticated user
 * Returns null if not authenticated
 */
export async function getCurrentAuthUser() {
  if (!supabaseClient) {
    console.error("Supabase not configured")
    return null
  }

  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser()
    if (error) throw error
    return user
  } catch (error) {
    console.error("Get user error:", error)
    return null
  }
}

/**
 * Get current session
 * Returns null if not authenticated
 */
export async function getCurrentSession() {
  if (!supabaseClient) {
    console.error("Supabase not configured")
    return null
  }

  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession()
    if (error) throw error
    return session
  } catch (error) {
    console.error("Get session error:", error)
    return null
  }
}

/**
 * Sign in with email and password (real authentication)
 */
export async function signInWithEmail(email: string, password: string) {
  if (!supabaseClient) {
    throw new Error("Supabase not configured")
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}

export async function setSessionCookie(session: { access_token: string; refresh_token: string }) {
  if (typeof window !== "undefined") return

  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  cookieStore.set("zivona-owner-session", encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

/**
 * Sign up with email and password (real authentication)
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  options?: { data?: Record<string, unknown> }
) {
  if (!supabaseClient) {
    throw new Error("Supabase not configured")
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: options || {
      data: {
        username: email.split("@")[0],
        full_name: "",
      },
    },
  })

  if (error) throw error
  return data
}

/**
 * Sign out current user
 */
export async function signOut() {
  if (!supabaseClient) {
    throw new Error("Supabase not configured")
  }

  const { error } = await supabaseClient.auth.signOut()
  if (error) throw error
}

/**
 * Reset password with email link
 */
export async function resetPassword(email: string) {
  if (!supabaseClient) {
    throw new Error("Supabase not configured")
  }

  const redirectOrigin = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${redirectOrigin}/auth/reset-password`,
  })

  if (error) throw error
  return data
}

/**
 * Update password with recovery token
 */
export async function updatePassword(password: string) {
  if (!supabaseClient) {
    throw new Error("Supabase not configured")
  }

  const { data, error } = await supabaseClient.auth.updateUser({
    password,
  })

  if (error) throw error
  return data
}

/**
 * Parse owner session cookie (if needed)
 */
export function parseOwnerSessionCookie(cookieValue?: string | null) {
  if (!cookieValue) return null

  try {
    return JSON.parse(decodeURIComponent(cookieValue))
  } catch {
    return null
  }
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/supabase"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [pending2FA, setPending2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setLoading(true)

    try {
      if (pending2FA) {
        const res = await fetch('/api/auth/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', code: twoFactorCode }),
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Invalid verification code')
        }

        toast.success('Two-factor authentication verified')
        router.push('/feed')
        return
      }

      const trimmedIdentifier = identifier.trim()
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedIdentifier)
      let emailToUse = trimmedIdentifier

      if (!isEmail) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('email, username')
          .or(`username.eq.${trimmedIdentifier},email.eq.${trimmedIdentifier}`)
          .maybeSingle()

        if (profileError) throw profileError
        if (!profileData?.email) {
          throw new Error('We could not find an account for that username or email.')
        }
        emailToUse = profileData.email
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password })

      if (error?.status === 400 || error?.message?.toLowerCase().includes('invalid')) {
        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'login-failed', metadata: { identifier: trimmedIdentifier } }),
        })
      }

      if (error) throw error

      if (data.session) {
        const twoFactorStatusRes = await fetch('/api/auth/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        })
        const twoFactorStatusData = await twoFactorStatusRes.json().catch(() => ({}))

        if (twoFactorStatusRes.ok && twoFactorStatusData?.enabled) {
          setPending2FA(true)
          setTwoFactorCode("")
          toast.success('Two-factor authentication is required to continue.')
          return
        }

        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'login-success', metadata: { identifier: trimmedIdentifier } }),
        })
        toast.success("Welcome back to Zivona")
        router.push("/feed")
      } else {
        toast.error("Unable to sign in right now.")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in right now."
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="identifier">Email or username</Label>
        <Input
          id="identifier"
          type="text"
          required
          placeholder="you@example.com or yourusername"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {pending2FA ? (
        <div className="space-y-2">
          <Label htmlFor="twoFactorCode">Two-factor authentication code</Label>
          <Input
            id="twoFactorCode"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={twoFactorCode}
            onChange={(event) => setTwoFactorCode(event.target.value)}
          />
        </div>
      ) : null}

      <Button type="submit" className="w-full rounded-lg" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : pending2FA ? 'Verify code' : 'Sign in'}
      </Button>
    </form>
  )
}

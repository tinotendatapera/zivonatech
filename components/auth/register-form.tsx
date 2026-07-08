"use client"

import { useState } from "react"
import { useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/supabase"

export function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [form, setForm] = useState({
    first: "",
    last: "",
    username: "",
    email: "",
    password: "",
    dateOfBirth: "",
  })
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  useEffect(() => {
    if (status === "success") {
      router.push("/feed")
    }
  }, [router, status])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setStatus("idle")

    try {
      if (!acceptedTerms) {
        toast.error("You must accept the Terms of Service and Privacy Policy to continue.")
        setStatus("error")
        return
      }

      if (!form.dateOfBirth) {
        toast.error("Please provide your date of birth so we can apply age-appropriate safety settings.")
        setStatus("error")
        return
      }

      const fullName = [form.first, form.last].filter(Boolean).join(" ").trim()
      const birthDate = new Date(form.dateOfBirth)
      const age = new Date().getFullYear() - birthDate.getFullYear()
      const isMinor = age < 18
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: fullName,
            username: form.username,
            date_of_birth: form.dateOfBirth,
            is_minor: isMinor,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/auth/callback`,
        },
      })

      if (!error && data.user) {
        await supabase.from("profiles").insert({
          id: data.user.id,
          username: form.username,
          email: form.email,
          full_name: fullName,
        })

        await supabase.from("user_profiles_extended").upsert({
          user_id: data.user.id,
          date_of_birth: form.dateOfBirth,
          age_verified: true,
          is_minor: isMinor,
          safety_flags: isMinor ? { restricted_features: ['direct_messages_from_strangers', 'marketplace_transactions', 'public_profile_visibility'] } : {},
        }, { onConflict: 'user_id' })

        await fetch('/api/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accepted: true, version: 'v1' }),
        })
      }

      if (error) {
        if (error.message.includes("rate limit") || error.message.includes("over_email_send_rate_limit")) {
          toast.error("Supabase is rate-limiting email signups right now. Please try again in a few minutes or use another email.")
          setStatus("error")
          return
        }
        throw error
      }

      if (data.session) {
        await fetch('/api/analytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'signup-success', metadata: { email: form.email } }),
        })
        toast.success("Account created. Welcome to Zivona!")
        setStatus("success")
      } else {
        toast.success("Account created. Please check your email to confirm your account.")
        router.push("/login")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create your account right now."
      toast.error(message)
      setStatus("error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="first">First name</Label>
          <Input
            id="first"
            required
            placeholder="Amara"
            value={form.first}
            onChange={(event) => setForm((prev) => ({ ...prev, first: event.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last">Last name</Label>
          <Input
            id="last"
            required
            placeholder="Okafor"
            value={form.last}
            onChange={(event) => setForm((prev) => ({ ...prev, last: event.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          required
          placeholder="amaracreates"
          value={form.username}
          onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dob">Date of birth</Label>
        <Input
          id="dob"
          type="date"
          required
          value={form.dateOfBirth}
          onChange={(event) => setForm((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
        />
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm text-muted-foreground">
        <Checkbox checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(Boolean(checked))} />
        <span>
          I accept the Terms of Service and Privacy Policy, and I understand that age-appropriate safety settings may apply based on the birth date provided.
        </span>
      </label>

      <Button type="submit" className="w-full rounded-lg" disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : "Create account"}
      </Button>

      {status === "error" ? (
        <p className="text-center text-xs text-amber-600">
          If email confirmation is blocked, try again later or use a different email.
        </p>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        By signing up you agree to Zivona&apos;s Terms of Service and Privacy
        Policy.
      </p>
    </form>
  )
}

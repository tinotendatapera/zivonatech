"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { toast } from "sonner"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState("")

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (!res.ok) {
        throw new Error('Unable to send reset instructions right now.')
      }

      toast.success('If that account exists, a reset link was sent.')
      setSent(true)
    } catch (error: any) {
      toast.error(error.message || 'Unable to send reset instructions right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-border bg-secondary/40 p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-emerald/15 text-brand-emerald">
            <MailCheck className="size-6" />
          </div>
          <p className="mt-4 font-medium">Check your inbox</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;ve sent a password reset link to your email address.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <Button type="submit" className="w-full rounded-lg" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

"use client"

import { Bell, Lock, MoonStar, ShieldCheck, Smartphone, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/components/auth/auth-state"
import { supabase } from "@/supabase"

export default function SettingsPage() {
  const { user } = useAuth()
  const [privacy, setPrivacy] = useState({
    accountIsPrivate: false,
    showEmail: false,
    showLocation: true,
    allowMessages: true,
    allowMarketplaceContact: true,
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [twoFactorState, setTwoFactorState] = useState({
    enabled: false,
    loading: false,
    secret: '',
    recoveryCodes: [] as string[],
    code: '',
    pendingSetup: false,
  })

  const profileUser = useMemo(() => ({
    name: user?.userMetadata?.full_name ? String(user.userMetadata.full_name) : user?.email || 'User',
    username: user?.userMetadata?.username ? String(user.userMetadata.username) : 'user',
    role: user?.userMetadata?.role ? String(user.userMetadata.role) : 'member',
  }), [user])

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('Unable to load privacy settings')
        const data = await res.json()
        const settings = data?.profile?.privacy_settings ?? data?.privacy_settings ?? {}
        setPrivacy({
          accountIsPrivate: Boolean(settings.account_is_private),
          showEmail: Boolean(settings.show_email),
          showLocation: Boolean(settings.show_location),
          allowMessages: Boolean(settings.allow_messages),
          allowMarketplaceContact: Boolean(settings.allow_marketplace_contact),
        })
      } catch (error) {
        console.error('Unable to load privacy settings', error)
        setStatus('Unable to load your privacy settings. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    async function loadTwoFactorStatus() {
      if (!user?.id) return

      try {
        const res = await fetch('/api/auth/2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        })
        const data = await res.json().catch(() => ({}))
        setTwoFactorState((current) => ({ ...current, enabled: Boolean(data?.enabled), loading: false }))
      } catch (error) {
        console.error('Unable to load 2FA status', error)
      }
    }

    void loadProfile()
    void loadTwoFactorStatus()
  }, [user?.id])

  async function handleSavePrivacy() {
    if (!user?.id) return
    setSaving(true)
    setStatus(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacy_settings: {
            account_is_private: privacy.accountIsPrivate,
            show_email: privacy.showEmail,
            show_location: privacy.showLocation,
            allow_messages: privacy.allowMessages,
            allow_marketplace_contact: privacy.allowMarketplaceContact,
          },
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Unable to save privacy settings')
      }
      setStatus('Privacy settings updated')
    } catch (error: any) {
      setStatus(error.message || 'Unable to save privacy settings')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetupTwoFactor() {
    setTwoFactorState((current) => ({ ...current, loading: true, pendingSetup: true }))

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Unable to start 2FA setup')
      }

      setTwoFactorState((current) => ({
        ...current,
        secret: data.secret || '',
        recoveryCodes: data.recoveryCodes || [],
        pendingSetup: true,
        loading: false,
      }))
      setStatus('Scan the QR code in your authenticator app and enter the six-digit code below.')
    } catch (error: any) {
      setStatus(error.message || 'Unable to start 2FA setup')
      setTwoFactorState((current) => ({ ...current, loading: false, pendingSetup: false }))
    }
  }

  async function handleVerifyTwoFactor() {
    if (!twoFactorState.code.trim()) return
    setTwoFactorState((current) => ({ ...current, loading: true }))

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', code: twoFactorState.code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Unable to verify 2FA code')
      }

      setTwoFactorState((current) => ({ ...current, enabled: true, pendingSetup: false, loading: false, code: '' }))
      setStatus('Two-factor authentication enabled.')
    } catch (error: any) {
      setStatus(error.message || 'Unable to verify 2FA code')
      setTwoFactorState((current) => ({ ...current, loading: false }))
    }
  }

  async function handleDisableTwoFactor() {
    setTwoFactorState((current) => ({ ...current, loading: true }))

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Unable to disable 2FA')
      }

      setTwoFactorState((current) => ({ ...current, enabled: false, secret: '', recoveryCodes: [], pendingSetup: false, loading: false, code: '' }))
      setStatus('Two-factor authentication disabled.')
    } catch (error: any) {
      setStatus(error.message || 'Unable to disable 2FA')
      setTwoFactorState((current) => ({ ...current, loading: false }))
    }
  }

  async function handleSetPassword() {
    if (!password.trim()) {
      setPasswordStatus('Please enter a password.')
      return
    }
    if (password !== confirmPassword) {
      setPasswordStatus('Passwords do not match.')
      return
    }

    setPasswordLoading(true)
    setPasswordStatus(null)

    try {
      const { data, error } = await supabase.auth.updateUser({ password })
      if (error || !data) {
        throw new Error(error?.message || 'Unable to set password')
      }
      setPasswordStatus('Password saved successfully. You can now sign in with email and password.')
      setPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setPasswordStatus(error?.message || 'Unable to set password')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, privacy, and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <div className="font-medium">{profileUser.name}</div>
              <div className="text-sm text-muted-foreground">{profileUser.username}</div>
            </div>
            <Button variant="outline" className="rounded-full">Edit profile</Button>
          </div>
          <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
            Your account is verified and ready for public posting.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Key className="size-4 text-primary" />
              <span>Set or update a password for your account so you can sign in with email and password in addition to OAuth.</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              disabled={passwordLoading}
            />
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              disabled={passwordLoading}
            />
          </div>
          {passwordStatus ? <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{passwordStatus}</div> : null}
          <div className="flex justify-end">
            <Button className="rounded-full" onClick={handleSetPassword} disabled={passwordLoading || loading}>
              {passwordLoading ? 'Saving...' : 'Save password'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Privacy controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { icon: Lock, label: 'Private account', helper: 'Hide your profile and listings from non-followers', value: privacy.accountIsPrivate, onChange: (checked: boolean) => setPrivacy((current) => ({ ...current, accountIsPrivate: checked })) },
            { icon: Bell, label: 'Show your email', helper: 'Allow other users to see your email on public profile cards', value: privacy.showEmail, onChange: (checked: boolean) => setPrivacy((current) => ({ ...current, showEmail: checked })) },
            { icon: Smartphone, label: 'Show location', helper: 'Share your city or region with buyers and visitors', value: privacy.showLocation, onChange: (checked: boolean) => setPrivacy((current) => ({ ...current, showLocation: checked })) },
            { icon: MoonStar, label: 'Allow messages', helper: 'Let other users contact you directly', value: privacy.allowMessages, onChange: (checked: boolean) => setPrivacy((current) => ({ ...current, allowMessages: checked })) },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-secondary p-2 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.helper}</div>
                  </div>
                </div>
                <Switch checked={item.value} onCheckedChange={item.onChange} />
              </div>
            )
          })}
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <div className="font-medium">Marketplace contact</div>
              <div className="text-sm text-muted-foreground">Allow buyers to request a secure checkout and contact you through marketplace listings.</div>
            </div>
            <Switch checked={privacy.allowMarketplaceContact} onCheckedChange={(checked) => setPrivacy((current) => ({ ...current, allowMarketplaceContact: checked }))} />
          </div>
          {status ? <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">{status}</div> : null}
          <div className="flex justify-end">
            <Button className="rounded-full" onClick={handleSavePrivacy} disabled={saving || loading}>
              {saving ? 'Saving...' : 'Save privacy'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
            <div>
              <div className="font-medium">Download your data</div>
              <div className="text-sm text-muted-foreground">Receive a JSON export of your profile, posts, messages, listings, and consent records.</div>
            </div>
            <Button variant="outline" className="rounded-full" onClick={async () => {
              const res = await fetch('/api/account/export')
              const data = await res.json().catch(() => ({}))
              const blob = new Blob([JSON.stringify(data.export ?? {}, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = 'zivona-data-export.json'
              link.click()
              URL.revokeObjectURL(url)
              setStatus('Data export requested.')
            }}>
              Export data
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
            <div>
              <div className="font-medium">Delete account</div>
              <div className="text-sm text-muted-foreground">This anonymizes or removes your account data where possible and is intended for privacy requests.</div>
            </div>
            <Button variant="destructive" className="rounded-full" onClick={async () => {
              const res = await fetch('/api/account/delete', { method: 'POST' })
              const data = await res.json().catch(() => ({}))
              if (!res.ok || data?.error) {
                setStatus(data?.error || 'Unable to delete account')
                return
              }
              setStatus('Account deletion requested.')
            }}>
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-secondary p-2 text-primary">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <div className="font-medium">Two-factor authentication</div>
                <div className="text-sm text-muted-foreground">{twoFactorState.enabled ? 'Enabled for your account' : 'Add an extra layer of protection'}</div>
              </div>
            </div>
            {twoFactorState.enabled ? (
              <Button variant="outline" className="rounded-full" onClick={handleDisableTwoFactor} disabled={twoFactorState.loading}>
                Disable
              </Button>
            ) : (
              <Button variant="outline" className="rounded-full" onClick={handleSetupTwoFactor} disabled={twoFactorState.loading}>
                Enable
              </Button>
            )}
          </div>

          {twoFactorState.pendingSetup ? (
            <div className="space-y-3 rounded-xl border border-border p-3 text-sm">
              <div>
                <div className="font-medium">Authenticator setup</div>
                <p className="text-muted-foreground">Use any TOTP app such as Authy or Google Authenticator.</p>
              </div>
              {twoFactorState.secret ? (
                <div className="rounded-lg bg-secondary/40 p-3 font-mono text-xs">{twoFactorState.secret}</div>
              ) : null}
              {twoFactorState.recoveryCodes.length ? (
                <div>
                  <div className="mb-2 font-medium">Recovery codes</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {twoFactorState.recoveryCodes.map((code) => (
                      <div key={code} className="rounded-md border border-border bg-background px-2 py-1 font-mono text-xs">{code}</div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Enter 6-digit code"
                  value={twoFactorState.code}
                  onChange={(event) => setTwoFactorState((current) => ({ ...current, code: event.target.value }))}
                />
                <Button onClick={handleVerifyTwoFactor} disabled={twoFactorState.loading}>
                  Verify code
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

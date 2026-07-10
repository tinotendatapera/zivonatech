"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAvatar, VerifiedBadge } from "@/components/user-avatar"
import { Heart, MessageCircle, Repeat2, UserRoundPlus, BellRing } from "lucide-react"

type NotificationRow = {
  id: string
  type: 'like' | 'comment' | 'follow' | 'message' | 'repost' | 'mention' | 'system' | string
  title?: string | null
  body?: string | null
  payload?: Record<string, any> | null
  is_read: boolean
  created_at: string
  actor?: {
    id?: string
    username?: string
    full_name?: string
    avatar_url?: string | null
    is_verified?: boolean | null
  } | null
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000))
  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
  ]

  let interval = seconds
  let unit: Intl.RelativeTimeFormatUnit = 'second'
  for (const [threshold, nextUnit] of ranges) {
    if (interval < threshold) break
    interval = Math.floor(interval / threshold)
    unit = nextUnit
  }

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  return formatter.format(-interval, unit)
}

function getNotificationIcon(type: NotificationRow['type']) {
  switch (type) {
    case 'like':
      return Heart
    case 'follow':
      return UserRoundPlus
    case 'repost':
      return Repeat2
    case 'message':
      return MessageCircle
    case 'comment':
      return MessageCircle
    default:
      return BellRing
  }
}

export default function NotificationsPage() {
  const [notificationList, setNotificationList] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'mentions'>('all')

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          setNotificationList(Array.isArray(data.notifications) ? data.notifications : [])
        }
      } catch (error) {
        console.error('Error loading notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadNotifications()
  }, [])

  const filteredNotifications = useMemo(() => {
    if (tab === 'mentions') {
      return notificationList.filter((item) => item.type === 'mention' || /@\w+/.test(`${item.title || ''} ${item.body || ''}`))
    }

    return notificationList
  }, [notificationList, tab])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Live activity from likes, follows, comments, reposts, and messages.</p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'all' | 'mentions')} className="space-y-4">
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-full bg-muted p-1">
          <TabsTrigger value="all" className="rounded-full">All</TabsTrigger>
          <TabsTrigger value="mentions" className="rounded-full">Mentions</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          <Card className="border-border bg-background/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Loading notifications...</div>
              ) : filteredNotifications.length > 0 ? (
                filteredNotifications.map((item) => {
                  const Icon = getNotificationIcon(item.type)
                  const actor = item.actor
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-3xl border p-4 transition ${item.is_read ? 'border-border bg-background' : 'border-primary/20 bg-primary/5'}`}
                    >
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          <Icon className="size-4" />
                        </div>
                        {actor ? <UserAvatar user={actor as any} size="sm" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {actor?.id ? (
                            <Link href={`/profile/${actor.id}`} className="text-sm font-semibold text-foreground transition hover:text-primary">
                              {actor.full_name || 'Zivona'}
                            </Link>
                          ) : (
                            <span className="text-sm font-semibold text-foreground">{actor?.full_name || 'Zivona'}</span>
                          )}
                          {actor?.is_verified ? <VerifiedBadge className="size-4" /> : null}
                          <Badge variant={item.is_read ? 'outline' : 'default'} className="rounded-full">{item.type}</Badge>
                          <span className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{item.body || item.title || 'New activity on your account.'}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-background/60 py-12 text-center text-sm text-muted-foreground">
                  {tab === 'mentions' ? 'No mentions yet.' : 'No notifications yet.'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

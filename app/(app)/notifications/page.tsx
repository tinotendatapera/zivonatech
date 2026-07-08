'use client'

import { useEffect, useState } from "react"
import { BellRing, MessageCircle, Sparkles, UserRoundPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserAvatar } from "@/components/user-avatar"

const iconMap = {
  like: Sparkles,
  comment: MessageCircle,
  follow: UserRoundPlus,
  marketplace: Sparkles,
  message: MessageCircle,
  system: BellRing,
}

type Notification = {
  id: string
  type: keyof typeof iconMap
  userId?: string
  text: string
  time: string
  read: boolean
  user?: { name: string; avatar?: string }
}

export default function NotificationsPage() {
  const [notificationList, setNotificationList] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json()
          setNotificationList(data.notifications || [])
        }
      } catch (error) {
        console.error('Error loading notifications:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotifications()
  }, [])

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Your latest updates from the community, marketplace, and direct messages.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inbox</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">Loading notifications...</div>
          ) : notificationList.length > 0 ? (
            notificationList.map((item) => {
              const Icon = iconMap[item.type]
              const user = item.user
              return (
                <div key={item.id} className={`flex items-start gap-3 rounded-xl border p-3 ${item.read ? "border-border bg-background" : "border-primary/20 bg-primary/10"}`}>
                  <div className="mt-0.5 rounded-full bg-secondary p-2 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {user ? <UserAvatar user={user} size="xs" /> : null}
                        <span className="text-sm font-medium">{user?.name ?? "Zivona"}</span>
                      </div>
                      <Badge variant={item.read ? "outline" : "default"}>{item.time}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">No notifications yet</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

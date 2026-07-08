"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AnalyticsSummary {
  totalEvents: number
  topEvents: Array<{ event: string; count: number }>
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<AnalyticsSummary>({ totalEvents: 0, topEvents: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch('/api/admin/analytics')
        if (!res.ok) {
          if (res.status === 403 || res.status === 401) {
            router.replace('/feed')
            return
          }
          throw new Error('Unable to load analytics')
        }
        const data = await res.json()
        setSummary(data.summary || { totalEvents: 0, topEvents: [] })
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    void loadSummary()
  }, [])

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin analytics</h1>
        <p className="text-sm text-muted-foreground">Monitor engagement and health signals for the platform.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events tracked</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : <p className="text-3xl font-semibold">{summary.totalEvents}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.topEvents.map((item) => (
              <div key={item.event} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="text-sm">{item.event}</span>
                <Badge>{item.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

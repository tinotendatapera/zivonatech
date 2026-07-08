import { NextResponse } from 'next/server'
import { trackAnalyticsEvent } from '../../../lib/security'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const event = body?.event
    const metadata = body?.metadata || {}

    if (!event || typeof event !== 'string') {
      return NextResponse.json({ error: 'Event is required' }, { status: 400 })
    }

    await trackAnalyticsEvent(event, metadata)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to track event' }, { status: 500 })
  }
}

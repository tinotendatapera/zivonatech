export async function trackEvent(event: string, metadata: Record<string, unknown> = {}) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, metadata }),
    })
  } catch {
    // ignore analytics failures
  }
}

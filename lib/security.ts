import { supabaseAdmin } from './supabase'
import { getCachedValue as getCachedValueFromStore, setCachedValue as setCachedValueInStore } from './cache'

const rateLimitBuckets = new Map<string, number[]>()
const suspiciousActivityBuckets = new Map<string, number[]>()
const cacheStore = new Map<string, { expiresAt: number; value: unknown }>()

export interface SecurityContext {
  ip: string
  userAgent: string
  requestId: string
}

export interface RateLimitOptions {
  request: Request
  userId?: string | null
  keyPrefix: string
  maxRequests?: number
  windowMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
  key: string
}

function buildRateLimitKey(options: RateLimitOptions) {
  const ip = getClientIp(options.request)
  return `${options.keyPrefix}:${options.userId ?? 'anonymous'}:${ip}`
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  const firstForwarded = forwarded.split(',')[0]?.trim()
  const realIp = request.headers.get('x-real-ip') || ''
  return firstForwarded || realIp || 'unknown'
}

export function buildSecurityContext(request: Request): SecurityContext {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestId: request.headers.get('x-request-id') || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const maxRequests = options.maxRequests ?? 15
  const windowMs = options.windowMs ?? 60_000
  const now = Date.now()
  const key = buildRateLimitKey(options)
  const history = rateLimitBuckets.get(key) ?? []
  const recent = history.filter((timestamp) => now - timestamp < windowMs)

  if (recent.length >= maxRequests) {
    const retryAfterMs = Math.max(windowMs - (now - recent[0]), 1000)
    return { allowed: false, retryAfterMs, key }
  }

  recent.push(now)
  rateLimitBuckets.set(key, recent)

  return { allowed: true, retryAfterMs: 0, key }
}

export function checkSuspiciousActivity(request: Request, userId?: string | null) {
  const context = buildSecurityContext(request)
  const key = `${userId ?? 'anonymous'}:${context.ip}`
  const history = suspiciousActivityBuckets.get(key) ?? []
  const now = Date.now()
  const recent = history.filter((timestamp) => now - timestamp < 60_000)

  if (recent.length >= 4) {
    return true
  }

  recent.push(now)
  suspiciousActivityBuckets.set(key, recent)
  return false
}

export async function logSecurityEvent(level: 'info' | 'warn' | 'error', message: string, metadata: Record<string, unknown> = {}) {
  const output = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  }

  const method = level === 'warn' ? console.warn : level === 'error' ? console.error : console.info
  method('[security]', JSON.stringify(output))

  if (!supabaseAdmin) {
    return
  }

  try {
    await supabaseAdmin.from('analytics_events').insert({
      event_name: message,
      event_payload: output,
      created_at: new Date().toISOString(),
    })
  } catch {
    // Ignore analytics insert failures so the app keeps running.
  }
}

export async function trackAnalyticsEvent(event: string, metadata: Record<string, unknown> = {}) {
  await logSecurityEvent('info', event, metadata)
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  const entry = cacheStore.get(key)
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T
  }

  if (entry) {
    cacheStore.delete(key)
  }

  return getCachedValueFromStore<T>(key)
}

export async function setCachedValue(key: string, value: unknown, ttlMs = 30_000) {
  cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs })
  await setCachedValueInStore(key, value, ttlMs)
}

export function invalidateCache(prefix: string) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key)
    }
  }
}

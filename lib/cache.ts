const memoryStore = new Map<string, { expiresAt: number; value: string }>()

function buildRedisRestConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || ''
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || ''
  return { url, token }
}

async function readFromRedis(key: string) {
  const { url, token } = buildRedisRestConfig()
  if (!url || !token) return null

  try {
    const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) return null
    const payload = await response.json()
    return payload?.result ?? null
  } catch {
    return null
  }
}

async function writeToRedis(key: string, value: string, ttlMs: number) {
  const { url, token } = buildRedisRestConfig()
  if (!url || !token) return false

  try {
    const response = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value, ex: Math.max(1, Math.floor(ttlMs / 1000)) }),
    })

    return response.ok
  } catch {
    return false
  }
}

async function deleteFromRedis(key: string) {
  const { url, token } = buildRedisRestConfig()
  if (!url || !token) return false

  try {
    const response = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return response.ok
  } catch {
    return false
  }
}

export async function getCachedValue<T>(key: string): Promise<T | null> {
  const serialized = memoryStore.get(key)
  if (serialized && serialized.expiresAt > Date.now()) {
    return JSON.parse(serialized.value) as T
  }

  if (serialized) {
    memoryStore.delete(key)
  }

  const redisValue = await readFromRedis(key)
  if (redisValue == null) return null

  try {
    return JSON.parse(redisValue) as T
  } catch {
    return redisValue as T
  }
}

export async function setCachedValue<T>(key: string, value: T, ttlMs = 60_000) {
  const serialized = JSON.stringify(value)
  memoryStore.set(key, { expiresAt: Date.now() + ttlMs, value: serialized })
  await writeToRedis(key, serialized, ttlMs)
}

export async function invalidateCache(prefix: string) {
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key)
    }
  }

  const { url, token } = buildRedisRestConfig()
  if (!url || !token) return

  try {
    const response = await fetch(`${url}/scan`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) return
    const payload = await response.json()
    const matches = Array.isArray(payload?.result) ? payload.result : []
    for (const match of matches) {
      if (typeof match === 'string' && match.startsWith(prefix)) {
        await deleteFromRedis(match)
      }
    }
  } catch {
    // Ignore invalidation failures and keep the app responsive.
  }
}

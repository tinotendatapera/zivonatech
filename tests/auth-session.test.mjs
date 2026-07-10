import test from 'node:test'
import assert from 'node:assert/strict'

import { getAuthenticatedUserFromRequest } from '../lib/auth-session.mjs'

test('getAuthenticatedUserFromRequest uses an authorization header when provided', async () => {
  const user = { id: 'user-1', email: 'hello@example.com' }
  const supabase = {
    auth: {
      getUser: async (jwt) => {
        if (jwt === 'token-123') {
          return { data: { user }, error: null }
        }

        return { data: { user: null }, error: new Error('missing token') }
      },
    },
  }

  const request = new Request('http://localhost/api/profile', {
    headers: { Authorization: 'Bearer token-123' },
  })

  const resolvedUser = await getAuthenticatedUserFromRequest(request, supabase)

  assert.equal(resolvedUser?.id, 'user-1')
})

import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { OWNER_SESSION_COOKIE_NAME, parseOwnerSessionCookie, supabaseAdmin } from '../../../lib/supabase'

async function createSupabaseServerClient(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  const resolvedCookieStore = cookieStore ?? await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => resolvedCookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: async (cookieArray: Array<{ name: string; value: string; options?: any }>) => {
          cookieArray.forEach((cookie) => {
            resolvedCookieStore.set({ name: cookie.name, value: cookie.value, ...(cookie.options ?? {}) })
          })
        },
      },
    }
  )
}

async function getCurrentUser(cookieStore?: Awaited<ReturnType<typeof cookies>>) {
  const supabase = await createSupabaseServerClient(cookieStore)
  const store = cookieStore ?? await cookies()
  const ownerSessionCookie = store.get(OWNER_SESSION_COOKIE_NAME)
  const ownerSession = parseOwnerSessionCookie(ownerSessionCookie?.value)

  let user = ownerSession?.user
  if (!user) {
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return null
    }
    user = authUser
  }

  return user
}

function isSchemaFallbackError(message?: string) {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('column') || normalized.includes('permission denied')
}

async function getPrivacySettingsForUsers(userIds: string[]) {
  if (!supabaseAdmin || userIds.length === 0) return new Map<string, any>()

  const { data, error } = await supabaseAdmin
    .from('profile_privacy')
    .select('profile_id, account_is_private, show_email, show_phone, show_location, allow_messages, allow_marketplace_contact')
    .in('profile_id', userIds)

  if (error || !data) return new Map<string, any>()

  return new Map(data.map((row: any) => [row.profile_id, row]))
}

export async function GET(request: Request) {
  try {
    const currentUser = await getCurrentUser()
    const client = supabaseAdmin
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''

    if (!client) {
      return NextResponse.json({ profiles: [] })
    }

    let profilesQuery = client
      .from('profiles')
      .select('id, username, full_name, avatar_url, role, location, bio')
      .order('full_name', { ascending: true })
      .limit(12)

    if (currentUser?.id) {
      profilesQuery = profilesQuery.neq('id', currentUser.id)
    }

    if (query) {
      profilesQuery = profilesQuery.or(`username.ilike.%${query}%,full_name.ilike.%${query}%,bio.ilike.%${query}%`)
    }

    const { data, error } = await profilesQuery

    if (error) {
      if (isSchemaFallbackError(error.message)) {
        return NextResponse.json({ profiles: [] })
      }

      return NextResponse.json({ profiles: [], error: error.message }, { status: 500 })
    }

    const privacyMap = await getPrivacySettingsForUsers((data ?? []).map((profile: any) => profile.id))
    const visibleProfiles = (data ?? []).map((profile: any) => {
      const privacy = privacyMap.get(profile.id)
      const isPrivate = Boolean(privacy?.account_is_private)

      if (isPrivate && currentUser?.id !== profile.id) {
        return {
          ...profile,
          full_name: 'Private profile',
          username: 'private',
        }
      }

      return profile
    })

    return NextResponse.json({ profiles: visibleProfiles, query })
  } catch (error: any) {
    return NextResponse.json({ profiles: [], error: error?.message || 'Unable to load profiles' }, { status: 500 })
  }
}

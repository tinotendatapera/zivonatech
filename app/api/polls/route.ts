import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { checkRateLimit, buildSecurityContext, logSecurityEvent } from '../../../lib/security'

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

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = await createSupabaseServerClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const context = buildSecurityContext(request)
  const rateLimit = await checkRateLimit({ request, userId: user.id, keyPrefix: 'poll-vote', maxRequests: 30, windowMs: 60000 })
  if (!rateLimit.allowed) {
    await logSecurityEvent('warn', 'poll-vote-rate-limit-hit', { userId: user.id, ...context })
    return NextResponse.json({ error: 'Too many poll votes. Please slow down.' }, { status: 429 })
  }

  try {
    const { poll_id, option_id } = await request.json()

    if (!poll_id || !option_id) {
      return NextResponse.json({ error: 'poll_id and option_id are required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Check if poll exists and hasn't expired
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select('id, expires_at')
      .eq('id', poll_id)
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    if (new Date(poll.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Poll has expired' }, { status: 400 })
    }

    // Check if option exists (include vote count)
    const { data: option, error: optionError } = await supabaseAdmin
      .from('poll_options')
      .select('id, vote_count')
      .eq('id', option_id)
      .eq('poll_id', poll_id)
      .single()

    if (optionError || !option) {
      return NextResponse.json({ error: 'Poll option not found' }, { status: 404 })
    }

    // Check if user already voted
    const { data: existingVote } = await supabaseAdmin
      .from('poll_votes')
      .select('id')
      .eq('poll_id', poll_id)
      .eq('user_id', user.id)
      .single()

    if (existingVote) {
      return NextResponse.json({ error: 'You have already voted on this poll' }, { status: 400 })
    }

    // Create vote
    const { error: voteError } = await supabaseAdmin
      .from('poll_votes')
      .insert({
        poll_id,
        option_id,
        user_id: user.id,
      })

    if (voteError) {
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
    }

    // Increment vote count
    await supabaseAdmin
      .from('poll_options')
      .update({ vote_count: (option.vote_count || 0) + 1 })
      .eq('id', option_id)

    return NextResponse.json({ voted: true })
  } catch (error: any) {
    console.error('Poll vote error:', error)
    return NextResponse.json({ error: error.message || 'Failed to vote on poll' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const poll_id = url.searchParams.get('poll_id')

    if (!poll_id) {
      return NextResponse.json({ error: 'poll_id is required' }, { status: 400 })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Get poll with options
    const { data: poll, error: pollError } = await supabaseAdmin
      .from('polls')
      .select(`
        id,
        question,
        expires_at,
        poll_options(
          id,
          text,
          vote_count
        )
      `)
      .eq('id', poll_id)
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Check if user voted
    const { data: userVote } = await supabaseAdmin
      .from('poll_votes')
      .select('option_id')
      .eq('poll_id', poll_id)
      .eq('user_id', user.id)
      .single()

    // Calculate totals and percentages
    const totalVotes = poll.poll_options?.reduce((sum: number, opt: any) => sum + (opt.vote_count || 0), 0) || 0
    const options = poll.poll_options?.map((opt: any) => ({
      id: opt.id,
      text: opt.text,
      votes: opt.vote_count || 0,
      percentage: totalVotes > 0 ? ((opt.vote_count || 0) / totalVotes) * 100 : 0,
    })) || []

    return NextResponse.json({
      id: poll.id,
      question: poll.question,
      expiresAt: poll.expires_at,
      options,
      totalVotes,
      userVoteId: userVote?.option_id || null,
    })
  } catch (error: any) {
    console.error('Get poll error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch poll' }, { status: 500 })
  }
}

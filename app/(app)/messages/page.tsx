'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MessagesPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<any[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')

  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        const [conversationsRes, profilesRes] = await Promise.all([
          fetch('/api/conversations'),
          fetch('/api/profiles')
        ])

        // Check response status before trying to parse JSON
        if (!conversationsRes.ok) {
          console.error('Conversations API error:', conversationsRes.status, conversationsRes.statusText)
          setConversations([])
        } else {
          try {
            const conversationsData = await conversationsRes.json()
            if (isMounted) {
              setCurrentUserId(conversationsData.user_id || '')
              const convos = conversationsData.conversations || []
              setConversations(convos)
            }
          } catch (parseError) {
            console.error('Error parsing conversations JSON:', parseError)
            setConversations([])
          }
        }

        if (!profilesRes.ok) {
          console.error('Profiles API error:', profilesRes.status, profilesRes.statusText)
          setSuggestedUsers([])
        } else {
          try {
            const profilesData = await profilesRes.json()
            if (isMounted) {
              setSuggestedUsers(profilesData.profiles || [])
            }
          } catch (parseError) {
            console.error('Error parsing profiles JSON:', parseError)
            setSuggestedUsers([])
          }
        }
      } catch (error) {
        console.error('Error fetching conversations/profiles:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) {
        console.error('Conversations API error:', res.status, res.statusText)
        setConversations([])
        return
      }

      try {
        const data = await res.json()
        setCurrentUserId(data.user_id || '')
        setConversations(data.conversations || [])
      } catch (parseError) {
        console.error('Error parsing conversations JSON:', parseError)
        setConversations([])
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
      setConversations([])
    } finally {
      setLoading(false)
    }
  }

  function getOtherUser(convo: any) {
    return convo.participant_1 === currentUserId
      ? convo.participant_2_profile
      : convo.participant_1_profile
  }

  function getInitials(name?: string) {
    return (name || 'Z')
      .split(' ')
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  function getPresenceMeta(otherUser: any) {
    // Real presence from database - updated in real-time via user_presence table
    const isOnline = Boolean(otherUser?.is_online)
    return {
      isOnline,
      statusLabel: isOnline ? 'Online now' : 'Active recently',
      dotClass: isOnline ? 'bg-emerald-400' : 'bg-zinc-500',
    }
  }

  async function handleStartConversation(userId: string) {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: userId })
      })

      if (!res.ok) {
        console.error('Error starting conversation:', res.status, res.statusText)
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to start conversation')
      }

      const data = await res.json()
      if (data.conversation_id) {
        router.push(`/messages/${data.conversation_id}`)
      }
    } catch (error) {
      console.error('Error starting conversation:', error)
    }
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/80 bg-black/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Messages</p>
            <h1 className="text-xl font-semibold text-purple-400">Inbox</h1>
          </div>
          <div className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs text-zinc-400">
            {conversations.length} chats
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl space-y-6 px-4 pb-10 pt-24">
        <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="border-b border-zinc-800/80 bg-zinc-900/70 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Start a new conversation</h2>
                <p className="text-xs text-zinc-500">Message followers, sellers, and creators who are available now.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {suggestedUsers.length === 0 ? (
              <div className="sm:col-span-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-500">
                No other profiles are available yet. New users will appear here once they’re stored in the database.
              </div>
            ) : (
              suggestedUsers.slice(0, 4).map((user) => (
                <div key={user.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name || user.username} className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-sm font-bold text-white">
                        {getInitials(user.full_name || user.username)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{user.full_name || user.username}</p>
                      <p className="truncate text-xs text-zinc-500">@{user.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartConversation(user.id)}
                    className="mt-4 w-full rounded-full border border-purple-600/60 bg-purple-600/10 px-3 py-2 text-sm text-purple-300 transition hover:bg-purple-600/20"
                  >
                    Start chat
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-zinc-800 rounded w-1/3" />
                  <div className="h-3 bg-zinc-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">No messages yet.</p>
            <p className="text-zinc-600 text-sm mt-1">Choose a creator above to start your first chat.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-950/90 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <div className="border-b border-zinc-800/80 bg-zinc-900/70 px-4 py-3">
              <p className="text-sm font-semibold text-white">Recent chats</p>
              <p className="text-xs text-zinc-500">Your conversations with friends and creators</p>
            </div>
            <div className="divide-y divide-zinc-800/80">
              {conversations.map((convo) => {
              const otherUser = getOtherUser(convo)
              const { isOnline, statusLabel, dotClass } = getPresenceMeta(otherUser)
              return (
                <button
                  key={convo.id}
                  onClick={() => router.push(`/messages/${convo.id}`)}
                  className="flex w-full items-center gap-3 bg-zinc-950/60 p-4 text-left transition hover:bg-zinc-900"
                >
                  <div className="relative flex-shrink-0">
                    {otherUser?.avatar_url ? (
                      <img
                        src={otherUser.avatar_url}
                        alt={otherUser?.full_name || 'User'}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-sm font-semibold text-white">
                        {getInitials(otherUser?.full_name)}
                      </div>
                    )}
                    <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-zinc-950 ${dotClass}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{otherUser?.full_name || 'Zivona User'}</p>
                      <span className="text-xs text-zinc-500">@{otherUser?.username || 'zivona'}</span>
                    </div>
                    <p className="truncate text-sm text-zinc-500">{convo.last_message || 'No messages yet'}</p>
                    <p className="mt-1 text-xs text-zinc-500">{statusLabel}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-zinc-500">
                    <span className="whitespace-nowrap">
                      {convo.last_message_at ? new Date(convo.last_message_at).toLocaleDateString() : ''}
                    </span>
                    {isOnline ? <span className="text-emerald-400">Online</span> : null}
                  </div>
                </button>
              )
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

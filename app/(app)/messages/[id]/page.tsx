'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Send, ArrowLeft } from 'lucide-react'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState<any[]>([])
  const [conversation, setConversation] = useState<any>(null)
  const [newMessage, setNewMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        const res = await fetch(`/api/messages/${params.id}`)

        if (!isMounted) return

        if (!res.ok) {
          console.error('Messages API error:', res.status, res.statusText)
          if (res.status === 401) {
            router.push('/login')
          }
          return
        }

        try {
          const data = await res.json()
          if (isMounted) {
            setCurrentUserId(data.user_id || '')
            setMessages(data.messages || [])
            setConversation(data.conversation || null)
            setLoading(false)
          }
        } catch (parseError) {
          console.error('Error parsing messages JSON:', parseError)
          if (isMounted) {
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [params.id, router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/messages/${params.id}`)

      if (!res.ok) {
        console.error('Messages API error:', res.status, res.statusText)
        return
      }

      try {
        const data = await res.json()
        setMessages(data.messages || [])
        setCurrentUserId(data.user_id || '')
        setConversation(data.conversation || null)
        setLoading(false)
      } catch (parseError) {
        console.error('Error parsing messages JSON:', parseError)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }

  async function handleSend() {
    if (!newMessage.trim()) return

    const content = newMessage
    setNewMessage('')

    try {
      const res = await fetch(`/api/messages/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })

      if (res.ok) {
        await fetchMessages()
      } else {
        console.error('Error sending message:', res.status, res.statusText)
        setNewMessage(content) // Restore message if send failed
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setNewMessage(content) // Restore message if send failed
    }
  }

  function getInitials(name?: string) {
    return (name || 'Z')
      .split(' ')
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  function getOtherUser() {
    if (!conversation) return null
    return conversation.participant_1 === currentUserId
      ? conversation.participant_2_profile
      : conversation.participant_1_profile
  }

  function getPresenceMeta(otherUser: any) {
    // Real presence from database - updated in real-time via user_presence table
    const isOnline = Boolean(otherUser?.is_online)
    return {
      isOnline,
      statusLabel: isOnline ? 'Online now' : 'Away',
      dotClass: isOnline ? 'bg-emerald-400' : 'bg-zinc-500',
    }
  }

  function normalizeId(value?: string | null) {
    return (value || '').trim().toLowerCase()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const otherUser = getOtherUser()
  const { isOnline, statusLabel, dotClass } = getPresenceMeta(otherUser)
  const currentParticipantId = conversation
    ? normalizeId(conversation.participant_1) === normalizeId(currentUserId)
      ? conversation.participant_1
      : conversation.participant_2
    : null

  return (
    <div className="flex min-h-screen flex-col bg-[#070707] text-white">
      <nav className="sticky top-0 z-40 border-b border-zinc-800/80 bg-black/85 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={() => router.push('/messages')} className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800">
            <ArrowLeft size={18} className="text-zinc-300" />
          </button>
          <div className="flex flex-1 items-center gap-3 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-2">
            <div className="relative flex-shrink-0">
              {otherUser?.avatar_url ? (
                <img src={otherUser.avatar_url} alt={otherUser?.full_name || 'User'} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 text-sm font-semibold text-white">
                  {getInitials(otherUser?.full_name)}
                </div>
              )}
              <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-950 ${dotClass}`} />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <h1 className="truncate text-sm font-semibold">{otherUser?.full_name || 'Chat'}</h1>
              <p className="truncate text-xs text-zinc-500">@{otherUser?.username || 'zivona'} · {statusLabel}</p>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex w-full max-w-2xl flex-1 px-4 pb-24 pt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">No messages yet. Say hello!</div>
        ) : (
          <div className="w-full space-y-3 rounded-[24px] border border-zinc-800 bg-zinc-950/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            {messages.map((msg) => {
              const isMine =
                normalizeId(msg.sender_id) === normalizeId(currentUserId) ||
                (currentParticipantId && normalizeId(msg.sender_id) === normalizeId(currentParticipantId))
              const senderLabel = isMine ? 'You' : msg.sender_profile?.full_name || otherUser?.full_name || 'Them'

              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      {senderLabel}
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isMine
                          ? 'rounded-br-sm bg-gradient-to-br from-purple-600 to-fuchsia-500 text-white'
                          : 'rounded-bl-sm border border-zinc-800 bg-zinc-900 text-zinc-100'
                      }`}
                    >
                      <div className="leading-5">{msg.content}</div>
                      <div className={`mt-1 text-[11px] ${isMine ? 'text-purple-100/80' : 'text-zinc-500'}`}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800/80 bg-black/85 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 p-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 rounded-full bg-transparent px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-purple-600 transition hover:bg-purple-700 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

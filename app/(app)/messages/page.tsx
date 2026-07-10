"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MessageCircle, Search, Send, Plus, Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { UserAvatar } from "@/components/user-avatar"

type Profile = {
  id: string
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

export default function MessagesPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<any[]>([])
  const [suggestedUsers, setSuggestedUsers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<any[]>([])
  const [threadConversation, setThreadConversation] = useState<any>(null)
  const [composeMode, setComposeMode] = useState(false)
  const [search, setSearch] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const [conversationsRes, profilesRes] = await Promise.all([
          fetch('/api/conversations'),
          fetch('/api/profiles'),
        ])

        if (conversationsRes.ok) {
          const data = await conversationsRes.json().catch(() => ({}))
          if (isMounted) {
            setCurrentUserId(data.user_id || '')
            setConversations(Array.isArray(data.conversations) ? data.conversations : [])
          }
        }

        if (profilesRes.ok) {
          const data = await profilesRes.json().catch(() => ({}))
          if (isMounted) {
            setSuggestedUsers(Array.isArray(data.profiles) ? data.profiles : [])
          }
        }
      } catch (error) {
        console.error('Error loading messages data:', error)
      } finally {
        if (isMounted) {
          setLoadingConversations(false)
        }
      }
    }

    void loadData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedConversationId) {
      setThreadMessages([])
      setThreadConversation(null)
      return
    }

    async function loadThread() {
      setLoadingThread(true)
      try {
        const res = await fetch(`/api/messages/${selectedConversationId}`)
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login')
          }
          return
        }

        const data = await res.json().catch(() => ({}))
        setThreadMessages(Array.isArray(data.messages) ? data.messages : [])
        setThreadConversation(data.conversation || null)
        setCurrentUserId(data.user_id || currentUserId)
      } catch (error) {
        console.error('Error loading conversation thread:', error)
      } finally {
        setLoadingThread(false)
      }
    }

    void loadThread()
  }, [currentUserId, router, selectedConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()
    return conversations.filter((conversation) => {
      const otherUser = getOtherUser(conversation, currentUserId)
      const haystack = `${otherUser?.full_name || ''} ${otherUser?.username || ''} ${conversation.last_message || ''}`.toLowerCase()
      return !query || haystack.includes(query)
    })
  }, [conversations, currentUserId, search])

  const selectableUsers = useMemo(() => {
    const conversationParticipants = new Set<string>()
    conversations.forEach((conversation) => {
      if (conversation.participant_1) conversationParticipants.add(String(conversation.participant_1))
      if (conversation.participant_2) conversationParticipants.add(String(conversation.participant_2))
    })

    const query = search.trim().toLowerCase()
    return suggestedUsers
      .filter((user) => String(user.id) !== String(currentUserId))
      .filter((user) => !conversationParticipants.has(String(user.id)))
      .filter((user) => {
        if (!query) return true
        const haystack = `${user.full_name || ''} ${user.username || ''}`.toLowerCase()
        return haystack.includes(query)
      })
      .slice(0, 12)
  }, [conversations, currentUserId, search, suggestedUsers])

  function getOtherUser(convo: any, viewerId = currentUserId) {
    if (!convo) return null
    return String(convo.participant_1) === String(viewerId)
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

  function getConversationTime(value?: string | null) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60_000))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  async function loadConversationThread(conversationId: string) {
    setComposeMode(false)
    setSelectedConversationId(conversationId)
  }

  async function startConversation(userId: string) {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ other_user_id: userId }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Unable to start conversation')
      }

      const data = await res.json().catch(() => ({}))
      if (data.conversation_id) {
        setComposeMode(false)
        setSelectedConversationId(data.conversation_id)
        await refreshConversations()
      }
    } catch (error) {
      console.error('Error starting conversation:', error)
    }
  }

  async function refreshConversations() {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) return

      const data = await res.json().catch(() => ({}))
      setCurrentUserId(data.user_id || currentUserId)
      setConversations(Array.isArray(data.conversations) ? data.conversations : [])
    } catch (error) {
      console.error('Error refreshing conversations:', error)
    }
  }

  async function handleSend() {
    if (!selectedConversationId || !messageDraft.trim()) return

    const content = messageDraft.trim()
    setMessageDraft('')

    try {
      const res = await fetch(`/api/messages/${selectedConversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData?.error || 'Unable to send message')
      }

      await refreshConversations()
      const updated = await fetch(`/api/messages/${selectedConversationId}`)
      if (updated.ok) {
        const data = await updated.json().catch(() => ({}))
        setThreadMessages(Array.isArray(data.messages) ? data.messages : [])
        setThreadConversation(data.conversation || null)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessageDraft(content)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const selectedConversation = selectedConversationId
    ? filteredConversations.find((conversation) => String(conversation.id) === String(selectedConversationId)) || conversations.find((conversation) => String(conversation.id) === String(selectedConversationId))
    : null
  const activeOtherUser = getOtherUser(threadConversation || selectedConversation, currentUserId)

  return (
    <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-border bg-background/80 shadow-sm">
          <CardHeader className="space-y-4 border-b border-border pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl tracking-tight">Messages</CardTitle>
                <p className="text-sm text-muted-foreground">Your live conversations and new chat suggestions.</p>
              </div>
              <Button variant="outline" className="rounded-full" onClick={() => setComposeMode((value) => !value)}>
                <Plus className="size-4" />
                New chat
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversations or people"
                className="h-8 border-0 bg-transparent px-0 shadow-none"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-3">
            {loadingConversations ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading conversations...</div>
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conversation) => {
                const otherUser = getOtherUser(conversation)
                const isSelected = String(conversation.id) === String(selectedConversationId)
                return (
                  <button
                    key={conversation.id}
                    onClick={() => void loadConversationThread(conversation.id)}
                    className={`flex w-full items-center gap-3 rounded-3xl border p-3 text-left transition ${isSelected ? 'border-primary/30 bg-primary/5' : 'border-border bg-background hover:bg-muted/40'}`}
                  >
                    <UserAvatar user={{ id: otherUser?.id, name: otherUser?.full_name, username: otherUser?.username, avatar_url: otherUser?.avatar_url }} size="md" ring />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-foreground">{otherUser?.full_name || 'Zivona User'}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{getConversationTime(conversation.last_message_at)}</span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{conversation.last_message || 'No messages yet'}</p>
                    </div>
                  </button>
                )
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
                No conversations yet. Start one with a real user.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-background/80 shadow-sm">
          <CardHeader className="border-b border-border pb-4">
            {selectedConversationId ? (
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-full xl:hidden" onClick={() => setSelectedConversationId(null)}>
                  <ArrowLeft className="size-4" />
                </Button>
                <UserAvatar user={{ id: activeOtherUser?.id, name: activeOtherUser?.full_name, username: activeOtherUser?.username, avatar_url: activeOtherUser?.avatar_url }} size="md" ring />
                <div>
                  <CardTitle className="text-lg">{activeOtherUser?.full_name || 'Conversation'}</CardTitle>
                  <p className="text-sm text-muted-foreground">@{activeOtherUser?.username || 'user'}</p>
                </div>
              </div>
            ) : composeMode ? (
              <div>
                <CardTitle className="text-lg">Start Conversation</CardTitle>
                <p className="text-sm text-muted-foreground">Choose from existing users stored in the database.</p>
              </div>
            ) : (
              <div>
                <CardTitle className="text-lg">Start Conversation</CardTitle>
                <p className="text-sm text-muted-foreground">Select a chat on the left or start a new one with a real user.</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="flex min-h-[520px] flex-col p-4">
            {selectedConversationId ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {loadingThread ? (
                    <div className="flex h-full items-center justify-center py-24 text-sm text-muted-foreground">Loading thread...</div>
                  ) : threadMessages.length > 0 ? (
                    threadMessages.map((message) => {
                      const isMine = String(message.sender_id) === String(currentUserId)
                      return (
                        <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm shadow-sm ${isMine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-background text-foreground'}`}>
                            <div className="leading-6">{message.content}</div>
                            <div className={`mt-1 text-[11px] ${isMine ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                              {message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center py-24 text-sm text-muted-foreground">No messages yet. Say hello.</div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex items-center gap-2 rounded-full border border-border bg-background p-2">
                    <input
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 rounded-full bg-transparent px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <Button onClick={() => void handleSend()} disabled={!messageDraft.trim()} className="h-11 w-11 rounded-full px-0">
                      <Send className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : composeMode ? (
              <div className="space-y-3 overflow-y-auto pr-1">
                {selectableUsers.length > 0 ? (
                  selectableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => void startConversation(user.id)}
                      className="flex w-full items-center gap-3 rounded-3xl border border-border bg-background p-4 text-left transition hover:bg-muted/40"
                    >
                      <UserAvatar
                        user={{
                          id: user.id,
                          name: user.full_name ?? user.username ?? undefined,
                          username: user.username ?? undefined,
                          avatar_url: user.avatar_url ?? undefined,
                        }}
                        size="md"
                        ring
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{user.full_name || 'Zivona User'}</p>
                        <p className="truncate text-xs text-muted-foreground">@{user.username || 'user'}</p>
                      </div>
                      <Button variant="outline" className="rounded-full">Start chat</Button>
                    </button>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-border bg-background/60 p-8 text-center text-sm text-muted-foreground">
                    No other profiles available right now.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="size-8" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Start Conversation</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">Pick an existing conversation or start a new one with a real profile from the database.</p>
                </div>
                <Button className="rounded-full" onClick={() => setComposeMode(true)}>
                  <Plus className="size-4" />
                  New chat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

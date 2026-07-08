"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [privacy, setPrivacy] = useState('public')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadGroups()
  }, [])

  async function loadGroups() {
    setLoading(true)
    try {
      const res = await fetch('/api/groups')
      const data = await res.json()
      setGroups(data.groups || [])
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateGroup() {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, privacy }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      console.error(data.error)
      return
    }
    setName('')
    setDescription('')
    await loadGroups()
  }

  async function handleJoin(groupId: string) {
    await fetch(`/api/groups/${groupId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join' }),
    })
    await loadGroups()
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Groups</h1>
        <p className="text-sm text-muted-foreground">Create communities, invite members, and share posts inside them.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a group</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Group name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={privacy} onChange={(event) => setPrivacy(event.target.value)}>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite_only">Invite only</option>
          </select>
          <Button onClick={handleCreateGroup}>Create group</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? <p className="text-sm text-muted-foreground">Loading groups…</p> : groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-base">{group.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{group.description || 'A community built on Zivona.'}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="rounded-full border border-border px-2 py-1">{group.privacy}</span>
                {group.membership ? <span className="text-muted-foreground">Joined</span> : <Button variant="outline" onClick={() => void handleJoin(group.id)}>Join</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

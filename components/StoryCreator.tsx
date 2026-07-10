'use client'

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Image as ImageIcon, Loader2 } from 'lucide-react'
import { trackEvent } from '@/lib/analytics'

interface StoryCreatorProps {
  onStoryCreated: () => void
}

export default function StoryCreator({ onStoryCreated }: StoryCreatorProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function parseUploadResponse(res: Response) {
    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return await res.json()
    }

    const body = await res.text()
    if (body.trim().startsWith('<!DOCTYPE') || body.includes('<html')) {
      throw new Error(`Unable to upload media (${res.status})`)
    }

    try {
      return JSON.parse(body)
    } catch {
      throw new Error(body || `Unable to upload media (${res.status})`)
    }
  }

  async function uploadMedia(file: File) {
    const formData = new FormData()
    formData.append('file', file, file.name)

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await parseUploadResponse(res)
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Unable to upload media')
    }

    return data.url as string
  }

  async function handleSubmit() {
    if (!content.trim() && !mediaFile) {
      setError('Add text or media to share a story.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      let uploadedMediaUrl: string | null = null
      if (mediaFile) {
        uploadedMediaUrl = await uploadMedia(mediaFile)
      }

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          media_url: uploadedMediaUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Unable to share story')
      }

      trackEvent('story_created', {
        hasMedia: Boolean(mediaFile),
        contentLength: content.trim().length,
      })
      setContent('')
      setMediaFile(null)
      setMediaUrl(null)
      setOpen(false)
      onStoryCreated()
    } catch (err: any) {
      setError(err?.message || 'Unable to share story')
    } finally {
      setSubmitting(false)
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    setMediaFile(file)
    setMediaUrl(URL.createObjectURL(file))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full bg-purple-600 hover:bg-purple-500 text-sm">Share a story</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share a Story</DialogTitle>
          <DialogDescription>Post a short story or visual update that expires in 24 hours.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-200">Text</label>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write something memorable..."
              className="min-h-[120px] bg-zinc-950 text-white"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-200">Media (optional)</label>
            <div className="mt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-full"
              >
                <ImageIcon size={16} />
                Add image
              </Button>
              {mediaFile ? <span className="text-sm text-zinc-400">{mediaFile.name}</span> : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {mediaUrl ? (
              <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
                <img src={mediaUrl} alt="Story preview" className="w-full object-cover" />
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Share story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

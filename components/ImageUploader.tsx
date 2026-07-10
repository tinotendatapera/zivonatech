'use client'

import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { Image as ImageIcon, X, Loader2 } from 'lucide-react'

interface ImageUploaderProps {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
}

export default function ImageUploader({ images, onChange, maxImages = 5 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function parseUploadResponse(res: Response) {
    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return await res.json()
    }

    const body = await res.text()
    if (body.trim().startsWith('<!DOCTYPE') || body.includes('<html')) {
      throw new Error(`Upload failed (${res.status})`)
    }

    try {
      return JSON.parse(body)
    } catch {
      throw new Error(body || `Upload failed (${res.status})`)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > maxImages) {
      setError(`Max ${maxImages} images allowed`)
      return
    }

    setUploading(true)
    setError('')

    const newImages: string[] = []

    for (const file of Array.from(files)) {
      try {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        })

        const formData = new FormData()
        formData.append('file', compressedFile, file.name)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await parseUploadResponse(res)
        if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')

        newImages.push(data.url)
      } catch (err: any) {
        setError(err.message ?? 'Upload failed')
      }
    }

    onChange([...images, ...newImages])
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="text-zinc-400 text-sm mb-2 block">
        Photos ({images.length}/{maxImages})
      </label>

      {error && (
        <div className="mb-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        {images.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-zinc-800 group">
            <img src={url} alt={`Upload ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-zinc-700 hover:border-purple-500 flex flex-col items-center justify-center gap-1 transition disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={20} className="text-purple-400 animate-spin" />
            ) : (
              <>
                <ImageIcon size={20} className="text-zinc-500" />
                <span className="text-xs text-zinc-500">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

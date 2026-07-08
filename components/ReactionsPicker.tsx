'use client'

import { useState, useRef, useEffect } from 'react'

interface ReactionOption {
  emoji: string
  label: string
  type: 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
}

const REACTION_OPTIONS: ReactionOption[] = [
  { emoji: '👍', label: 'Like', type: 'like' },
  { emoji: '❤️', label: 'Love', type: 'love' },
  { emoji: '😂', label: 'Haha', type: 'haha' },
  { emoji: '😮', label: 'Wow', type: 'wow' },
  { emoji: '😢', label: 'Sad', type: 'sad' },
  { emoji: '😠', label: 'Angry', type: 'angry' },
]

interface ReactionsPickerProps {
  onReact: (type: string) => void
  isOpen: boolean
  onClose: () => void
}

export function ReactionsPicker({ onReact, isOpen, onClose }: ReactionsPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-10 left-0 z-50 flex gap-1 rounded-full border border-zinc-700 bg-black/95 backdrop-blur px-3 py-2 shadow-lg"
    >
      {REACTION_OPTIONS.map((option) => (
        <button
          key={option.type}
          onClick={() => {
            onReact(option.type)
            onClose()
          }}
          className="text-xl hover:scale-125 transition-transform cursor-pointer"
          title={option.label}
        >
          {option.emoji}
        </button>
      ))}
    </div>
  )
}

interface ReactionDisplayProps {
  type: string
  count: number
}

export function ReactionDisplay({ type, count }: ReactionDisplayProps) {
  const reaction = REACTION_OPTIONS.find((r) => r.type === type)
  if (!reaction || count === 0) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-900 text-sm border border-zinc-800">
      <span className="text-sm">{reaction.emoji}</span>
      <span className="text-xs text-zinc-400">{count}</span>
    </div>
  )
}

export default ReactionsPicker

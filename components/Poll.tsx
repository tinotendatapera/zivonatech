'use client'

import { useState } from 'react'

export interface PollOption {
  id: string
  text: string
  votes: number
  percentage: number
}

export interface Poll {
  id: string
  question: string
  options: PollOption[]
  totalVotes: number
  userVoteId?: string | null
  expiresAt?: string
}

interface PollProps {
  poll: Poll
  onVote: (pollId: string, optionId: string) => Promise<void>
  isLoading?: boolean
}

export default function PollComponent({ poll, onVote, isLoading = false }: PollProps) {
  const [isVoting, setIsVoting] = useState(false)

  const handleVote = async (optionId: string) => {
    if (isVoting || isLoading || poll.userVoteId) return
    
    setIsVoting(true)
    try {
      await onVote(poll.id, optionId)
    } finally {
      setIsVoting(false)
    }
  }

  const hasVoted = Boolean(poll.userVoteId)
  const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false

  const getDaysLeft = () => {
    if (!poll.expiresAt) return null
    const now = new Date()
    const expires = new Date(poll.expiresAt)
    const hoursLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60))
    
    if (hoursLeft < 1) return 'Ending soon'
    if (hoursLeft < 24) return `${hoursLeft}h left`
    const daysLeft = Math.ceil(hoursLeft / 24)
    return `${daysLeft}d left`
  }

  return (
    <div 
      className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3"
      role="region"
      aria-label={`Poll: ${poll.question}`}
    >
      <h3 className="text-sm font-semibold text-white">{poll.question}</h3>
      
      <div className="space-y-2">
        {poll.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleVote(option.id)}
            disabled={isVoting || isLoading || hasVoted || isExpired}
            className={`w-full rounded-lg p-3 transition text-left ${
              hasVoted || isExpired
                ? 'bg-zinc-900/50 cursor-default'
                : 'bg-zinc-900 hover:bg-zinc-800/80 cursor-pointer'
            } ${isVoting || isLoading ? 'opacity-50' : ''}`}
            aria-label={`Vote for: ${option.text}`}
            aria-pressed={poll.userVoteId === option.id}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white">{option.text}</span>
              <span className="text-xs text-zinc-400">{option.votes}</span>
            </div>
            
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  poll.userVoteId === option.id
                    ? 'bg-purple-500'
                    : 'bg-purple-600/70'
                }`}
                style={{ width: `${option.percentage}%` }}
                role="progressbar"
                aria-valuenow={Math.round(option.percentage)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            
            <div className="mt-1">
              <span className="text-xs text-zinc-500">{Math.round(option.percentage)}%</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 text-xs text-zinc-500 border-t border-zinc-800">
        <span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
        {getDaysLeft() && (
          <span className={isExpired ? 'text-red-400' : ''}>
            {isExpired ? 'Poll ended' : getDaysLeft()}
          </span>
        )}
      </div>
    </div>
  )
}

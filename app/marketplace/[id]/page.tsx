'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MapPin, Eye, MessageCircle, ShieldCheck, CreditCard } from 'lucide-react'

export default function ListingDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [listing, setListing] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutState, setCheckoutState] = useState<{ loading: boolean; message: string | null; orderId?: string | null }>({ loading: false, message: null, orderId: null })
  const [reviewOrderId, setReviewOrderId] = useState<string>('')
  const [reviewRating, setReviewRating] = useState('5')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewStatus, setReviewStatus] = useState<string | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)

  useEffect(() => {
    fetchListing()
  }, [])

  async function fetchListing() {
    const res = await fetch(`/api/listings/${params.id}`)
    const data = await res.json()
    setListing(data.listing)
    setLoading(false)
  }

  async function handleContactSeller() {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: listing.profiles?.id })
    })

    const data = await res.json()
    if (data.conversation_id) {
      router.push(`/messages/${data.conversation_id}`)
    }
  }

  async function handleSecureCheckout() {
    setCheckoutState({ loading: true, message: null })
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Unable to start checkout')
      }
      setCheckoutState({
        loading: false,
        message: data.message || 'Secure checkout started.',
        orderId: data.order?.id ?? null,
      })
      if (data.order?.id) {
        setReviewOrderId(data.order.id)
      }
    } catch (error: any) {
      setCheckoutState({ loading: false, message: error.message || 'Unable to start checkout' })
    }
  }

  async function handleReviewSubmit() {
    setReviewStatus(null)
    setReviewError(null)

    if (!reviewOrderId.trim()) {
      setReviewError('Order ID is required to submit a review.')
      return
    }

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: reviewOrderId.trim(),
          rating: Number(reviewRating),
          comment: reviewComment.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Unable to submit review')
      }

      setReviewStatus('Review submitted. Thank you for sharing feedback.')
      setReviewComment('')
    } catch (error: any) {
      setReviewError(error.message || 'Unable to submit review')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Loading...</div>
  }

  if (!listing) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">Listing not found</div>
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <button onClick={() => router.back()} className="text-purple-400 text-sm">← Back</button>
      </nav>

      <div className="max-w-2xl mx-auto pt-20 pb-10 px-4">
        <div className="aspect-square bg-zinc-900 rounded-2xl border border-zinc-800 mb-6 overflow-hidden">
          {listing.images?.[0] ? (
            <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600">No image</div>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-2">{listing.title}</h1>
        <p className="text-3xl font-bold text-purple-400 mb-4">{listing.currency} {listing.price.toLocaleString()}</p>

        <div className="flex items-center gap-4 text-sm text-zinc-500 mb-6 pb-6 border-b border-zinc-800">
          <span className="flex items-center gap-1"><MapPin size={14} />{listing.location || 'Zimbabwe'}</span>
          <span className="flex items-center gap-1"><Eye size={14} />{listing.views_count} views</span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs capitalize">{listing.condition}</span>
        </div>

        <div className="mb-6 pb-6 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">Description</h3>
          <p className="text-zinc-200 leading-relaxed">{listing.description || 'No description provided.'}</p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center font-bold">
              {listing.profiles?.full_name?.[0] || 'Z'}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold">{listing.profiles?.full_name}</span>
                {listing.profiles?.is_verified && <ShieldCheck size={14} className="text-purple-400" />}
              </div>
              <span className="text-zinc-500 text-sm">@{listing.profiles?.username}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSecureCheckout}
              disabled={checkoutState.loading}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <CreditCard size={16} />
              {checkoutState.loading ? 'Starting secure checkout...' : 'Secure checkout'}
            </button>
            <button
              onClick={handleContactSeller}
              className="w-full py-3 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 font-semibold transition flex items-center justify-center gap-2"
            >
              <MessageCircle size={16} />
              Contact seller
            </button>
          </div>
          {checkoutState.message ? (
            <p className="mt-3 text-sm text-zinc-400">{checkoutState.message}</p>
          ) : null}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-white">Seller review</p>
                <p className="text-xs text-zinc-500">Leave feedback about your purchase.</p>
              </div>
              <span className="text-xs text-zinc-400">Required order id</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Order ID</label>
                <input
                  value={reviewOrderId}
                  onChange={(event) => setReviewOrderId(event.target.value)}
                  placeholder="Enter your order id"
                  className="w-full rounded-xl border border-zinc-800 bg-black/80 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Rating</label>
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black/80 px-3 py-2 text-sm text-white focus:outline-none"
                >
                  <option value="5">5 stars</option>
                  <option value="4">4 stars</option>
                  <option value="3">3 stars</option>
                  <option value="2">2 stars</option>
                  <option value="1">1 star</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Comment</label>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows={4}
                  placeholder="Tell us how the transaction went"
                  className="w-full rounded-xl border border-zinc-800 bg-black/80 px-3 py-2 text-sm text-white focus:outline-none"
                />
              </div>
              {reviewStatus ? <p className="text-sm text-green-400">{reviewStatus}</p> : null}
              {reviewError ? <p className="text-sm text-red-400">{reviewError}</p> : null}
              <button
                onClick={handleReviewSubmit}
                className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 py-3 text-sm font-semibold transition"
              >
                Submit review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

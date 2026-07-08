'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LazyImage from '@/components/LazyImage'
import { Search, Plus, MapPin, Eye, Heart } from 'lucide-react'

interface Listing {
  id: string
  title: string
  price: number
  currency: string
  category: string
  condition: string
  images: string[]
  location: string
  views_count: number
  is_featured: boolean
  profiles: {
    username: string
    full_name: string
    is_verified: boolean
  }
}

const CATEGORIES = [
  'all', 'phones', 'cars', 'electronics', 'fashion',
  'furniture', 'property', 'services', 'jobs'
]

export default function MarketplacePage() {
  const router = useRouter()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchListings()
  }, [category])

  async function fetchListings() {
    setLoading(true)
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (search) params.set('search', search)

    const res = await fetch(`/api/listings?${params}`)
    const data = await res.json()
    setListings(data.listings || [])
    setLoading(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchListings()
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-400">Zivona</h1>
        <button
          onClick={() => router.push('/marketplace/create')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-sm font-semibold transition"
        >
          <Plus size={16} />
          Sell
        </button>
      </nav>

      <div className="max-w-6xl mx-auto pt-20 pb-10 px-4">
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search phones, cars, electronics..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </form>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                category === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden animate-pulse">
                <div className="aspect-square bg-zinc-800" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-zinc-800 rounded w-3/4" />
                  <div className="h-4 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-500 text-lg">No listings yet.</p>
            <p className="text-zinc-600 text-sm mt-1">Be the first to sell something!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {listings.map(listing => (
              <div
                key={listing.id}
                onClick={() => router.push(`/marketplace/${listing.id}`)}
                className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden cursor-pointer hover:border-zinc-700 transition group"
              >
                <div className="aspect-square bg-zinc-800 relative overflow-hidden">
                  {listing.images?.[0] ? (
                    <LazyImage
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-sm">
                      No image
                    </div>
                  )}
                  {listing.is_featured && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-black text-xs font-semibold">
                      Featured
                    </span>
                  )}
                  <button
                    onClick={e => e.stopPropagation()}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70 transition"
                  >
                    <Heart size={14} className="text-white" />
                  </button>
                </div>

                <div className="p-3">
                  <p className="text-sm text-zinc-200 line-clamp-1 mb-1">{listing.title}</p>
                  <p className="text-base font-bold text-purple-400 mb-1">{listing.currency} {listing.price.toLocaleString()}</p>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1"><MapPin size={11} />{listing.location || 'Zimbabwe'}</span>
                    <span className="flex items-center gap-1"><Eye size={11} />{listing.views_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

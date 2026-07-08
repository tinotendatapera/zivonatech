import dynamic from 'next/dynamic'

// Heavy components loaded on demand
export const LazyImage = dynamic(() => import('@/components/LazyImage'), {
  loading: () => <div className="bg-zinc-900 animate-pulse rounded-lg" />,
  ssr: true,
})

export const VideoPlayer = dynamic(() => import('@/components/VideoPlayer'), {
  loading: () => <div className="bg-black rounded-xl h-96 flex items-center justify-center"><div className="animate-spin">Loading...</div></div>,
  ssr: false,
})

export const ReactionsPicker = dynamic(() => import('@/components/ReactionsPicker'), {
  loading: () => null,
  ssr: false,
})

export const Poll = dynamic(() => import('@/components/Poll'), {
  loading: () => <div className="bg-zinc-950 rounded-xl p-4 animate-pulse h-40" />,
  ssr: true,
})

export const ImageUploader = dynamic(() => import('@/components/ImageUploader'), {
  loading: () => <div className="bg-zinc-900 rounded-xl p-4 h-32 animate-pulse" />,
  ssr: false,
})

// Lazy load page components
export const MarketplacePage = dynamic(
  () => import('@/app/marketplace/page'),
  { ssr: true }
)

export const ExpllorePage = dynamic(
  () => import('@/app/(app)/explore/page'),
  { ssr: true }
)

export const NotificationsPage = dynamic(
  () => import('@/app/(app)/notifications/page'),
  { ssr: true }
)

export const BookmarksPage = dynamic(
  () => import('@/app/(app)/bookmarks/page'),
  { ssr: true }
)

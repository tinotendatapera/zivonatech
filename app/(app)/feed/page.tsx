'use client'

import Link from 'next/link'
import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { supabase } from '@/supabase'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import LazyImage from '@/components/LazyImage'
import VideoPlayer from '@/components/VideoPlayer'
import { ReactionsPicker } from '@/components/ReactionsPicker'
import { Poll } from '@/lib/dynamic-imports'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/user-avatar'
// virtualized rendering removed due to runtime error; fallback to simple mapping
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Image, Video, X, Eye, Pencil, Trash2, Loader, Repeat2, Search, TrendingUp, Sparkles, UserPlus, BarChart3, Smile, MapPin } from 'lucide-react'
import { paginateFeedPosts, rankFeedPosts } from '@/lib/feed-ranking'

interface Post {
  id: string
  user_id: string
  content: string
  image_url: string | null
  video_url: string | null
  post_type: 'text' | 'image' | 'video' | 'poll'
  poll_id?: string | null
  likes_count: number
  comments_count: number
  views_count: number
  shares_count: number
  reposts_count: number
  created_at: string
  profiles: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
  }
}

interface PollOption {
  id: string
  text: string
  votes: number
  percentage: number
}

interface Poll {
  id: string
  question: string
  options: PollOption[]
  totalVotes: number
  userVoteId?: string | null
  expiresAt: string
}

interface Comment {
  id: string
  post_id: string
  parent_comment_id?: string | null
  user_id: string
  content: string
  likes_count?: number
  created_at: string
  profiles: {
    id: string
    username: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
  }
}

export default function FeedPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState('')
  const [postImages, setPostImages] = useState<string[]>([])
  const [showComposerMedia, setShowComposerMedia] = useState(false)
  const [posting, setPosting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [postError, setPostError] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [commentReplyDrafts, setCommentReplyDrafts] = useState<Record<string, string>>({})
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null)
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null)
  const [threadPostId, setThreadPostId] = useState<string | null>(null)
  const [threadCommentId, setThreadCommentId] = useState<string | null>(null)
  const [viewedPostIds, setViewedPostIds] = useState<Set<string>>(new Set())
  const [commenting, setCommenting] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({})
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({})
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editingPostContent, setEditingPostContent] = useState('')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')
  const [menuPostId, setMenuPostId] = useState<string | null>(null)
  const [menuCommentId, setMenuCommentId] = useState<string | null>(null)
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<Set<string>>(new Set())
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set())
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set())
  const [repostedPostIds, setRepostedPostIds] = useState<Set<string>>(new Set())
  const [reactionsPickerOpen, setReactionsPickerOpen] = useState<string | null>(null)
  const [pollData, setPollData] = useState<Record<string, Poll>>({})
  const [votingPollIds, setVotingPollIds] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [allPostsCache, setAllPostsCache] = useState<any[]>([])
  const sentinelRef = useRef<HTMLDivElement>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const feedChannelRef = useRef<any>(null)

  function profileHref(profileId?: string | null) {
    return profileId ? `/profile/${profileId}` : '#'
  }

  useEffect(() => {
    async function init() {
      const currentUser = await getUser()
      currentUserIdRef.current = currentUser?.id ?? null
      await fetchPosts(currentUserIdRef.current ?? undefined)
      await fetchBookmarks()
    }

    void init()
  }, [])

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true)
          setCurrentPage((prev) => prev + 1)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore])

  useEffect(() => {
    if (currentPage === 1 || !isLoadingMore) return
    void fetchPosts(currentUserIdRef.current ?? undefined, currentPage, true)
  }, [currentPage])

  useEffect(() => {
    if (loading || posts.length === 0) return

    posts.slice(0, 6).forEach((post) => {
      void recordPostView(post.id)
    })
  }, [loading, posts])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        void fetchPosts(currentUserIdRef.current ?? undefined)
      }
    }, 20_000)

    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('feed-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        async () => {
          await fetchPosts(currentUserIdRef.current ?? undefined)
        }
      )
      .subscribe()

    feedChannelRef.current = channel

    return () => {
      if (feedChannelRef.current) {
        supabase.removeChannel(feedChannelRef.current)
        feedChannelRef.current = null
      }
    }
  }, [user])

  async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return null
    }

    setUser(user)
    return user
  }

  async function fetchPosts(currentUserId?: string, pageNum: number = 1, isLoadMore: boolean = false) {
    try {
      const res = await fetch('/api/posts')
      if (!res.ok) {
        console.error('Error fetching posts:', res.status, res.statusText)
        if (pageNum === 1) setPosts([])
        return
      }

      const data = await res.json()
      const followedIds = await fetch('/api/follows?type=following').then((response) => response.ok ? response.json() : { following: [] }).then((payload) => Array.isArray(payload.following) ? payload.following : [])
      const rankedPosts = rankFeedPosts(data.posts || [], currentUserId ?? user?.id, followedIds)
      const paginatedPosts = paginateFeedPosts(rankedPosts, pageNum, 20)
      
      const hasMoreFlag = paginatedPosts.page * paginatedPosts.limit < paginatedPosts.total
      if (isLoadMore) {
        setPosts((prev) => [...prev, ...(paginatedPosts.items as Post[])])
        setHasMore(hasMoreFlag)
      } else {
        setPosts(paginatedPosts.items as Post[])
        setAllPostsCache(rankedPosts)
        setHasMore(hasMoreFlag)
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
      if (pageNum === 1) setPosts([])
    } finally {
      if (pageNum === 1) setLoading(false)
      setIsLoadingMore(false)
    }
  }

  async function fetchBookmarks() {
    try {
      const res = await fetch('/api/bookmarks')
      if (!res.ok) return

      const data = await res.json().catch(() => ({}))
      const bookmarkIds = (data.bookmarks || [])
        .map((bookmark: any) => bookmark.post_id ?? bookmark.id)
        .filter(Boolean)
      setBookmarkedPostIds(new Set(bookmarkIds))
    } catch {
      // ignore bookmark loading failures
    }
  }

  async function fetchPoll(pollId: string) {
    try {
      const res = await fetch(`/api/polls?poll_id=${pollId}`)
      if (!res.ok) return

      const data = await res.json()
      if (data.poll) {
        setPollData((prev) => ({
          ...prev,
          [pollId]: {
            id: data.poll.id,
            question: data.poll.question,
            options: data.poll.options || [],
            totalVotes: data.poll.totalVotes || 0,
            userVoteId: data.poll.userVoteId,
            expiresAt: data.poll.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        }))
      }
    } catch (error) {
      console.error('Error fetching poll:', error)
    }
  }

  useEffect(() => {
    const pollsToLoad = posts
      .filter((post) => post.post_type === 'poll' && post.poll_id && !pollData[post.poll_id])
      .map((post) => post.poll_id as string)

    if (pollsToLoad.length === 0) return

    void Promise.all(pollsToLoad.map((pollId) => fetchPoll(pollId)))
  }, [posts, pollData])

  async function handleBookmark(postId: string) {
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to update bookmark')
      }

      const data = await res.json().catch(() => ({}))
      setBookmarkedPostIds((prev) => {
        const next = new Set(prev)
        if (data.bookmarked) {
          next.add(postId)
        } else {
          next.delete(postId)
        }
        return next
      })
    } catch (error: any) {
      setPostError(error.message || 'Unable to update bookmark')
    }
  }

    async function handlePost() {
      if (!newPost.trim() && postImages.length === 0) return
      setPosting(true)
      setPostError(null)

      try {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newPost,
            image_url: postImages[0] || null,
            post_type: postImages.length > 0 ? 'image' : 'text'
          })
        })

        if (!res.ok) {
          console.error('Error creating post:', res.status, res.statusText)
          const errorData = await res.json().catch(() => null)
          throw new Error(errorData?.error || 'Unable to create post')
        }

        const data = await res.json()
        if (data.error) {
          throw new Error(data.error || 'Unable to create post')
        }

        setNewPost('')
        setPostImages([])
        setShowComposerMedia(false)
        await fetchPosts()
      } catch (error: any) {
        setPostError(error.message || 'Unable to create post')
      } finally {
        setPosting(false)
      }
    }

  async function handleRepost(postId: string) {
    try {
      const res = await fetch('/api/posts/repost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to repost')
      }

      const data = await res.json().catch(() => ({}))
      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post
        return {
          ...post,
          reposts_count: Math.max(0, post.reposts_count + (data.reposted ? 1 : -1)),
        }
      }))
      setRepostedPostIds((prev) => {
        const next = new Set(prev)
        if (data.reposted) {
          next.add(postId)
        } else {
          next.delete(postId)
        }
        return next
      })
    } catch (error: any) {
      setPostError(error.message || 'Unable to repost')
    }
  }

  async function handleShare(post: Post) {
    try {
      const shareUrl = new URL(window.location.href)
      shareUrl.searchParams.set('post_id', post.id)

      if (navigator.share) {
        await navigator.share({
          title: 'Zivona post',
          text: post.content?.trim() ? post.content.trim() : 'Check out this post on Zivona',
          url: shareUrl.toString(),
        })
        return
      }

      await navigator.clipboard.writeText(shareUrl.toString())
      toast.success('Post link copied to clipboard')
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return
      }

      console.error('Error sharing post:', error)
      toast.error('Unable to share this post right now')
    }
  }

  async function handleReaction(postId: string, reactionType: string) {
    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, reaction_type: reactionType })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to react')
      }

      const data = await res.json()
      
      // Update the post's like count based on the total reactions
      // Calculate total reactions from the reactions object
      const totalReactions = Object.values(data.reactions || {}).reduce((sum: number, count: any) => sum + (count || 0), 0)
      
      setPosts((prev) => 
        prev.map((post) => 
          post.id === postId 
            ? { ...post, likes_count: totalReactions }
            : post
        )
      )
    } catch (error: any) {
      setPostError(error.message || 'Unable to react')
    }
  }

  async function handlePollVote(pollId: string, optionId: string) {
    try {
      setVotingPollIds((prev) => new Set([...prev, pollId]))
      
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poll_id: pollId, option_id: optionId })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to vote on poll')
      }

      // Refresh poll data after voting
      await fetchPoll(pollId)
    } catch (error: any) {
      setPostError(error.message || 'Unable to vote on poll')
    } finally {
      setVotingPollIds((prev) => {
        const updated = new Set(prev)
        updated.delete(pollId)
        return updated
      })
    }
  }

  async function handleLike(postId: string) {
    try {
      const res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId })
      })

      if (!res.ok) {
        console.error('Error liking post:', res.status, res.statusText)
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to like post')
      }

      const data = await res.json()
      setPosts((prev) => prev.map((post) => {
        if (post.id !== postId) return post

        return {
          ...post,
          likes_count: typeof data.likes_count === 'number'
            ? data.likes_count
            : Math.max(0, post.likes_count + (data.liked ? 1 : -1)),
        }
      }))
      setLikedPostIds((prev) => {
        const next = new Set(prev)
        if (data.liked) {
          next.add(postId)
        } else {
          next.delete(postId)
        }
        return next
      })
    } catch (error: any) {
      setPostError(error.message || 'Unable to like post')
    }
  }

  async function handleCommentLike(commentId: string) {
    try {
      const res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId })
      })

      if (!res.ok) {
        console.error('Error liking comment:', res.status, res.statusText)
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to like comment')
      }

      const data = await res.json()
      setCommentsByPost((prev) => {
        return Object.fromEntries(
          Object.entries(prev).map(([postId, comments]) => [
            postId,
            comments.map((comment) => comment.id === commentId
              ? { ...comment, likes_count: typeof data.likes_count === 'number' ? data.likes_count : (comment.likes_count ?? 0) + (data.liked ? 1 : -1) }
              : comment
            )
          ])
        )
      })
      setLikedCommentIds((prev) => {
        const next = new Set(prev)
        if (data.liked) {
          next.add(commentId)
        } else {
          next.delete(commentId)
        }
        return next
      })
    } catch (error: any) {
      setCommentError(error.message || 'Unable to like comment')
    }
  }

  function getCommentReplies(postId: string, parentCommentId: string) {
    return (commentsByPost[postId] || []).filter((comment) => comment.parent_comment_id === parentCommentId)
  }

  function getReplyCount(postId: string, parentCommentId: string) {
    return getCommentReplies(postId, parentCommentId).length
  }

  function getThreadRootComment(postId: string, commentId: string) {
    return (commentsByPost[postId] || []).find((comment) => comment.id === commentId)
  }

  async function recordPostView(postId: string) {
    if (viewedPostIds.has(postId)) return

    try {
      const res = await fetch('/api/posts/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId })
      })

      if (!res.ok) {
        return
      }

      const data = await res.json()
      if (data.views_count != null) {
        setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, views_count: data.views_count } : post))
      }
      setViewedPostIds((prev) => new Set(prev).add(postId))
    } catch {
      // ignore view tracking failures
    }
  }

  async function openThreadView(postId: string, commentId: string) {
    setThreadPostId(postId)
    setThreadCommentId(commentId)

    if (!commentsByPost[postId]) {
      await fetchComments(postId)
    }

    await recordPostView(postId)
  }

  function closeThreadView() {
    setThreadPostId(null)
    setThreadCommentId(null)
  }

  async function handleReply(postId: string, parentCommentId: string) {
    const content = (commentReplyDrafts[parentCommentId] || '').trim()
    if (!content) return

    setCommenting(true)
    setCommentError(null)

    try {
      const res = await fetch('/api/posts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, parent_comment_id: parentCommentId, content })
      })

      if (!res.ok) {
        console.error('Error adding reply:', res.status, res.statusText)
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to add reply')
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error || 'Unable to add reply')
      }

      setCommentReplyDrafts((prev) => ({ ...prev, [parentCommentId]: '' }))
      setReplyingCommentId(null)
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment],
      }))
      setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post))
    } catch (error: any) {
      setCommentError(error.message || 'Unable to add reply')
    } finally {
      setCommenting(false)
    }
  }

  async function fetchComments(postId: string) {
    setCommentsLoading((prev) => ({ ...prev, [postId]: true }))

    try {
      const res = await fetch(`/api/posts/comments?post_id=${encodeURIComponent(postId)}`)
      if (!res.ok) {
        console.error('Error fetching comments:', res.status, res.statusText)
        return
      }

      const data = await res.json()
      if (data.error) {
        console.error('Error fetching comments:', data.error)
        return
      }

      setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }))
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [postId]: false }))
    }
  }

  async function handleComment(postId: string) {
    const content = (commentDrafts[postId] || '').trim()
    if (!content) return

    setCommenting(true)
    setCommentError(null)

    try {
      const res = await fetch('/api/posts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, content })
      })

      if (!res.ok) {
        console.error('Error adding comment:', res.status, res.statusText)
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to add comment')
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.error || 'Unable to add comment')
      }

      setCommentDrafts((prev) => ({ ...prev, [postId]: '' }))
      setCommentingPostId(null)
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment],
      }))
      setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, comments_count: post.comments_count + 1 } : post))
    } catch (error: any) {
      setCommentError(error.message || 'Unable to add comment')
    } finally {
      setCommenting(false)
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to delete post')
      }

      setPosts((prev) => prev.filter((post) => post.id !== postId))
      setMenuPostId(null)
    } catch (error: any) {
      setPostError(error.message || 'Unable to delete post')
    }
  }

  async function handleEditPost(postId: string) {
    if (!editingPostContent.trim()) return

    try {
      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, content: editingPostContent.trim() })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to edit post')
      }

      const data = await res.json()
      setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, content: data.post?.content ?? editingPostContent.trim() } : post))
      setEditingPostId(null)
      setEditingPostContent('')
      setMenuPostId(null)
    } catch (error: any) {
      setPostError(error.message || 'Unable to edit post')
    }
  }

  async function handleDeleteComment(commentId: string, postId: string) {
    try {
      const res = await fetch('/api/posts/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, post_id: postId })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to delete comment')
      }

      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((comment) => comment.id !== commentId)
      }))
      setMenuCommentId(null)
      setPosts((prev) => prev.map((post) => post.id === postId ? { ...post, comments_count: Math.max(0, post.comments_count - 1) } : post))
    } catch (error: any) {
      setCommentError(error.message || 'Unable to delete comment')
    }
  }

  async function handleEditComment(commentId: string, postId: string) {
    if (!editingCommentContent.trim()) return

    try {
      const res = await fetch('/api/posts/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: commentId, post_id: postId, content: editingCommentContent.trim() })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to edit comment')
      }

      const data = await res.json()
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((comment) => comment.id === commentId ? { ...comment, content: data.comment?.content ?? editingCommentContent.trim() } : comment)
      }))
      setEditingCommentId(null)
      setEditingCommentContent('')
      setMenuCommentId(null)
    } catch (error: any) {
      setCommentError(error.message || 'Unable to edit comment')
    }
  }

  async function toggleComments(postId: string) {
    const isOpen = commentingPostId === postId
    setCommentingPostId(isOpen ? null : postId)

    if (!isOpen && !commentsByPost[postId]) {
      await fetchComments(postId)
    }

    if (!isOpen) {
      await recordPostView(postId)
    }
  }

  function handleComposerImagesChange(images: string[]) {
    setPostImages(images)
    setShowComposerMedia(images.length > 0)
  }

  const composerUser = {
    id: user?.id ?? '',
    name:
      (user?.userMetadata?.full_name && String(user.userMetadata.full_name)) ||
      (user?.userMetadata?.name && String(user.userMetadata.name)) ||
      'You',
    username: (user?.userMetadata?.username && String(user.userMetadata.username)) || 'you',
    avatar_url: user?.userMetadata?.avatar_url ? String(user.userMetadata.avatar_url) : null,
    color: 'from-violet-600 to-blue-600',
  }

  function renderPostItem({ index, style }: { index: number; style: CSSProperties }) {
    const post = posts[index]
    return (
      <div key={post?.id ?? index} style={style} className="px-0">
        <article
          key={post.id}
          className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4"
          role="article"
          aria-label={`Post by ${post.profiles?.full_name}`}
        >
          {/* Post Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href={profileHref(post.profiles?.id)} className="flex items-center gap-3 transition hover:opacity-80">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-sm font-bold">
                  {post.profiles?.full_name?.[0] || 'Z'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {post.profiles?.full_name || 'Zivona User'}
                    {post.profiles?.is_verified && (
                      <span className="text-purple-400 text-xs">✓</span>
                    )}
                  </p>
                  <span className="text-zinc-500 text-xs">@{post.profiles?.username} · {new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            </div>
            {user?.id === post.user_id ? (
              <div className="relative">
                <button
                  onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                  className="text-zinc-500 hover:text-white transition"
                >
                  <MoreHorizontal size={18} />
                </button>
                {menuPostId === post.id ? (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-lg z-10">
                    <button
                      onClick={() => {
                        setEditingPostId(post.id)
                        setEditingPostContent(post.content)
                        setMenuPostId(null)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                    >
                      <Pencil size={14} /> Edit post
                    </button>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-zinc-800"
                    >
                      <Trash2 size={14} /> Delete post
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {editingPostId === post.id ? (
            <div className="mb-3 space-y-2">
              <textarea
                value={editingPostContent}
                onChange={(e) => setEditingPostContent(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => { setEditingPostId(null); setEditingPostContent('') }} className="rounded-full px-3 py-1.5 text-sm text-zinc-400 hover:text-white">Cancel</button>
                <button onClick={() => handleEditPost(post.id)} className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white">Save</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-100 mb-3 leading-relaxed">
              {post.content}
            </p>
          )}

          {post.post_type === 'video' && post.video_url ? (
            <VideoPlayer
              src={post.video_url}
              className="w-full rounded-xl mb-3 max-h-96"
              controls={true}
            />
          ) : post.post_type === 'image' && post.image_url ? (
            <LazyImage
              src={post.image_url}
              alt="Post"
              className="w-full rounded-xl mb-3 object-cover max-h-80"
            />
          ) : post.image_url ? (
            <LazyImage
              src={post.image_url}
              alt="Post"
              className="w-full rounded-xl mb-3 object-cover max-h-80"
            />
          ) : null}

          {post.post_type === 'poll' && post.poll_id ? (
            pollData[post.poll_id] ? (
              <div className="mb-4">
                <Poll
                  poll={pollData[post.poll_id]}
                  onVote={handlePollVote}
                  isLoading={votingPollIds.has(post.poll_id)}
                />
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-500">
                Loading poll...
              </div>
            )
          ) : null}

          <div className="flex items-center gap-5 pt-3 border-t border-zinc-800 relative text-sm">
            <div className="relative">
              <button
                onClick={() => setReactionsPickerOpen(reactionsPickerOpen === post.id ? null : post.id)}
                className={`flex items-center gap-1 transition ${likedPostIds.has(post.id) ? 'text-red-400' : 'text-zinc-400 hover:text-red-400'}`}
                aria-label={`React to post with emoji. Current reactions: ${post.likes_count}`}
                aria-expanded={reactionsPickerOpen === post.id}
                aria-pressed={likedPostIds.has(post.id)}
              >
                <Heart size={16} />
                <span>{post.likes_count}</span>
              </button>
              <ReactionsPicker
                isOpen={reactionsPickerOpen === post.id}
                onClose={() => setReactionsPickerOpen(null)}
                onReact={(type) => handleReaction(post.id, type)}
              />
            </div>
            <button
              onClick={() => toggleComments(post.id)}
              className="flex items-center gap-1 text-zinc-400 hover:text-blue-400 transition"
              aria-label={`View comments on post. ${post.comments_count} comments`}
              aria-expanded={threadPostId === post.id}
            >
              <MessageCircle size={16} />
              <span>{post.comments_count}</span>
            </button>
            <div className="flex items-center gap-1 text-zinc-400" aria-label={`Post views: ${post.views_count ?? 0}`}>
              <Eye size={16} />
              <span>{post.views_count ?? 0}</span>
            </div>
            <button
              onClick={() => handleRepost(post.id)}
              className={`flex items-center gap-1 transition ${repostedPostIds.has(post.id) ? 'text-green-400' : 'text-zinc-400 hover:text-green-400'}`}
              aria-label={`Repost. ${post.reposts_count} reposts. ${repostedPostIds.has(post.id) ? 'Already reposted' : 'Not reposted'}`}
              aria-pressed={repostedPostIds.has(post.id)}
            >
              <Repeat2 size={16} />
              <span>{post.reposts_count}</span>
            </button>
            <button
              onClick={() => void handleShare(post)}
              className="flex items-center gap-1 text-zinc-400 hover:text-blue-400 transition"
              aria-label="Share this post"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={() => handleBookmark(post.id)}
              className={`ml-auto flex items-center gap-1 transition ${bookmarkedPostIds.has(post.id) ? 'text-purple-400' : 'text-zinc-400 hover:text-purple-400'}`}
            >
              <Bookmark size={16} />
            </button>
          </div>

          {commentingPostId === post.id ? (
            <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-200">Comments</span>
                <button onClick={() => setCommentingPostId(null)} className="text-zinc-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {commentsLoading[post.id] ? (
                <p className="text-sm text-zinc-500">Loading comments...</p>
              ) : (commentsByPost[post.id] || []).length === 0 ? (
                <p className="text-sm text-zinc-500">No comments yet. Be the first to comment.</p>
              ) : (
                <div className="space-y-3 mb-3">
                  {(commentsByPost[post.id] || []).filter((comment) => !comment.parent_comment_id).map((comment) => (
                    <div key={comment.id} className="rounded-xl border border-zinc-800 bg-black/80 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Link href={profileHref(comment.profiles?.id)} className="flex flex-1 items-center gap-2 transition hover:opacity-80">
                          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">
                            {comment.profiles?.full_name?.[0] || 'Z'}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-zinc-100">
                              {comment.profiles?.full_name || 'Zivona User'}
                            </p>
                            <p className="text-xs text-zinc-500">
                              @{comment.profiles?.username} · {new Date(comment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                        {user?.id === comment.user_id ? (
                          <div className="relative">
                            <button onClick={() => setMenuCommentId(menuCommentId === comment.id ? null : comment.id)} className="text-zinc-500 hover:text-white">
                              <MoreHorizontal size={14} />
                            </button>
                            {menuCommentId === comment.id ? (
                              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-lg z-10">
                                <button
                                  onClick={() => {
                                    setEditingCommentId(comment.id)
                                    setEditingCommentContent(comment.content)
                                    setMenuCommentId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                                >
                                  <Pencil size={14} /> Edit comment
                                </button>
                                <button
                                  onClick={() => handleDeleteComment(comment.id, post.id)}
                                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-zinc-800"
                                >
                                  <Trash2 size={14} /> Delete comment
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingCommentContent}
                            onChange={(e) => setEditingCommentContent(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => { setEditingCommentId(null); setEditingCommentContent('') }} className="rounded-full px-3 py-1.5 text-sm text-zinc-400 hover:text-white">Cancel</button>
                            <button onClick={() => handleEditComment(comment.id, post.id)} className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white">Save</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-200 leading-relaxed">{comment.content}</p>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400">
                        <button
                          onClick={() => handleCommentLike(comment.id)}
                          className={`transition ${likedCommentIds.has(comment.id) ? 'text-red-400' : 'hover:text-red-400'}`}
                          aria-pressed={likedCommentIds.has(comment.id)}
                        >
                          Like {comment.likes_count ?? 0}
                        </button>
                        <button onClick={() => setReplyingCommentId(replyingCommentId === comment.id ? null : comment.id)} className="hover:text-blue-400 transition">
                          Reply
                        </button>
                        <button onClick={() => openThreadView(post.id, comment.id)} className="hover:text-purple-400 transition">
                          Thread ({getReplyCount(post.id, comment.id)})
                        </button>
                      </div>

                      {getCommentReplies(post.id, comment.id).map((reply) => (
                        <div key={reply.id} className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 pl-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Link href={profileHref(reply.profiles?.id)} className="flex flex-1 items-center gap-2 transition hover:opacity-80">
                              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-[10px] font-bold">
                                {reply.profiles?.full_name?.[0] || 'Z'}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-zinc-100">
                                  {reply.profiles?.full_name || 'Zivona User'}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  @{reply.profiles?.username} · {new Date(reply.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </Link>
                          </div>
                          <p className="text-sm text-zinc-200 leading-relaxed">{reply.content}</p>
                          <div className="mt-2 flex items-center gap-4 text-xs text-zinc-400">
                            <button
                              onClick={() => handleCommentLike(reply.id)}
                              className={`transition ${likedCommentIds.has(reply.id) ? 'text-red-400' : 'hover:text-red-400'}`}
                              aria-pressed={likedCommentIds.has(reply.id)}
                            >
                              Like {reply.likes_count ?? 0}
                            </button>
                          </div>
                        </div>
                      ))}

                      {replyingCommentId === comment.id ? (
                        <div className="mt-3 rounded-xl border border-zinc-800 bg-black p-3">
                          <textarea
                            value={commentReplyDrafts[comment.id] || ''}
                            onChange={(e) => setCommentReplyDrafts((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                            placeholder="Write a reply..."
                            rows={2}
                            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={() => setReplyingCommentId(null)}
                              className="rounded-full px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReply(post.id, comment.id)}
                              disabled={commenting || !commentReplyDrafts[comment.id]?.trim()}
                              className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {commenting ? 'Replying...' : 'Reply'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-zinc-800 bg-black p-3">
                <textarea
                  value={commentDrafts[post.id] || ''}
                  onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Write a comment..."
                  rows={2}
                  className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setCommentingPostId(null)}
                    className="rounded-full px-3 py-1.5 text-sm text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleComment(post.id)}
                    disabled={commenting || !commentDrafts[post.id]?.trim()}
                    className="rounded-full bg-purple-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {commenting ? 'Posting...' : 'Comment'}
                  </button>
                </div>
                {commentError ? <p className="mt-2 text-sm text-red-400">{commentError}</p> : null}
              </div>
            </div>
          ) : null}
        </article>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-6 lg:px-6">
      <div className="mx-auto grid w-full max-w-[980px] gap-6 xl:grid-cols-[minmax(0,600px)_320px] xl:justify-center">
        <div className="min-w-0 space-y-4">
          <section
            className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm"
            aria-label="Create new post"
          >
            <div className="flex gap-3">
              <UserAvatar user={composerUser} size="md" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <textarea
                  value={newPost}
                  onChange={(event) => setNewPost(event.target.value)}
                  placeholder="What’s happening?"
                  rows={3}
                  className="w-full resize-none border-0 bg-transparent p-0 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-1 text-primary">
                    <button
                      type="button"
                      onClick={() => setShowComposerMedia((prev) => !prev)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      aria-label="Add image"
                      aria-pressed={showComposerMedia || postImages.length > 0}
                    >
                      <Image className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Video upload coming soon')}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      aria-label="Add video"
                    >
                      <Video className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Polls coming soon')}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      aria-label="Create poll"
                    >
                      <BarChart3 className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Emoji picker coming soon')}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      aria-label="Add emoji"
                    >
                      <Smile className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast('Location tagging coming soon')}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                      aria-label="Add location"
                    >
                      <MapPin className="size-4" />
                    </button>
                  </div>
                  <button
                    onClick={handlePost}
                    disabled={posting || (!newPost.trim() && postImages.length === 0)}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-primary/40 disabled:text-primary-foreground/60"
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>

                {(showComposerMedia || postImages.length > 0) ? (
                  <div className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
                    <ImageUploader images={postImages} onChange={handleComposerImagesChange} maxImages={4} />
                  </div>
                ) : null}

                {postError ? (
                  <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {postError}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section
            className="space-y-4"
            aria-label="Feed of posts from users you follow"
            aria-live="polite"
            aria-busy={loading || isLoadingMore}
          >
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm animate-pulse">
                    <div className="flex gap-3">
                      <div className="size-10 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded bg-muted" />
                        <div className="h-3 w-2/3 rounded bg-muted" />
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-background/60 py-20 text-center">
                <p className="text-lg text-muted-foreground">No posts yet.</p>
                <p className="mt-1 text-sm text-muted-foreground/80">Be the first to post something.</p>
              </div>
            ) : (
              <>
                {threadPostId && threadCommentId ? (
                  <div className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Reply thread</p>
                        <p className="text-xs text-muted-foreground">Viewing the thread for one comment on this post.</p>
                      </div>
                      <button onClick={closeThreadView} className="text-sm text-muted-foreground transition hover:text-foreground">
                        Close
                      </button>
                    </div>
                    {(() => {
                      const root = threadPostId && threadCommentId ? getThreadRootComment(threadPostId, threadCommentId) : null
                      const replies = threadPostId && threadCommentId ? getCommentReplies(threadPostId, threadCommentId) : []

                      if (!root) {
                        return <p className="text-sm text-muted-foreground">Loading thread...</p>
                      }

                      return (
                        <>
                          <div className="mb-4 rounded-2xl border border-border bg-background/80 p-4">
                            <div className="mb-2 flex items-center gap-3">
                              <Link href={profileHref(root.profiles?.id)} className="flex items-center gap-3 transition hover:opacity-80">
                                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                                  {root.profiles?.full_name?.[0] || 'Z'}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{root.profiles?.full_name || 'Zivona User'}</p>
                                  <p className="text-xs text-muted-foreground">@{root.profiles?.username} · {new Date(root.created_at).toLocaleDateString()}</p>
                                </div>
                              </Link>
                            </div>
                            <p className="text-sm leading-relaxed text-foreground/90">{root.content}</p>
                            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                              <button
                                onClick={() => handleCommentLike(root.id)}
                                className={`transition ${likedCommentIds.has(root.id) ? 'text-red-500' : 'hover:text-red-500'}`}
                                aria-pressed={likedCommentIds.has(root.id)}
                              >
                                Like {root.likes_count ?? 0}
                              </button>
                              <button onClick={() => setReplyingCommentId(replyingCommentId === root.id ? null : root.id)} className="transition hover:text-primary">
                                Reply
                              </button>
                            </div>
                          </div>
                          <div className="mb-4 space-y-3">
                            {replies.map((reply) => (
                              <div key={reply.id} className="rounded-2xl border border-border bg-background/70 p-4">
                                <div className="mb-2 flex items-center gap-3">
                                  <Link href={profileHref(reply.profiles?.id)} className="flex items-center gap-3 transition hover:opacity-80">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                                      {reply.profiles?.full_name?.[0] || 'Z'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">{reply.profiles?.full_name || 'Zivona User'}</p>
                                      <p className="text-xs text-muted-foreground">@{reply.profiles?.username} · {new Date(reply.created_at).toLocaleDateString()}</p>
                                    </div>
                                  </Link>
                                </div>
                                <p className="text-sm leading-relaxed text-foreground/90">{reply.content}</p>
                                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                  <button
                                    onClick={() => handleCommentLike(reply.id)}
                                    className={`transition ${likedCommentIds.has(reply.id) ? 'text-red-500' : 'hover:text-red-500'}`}
                                    aria-pressed={likedCommentIds.has(reply.id)}
                                  >
                                    Like {reply.likes_count ?? 0}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="rounded-2xl border border-border bg-background/80 p-4">
                            <textarea
                              value={commentReplyDrafts[root.id] || ''}
                              onChange={(event) => setCommentReplyDrafts((prev) => ({ ...prev, [root.id]: event.target.value }))}
                              placeholder="Write a reply..."
                              rows={2}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                            />
                            <div className="mt-2 flex items-center justify-end gap-2">
                              <button
                                onClick={() => setReplyingCommentId(null)}
                                className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleReply(threadPostId!, root.id)}
                                disabled={commenting || !commentReplyDrafts[root.id]?.trim()}
                                className="rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {commenting ? 'Replying...' : 'Reply'}
                              </button>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ) : null}
                <div className="space-y-4">
                  {posts.map((_, idx) => renderPostItem({ index: idx, style: {} as any }))}
                  {isLoadingMore ? (
                    <div className="flex justify-center py-8">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader size={18} className="animate-spin" />
                        <span>Loading more posts...</span>
                      </div>
                    </div>
                  ) : null}
                  <div ref={sentinelRef} className="py-4 text-center text-muted-foreground" aria-hidden="true" />
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-6 space-y-4">
            <section className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm">
              <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-muted-foreground">
                <Search className="size-4 shrink-0" />
                <input
                  type="search"
                  placeholder="Search Zivona"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  aria-label="Search Zivona"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Trending</h2>
                  <p className="text-xs text-muted-foreground">What people are talking about</p>
                </div>
                <TrendingUp className="size-4 text-primary" />
              </div>
              <div className="space-y-3">
                {[
                  { topic: '#ZivonaDesign', meta: '12.4K posts' },
                  { topic: '#CreatorTools', meta: '8.1K posts' },
                  { topic: '#BuildInPublic', meta: '5.6K posts' },
                ].map((item) => (
                  <div key={item.topic} className="rounded-2xl bg-muted/40 px-3 py-3">
                    <p className="text-sm font-medium text-foreground">{item.topic}</p>
                    <p className="text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Who to follow</h2>
                  <p className="text-xs text-muted-foreground">Suggested accounts and updates</p>
                </div>
                <Sparkles className="size-4 text-primary" />
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Zivona News', handle: '@zivonanews', note: 'Platform updates and announcements' },
                  { name: 'Creator Circle', handle: '@creatorcircle', note: 'Product tips, launches, and stories' },
                  { name: 'Local Pulse', handle: '@localpulse', note: 'Neighborhood news and events' },
                ].map((item) => (
                  <div key={item.handle} className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <UserPlus className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.handle}</p>
                      <p className="mt-1 text-xs text-muted-foreground/90">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-background/80 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">News</h2>
                  <p className="text-xs text-muted-foreground">Quick reads from around Zivona</p>
                </div>
                <BarChart3 className="size-4 text-primary" />
              </div>
              <div className="space-y-3">
                {[
                  'A smoother mobile composer is rolling out this week.',
                  'Trending tags now surface faster in the explore rail.',
                  'New profile polish is coming to the sidebar card.',
                ].map((headline) => (
                  <div key={headline} className="rounded-2xl bg-muted/40 px-3 py-3 text-sm text-foreground/90">
                    {headline}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  )
}

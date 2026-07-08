"use client"

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react"
import { ImageIcon, Loader2, Smile, MapPin } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { UserAvatar } from "@/components/user-avatar"
import { useMemo } from "react"
import { useAuth } from "@/components/auth/auth-state"
import { initials } from "@/lib/data"

type ComposeContextValue = { open: () => void }
const ComposeContext = createContext<ComposeContextValue>({ open: () => {} })

export function useCompose() {
  return useContext(ComposeContext)
}

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState("")
  const [posting, setPosting] = useState(false)
  const { user } = useAuth()
  const profileUser = useMemo(() => ({
    id: user?.id || '',
    name: user?.userMetadata?.full_name ? String(user.userMetadata.full_name) : user?.email || 'User',
    username: user?.userMetadata?.username ? String(user.userMetadata.username) : 'user',
    avatar: user?.userMetadata?.avatar_url ? String(user.userMetadata.avatar_url) : '',
  }), [user])

  function submit() {
    if (!text.trim()) return
    setPosting(true)
    setTimeout(() => {
      setPosting(false)
      setText("")
      setIsOpen(false)
      toast.success("Your post is live")
    }, 800)
  }

  return (
    <ComposeContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create post</DialogTitle>
          </DialogHeader>
          <div className="flex gap-3">
            <UserAvatar user={profileUser} size="sm" />
            <div className="flex-1">
              <Textarea
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What do you want to share?"
                className="min-h-28 resize-none border-0 px-0 text-base shadow-none focus-visible:ring-0"
              />
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-1 text-primary">
                  <Button variant="ghost" size="icon" className="size-9" aria-label="Add image">
                    <ImageIcon className="size-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9" aria-label="Add emoji">
                    <Smile className="size-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-9" aria-label="Add location">
                    <MapPin className="size-5" />
                  </Button>
                </div>
                <Button
                  onClick={submit}
                  disabled={!text.trim() || posting}
                  className="rounded-full"
                >
                  {posting ? <Loader2 className="size-4 animate-spin" /> : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ComposeContext.Provider>
  )
}

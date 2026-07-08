import type { ReactNode } from 'react'
import { AppSidebar } from '@/components/app/app-sidebar'
import { BottomNav } from '@/components/app/bottom-nav'
import { MobileTopbar } from '@/components/app/mobile-topbar'
import { ComposeProvider } from '@/components/app/compose-provider'

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <ComposeProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopbar />
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        </div>
      </div>
      <BottomNav />
    </ComposeProvider>
  )
}

import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import I18nProvider from '@/lib/i18n'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/auth/auth-state'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Zivona — Create. Connect. Grow.',
  description:
    'Zivona is Africa\'s all-in-one digital ecosystem — social feed, marketplace, and messaging in one premium, AI-first platform.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/favicon.ico?v=2',
        type: 'image/x-icon',
      },
      {
        url: '/favicon.png?v=2',
        type: 'image/png',
      },
      {
        url: '/zivona.png?v=2',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/zivona.png?v=2',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: '/favicon.png?v=2',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#16131e' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <I18nProvider>
              {children}
              <Toaster position="top-center" />
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Libre_Caslon_Display, Public_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const display = Libre_Caslon_Display({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
})

const sans = Public_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
})

const mono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'ClientHub',
  description: 'CRM + activity tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}

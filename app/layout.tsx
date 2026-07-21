import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ClientHub',
  description: 'CRM + activity tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}

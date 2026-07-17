import type { Metadata, Viewport } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Progress Platform' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1 }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ro"><body>{children}</body></html>
}

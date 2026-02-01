import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Modul tra cứu Spliter cấp 2',
  description: 'Modul tra cứu spliter cấp 2 theo OLT, Slot, Port',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}

'use client'

import { usePathname } from 'next/navigation'
import AdminNav from './AdminNav'

export default function AdminNavConditional() {
  const pathname = usePathname()
  if (pathname === '/admin' || pathname === '/admin/') return null
  return <AdminNav />
}

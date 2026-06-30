import AdminNavConditional from '@/components/AdminNavConditional'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminNavConditional />
    </>
  )
}

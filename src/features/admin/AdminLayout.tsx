import { DashboardLayout } from '@/layouts/DashboardLayout'
import { adminNav } from './navigation'

/** Carcasa del área de Administración (reutiliza DashboardLayout). */
export function AdminLayout() {
  return (
    <DashboardLayout navItems={adminNav} sectionLabel="Administración" headerTitle="NILO Admin" />
  )
}

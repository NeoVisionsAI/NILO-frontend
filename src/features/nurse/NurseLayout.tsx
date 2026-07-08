import { DashboardLayout } from '@/layouts/DashboardLayout'
import { nurseNav } from './navigation'

/** Carcasa del área de Enfermería (reutiliza DashboardLayout). */
export function NurseLayout() {
  return <DashboardLayout navItems={nurseNav} sectionLabel="Enfermería" headerTitle="NILO" />
}

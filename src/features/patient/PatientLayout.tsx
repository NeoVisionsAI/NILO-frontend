import { DashboardLayout } from '@/layouts/DashboardLayout'
import { patientNav } from './navigation'

/** Carcasa del área del Paciente (reutiliza DashboardLayout). */
export function PatientLayout() {
  return <DashboardLayout navItems={patientNav} sectionLabel="Mi espacio" headerTitle="NILO" />
}

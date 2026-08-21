import { createBrowserRouter, Navigate } from 'react-router-dom'
import { UserRole } from '@/types'
import { ProtectedRoute } from './ProtectedRoute'
import { ROOT_PATHS } from './paths'

import { LoginPage } from '@/features/auth'
import { RootRedirect } from '@/features/shared/pages/RootRedirect'
import { NotFoundPage } from '@/features/shared/pages/NotFoundPage'

import { AdminLayout, AdminDashboardPage, UsersPage, SettingsPage } from '@/features/admin'
import {
  DoctorLayout,
  SummaryPage,
  AddPatientPage,
  AddNodePage,
  CardmedDevicePage,
  PatientsListPage,
  AlertsPage,
  PatientDetailPage,
  NodeDetailPage,
} from '@/features/doctor'
import { NurseLayout, NurseDashboardPage, RoundsPage, TasksPage } from '@/features/nurse'
import {
  PatientLayout,
  PatientDashboardPage,
  MyVitalsPage,
  AppointmentsPage,
  MedicationPage,
} from '@/features/patient'

/**
 * Definición central de rutas.
 *
 * La estructura usa rutas ANIDADAS: cada layout de rol renderiza un <Outlet />
 * donde se cargan sus páginas. El detalle de paciente anida a su vez subvistas
 * (Resumen / Constantes / Historial) en un Outlet interno, lo que permite
 * intercambiar subvistas dentro de un contenedor sin recargar la página.
 */
export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },

  { path: ROOT_PATHS.login, element: <LoginPage /> },

  // Área ADMINISTRADOR
  {
    path: ROOT_PATHS.admin,
    element: (
      <ProtectedRoute allow={[UserRole.ADMIN]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'usuarios', element: <UsersPage /> },
      { path: 'configuracion', element: <SettingsPage /> },
    ],
  },

  // Área MÉDICO
  {
    path: ROOT_PATHS.doctor,
    element: (
      <ProtectedRoute allow={[UserRole.DOCTOR]}>
        <DoctorLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <SummaryPage /> },
      { path: 'pacientes', element: <PatientsListPage /> },
      { path: 'pacientes/nuevo', element: <AddPatientPage /> },
      { path: 'nodos/nuevo', element: <AddNodePage /> },
      { path: 'dispositivos/cardmed', element: <CardmedDevicePage /> },
      {
        path: 'nodos/:nodeId',
        element: <NodeDetailPage />,
      },
      {
        path: 'pacientes/:patientId',
        element: <PatientDetailPage />,
      },
      { path: 'alertas', element: <AlertsPage /> },
    ],
  },

  // Área ENFERMERÍA
  {
    path: ROOT_PATHS.nurse,
    element: (
      <ProtectedRoute allow={[UserRole.NURSE]}>
        <NurseLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <NurseDashboardPage /> },
      { path: 'rondas', element: <RoundsPage /> },
      { path: 'tareas', element: <TasksPage /> },
    ],
  },

  // Área PACIENTE
  {
    path: ROOT_PATHS.patient,
    element: (
      <ProtectedRoute allow={[UserRole.PATIENT]}>
        <PatientLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PatientDashboardPage /> },
      { path: 'constantes', element: <MyVitalsPage /> },
      { path: 'citas', element: <AppointmentsPage /> },
      { path: 'medicacion', element: <MedicationPage /> },
    ],
  },

  { path: '404', element: <NotFoundPage /> },
  { path: '*', element: <Navigate to="/404" replace /> },
])

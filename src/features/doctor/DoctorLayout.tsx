import { useState } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ActivePatientsSidebar } from './components/ActivePatientsSidebar'
import { ClinicianTopBar, type ResourceListItem } from './components/ClinicianTopBar'
import { ClinicalDataProvider, useClinicalData } from './context/ClinicalDataContext'
import { patientDisplayName } from '@/types'
import { ROOT_PATHS } from '@/router/paths'
import './DoctorLayout.css'

const AVATAR_COLORS = ['#0369a1', '#0f766e', '#7c3aed', '#be123c', '#b45309', '#4338ca', '#0891b2']

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : ''
  return (first + last).toUpperCase()
}

function ListAvatar({ name, photoUrl }: { name: string; photoUrl?: string | null }) {
  if (photoUrl) {
    return <img className="nilo-ctopbar__item-avatar" src={photoUrl} alt="" />
  }
  return (
    <span
      className="nilo-ctopbar__item-avatar nilo-ctopbar__item-avatar--initials"
      style={{ backgroundColor: colorForName(name) }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  )
}

function DoctorShell() {
  const navigate = useNavigate()
  const { patientId } = useParams()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { patients, nodes, monitoringActive } = useClinicalData()

  const patientItems: ResourceListItem[] = patients.map((p) => {
    const name = patientDisplayName(p)
    const profile = p.patient_profile
    const secondary = [profile?.room && `Hab. ${profile.room}`, profile?.bed && `Cama ${profile.bed}`]
      .filter(Boolean)
      .join(' · ')
    const searchText = [
      name,
      p.email,
      profile?.medical_record_number,
      profile?.room,
      profile?.bed,
      profile?.relative_name,
    ]
      .filter(Boolean)
      .join(' ')

    return {
      id: p.id,
      primary: name,
      secondary: secondary || undefined,
      searchText,
      leading: <ListAvatar name={name} photoUrl={p.photo} />,
      onSelect: () => navigate(`${ROOT_PATHS.doctor}/pacientes/${p.id}`),
    }
  })

  const nodeItems: ResourceListItem[] = nodes.map((n) => ({
    id: n.id,
    primary: n.name,
    secondary: n.location ?? n.mac_address,
    searchText: [n.name, n.location, n.mac_address, n.city, n.ddns].filter(Boolean).join(' '),
    leading: <MaterialIcon name="router" size={20} className="nilo-ctopbar__item-icon" />,
    onSelect: () => navigate(`${ROOT_PATHS.doctor}/nodos/${n.id}`),
  }))

  function goToPatient(id: string) {
    setMobileOpen(false)
    navigate(`${ROOT_PATHS.doctor}/pacientes/${id}`)
  }

  return (
    <div className="nilo-clinician m3">
      <ClinicianTopBar
        onToggleSidebar={() => setMobileOpen((v) => !v)}
        patientItems={patientItems}
        nodeItems={nodeItems}
        onAddPatient={() => navigate(`${ROOT_PATHS.doctor}/pacientes/nuevo`)}
        onAddNode={() => navigate(`${ROOT_PATHS.doctor}/nodos/nuevo`)}
      />

      <div className="nilo-clinician__body">
        <ActivePatientsSidebar
          patients={monitoringActive}
          selectedPatientId={patientId}
          onSelectPatient={goToPatient}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <main className="nilo-clinician__main m3-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function DoctorLayout() {
  return (
    <ClinicalDataProvider>
      <DoctorShell />
    </ClinicalDataProvider>
  )
}

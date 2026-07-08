import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ROOT_PATHS } from '@/router/paths'
import { MOCK_PATIENTS, STATUS_META } from '../data'

export function PatientsListPage() {
  const navigate = useNavigate()
  return (
    <div>
      <PageHeader title="Pacientes" description="Listado de pacientes monitorizados." />
      <Card padded={false}>
        <table className="nilo-table">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Edad</th>
              <th>Habitación</th>
              <th>FC</th>
              <th>SpO₂</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_PATIENTS.map((p) => (
              <tr
                key={p.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`${ROOT_PATHS.doctor}/pacientes/${p.id}`)}
              >
                <td><strong>{p.name}</strong></td>
                <td>{p.age}</td>
                <td>{p.room}</td>
                <td>{p.heartRate} lpm</td>
                <td>{p.spo2}%</td>
                <td>
                  <Badge tone={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

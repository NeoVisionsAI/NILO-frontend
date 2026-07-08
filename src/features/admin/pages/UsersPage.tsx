import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ROLE_LABELS, UserRole } from '@/types'

const MOCK = [
  { name: 'Diego Ramírez', email: 'medico@nilo.health', role: UserRole.DOCTOR, active: true },
  { name: 'Elena Núñez', email: 'enfermeria@nilo.health', role: UserRole.NURSE, active: true },
  { name: 'Pablo Pérez', email: 'paciente@nilo.health', role: UserRole.PATIENT, active: false },
]

export function UsersPage() {
  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Gestiona las cuentas de la plataforma."
        actions={<Button size="sm">Nuevo usuario</Button>}
      />
      <Card padded={false}>
        <table className="nilo-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {MOCK.map((u) => (
              <tr key={u.email}>
                <td>{u.name}</td>
                <td className="u-muted">{u.email}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>
                  <Badge tone={u.active ? 'success' : 'neutral'}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

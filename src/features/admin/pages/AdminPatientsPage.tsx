import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { adminPatientService } from '@/services/admin-patient.service'
import type { AdminUserListParams, PatientUser } from '@/types'
import { patientDisplayName } from '@/types'
import { AdminModal } from '../components/AdminModal'
import { AdminPagination } from '../components/AdminPagination'
import { AdminSearchToolbar } from '../components/AdminSearchToolbar'
import {
  AdminPatientFormFields,
  EMPTY_PATIENT_FORM,
  formToPatientCreate,
  formToPatientUpdate,
  patientToFormState,
  type PatientFormState,
} from '../components/AdminPatientForm'
import { useAdminList, type AdminListFilters } from '../hooks/useAdminList'
import { toast } from '@/lib/toast'

const USER_FILTERS = [
  { key: 'name' as const, label: 'Nombre' },
  { key: 'lastname' as const, label: 'Apellidos' },
  { key: 'email' as const, label: 'Email' },
  { key: 'country' as const, label: 'País' },
  { key: 'zip' as const, label: 'CP' },
]

export function AdminPatientsPage() {
  const buildParams = useCallback(
    ({ skip, limit, q, filters }: { skip: number; limit: number; q: string; filters: AdminListFilters }) => {
      const params: AdminUserListParams = { skip, limit }
      if (q) params.q = q
      if (filters.name) params.name = filters.name
      if (filters.lastname) params.lastname = filters.lastname
      if (filters.email) params.email = filters.email
      if (filters.country) params.country = filters.country
      if (filters.zip) params.zip = filters.zip
      return params
    },
    [],
  )

  const list = useAdminList<PatientUser, AdminUserListParams>({
    fetchList: adminPatientService.list,
    buildParams,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PatientUser | null>(null)
  const [form, setForm] = useState<PatientFormState>(EMPTY_PATIENT_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PatientUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_PATIENT_FORM)
    setModalOpen(true)
  }

  function openEdit(p: PatientUser) {
    setEditing(p)
    setForm(patientToFormState(p))
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.lastname.trim() || !form.email.trim()) {
      toast.error('Completa nombre, apellidos y email.')
      return
    }
    if (!editing && !form.password) {
      toast.error('La contraseña es obligatoria al crear.')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await adminPatientService.update(editing.id, formToPatientUpdate(form, editing))
        toast.success('Paciente actualizado.')
      } else {
        await adminPatientService.create(formToPatientCreate(form))
        toast.success('Paciente creado.')
      }
      setModalOpen(false)
      await list.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminPatientService.remove(deleteTarget.id)
      toast.success('Paciente eliminado.')
      setDeleteTarget(null)
      await list.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Pacientes" description="Gestión global de pacientes (root admin)." />

      <AdminSearchToolbar
        q={list.q}
        onQChange={list.setQ}
        filters={list.filters}
        onFilterChange={(key, value) => list.setFilters((f) => ({ ...f, [key]: value }))}
        showFilters={list.showFilters}
        onToggleFilters={() => list.setShowFilters((v) => !v)}
        onSearch={list.applySearch}
        onReset={list.resetFilters}
        filterFields={USER_FILTERS}
        newLabel="Nuevo paciente"
        onNew={openCreate}
      />

      <Card padded={false}>
        {list.loading ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <Spinner />
          </div>
        ) : list.items.length === 0 ? (
          <p className="u-muted" style={{ padding: 'var(--space-6)' }}>
            No hay pacientes con estos criterios.
          </p>
        ) : (
          <table className="nilo-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>País</th>
                <th>Habitación</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.items.map((p) => (
                <tr key={p.id}>
                  <td>{patientDisplayName(p)}</td>
                  <td className="u-muted">{p.email}</td>
                  <td>{p.country ?? '—'}</td>
                  <td>{p.patient_profile.room ?? '—'}</td>
                  <td>
                    <Badge tone={p.is_active !== false ? 'success' : 'neutral'}>
                      {p.is_active !== false ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AdminPagination
        page={list.page}
        hasMore={list.hasMore}
        loading={list.loading}
        onPrev={() => list.setPage((p) => Math.max(0, p - 1))}
        onNext={() => list.setPage((p) => p + 1)}
      />

      <AdminModal
        open={modalOpen}
        title={editing ? 'Editar paciente' : 'Nuevo paciente'}
        onClose={() => !saving && setModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <AdminPatientFormFields
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          isEdit={Boolean(editing)}
        />
      </AdminModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar paciente"
        message={`¿Eliminar a ${deleteTarget ? patientDisplayName(deleteTarget) : ''}? Se borrará también el registro clínico vinculado.`}
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  )
}

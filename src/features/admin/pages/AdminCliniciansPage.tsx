import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { adminClinicianService } from '@/services/admin-clinician.service'
import type { AdminUserListParams, ClinicianUser } from '@/types'
import { clinicianDisplayName } from '@/types'
import { AdminModal } from '../components/AdminModal'
import { AdminPagination } from '../components/AdminPagination'
import { AdminSearchToolbar } from '../components/AdminSearchToolbar'
import {
  AdminClinicianFormFields,
  EMPTY_CLINICIAN_FORM,
  formToClinicianCreate,
  formToClinicianUpdate,
  clinicianToFormState,
  type ClinicianFormState,
} from '../components/AdminClinicianForm'
import { useAdminList, type AdminListFilters } from '../hooks/useAdminList'
import { toast } from '@/lib/toast'

const USER_FILTERS = [
  { key: 'name' as const, label: 'Nombre' },
  { key: 'lastname' as const, label: 'Apellidos' },
  { key: 'email' as const, label: 'Email' },
  { key: 'country' as const, label: 'País' },
  { key: 'zip' as const, label: 'CP' },
]

export function AdminCliniciansPage() {
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

  const list = useAdminList<ClinicianUser, AdminUserListParams>({
    fetchList: adminClinicianService.list,
    buildParams,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ClinicianUser | null>(null)
  const [form, setForm] = useState<ClinicianFormState>(EMPTY_CLINICIAN_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClinicianUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_CLINICIAN_FORM)
    setModalOpen(true)
  }

  function openEdit(c: ClinicianUser) {
    setEditing(c)
    setForm(clinicianToFormState(c))
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
        await adminClinicianService.update(editing.id, formToClinicianUpdate(form, editing))
        toast.success('Médico actualizado.')
      } else {
        await adminClinicianService.create(formToClinicianCreate(form))
        toast.success('Médico creado.')
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
      await adminClinicianService.remove(deleteTarget.id)
      toast.success('Médico eliminado.')
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
      <PageHeader title="Médicos" description="Gestión global de clínicos (root admin)." />

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
        newLabel="Nuevo médico"
        onNew={openCreate}
      />

      <Card padded={false}>
        {list.loading ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <Spinner />
          </div>
        ) : list.items.length === 0 ? (
          <p className="u-muted" style={{ padding: 'var(--space-6)' }}>
            No hay médicos con estos criterios.
          </p>
        ) : (
          <table className="nilo-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Institución</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.items.map((c) => (
                <tr key={c.id}>
                  <td>{clinicianDisplayName(c)}</td>
                  <td className="u-muted">{c.email}</td>
                  <td>{c.clinician_profile.type_clinician}</td>
                  <td>{c.clinician_profile.institution ?? '—'}</td>
                  <td>
                    <Badge tone={c.is_active !== false ? 'success' : 'neutral'}>
                      {c.is_active !== false ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(c)}>
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
        title={editing ? 'Editar médico' : 'Nuevo médico'}
        onClose={() => !saving && setModalOpen(false)}
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
        <AdminClinicianFormFields
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          isEdit={Boolean(editing)}
        />
      </AdminModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar médico"
        message={`¿Eliminar a ${deleteTarget ? clinicianDisplayName(deleteTarget) : ''}?`}
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  )
}

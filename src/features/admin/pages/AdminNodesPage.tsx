import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/common'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { adminNodeService } from '@/services/admin-node.service'
import type { AdminNode, AdminNodeListParams } from '@/types'
import { AdminModal } from '../components/AdminModal'
import { AdminPagination } from '../components/AdminPagination'
import { AdminSearchToolbar } from '../components/AdminSearchToolbar'
import {
  AdminNodeFormFields,
  EMPTY_NODE_FORM,
  formToNodeCreate,
  formToNodeUpdate,
  nodeToFormState,
  type NodeFormState,
} from '../components/AdminNodeForm'
import { useAdminList, type AdminListFilters } from '../hooks/useAdminList'
import { formatRelativeTime, formatUptime, isHeartbeatStale } from '../utils/format'
import { toast } from '@/lib/toast'

const NODE_FILTERS = [
  { key: 'name' as const, label: 'Nombre' },
  { key: 'mac_address' as const, label: 'MAC' },
  { key: 'city' as const, label: 'Ciudad' },
  { key: 'public_ip' as const, label: 'IP pública' },
  { key: 'ddns' as const, label: 'DDNS' },
]

export function AdminNodesPage() {
  const buildParams = useCallback(
    ({ skip, limit, q, filters }: { skip: number; limit: number; q: string; filters: AdminListFilters }) => {
      const params: AdminNodeListParams = { skip, limit }
      if (q) params.q = q
      if (filters.name) params.name = filters.name
      if (filters.mac_address) params.mac_address = filters.mac_address
      if (filters.city) params.city = filters.city
      if (filters.public_ip) params.public_ip = filters.public_ip
      if (filters.ddns) params.ddns = filters.ddns
      return params
    },
    [],
  )

  const list = useAdminList<AdminNode, AdminNodeListParams>({
    fetchList: adminNodeService.list,
    buildParams,
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminNode | null>(null)
  const [form, setForm] = useState<NodeFormState>(EMPTY_NODE_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminNode | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_NODE_FORM)
    setModalOpen(true)
  }

  function openEdit(n: AdminNode) {
    setEditing(n)
    setForm(nodeToFormState(n))
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.mac_address.trim()) {
      toast.error('Nombre y MAC son obligatorios.')
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await adminNodeService.update(editing.id, formToNodeUpdate(form))
        toast.success('Nodo actualizado.')
      } else {
        await adminNodeService.create(formToNodeCreate(form))
        toast.success('Nodo creado.')
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
      await adminNodeService.remove(deleteTarget.id)
      toast.success('Nodo eliminado.')
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
      <PageHeader
        title="NILO Nodes"
        description="Gestión de nodos edge. El heartbeat lo envía nilo-node (POST /nodes/heartbeat), no esta UI."
      />

      <AdminSearchToolbar
        q={list.q}
        onQChange={list.setQ}
        filters={list.filters}
        onFilterChange={(key, value) => list.setFilters((f) => ({ ...f, [key]: value }))}
        showFilters={list.showFilters}
        onToggleFilters={() => list.setShowFilters((v) => !v)}
        onSearch={list.applySearch}
        onReset={list.resetFilters}
        filterFields={NODE_FILTERS}
        newLabel="Nuevo nodo"
        onNew={openCreate}
      />

      <Card padded={false}>
        {list.loading ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <Spinner />
          </div>
        ) : list.items.length === 0 ? (
          <p className="u-muted" style={{ padding: 'var(--space-6)' }}>
            No hay nodos con estos criterios.
          </p>
        ) : (
          <table className="nilo-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>MAC</th>
                <th>IP pública</th>
                <th>Último heartbeat</th>
                <th>SSH</th>
                <th>Uptime</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.items.map((n) => {
                const stale = isHeartbeatStale(n.last_heartbeat)
                return (
                  <tr key={n.id}>
                    <td>{n.name}</td>
                    <td className="u-muted">{n.mac_address}</td>
                    <td>{n.public_ip ?? n.ddns ?? '—'}</td>
                    <td>
                      <span className={stale ? 'admin-heartbeat--stale' : undefined}>
                        {formatRelativeTime(n.last_heartbeat)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={n.ssh_enabled ? 'success' : 'neutral'}>
                        {n.ssh_enabled ? 'Sí' : 'No'}
                      </Badge>
                    </td>
                    <td>{formatUptime(n.uptime_seconds)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(n)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleteTarget(n)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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
        title={editing ? 'Editar nodo' : 'Nuevo nodo'}
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
        {editing && (
          <div className="u-stack" style={{ marginBottom: 'var(--space-4)' }}>
            <p className="u-muted" style={{ fontSize: 'var(--text-sm)' }}>
              IP privada: {editing.private_ip ?? '—'} · DDNS: {editing.ddns ?? '—'} · Heartbeat:{' '}
              {formatRelativeTime(editing.last_heartbeat)}
            </p>
            {editing.telemetry && Object.keys(editing.telemetry).length > 0 && (
              <pre
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: 'var(--space-2)',
                  background: 'var(--color-surface-muted)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(editing.telemetry, null, 2)}
              </pre>
            )}
          </div>
        )}
        <AdminNodeFormFields
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          isEdit={Boolean(editing)}
        />
      </AdminModal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar nodo"
        message={`¿Eliminar el nodo «${deleteTarget?.name ?? ''}»?`}
        confirmLabel="Eliminar"
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  )
}

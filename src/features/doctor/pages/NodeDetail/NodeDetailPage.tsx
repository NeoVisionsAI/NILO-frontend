import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClinicalData } from '../../context/ClinicalDataContext'
import { ROOT_PATHS } from '@/router/paths'
import { findNodeSection, resolveNodeSections, type NodeSectionId } from './node-sections'
import { NodeSectionContent } from './NodeSectionContent'
import './NodeDetailPage.css'

/**
 * Vista de detalle del nodo (Contenedor B).
 * Secciones: datos, cámaras de monitorización, cámaras fisiológicas y micronos Bluetooth.
 */
export function NodeDetailPage() {
  const { nodeId = '' } = useParams()
  const navigate = useNavigate()
  const { nodes, deleteNode } = useClinicalData()
  const node = nodes.find((n) => n.id === nodeId)

  const sections = useMemo(() => (node ? resolveNodeSections(node) : []), [node])
  const defaultSectionId = sections[0]?.id ?? 'node-data'

  const [activeSectionId, setActiveSectionId] = useState<NodeSectionId>(defaultSectionId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activeSection = findNodeSection(sections, activeSectionId) ?? sections[0]

  useEffect(() => {
    setActiveSectionId(sections[0]?.id ?? 'node-data')
  }, [nodeId, sections])

  if (!node) {
    return (
      <div className="nilo-ndetail">
        <div className="nilo-ndetail__empty">
          <MaterialIcon name="router" size={48} />
          <p>Node not found.</p>
          <button
            type="button"
            className="nilo-ndetail__btn nilo-ndetail__btn--ghost"
            onClick={() => navigate(ROOT_PATHS.doctor)}
          >
            Back to summary
          </button>
        </div>
      </div>
    )
  }

  const connectivity = [
    node.wifi_enabled ? 'Wi‑Fi' : null,
    node.bluetooth_enabled ? 'Bluetooth' : null,
    node.wired_enabled ? 'Cable' : null,
  ].filter((tag): tag is string => Boolean(tag))

  async function handleDelete() {
    if (!node) return
    setDeleting(true)
    try {
      await deleteNode(node.id)
      setConfirmDelete(false)
      navigate(ROOT_PATHS.doctor)
    } catch {
      /* toast de error del cliente API */
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="nilo-ndetail">
      <header className="nilo-ndetail__header">
        <div className="nilo-ndetail__identity">
          <span className="nilo-ndetail__icon-wrap" aria-hidden="true">
            <MaterialIcon name="router" size={36} />
          </span>
          <div className="nilo-ndetail__info">
            <h1 className="nilo-ndetail__name">{node.name}</h1>
            <p className="nilo-ndetail__meta">
              <span>{node.mac_address}</span>
              {node.location && (
                <>
                  <span className="nilo-ndetail__meta-sep">·</span>
                  <span>{node.location}</span>
                </>
              )}
            </p>
            {connectivity.length > 0 && (
              <div className="nilo-ndetail__tags">
                {connectivity.map((tag) => (
                  <span key={tag} className="nilo-ndetail__tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="nilo-ndetail__delete"
          onClick={() => setConfirmDelete(true)}
          aria-label="Eliminar nodo"
          title="Eliminar nodo"
        >
          <MaterialIcon name="delete" size={22} />
        </button>
      </header>

      <div className="nilo-ndetail__workspace">
        <nav className="nilo-ndetail__tabs" aria-label="Secciones del nodo">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`nilo-ndetail__tab${activeSectionId === section.id ? ' nilo-ndetail__tab--active' : ''}`}
              onClick={() => setActiveSectionId(section.id)}
              aria-current={activeSectionId === section.id ? 'page' : undefined}
            >
              <MaterialIcon name={section.icon} size={18} />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>

        <div className="nilo-ndetail__content">
          {activeSection && <NodeSectionContent section={activeSection} node={node} />}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar nodo"
        message={`¿Seguro que quieres eliminar el nodo «${node.name}»? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        tone="danger"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmDelete(false)}
      />
    </div>
  )
}

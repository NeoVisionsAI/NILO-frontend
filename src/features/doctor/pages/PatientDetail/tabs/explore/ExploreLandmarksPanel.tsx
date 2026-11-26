import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLandmarksDocument } from '@/lib/fetch-landmarks-document'
import {
  formatLandmarkChipLabel,
  sortLandmarksByRecordedAt,
} from '@/lib/landmark-object-key-datetime'
import type { ParsedLandmarks } from '@/lib/landmarks-json'
import { toast } from '@/lib/toast'
import type { LandmarksOut } from '@/services/landmarks.service'
import { LandmarksMeshViewer } from './LandmarksMeshViewer'
import './ExploreLandmarksPanel.css'

interface ExploreLandmarksPanelProps {
  sessionId: string
  rows: LandmarksOut[]
  loading: boolean
  painHint?: string
}

export function ExploreLandmarksPanel({ sessionId, rows, loading, painHint }: ExploreLandmarksPanelProps) {
  const sortedRows = useMemo(() => sortLandmarksByRecordedAt(rows), [rows])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [meshData, setMeshData] = useState<ParsedLandmarks | null>(null)
  const [meshLoading, setMeshLoading] = useState(false)
  const loadSeq = useRef(0)

  const loadLandmark = useCallback(
    async (row: LandmarksOut) => {
      const seq = ++loadSeq.current
      setActiveId(row.id)
      setMeshLoading(true)
      try {
        const doc = await fetchLandmarksDocument(sessionId, row)
        if (seq !== loadSeq.current) return
        setMeshData(doc)
      } catch (e) {
        if (seq !== loadSeq.current) return
        toast.error(e instanceof Error ? e.message : 'No se pudo cargar la malla.')
      } finally {
        if (seq === loadSeq.current) setMeshLoading(false)
      }
    },
    [sessionId],
  )

  useEffect(() => {
    loadSeq.current += 1
    setActiveId(null)
    setMeshData(null)
    setMeshLoading(false)
  }, [sessionId, rows])

  useEffect(() => {
    if (loading || sortedRows.length === 0 || activeId) return
    void loadLandmark(sortedRows[0]!)
  }, [activeId, loadLandmark, loading, sortedRows])

  const listReady = !loading && sortedRows.length > 0

  return (
    <div className="nilo-explore-lm">
      {painHint ? <p className="nilo-explore__pain-hint">{painHint}</p> : null}

      <div className="nilo-explore-lm__strip" role="tablist" aria-label="Registros por fecha">
        {loading && (
          <span className="nilo-explore-lm__strip-hint" aria-hidden>
            Cargando registros…
          </span>
        )}
        {!loading && sortedRows.length === 0 && (
          <span className="nilo-explore-lm__strip-hint">Sin lotes en esta sesión.</span>
        )}
        {listReady &&
          sortedRows.map((row) => {
            const label = formatLandmarkChipLabel(row.object_key)
            const selected = row.id === activeId
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`nilo-explore-lm__chip${selected ? ' nilo-explore-lm__chip--active' : ''}`}
                title={row.object_key}
                onClick={() => void loadLandmark(row)}
              >
                {label}
              </button>
            )
          })}
      </div>

      <div className="nilo-explore-lm__stage" aria-busy={meshLoading}>
        {meshData ? (
          <div className="nilo-explore-lm__stage-inner">
            <LandmarksMeshViewer data={meshData} layout="stage" />
            {meshLoading && (
              <div className="nilo-explore-lm__stage-overlay" aria-live="polite">
                Cargando…
              </div>
            )}
          </div>
        ) : (
          <p className="nilo-explore-lm__stage-msg">
            {meshLoading ? 'Descargando malla…' : listReady ? 'Elige un instante arriba.' : 'Esperando registros…'}
          </p>
        )}
      </div>
    </div>
  )
}
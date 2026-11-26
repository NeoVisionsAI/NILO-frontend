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
      setMeshData(null)
      try {
        const doc = await fetchLandmarksDocument(sessionId, row)
        if (seq !== loadSeq.current) return
        setMeshData(doc)
      } catch (e) {
        if (seq !== loadSeq.current) return
        toast.error(e instanceof Error ? e.message : 'No se pudo cargar la malla.')
        setMeshData(null)
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

  return (
    <div className="nilo-explore-lm">
      {painHint ? <p className="nilo-explore__pain-hint">{painHint}</p> : null}

      {loading ? (
        <p className="nilo-explore__placeholder">Cargando registros…</p>
      ) : sortedRows.length === 0 ? (
        <p className="nilo-explore__placeholder">Sin lotes en esta sesión.</p>
      ) : (
        <>
          <div className="nilo-explore-lm__strip" role="tablist" aria-label="Registros por fecha">
            {sortedRows.map((row) => {
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
            {meshLoading && <p className="nilo-explore-lm__stage-msg">Descargando malla…</p>}
            {!meshLoading && meshData && (
              <LandmarksMeshViewer data={meshData} layout="stage" />
            )}
            {!meshLoading && !meshData && (
              <p className="nilo-explore-lm__stage-msg">Selecciona un registro de la franja superior.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
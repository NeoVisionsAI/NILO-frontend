import { useEffect, useState } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { formatSessionElapsed } from '@/lib/format-session-elapsed'

interface SessionElapsedBadgeProps {
  startedAt: string
  active?: boolean
}

export function SessionElapsedBadge({ startedAt, active = true }: SessionElapsedBadgeProps) {
  const [elapsed, setElapsed] = useState(() => formatSessionElapsed(startedAt))

  useEffect(() => {
    if (!active) return
    const tick = () => setElapsed(formatSessionElapsed(startedAt))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [active, startedAt])

  if (!active) return null

  return (
    <span className="nilo-pdetail-hdr__elapsed" title="Tiempo de sesión activa">
      <MaterialIcon name="timer" size={22} />
      <span>{elapsed}</span>
    </span>
  )
}
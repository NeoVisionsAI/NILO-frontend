import { useCallback, useEffect, useState } from 'react'
import {
  getFullscreenTarget,
  isFullscreenActive,
  isFullscreenSupported,
  toggleFullscreen as toggleFullscreenElement,
} from '@/lib/fullscreen'

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(isFullscreenActive)

  useEffect(() => {
    function onChange() {
      setIsFullscreen(isFullscreenActive())
    }

    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  const toggleFullscreen = useCallback(async () => {
    await toggleFullscreenElement(getFullscreenTarget())
  }, [])

  return {
    isFullscreen,
    toggleFullscreen,
    supported: isFullscreenSupported(),
  }
}

export type CameraErrorCode = 'insecure' | 'unsupported' | 'denied' | 'not-found' | 'unknown'

export class CameraError extends Error {
  readonly code: CameraErrorCode

  constructor(message: string, code: CameraErrorCode) {
    super(message)
    this.name = 'CameraError'
    this.code = code
  }
}

/** Contexto seguro: HTTPS o localhost (cámara en vivo vía getUserMedia). */
export function isSecureCameraContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function canUseLiveCamera(): boolean {
  return isSecureCameraContext() && Boolean(navigator.mediaDevices?.getUserMedia)
}

/** Instrucciones cuando se abre la app por HTTP (solo legacy). */
export function insecureCameraDevHint(): string {
  if (typeof window === 'undefined') return ''
  const httpsUrl = `https://${window.location.hostname}:8080`
  return (
    `La cámara requiere HTTPS. Estás en ${window.location.origin}. ` +
    `Abre ${httpsUrl} (certificado en certs/). ` +
    `Mientras tanto puedes usar «Capturar vídeo» o un archivo de prueba.`
  )
}

export function assertCameraSupported(): void {
  if (typeof window === 'undefined') return

  if (!window.isSecureContext) {
    throw new CameraError(insecureCameraDevHint(), 'insecure')
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError('Este navegador no soporta acceso a la cámara.', 'unsupported')
  }
}

export async function requestCameraStream(
  constraints: MediaStreamConstraints,
): Promise<MediaStream> {
  assertCameraSupported()

  try {
    return await navigator.mediaDevices!.getUserMedia(constraints)
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new CameraError(
          'Permiso de cámara denegado. Actívalo en los ajustes del navegador o del sistema.',
          'denied',
        )
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new CameraError('No se encontró ninguna cámara en este dispositivo.', 'not-found')
      }
    }
    throw err instanceof Error ? err : new CameraError('Error al iniciar la cámara.', 'unknown')
  }
}

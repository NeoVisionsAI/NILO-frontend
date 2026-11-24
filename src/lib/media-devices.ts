export type MediaDeviceKind = 'audioinput' | 'videoinput'

export async function listMediaInputDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return all.filter((d) => d.kind === kind)
  } catch {
    return []
  }
}

/** Pide permiso breve para que `enumerateDevices` devuelva etiquetas legibles. */
export async function ensureMediaPermission(kind: MediaDeviceKind): Promise<void> {
  const constraints: MediaStreamConstraints =
    kind === 'audioinput' ? { audio: true } : { video: { facingMode: 'user' } }
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  stream.getTracks().forEach((t) => t.stop())
}

export function deviceLabel(device: MediaDeviceInfo, index: number): string {
  return device.label?.trim() || `Dispositivo ${index + 1} (${device.deviceId.slice(0, 8)}…)`
}
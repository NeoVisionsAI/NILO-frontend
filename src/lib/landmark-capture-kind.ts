import type { LandmarksCaptureKind, LandmarksOut } from '@/services/landmarks.service'

export function resolveLandmarkCaptureKind(
  row: Pick<LandmarksOut, 'capture_kind' | 'object_key'>,
): LandmarksCaptureKind | 'other' {
  const fromApi = row.capture_kind?.toLowerCase()
  if (fromApi === 'face' || fromApi === 'pose') return fromApi

  const key = row.object_key.toLowerCase()
  if (key.includes('face_landmark')) return 'face'
  if (key.includes('/pose/') || key.includes('pose_land')) return 'pose'
  return 'other'
}

export function matchesLandmarkCaptureKind(
  row: Pick<LandmarksOut, 'capture_kind' | 'object_key'>,
  kind: LandmarksCaptureKind,
): boolean {
  return resolveLandmarkCaptureKind(row) === kind
}
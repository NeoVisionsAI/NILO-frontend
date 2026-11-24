import { strToU8, zipSync } from 'fflate'

const JSON_ENTRY = 'landmarks.json'

/** Un solo `.json` dentro del zip (contrato backend `POST /landmarks/upload`). */
export function buildLandmarksZip(payload: object): Blob {
  const json = JSON.stringify(payload)
  const zipped = zipSync({ [JSON_ENTRY]: strToU8(json) })
  return new Blob([zipped], { type: 'application/zip' })
}
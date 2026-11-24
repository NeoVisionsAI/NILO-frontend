const PRESIGNED_PUT_TIMEOUT_MS = 120_000

/**
 * PUT directo a MinIO vía URL presignada (sin Bearer NILO).
 * Si la página es HTTPS y la URL es HTTP, el navegador bloquea (Mixed Content) —
 * hay que configurar MINIO_PUBLIC_* con HTTPS en el backend.
 */
export async function putPresignedObject(
  uploadUrl: string,
  body: Blob | ArrayBuffer | string,
  contentType: string,
): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    uploadUrl.startsWith('http://')
  ) {
    throw new Error(
      'Mixed Content: el backend devolvió una URL MinIO en HTTP (p. ej. IP interna). ' +
        'Desde https://nilomed.eu no se puede subir. Configura MINIO_PUBLIC_HOST + HTTPS (o proxy) en NILO-backend.',
    )
  }

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
    signal: AbortSignal.timeout(PRESIGNED_PUT_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Error al subir objeto a almacenamiento (${res.status})`)
  }
}
/** PUT directo a MinIO vía URL presignada (sin Bearer NILO). */
export async function putPresignedObject(
  uploadUrl: string,
  body: Blob | ArrayBuffer | string,
  contentType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  })
  if (!res.ok) {
    throw new Error(`Error al subir objeto (${res.status})`)
  }
}
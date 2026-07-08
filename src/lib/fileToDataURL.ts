/** Convierte un fichero de imagen a data URI base64 (para el campo `photo` del backend). */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el fichero'))
    reader.readAsDataURL(file)
  })
}

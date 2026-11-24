/** Espera `seconds` en tiempo real, llamando `onTick` cada segundo con lo que queda. */
export function waitCountdown(
  seconds: number,
  onTick: (remaining: number) => void,
): Promise<void> {
  const total = Math.max(0, Math.round(seconds))
  return new Promise((resolve) => {
    if (total === 0) {
      onTick(0)
      resolve()
      return
    }
    let remaining = total
    onTick(remaining)
    const id = window.setInterval(() => {
      remaining -= 1
      onTick(Math.max(0, remaining))
      if (remaining <= 0) {
        window.clearInterval(id)
        resolve()
      }
    }, 1000)
  })
}
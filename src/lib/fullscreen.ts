type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

export function getFullscreenElement(): Element | null {
  const doc = document as FullscreenDocument
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

export function getFullscreenTarget(): HTMLElement {
  return document.documentElement
}

export function isFullscreenActive(): boolean {
  return getFullscreenElement() === getFullscreenTarget()
}

export function isFullscreenSupported(): boolean {
  const el = getFullscreenTarget() as FullscreenElement
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen)
}

export async function requestFullscreen(element: HTMLElement = getFullscreenTarget()) {
  const el = element as FullscreenElement
  if (element.requestFullscreen) {
    await element.requestFullscreen()
    return
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen()
  }
}

export async function exitFullscreen() {
  const doc = document as FullscreenDocument
  if (document.exitFullscreen) {
    await document.exitFullscreen()
    return
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen()
  }
}

export async function toggleFullscreen(element: HTMLElement = getFullscreenTarget()) {
  if (getFullscreenElement() === element) {
    await exitFullscreen()
  } else {
    await requestFullscreen(element)
  }
}

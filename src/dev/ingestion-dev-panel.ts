const STORAGE_KEY = 'nilo_show_ingestion_dev_panel'

/** Incluido en dev o si VITE_ENABLE_INGESTION_DEV_PANEL=true en el build. */
export function ingestionDevPanelBuildEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_INGESTION_DEV_PANEL === 'true'
}

export function isIngestionDevPanelVisible(): boolean {
  if (!ingestionDevPanelBuildEnabled()) return false
  if (localStorage.getItem(STORAGE_KEY) === null) {
    return import.meta.env.DEV
  }
  return localStorage.getItem(STORAGE_KEY) === '1'
}

export function setIngestionDevPanelVisible(visible: boolean): void {
  localStorage.setItem(STORAGE_KEY, visible ? '1' : '0')
}
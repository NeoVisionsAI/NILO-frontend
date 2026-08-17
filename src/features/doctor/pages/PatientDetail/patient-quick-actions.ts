/** Acción rápida del paciente (menú FAB). Ampliable desde backend o config. */
export interface PatientQuickAction {
  id: string
  label: string
  icon: string
  /** Clave para enlazar formulario / API más adelante. */
  actionKey: string
}

export const PATIENT_QUICK_ACTIONS: PatientQuickAction[] = [
  {
    id: 'pain-episode',
    label: 'Episodio de dolor',
    icon: 'sick',
    actionKey: 'pain-episode',
  },
  {
    id: 'audio-note',
    label: 'Nota de audio',
    icon: 'mic',
    actionKey: 'audio-note',
  },
  {
    id: 'text-note',
    label: 'Nota de texto',
    icon: 'edit_note',
    actionKey: 'text-note',
  },
  {
    id: 'action',
    label: 'Acción',
    icon: 'bolt',
    actionKey: 'action',
  },
]

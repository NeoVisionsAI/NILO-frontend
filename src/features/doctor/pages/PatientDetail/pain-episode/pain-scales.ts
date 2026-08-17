export interface PainScaleDefinition {
  id: string
  name: string
  description: string
  min: number
  max: number
  step?: number
}

export interface RecordedPainScale {
  id: string
  scaleId: string
  scaleName: string
  value: number
  timestamp: string
}

export const PAIN_SCALE_DEFINITIONS: PainScaleDefinition[] = [
  {
    id: 'en',
    name: 'Escala Numérica (EN / NRS)',
    description:
      'Escala verbal de 0 a 10 para pacientes conscientes y capaces de comunicar su dolor. 0 = Sin dolor, 10 = Máximo dolor imaginable.',
    min: 0,
    max: 10,
    step: 1,
  },
  {
    id: 'eva',
    name: 'Escala Visual Analógica (EVA / VAS)',
    description:
      'Medición continua de intensidad del dolor. Permite mayor precisión en la evaluación del paciente adulto comunicativo.',
    min: 0,
    max: 10,
    step: 1,
  },
  {
    id: 'flacc',
    name: 'Escala FLACC',
    description:
      'Escala observacional para niños entre 2 meses y 7 años, o pacientes con deterioro cognitivo. Evalúa expresión facial, piernas, actividad, llanto y consolabilidad (0-2 ptos por categoría).',
    min: 0,
    max: 10,
    step: 1,
  },
  {
    id: 'nipps',
    name: 'Escala NIPPS',
    description:
      'Evaluación del dolor en recién nacidos a término y prematuros. Mide expresión facial, llanto, respiración, extremidades y estado de alerta.',
    min: 0,
    max: 7,
    step: 1,
  },
  {
    id: 'pipp',
    name: 'Escala PIPP-R',
    description:
      'Diseñada para lactantes prematuros. Combina variables de comportamiento (gestos), fisiológicas (frecuencia cardíaca, SpO2) y contextuales (edad gestacional).',
    min: 0,
    max: 21,
    step: 1,
  },
  {
    id: 'cpot',
    name: 'Escala CPOT',
    description:
      'Diseñada para pacientes adultos críticos en UCI (intubados o no comunicativos). Evalúa expresión facial, movimientos corporales, tensión muscular y adaptación al respirador.',
    min: 0,
    max: 8,
    step: 1,
  },
  {
    id: 'bps',
    name: 'Escala BPS',
    description:
      'Evaluación comportamental del dolor en pacientes sedados y bajo ventilación mecánica. Mide expresión facial, miembros superiores y tolerancia al tubo.',
    min: 3,
    max: 12,
    step: 1,
  },
  {
    id: 'wong-baker',
    name: 'Escala Wong-Baker (FACES)',
    description:
      'Escala visual de rostros gráficos útil en pediatría (a partir de 3 años) o pacientes con barreras del idioma/comunicación.',
    min: 0,
    max: 10,
    step: 2,
  },
]

export function findPainScaleDefinition(scaleId: string): PainScaleDefinition | undefined {
  return PAIN_SCALE_DEFINITIONS.find((scale) => scale.id === scaleId)
}

export function formatPainScaleValue(value: number, step = 1): string {
  if (step < 1) return value.toFixed(1)
  return String(value)
}

import type { PatientSectionConfig } from './medical-sections'
import { ClinicalResultsTab } from './tabs/ClinicalResultsTab'
import { GrowthTab } from './tabs/GrowthTab'
import { LiveTab } from './tabs/LiveTab'

interface SectionContentProps {
  section: PatientSectionConfig
}

/** Resuelve la subvista de consulta según la sección activa. Ampliable por recordKey. */
export function SectionContent({ section }: SectionContentProps) {
  switch (section.id) {
    case 'live':
      return <LiveTab />
    case 'clinical-results':
      return <ClinicalResultsTab />
    case 'growth':
      return <GrowthTab />
    default:
      return (
        <div className="nilo-pdetail-tab nilo-pdetail-tab--empty">
          <h2>{section.label}</h2>
          <p>Sección «{section.id}» pendiente de implementar.</p>
        </div>
      )
  }
}

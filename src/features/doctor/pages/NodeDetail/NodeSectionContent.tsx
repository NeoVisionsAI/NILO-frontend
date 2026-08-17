import type { Node } from '@/types'
import type { NodeSectionConfig } from './node-sections'
import { DeviceSectionPanel } from './sections/DeviceSectionPanel'
import { NodeDataSection } from './sections/NodeDataSection'

interface NodeSectionContentProps {
  section: NodeSectionConfig
  node: Node
}

export function NodeSectionContent({ section, node }: NodeSectionContentProps) {
  if (section.kind === 'data') {
    return <NodeDataSection node={node} />
  }

  return <DeviceSectionPanel section={section} />
}

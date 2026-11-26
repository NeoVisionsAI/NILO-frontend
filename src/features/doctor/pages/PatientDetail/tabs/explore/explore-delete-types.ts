export interface ExploreDeleteAction {
  itemLabel: string
  entityLabel: string
  run: () => Promise<void>
}
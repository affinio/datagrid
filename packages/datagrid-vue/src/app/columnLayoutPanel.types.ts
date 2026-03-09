export interface DataGridAppColumnLayoutDraftColumn {
  key: string
  label: string
  visible: boolean
}

export interface DataGridAppColumnLayoutPanelItem
  extends DataGridAppColumnLayoutDraftColumn {
  canMoveUp: boolean
  canMoveDown: boolean
}

export interface DataGridAppColumnLayoutVisibilityPatch {
  key: string
  visible: boolean
}

export interface DataGridAppApplyColumnLayoutPayload {
  order: readonly string[]
  visibilityByKey: Record<string, boolean>
}

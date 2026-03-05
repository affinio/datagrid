export interface ColumnLayoutDraftColumn {
  key: string
  label: string
  visible: boolean
}

export interface ColumnLayoutPanelItem extends ColumnLayoutDraftColumn {
  canMoveUp: boolean
  canMoveDown: boolean
}

export interface ColumnLayoutVisibilityPatch {
  key: string
  visible: boolean
}

export interface ApplyColumnLayoutPayload {
  order: readonly string[]
  visibilityByKey: Record<string, boolean>
}

export type DataGridAppInteractionOwner =
  | "drag-selection"
  | "fill"
  | "range-move"
  | "column-resize"
  | "row-resize"
  | "touch-pan"

export interface DataGridAppInteractionOwnerInputs {
  dragSelection?: boolean
  fill?: boolean
  rangeMove?: boolean
  columnResize?: boolean
  rowResize?: boolean
  touchPan?: boolean
}

export interface DataGridAppInteractionOwnerSnapshot {
  owner: DataGridAppInteractionOwner | null
  activeOwners: readonly DataGridAppInteractionOwner[]
  hasConflict: boolean
}

const INTERACTION_OWNER_ORDER: readonly DataGridAppInteractionOwner[] = [
  "drag-selection",
  "fill",
  "range-move",
  "column-resize",
  "row-resize",
  "touch-pan",
]

export function resolveDataGridAppInteractionOwnerSnapshot(
  inputs: DataGridAppInteractionOwnerInputs,
): DataGridAppInteractionOwnerSnapshot {
  const activeOwners = INTERACTION_OWNER_ORDER.filter(owner => {
    switch (owner) {
      case "drag-selection":
        return inputs.dragSelection === true
      case "fill":
        return inputs.fill === true
      case "range-move":
        return inputs.rangeMove === true
      case "column-resize":
        return inputs.columnResize === true
      case "row-resize":
        return inputs.rowResize === true
      case "touch-pan":
        return inputs.touchPan === true
    }
  })

  return {
    owner: activeOwners.length === 1 ? activeOwners[0] ?? null : null,
    activeOwners,
    hasConflict: activeOwners.length > 1,
  }
}

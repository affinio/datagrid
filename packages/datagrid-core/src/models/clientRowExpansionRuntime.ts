import {
  buildGroupExpansionSnapshot,
  isSameGroupExpansionSnapshot,
  type DataGridGroupBySpec,
  type DataGridGroupExpansionSnapshot,
  type DataGridPivotSpec,
} from "./rowModel.js"

export interface ClientRowExpansionStateStore {
  expandedByDefault: boolean
  toggledKeys: Set<string>
  setExpandedByDefault: (value: boolean) => void
}

export interface ResolveClientRowExpansionStateStoreInput {
  pivotModel: DataGridPivotSpec | null
  treeDataEnabled: boolean
  expansionExpandedByDefault: boolean
  pivotExpansionExpandedByDefault: boolean
  toggledGroupKeys: Set<string>
  toggledPivotGroupKeys: Set<string>
  setExpansionExpandedByDefault: (value: boolean) => void
  setPivotExpansionExpandedByDefault: (value: boolean) => void
}

export function resolveClientRowExpansionStateStore(
  input: ResolveClientRowExpansionStateStoreInput,
): ClientRowExpansionStateStore {
  const isPivotExpansionActive = Boolean(input.pivotModel) && !input.treeDataEnabled
  if (isPivotExpansionActive) {
    return {
      expandedByDefault: input.pivotExpansionExpandedByDefault,
      toggledKeys: input.toggledPivotGroupKeys,
      setExpandedByDefault: input.setPivotExpansionExpandedByDefault,
    }
  }
  return {
    expandedByDefault: input.expansionExpandedByDefault,
    toggledKeys: input.toggledGroupKeys,
    setExpandedByDefault: input.setExpansionExpandedByDefault,
  }
}

export interface ResolveClientRowExpansionSpecInput {
  treeDataEnabled: boolean
  pivotModel: DataGridPivotSpec | null
  groupBy: DataGridGroupBySpec | null
  expansionExpandedByDefault: boolean
  pivotExpansionExpandedByDefault: boolean
}

export function resolveClientRowExpansionSpec(
  input: ResolveClientRowExpansionSpecInput,
): DataGridGroupBySpec | null {
  if (input.treeDataEnabled) {
    return {
      fields: ["__tree__"],
      expandedByDefault: input.expansionExpandedByDefault,
    }
  }
  if (input.pivotModel) {
    return {
      fields: input.pivotModel.rows.length > 0 ? input.pivotModel.rows : ["__pivot__"],
      expandedByDefault: input.pivotExpansionExpandedByDefault,
    }
  }
  if (!input.groupBy) {
    return null
  }
  return {
    fields: input.groupBy.fields,
    expandedByDefault: input.expansionExpandedByDefault,
  }
}

export interface ResolveClientRowExpansionSnapshotInput {
  expansionSpec: DataGridGroupBySpec | null
  expansionState: Pick<ClientRowExpansionStateStore, "toggledKeys">
}

export function resolveClientRowExpansionSnapshot(
  input: ResolveClientRowExpansionSnapshotInput,
): DataGridGroupExpansionSnapshot {
  return buildGroupExpansionSnapshot(input.expansionSpec, input.expansionState.toggledKeys)
}

export interface ApplyClientRowGroupExpansionInput {
  nextExpansion: DataGridGroupExpansionSnapshot | null
  expansionSpec: DataGridGroupBySpec
  expansionState: ClientRowExpansionStateStore
}

export function applyClientRowGroupExpansion(
  input: ApplyClientRowGroupExpansionInput,
): boolean {
  const normalizedSnapshot = buildGroupExpansionSnapshot(
    {
      fields: input.expansionSpec.fields,
      expandedByDefault: input.nextExpansion?.expandedByDefault ?? input.expansionSpec.expandedByDefault,
    },
    input.nextExpansion?.toggledGroupKeys ?? [],
  )
  const currentSnapshot = buildGroupExpansionSnapshot(input.expansionSpec, input.expansionState.toggledKeys)
  if (isSameGroupExpansionSnapshot(currentSnapshot, normalizedSnapshot)) {
    return false
  }
  input.expansionState.setExpandedByDefault(normalizedSnapshot.expandedByDefault)
  input.expansionState.toggledKeys.clear()
  for (const groupKey of normalizedSnapshot.toggledGroupKeys) {
    input.expansionState.toggledKeys.add(groupKey)
  }
  return true
}

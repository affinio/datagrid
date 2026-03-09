import type { DataGridPivotSpec } from "@affino/datagrid-pivot"
import type {
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
} from "../rowModel.js"
import {
  applyClientRowGroupExpansion,
  resolveClientRowExpansionSnapshot,
  resolveClientRowExpansionSpec,
  resolveClientRowExpansionStateStore,
  type ClientRowExpansionStateStore,
} from "../clientRowExpansionRuntime.js"

export interface CreateClientRowExpansionHostRuntimeOptions {
  getTreeDataEnabled: () => boolean
  getPivotModel: () => DataGridPivotSpec | null
  getGroupBy: () => DataGridGroupBySpec | null
  getPivotExpansionExpandedByDefault: () => boolean
  setPivotExpansionExpandedByDefault: (value: boolean) => void
  getToggledPivotGroupKeys: () => Set<string>
}

export interface DataGridClientRowExpansionHostRuntime {
  getExpansionExpandedByDefault: () => boolean
  setExpansionExpandedByDefault: (value: boolean) => void
  getToggledGroupKeys: () => Set<string>
  clearToggledGroupKeys: () => void
  restoreExpansionSnapshot: (snapshot: DataGridGroupExpansionSnapshot | null) => void
  resetExpansionState: () => void
  getActiveExpansionStateStore: () => ClientRowExpansionStateStore
  getExpansionSpec: () => DataGridGroupBySpec | null
  getCurrentExpansionSnapshot: () => DataGridGroupExpansionSnapshot
  applyGroupExpansion: (nextExpansion: DataGridGroupExpansionSnapshot | null) => boolean
}

export function createClientRowExpansionHostRuntime(
  options: CreateClientRowExpansionHostRuntimeOptions,
): DataGridClientRowExpansionHostRuntime {
  let expansionExpandedByDefault = false
  const toggledGroupKeys = new Set<string>()

  const getActiveExpansionStateStore = (): ClientRowExpansionStateStore => {
    return resolveClientRowExpansionStateStore({
      pivotModel: options.getPivotModel(),
      treeDataEnabled: options.getTreeDataEnabled(),
      expansionExpandedByDefault,
      pivotExpansionExpandedByDefault: options.getPivotExpansionExpandedByDefault(),
      toggledGroupKeys,
      toggledPivotGroupKeys: options.getToggledPivotGroupKeys(),
      setExpansionExpandedByDefault: (value: boolean) => {
        expansionExpandedByDefault = value
      },
      setPivotExpansionExpandedByDefault: (value: boolean) => {
        options.setPivotExpansionExpandedByDefault(value)
      },
    })
  }

  const getExpansionSpec = (): DataGridGroupBySpec | null => {
    return resolveClientRowExpansionSpec({
      treeDataEnabled: options.getTreeDataEnabled(),
      pivotModel: options.getPivotModel(),
      groupBy: options.getGroupBy(),
      expansionExpandedByDefault,
      pivotExpansionExpandedByDefault: options.getPivotExpansionExpandedByDefault(),
    })
  }

  const getCurrentExpansionSnapshot = (): DataGridGroupExpansionSnapshot => {
    return resolveClientRowExpansionSnapshot({
      expansionSpec: getExpansionSpec(),
      expansionState: getActiveExpansionStateStore(),
    })
  }

  return {
    getExpansionExpandedByDefault: () => expansionExpandedByDefault,
    setExpansionExpandedByDefault: (value) => {
      expansionExpandedByDefault = value
    },
    getToggledGroupKeys: () => toggledGroupKeys,
    clearToggledGroupKeys: () => {
      toggledGroupKeys.clear()
    },
    restoreExpansionSnapshot: (snapshot) => {
      expansionExpandedByDefault = Boolean(snapshot?.expandedByDefault)
      toggledGroupKeys.clear()
      for (const groupKey of snapshot?.toggledGroupKeys ?? []) {
        toggledGroupKeys.add(groupKey)
      }
    },
    resetExpansionState: () => {
      expansionExpandedByDefault = false
      toggledGroupKeys.clear()
    },
    getActiveExpansionStateStore,
    getExpansionSpec,
    getCurrentExpansionSnapshot,
    applyGroupExpansion: (nextExpansion) => {
      const expansionSpec = getExpansionSpec()
      if (!expansionSpec) {
        return false
      }
      return applyClientRowGroupExpansion({
        nextExpansion,
        expansionSpec,
        expansionState: getActiveExpansionStateStore(),
      })
    },
  }
}

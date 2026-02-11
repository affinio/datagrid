import { ref, type Ref } from "vue"
import type { DataGridColumnModelSnapshot, DataGridSortState } from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"
import type { AffinoDataGridLayoutProfile } from "../../useAffinoDataGrid.types"
import type { UseAffinoDataGridFeatureSuiteResult } from "./useAffinoDataGridFeatureSuite"

export interface UseAffinoDataGridLayoutProfilesOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  sortState: Ref<readonly DataGridSortState[]>
  setSortState: (nextState: readonly DataGridSortState[]) => void
  featureSuite: UseAffinoDataGridFeatureSuiteResult<TRow>
  applyColumnStateSnapshot: (snapshot: DataGridColumnModelSnapshot) => void
  cloneColumnModelSnapshot: (snapshot: DataGridColumnModelSnapshot) => DataGridColumnModelSnapshot
  stableClone: <T>(value: T) => T
  pushFeedback: (event: {
    source: "layout"
    action: string
    message: string
    ok?: boolean
  }) => void
}

export interface UseAffinoDataGridLayoutProfilesResult {
  profiles: Ref<readonly AffinoDataGridLayoutProfile[]>
  capture: (name: string, options?: { id?: string }) => AffinoDataGridLayoutProfile
  apply: (idOrProfile: string | AffinoDataGridLayoutProfile) => boolean
  remove: (id: string) => boolean
  clear: () => void
}

export function useAffinoDataGridLayoutProfiles<TRow>(
  options: UseAffinoDataGridLayoutProfilesOptions<TRow>,
): UseAffinoDataGridLayoutProfilesResult {
  const layoutProfiles = ref<readonly AffinoDataGridLayoutProfile[]>([])

  const captureLayoutProfile = (
    name: string,
    profileOptions: { id?: string } = {},
  ): AffinoDataGridLayoutProfile => {
    const snapshot = options.runtime.api.getRowModelSnapshot()
    const profile: AffinoDataGridLayoutProfile = {
      id: profileOptions.id?.trim() || `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim() || "Layout",
      createdAt: Date.now(),
      sortState: [...options.sortState.value],
      filterModel: options.stableClone(options.featureSuite.filterModel.value),
      groupBy: options.stableClone(snapshot.groupBy),
      groupExpansion: options.stableClone(snapshot.groupExpansion),
      columnState: options.cloneColumnModelSnapshot(options.runtime.api.getColumnModelSnapshot()),
    }
    layoutProfiles.value = [...layoutProfiles.value, profile]
    options.pushFeedback({
      source: "layout",
      action: "capture",
      message: `Layout saved: ${profile.name}`,
      ok: true,
    })
    return profile
  }

  const applyLayoutProfile = (idOrProfile: string | AffinoDataGridLayoutProfile): boolean => {
    const profile = typeof idOrProfile === "string"
      ? layoutProfiles.value.find(entry => entry.id === idOrProfile)
      : idOrProfile
    if (!profile) {
      return false
    }
    options.setSortState([...profile.sortState])
    options.featureSuite.setFilterModel(options.stableClone(profile.filterModel))
    options.featureSuite.setGroupBy(options.stableClone(profile.groupBy))
    options.applyColumnStateSnapshot(options.stableClone(profile.columnState))
    const currentExpansion = options.runtime.api.getRowModelSnapshot().groupExpansion.toggledGroupKeys
    const targetExpansion = profile.groupExpansion.toggledGroupKeys
    const expansionSet = new Set(targetExpansion)
    for (const groupKey of currentExpansion) {
      if (!expansionSet.has(groupKey)) {
        options.runtime.api.toggleGroup(groupKey)
      }
    }
    for (const groupKey of targetExpansion) {
      if (!currentExpansion.includes(groupKey)) {
        options.runtime.api.toggleGroup(groupKey)
      }
    }
    options.pushFeedback({
      source: "layout",
      action: "apply",
      message: `Layout applied: ${profile.name}`,
      ok: true,
    })
    return true
  }

  const removeLayoutProfile = (id: string): boolean => {
    const current = layoutProfiles.value
    const next = current.filter(entry => entry.id !== id)
    if (next.length === current.length) {
      return false
    }
    layoutProfiles.value = next
    return true
  }

  const clearLayoutProfiles = (): void => {
    layoutProfiles.value = []
  }

  return {
    profiles: layoutProfiles,
    capture: captureLayoutProfile,
    apply: applyLayoutProfile,
    remove: removeLayoutProfile,
    clear: clearLayoutProfiles,
  }
}

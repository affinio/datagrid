import { onBeforeUnmount, ref, type Ref } from "vue"
import type {
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridRowNode,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "./useDataGridRuntime"

export interface AffinoTreeFeatureInput {
  enabled?: boolean
  initialGroupBy?: DataGridGroupBySpec | null
}

export interface NormalizedAffinoTreeFeature {
  enabled: boolean
  initialGroupBy: DataGridGroupBySpec | null
}

export interface UseAffinoDataGridTreeFeatureOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  feature: NormalizedAffinoTreeFeature
}

export interface UseAffinoDataGridTreeFeatureResult {
  treeEnabled: Ref<boolean>
  groupBy: Ref<DataGridGroupBySpec | null>
  groupExpansion: Ref<DataGridGroupExpansionSnapshot>
  setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
  clearGroupBy: () => void
  toggleGroup: (groupKey: string) => void
  isGroupExpanded: (groupKey: string) => boolean
  expandGroups: (groupKeys?: readonly string[]) => number
  collapseGroups: (groupKeys?: readonly string[]) => number
  expandAllGroups: () => number
  collapseAllGroups: () => number
}

function cloneGroupBy(groupBy: DataGridGroupBySpec | null | undefined): DataGridGroupBySpec | null {
  if (!groupBy) {
    return null
  }
  return {
    fields: Array.isArray(groupBy.fields) ? [...groupBy.fields] : [],
    expandedByDefault: Boolean(groupBy.expandedByDefault),
  }
}

function cloneGroupExpansion(
  expansion: DataGridGroupExpansionSnapshot | null | undefined,
): DataGridGroupExpansionSnapshot {
  if (!expansion) {
    return {
      expandedByDefault: false,
      toggledGroupKeys: [],
    }
  }
  return {
    expandedByDefault: Boolean(expansion.expandedByDefault),
    toggledGroupKeys: Array.isArray(expansion.toggledGroupKeys) ? [...expansion.toggledGroupKeys] : [],
  }
}

function normalizeGroupKey(groupKey: string): string | null {
  if (typeof groupKey !== "string") {
    return null
  }
  const trimmed = groupKey.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toUniqueGroupKeys(groupKeys: readonly string[]): readonly string[] {
  const unique = new Set<string>()
  for (const rawKey of groupKeys) {
    const key = normalizeGroupKey(rawKey)
    if (key) {
      unique.add(key)
    }
  }
  return Array.from(unique)
}

function resolveRowGroupKey(row: DataGridRowNode<unknown>): string | null {
  if (row.kind !== "group") {
    return null
  }
  const fromMeta = row.groupMeta?.groupKey
  if (typeof fromMeta === "string" && fromMeta.trim().length > 0) {
    return fromMeta.trim()
  }
  if (typeof row.rowId === "string" && row.rowId.trim().length > 0) {
    return row.rowId.trim()
  }
  return null
}

export function normalizeTreeFeature(
  input: boolean | AffinoTreeFeatureInput | undefined,
): NormalizedAffinoTreeFeature {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      initialGroupBy: null,
    }
  }
  if (!input) {
    return {
      enabled: false,
      initialGroupBy: null,
    }
  }
  return {
    enabled: input.enabled ?? true,
    initialGroupBy: cloneGroupBy(input.initialGroupBy ?? null),
  }
}

export function useAffinoDataGridTreeFeature<TRow>(
  options: UseAffinoDataGridTreeFeatureOptions<TRow>,
): UseAffinoDataGridTreeFeatureResult {
  const treeEnabled = ref(options.feature.enabled)
  const snapshot = options.runtime.rowModel.getSnapshot()
  const groupBy = ref<DataGridGroupBySpec | null>(cloneGroupBy(snapshot.groupBy))
  const groupExpansion = ref<DataGridGroupExpansionSnapshot>(cloneGroupExpansion(snapshot.groupExpansion))

  const unsubscribe = options.runtime.rowModel.subscribe(next => {
    groupBy.value = cloneGroupBy(next.groupBy)
    groupExpansion.value = cloneGroupExpansion(next.groupExpansion)
  })

  onBeforeUnmount(() => {
    unsubscribe()
  })

  if (treeEnabled.value && options.feature.initialGroupBy) {
    options.runtime.api.setGroupBy(cloneGroupBy(options.feature.initialGroupBy))
  }

  const setGroupBy = (nextGroupBy: DataGridGroupBySpec | null) => {
    if (!treeEnabled.value) {
      return
    }
    options.runtime.api.setGroupBy(cloneGroupBy(nextGroupBy))
  }

  const clearGroupBy = () => {
    if (!treeEnabled.value) {
      return
    }
    options.runtime.api.setGroupBy(null)
  }

  const toggleGroup = (groupKey: string) => {
    if (!treeEnabled.value) {
      return
    }
    const key = normalizeGroupKey(groupKey)
    if (!key) {
      return
    }
    options.runtime.api.toggleGroup(key)
  }

  const isGroupExpanded = (groupKey: string): boolean => {
    const key = normalizeGroupKey(groupKey)
    if (!key) {
      return false
    }
    const expansion = groupExpansion.value
    const toggled = new Set(expansion.toggledGroupKeys ?? [])
    return expansion.expandedByDefault ? !toggled.has(key) : toggled.has(key)
  }

  const collectVisibleGroupKeys = (): readonly string[] => {
    const total = options.runtime.api.getRowCount()
    const keys = new Set<string>()
    for (let rowIndex = 0; rowIndex < total; rowIndex += 1) {
      const row = options.runtime.api.getRow(rowIndex)
      if (!row) {
        continue
      }
      const key = resolveRowGroupKey(row)
      if (key) {
        keys.add(key)
      }
    }
    return Array.from(keys)
  }

  const resolveTargetGroupKeys = (groupKeys?: readonly string[]): readonly string[] => {
    if (!groupKeys || groupKeys.length === 0) {
      return collectVisibleGroupKeys()
    }
    return toUniqueGroupKeys(groupKeys)
  }

  const expandGroups = (groupKeys?: readonly string[]): number => {
    if (!treeEnabled.value || !groupBy.value) {
      return 0
    }
    const targets = resolveTargetGroupKeys(groupKeys)
    let affected = 0
    for (const groupKey of targets) {
      if (isGroupExpanded(groupKey)) {
        continue
      }
      options.runtime.api.toggleGroup(groupKey)
      affected += 1
    }
    return affected
  }

  const collapseGroups = (groupKeys?: readonly string[]): number => {
    if (!treeEnabled.value || !groupBy.value) {
      return 0
    }
    const targets = resolveTargetGroupKeys(groupKeys)
    let affected = 0
    for (const groupKey of targets) {
      if (!isGroupExpanded(groupKey)) {
        continue
      }
      options.runtime.api.toggleGroup(groupKey)
      affected += 1
    }
    return affected
  }

  const expandAllGroups = (): number => expandGroups()
  const collapseAllGroups = (): number => collapseGroups()

  return {
    treeEnabled,
    groupBy,
    groupExpansion,
    setGroupBy,
    clearGroupBy,
    toggleGroup,
    isGroupExpanded,
    expandGroups,
    collapseGroups,
    expandAllGroups,
    collapseAllGroups,
  }
}

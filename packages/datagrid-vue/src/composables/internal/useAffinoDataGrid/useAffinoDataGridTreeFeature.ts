import { onBeforeUnmount, ref, type Ref } from "vue"
import type {
  DataGridGroupBySpec,
  DataGridGroupExpansionSnapshot,
  DataGridRowNode,
} from "@affino/datagrid-core"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"

export interface AffinoTreeFeatureInput {
  enabled?: boolean
  initialGroupBy?: DataGridGroupBySpec | null
  groupSelectsChildren?: boolean
}

export interface NormalizedAffinoTreeFeature {
  enabled: boolean
  initialGroupBy: DataGridGroupBySpec | null
  groupSelectsChildren: boolean
}

export interface UseAffinoDataGridTreeFeatureOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  feature: NormalizedAffinoTreeFeature
}

export interface UseAffinoDataGridTreeFeatureResult {
  treeEnabled: Ref<boolean>
  groupSelectsChildren: Ref<boolean>
  groupBy: Ref<DataGridGroupBySpec | null>
  groupExpansion: Ref<DataGridGroupExpansionSnapshot>
  setGroupBy: (groupBy: DataGridGroupBySpec | null) => void
  setGroupExpansion: (expansion: DataGridGroupExpansionSnapshot | null) => void
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
      groupSelectsChildren: false,
    }
  }
  if (!input) {
    return {
      enabled: false,
      initialGroupBy: null,
      groupSelectsChildren: false,
    }
  }
  return {
    enabled: input.enabled ?? true,
    initialGroupBy: cloneGroupBy(input.initialGroupBy ?? null),
    groupSelectsChildren: Boolean(input.groupSelectsChildren),
  }
}

export function useAffinoDataGridTreeFeature<TRow>(
  options: UseAffinoDataGridTreeFeatureOptions<TRow>,
): UseAffinoDataGridTreeFeatureResult {
  const treeEnabled = ref(options.feature.enabled)
  const groupSelectsChildren = ref(Boolean(options.feature.groupSelectsChildren))
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

  const setGroupExpansion = (expansion: DataGridGroupExpansionSnapshot | null) => {
    if (!treeEnabled.value) {
      return
    }
    options.runtime.api.setGroupExpansion(expansion)
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
    if (total <= 0) {
      return []
    }
    const rows = options.runtime.api.getRowsInRange({ start: 0, end: total - 1 })
    const keys = new Set<string>()
    for (const row of rows) {
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
    if (!treeEnabled.value) {
      return 0
    }
    const targets = resolveTargetGroupKeys(groupKeys)
    let affected = 0
    for (const groupKey of targets) {
      if (isGroupExpanded(groupKey)) {
        continue
      }
      options.runtime.api.expandGroup(groupKey)
      affected += 1
    }
    return affected
  }

  const collapseGroups = (groupKeys?: readonly string[]): number => {
    if (!treeEnabled.value) {
      return 0
    }
    const targets = resolveTargetGroupKeys(groupKeys)
    let affected = 0
    for (const groupKey of targets) {
      if (!isGroupExpanded(groupKey)) {
        continue
      }
      options.runtime.api.collapseGroup(groupKey)
      affected += 1
    }
    return affected
  }

  const expandAllGroups = (): number => {
    if (!treeEnabled.value) {
      return 0
    }
    const previous = cloneGroupExpansion(groupExpansion.value)
    if (previous.expandedByDefault && previous.toggledGroupKeys.length === 0) {
      return 0
    }
    const visibleGroupsBefore = collectVisibleGroupKeys().length
    options.runtime.api.expandAllGroups()
    return visibleGroupsBefore > 0 ? visibleGroupsBefore : 1
  }

  const collapseAllGroups = (): number => {
    if (!treeEnabled.value) {
      return 0
    }
    const previous = cloneGroupExpansion(groupExpansion.value)
    if (!previous.expandedByDefault && previous.toggledGroupKeys.length === 0) {
      return 0
    }
    const visibleGroupsBefore = collectVisibleGroupKeys().length
    options.runtime.api.collapseAllGroups()
    return visibleGroupsBefore > 0 ? visibleGroupsBefore : 1
  }

  return {
    treeEnabled,
    groupSelectsChildren,
    groupBy,
    groupExpansion,
    setGroupBy,
    setGroupExpansion,
    clearGroupBy,
    toggleGroup,
    isGroupExpanded,
    expandGroups,
    collapseGroups,
    expandAllGroups,
    collapseAllGroups,
  }
}

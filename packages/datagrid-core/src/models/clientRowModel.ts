import {
  buildPaginationSnapshot,
  cloneGroupBySpec,
  clonePivotSpec,
  normalizeRowNode,
  normalizeGroupBySpec,
  normalizePaginationInput,
  normalizePivotSpec,
  normalizeTreeDataSpec,
  normalizeViewportRange,
  withResolvedRowIdentity,
  type DataGridGroupExpansionSnapshot,
  type DataGridPaginationInput,
  type DataGridPivotCellDrilldownInput,
  type DataGridComputedFieldDefinition,
  type DataGridComputedFieldSnapshot,
  type DataGridComputedDependencyToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramOptions,
  type DataGridFilterSnapshot,
  type DataGridSortAndFilterModelInput,
  type DataGridAggregationModel,
  type DataGridGroupBySpec,
  type DataGridPivotColumn,
  type DataGridPivotSpec,
  type DataGridRowId,
  type DataGridRowIdResolver,
  type DataGridRowNode,
  type DataGridRowNodeInput,
  type DataGridRowModel,
  type DataGridRowModelListener,
  type DataGridRowModelRefreshReason,
  type DataGridRowModelSnapshot,
  type DataGridSortState,
  type DataGridTreeDataDiagnostics,
  type DataGridTreeDataSpec,
  type DataGridViewportRange,
} from "./rowModel.js"
import {
  createClientRowProjectionEngine,
  expandClientProjectionStages,
} from "./clientRowProjectionEngine.js"
import { createClientRowProjectionOrchestrator } from "./clientRowProjectionOrchestrator.js"
import { DATAGRID_CLIENT_ALL_PROJECTION_STAGES } from "./projectionStages.js"
import {
  createClientRowComputeRuntime,
  type DataGridClientComputeDiagnostics,
  type DataGridClientComputeMode,
  type DataGridClientComputeTransport,
} from "./clientRowComputeRuntime.js"
import {
  createDataGridAggregationEngine,
} from "./aggregationEngine.js"
import {
  cloneDataGridFilterSnapshot as cloneFilterSnapshot,
} from "./advancedFilter.js"
import {
  type DataGridPatchChangeSet,
} from "./rowPatchAnalyzer.js"
import {
  createDataGridProjectionPolicy,
  type DataGridClientPerformanceMode,
  type DataGridProjectionPolicy,
} from "./projectionPolicy.js"
import { createClientRowRuntimeStateStore } from "./clientRowRuntimeStateStore.js"
import { createClientRowLifecycle } from "./clientRowLifecycle.js"
import {
  createPivotRuntime,
  type DataGridPivotIncrementalPatchRow,
} from "./pivotRuntime.js"
import {
  areSameAggregateRecords,
  cloneAggregationModel,
  createEmptyTreeDataDiagnostics,
  findDuplicateRowIds,
  patchGroupRowsAggregatesByGroupKey,
} from "./clientRowModelHelpers.js"
import {
  createTreeProjectionRuntime,
  type TreeParentProjectionCacheState,
  type TreePathProjectionCacheState,
} from "./treeProjectionRuntime.js"
import {
  applyIncrementalAggregationPatch as applyIncrementalAggregationPatchRuntime,
  createGroupByIncrementalAggregationState,
  resetGroupByIncrementalAggregationState as resetGroupByIncrementalAggregationStateRuntime,
} from "./incrementalAggregationRuntime.js"
import {
  buildColumnHistogram,
  createFilterPredicate,
  hasActiveFilterModel,
  normalizeText,
  readRowField,
} from "./clientRowProjectionPrimitives.js"
import {
  applyRowDataPatch,
  bumpRowVersions,
  buildRowIdPositionIndex,
  buildRowIdIndex,
  createRowVersionIndex,
  mergeRowPatch,
  pruneSortCacheRows,
  rebuildRowVersionIndex,
  reindexSourceRows,
} from "./clientRowRuntimeUtils.js"
import type { SortValueCacheEntry } from "./clientRowProjectionBasicStages.js"
import type { DataGridFieldDependency } from "./dependencyGraph.js"
import { normalizeDataGridDependencyToken } from "./dependencyModel.js"
import { resolveClientRowPivotCellDrilldown } from "./clientRowPivotDrilldownRuntime.js"
import {
  applyClientRowGroupExpansion,
  resolveClientRowExpansionSnapshot,
  resolveClientRowExpansionSpec,
  resolveClientRowExpansionStateStore,
} from "./clientRowExpansionRuntime.js"
import { createClientRowRowsMutationsRuntime } from "./clientRowRowsMutationsRuntime.js"
import { createClientRowPatchCoordinatorRuntime } from "./clientRowPatchCoordinatorRuntime.js"
import { createClientRowStateMutationsRuntime } from "./clientRowStateMutationsRuntime.js"
import { createClientRowSnapshotRuntime } from "./clientRowSnapshotRuntime.js"
import { createClientRowProjectionHandlersRuntime } from "./clientRowProjectionHandlersRuntime.js"
import type { ApplyClientRowPatchUpdatesResult } from "./clientRowPatchRuntime.js"

export interface CreateClientRowModelOptions<T> {
  rows?: readonly DataGridRowNodeInput<T>[]
  resolveRowId?: DataGridRowIdResolver<T>
  initialTreeData?: DataGridTreeDataSpec<T> | null
  initialSortModel?: readonly DataGridSortState[]
  initialFilterModel?: DataGridFilterSnapshot | null
  initialGroupBy?: DataGridGroupBySpec | null
  initialPivotModel?: DataGridPivotSpec | null
  initialAggregationModel?: DataGridAggregationModel<T> | null
  initialPagination?: DataGridPaginationInput | null
  performanceMode?: DataGridClientPerformanceMode
  projectionPolicy?: DataGridProjectionPolicy
  fieldDependencies?: readonly DataGridFieldDependency[]
  initialComputedFields?: readonly DataGridComputedFieldDefinition<T>[]
  computeMode?: DataGridClientComputeMode
  computeTransport?: DataGridClientComputeTransport | null
}

export interface DataGridClientRowReorderInput {
  fromIndex: number
  toIndex: number
  count?: number
}

export interface DataGridClientRowPatch<T = unknown> {
  rowId: DataGridRowId
  data: Partial<T>
}

export interface DataGridClientRowPatchOptions {
  /**
   * `false` by default for Excel-like edit flow: keep current projection order
   * until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeSort?: boolean
  /**
   * `false` by default for Excel-like edit flow: keep current filter membership
   * until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeFilter?: boolean
  /**
   * `false` by default for Excel-like edit flow: keep current grouping/aggregation
   * and pivot layout until explicit reapply (`refresh`) or recompute-enabled patch.
   */
  recomputeGroup?: boolean
  emit?: boolean
  signal?: AbortSignal | null
}

export interface ClientRowModel<T> extends DataGridRowModel<T> {
  setRows(rows: readonly DataGridRowNodeInput<T>[]): void
  replaceRows(rows: readonly DataGridRowNodeInput<T>[]): void
  appendRows(rows: readonly DataGridRowNodeInput<T>[]): void
  prependRows(rows: readonly DataGridRowNodeInput<T>[]): void
  setSortAndFilterModel(input: DataGridSortAndFilterModelInput): void
  getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions): DataGridColumnHistogram
  patchRows(
    updates: readonly DataGridClientRowPatch<T>[],
    options?: DataGridClientRowPatchOptions,
  ): void
  registerComputedField(definition: DataGridComputedFieldDefinition<T>): void
  getComputedFields(): readonly DataGridComputedFieldSnapshot[]
  recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
  reorderRows(input: DataGridClientRowReorderInput): boolean
  getComputeMode(): DataGridClientComputeMode
  switchComputeMode(mode: DataGridClientComputeMode): boolean
  getDerivedCacheDiagnostics(): DataGridClientRowModelDerivedCacheDiagnostics
  getComputeDiagnostics(): DataGridClientComputeDiagnostics
}

export interface DataGridClientRowModelDerivedCacheDiagnostics {
  revisions: {
    row: number
    sort: number
    filter: number
    group: number
  }
  filterPredicateHits: number
  filterPredicateMisses: number
  sortValueHits: number
  sortValueMisses: number
  groupValueHits: number
  groupValueMisses: number
}

function isDataGridRowId(value: unknown): value is DataGridRowId {
  return typeof value === "string" || typeof value === "number"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizePivotAxisValue(value: unknown): string {
  if (value == null) {
    return ""
  }
  return normalizeText(value)
}

export function createClientRowModel<T>(
  options: CreateClientRowModelOptions<T> = {},
): ClientRowModel<T> {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(value: U) => U
  }).structuredClone

  const cloneSortModel = (input: readonly DataGridSortState[]): readonly DataGridSortState[] =>
    input.map(item => ({ ...item }))

  const cloneFilterModel = (input: DataGridFilterSnapshot | null): DataGridFilterSnapshot | null => {
    if (!input) {
      return null
    }
    if (typeof structuredCloneRef === "function") {
      try {
        return structuredCloneRef(input)
      } catch {
        // Fall through to deterministic JS clone for non-cloneable payloads.
      }
    }
    return cloneFilterSnapshot(input)
  }

  const resolveRowId = options.resolveRowId
  const treeData = normalizeTreeDataSpec(options.initialTreeData ?? null)
  const projectionPolicy = options.projectionPolicy ?? createDataGridProjectionPolicy({
    performanceMode: options.performanceMode,
    dependencies: options.fieldDependencies,
  })
  if (options.projectionPolicy && Array.isArray(options.fieldDependencies)) {
    for (const dependency of options.fieldDependencies) {
      projectionPolicy.dependencyGraph.registerDependency(
        dependency.sourceField,
        dependency.dependentField,
      )
    }
  }
  let treeDataDiagnostics: DataGridTreeDataDiagnostics | null = treeData ? createEmptyTreeDataDiagnostics() : null

  const normalizeSourceRows = (inputRows: readonly DataGridRowNodeInput<T>[] | null | undefined): DataGridRowNode<T>[] => {
    const normalized = Array.isArray(inputRows)
      ? reindexSourceRows(inputRows.map((row, index) => normalizeRowNode(withResolvedRowIdentity(row, index, resolveRowId), index)))
      : []
    if (!treeData) {
      return normalized
    }
    const duplicates = findDuplicateRowIds(normalized)
    if (duplicates.length === 0) {
      return normalized
    }
    const message = `[DataGridTreeData] Duplicate rowId detected (${duplicates.map(value => String(value)).join(", ")}).`
    treeDataDiagnostics = createEmptyTreeDataDiagnostics({
      duplicates: duplicates.length,
      lastError: message,
      orphans: treeDataDiagnostics?.orphans ?? 0,
      cycles: treeDataDiagnostics?.cycles ?? 0,
    })
    throw new Error(message)
  }

  let sourceRows: DataGridRowNode<T>[] = normalizeSourceRows(options.rows ?? [])
  let sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
  const runtimeStateStore = createClientRowRuntimeStateStore<T>()
  const runtimeState = runtimeStateStore.state
  let sortModel: readonly DataGridSortState[] = options.initialSortModel ? cloneSortModel(options.initialSortModel) : []
  let filterModel: DataGridFilterSnapshot | null = cloneFilterModel(options.initialFilterModel ?? null)
  let groupBy: DataGridGroupBySpec | null = treeData
    ? null
    : normalizeGroupBySpec(options.initialGroupBy ?? null)
  let pivotModel: DataGridPivotSpec | null = normalizePivotSpec(options.initialPivotModel ?? null)
  let pivotColumns: DataGridPivotColumn[] = []
  let aggregationModel: DataGridAggregationModel<T> | null = cloneAggregationModel(options.initialAggregationModel ?? null)
  const pivotRuntime = createPivotRuntime<T>()
  const treeProjectionRuntime = createTreeProjectionRuntime<T>()
  const aggregationEngine = createDataGridAggregationEngine<T>(aggregationModel)
  let expansionExpandedByDefault = Boolean(treeData?.expandedByDefault ?? groupBy?.expandedByDefault)
  let pivotExpansionExpandedByDefault = true
  let paginationInput = normalizePaginationInput(options.initialPagination ?? null)
  let pagination = buildPaginationSnapshot(0, paginationInput)
  const toggledGroupKeys = new Set<string>()
  const toggledPivotGroupKeys = new Set<string>()
  let viewportRange = normalizeViewportRange({ start: 0, end: 0 }, runtimeState.rows.length)
  const lifecycle = createClientRowLifecycle<T>()
  let cachedFilterPredicateKey = "__none__"
  let cachedFilterPredicate: ((rowNode: DataGridRowNode<T>) => boolean) | null = null
  let rowVersionById = createRowVersionIndex(sourceRows)
  const sortValueCache = new Map<DataGridRowId, SortValueCacheEntry>()
  let sortValueCacheKey = "__none__"
  const groupValueCache = new Map<string, string>()
  let groupValueCacheKey = "__none__"
  const derivedCacheDiagnostics: DataGridClientRowModelDerivedCacheDiagnostics = {
    revisions: {
      row: runtimeState.rowRevision,
      sort: runtimeState.sortRevision,
      filter: runtimeState.filterRevision,
      group: runtimeState.groupRevision,
    },
    filterPredicateHits: 0,
    filterPredicateMisses: 0,
    sortValueHits: 0,
    sortValueMisses: 0,
    groupValueHits: 0,
    groupValueMisses: 0,
  }
  let treeCacheRevision = 0
  let treePathProjectionCacheState: TreePathProjectionCacheState<T> | null = null
  let treeParentProjectionCacheState: TreeParentProjectionCacheState<T> | null = null
  const groupByIncrementalAggregationState = createGroupByIncrementalAggregationState()
  let groupedProjectionGroupIndexByRowId: ReadonlyMap<DataGridRowId, number> = new Map<DataGridRowId, number>()
  let lastTreeProjectionCacheKey: string | null = null
  let lastTreeExpansionSnapshot: DataGridGroupExpansionSnapshot | null = null
  let pendingPivotValuePatch: readonly DataGridPivotIncrementalPatchRow<T>[] | null = null
  const projectionEngine = createClientRowProjectionEngine<T>()
  type ComputedDependencyDomain = "field" | "computed" | "meta"
  interface DataGridResolvedComputedDependency {
    token: DataGridComputedDependencyToken
    domain: ComputedDependencyDomain
    value: string
  }
  interface DataGridRegisteredComputedField {
    name: string
    field: string
    deps: readonly DataGridResolvedComputedDependency[]
    compute: DataGridComputedFieldDefinition<T>["compute"]
  }
  interface ApplyComputedFieldsToSourceRowsOptions {
    rowIds?: ReadonlySet<DataGridRowId>
    changedFieldsByRowId?: ReadonlyMap<DataGridRowId, ReadonlySet<string>>
  }
  interface ApplyComputedFieldsToSourceRowsResult {
    changed: boolean
    changedRowIds: readonly DataGridRowId[]
    computedUpdatesByRowId: ReadonlyMap<DataGridRowId, Partial<T>>
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
    nextRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>
  }
  const computedFieldsByName = new Map<string, DataGridRegisteredComputedField>()
  const computedFieldNameByTargetField = new Map<string, string>()
  let computedOrder: string[] = []

  const normalizeComputedName = (value: unknown): string => {
    if (typeof value !== "string") {
      throw new Error("[DataGridComputed] Computed field name must be a string.")
    }
    const normalized = value.trim()
    if (normalized.length === 0) {
      throw new Error("[DataGridComputed] Computed field name must be non-empty.")
    }
    return normalized
  }

  const normalizeComputedTargetField = (
    value: unknown,
    fallbackName: string,
  ): string => {
    const rawValue = typeof value === "string" && value.trim().length > 0
      ? value
      : fallbackName
    const normalized = rawValue.trim()
    if (normalized.length === 0) {
      throw new Error("[DataGridComputed] Computed field target must be non-empty.")
    }
    if (normalized.includes(".")) {
      throw new Error(
        `[DataGridComputed] Nested target path '${normalized}' is not supported yet. Use a top-level field.`,
      )
    }
    return normalized
  }

  const resolveComputedDependency = (
    value: DataGridComputedDependencyToken,
  ): DataGridResolvedComputedDependency => {
    const normalizedToken = normalizeDataGridDependencyToken(String(value), "field")
    if (normalizedToken.startsWith("computed:")) {
      return {
        token: normalizedToken,
        domain: "computed",
        value: normalizedToken.slice("computed:".length),
      }
    }
    if (normalizedToken.startsWith("meta:")) {
      return {
        token: normalizedToken,
        domain: "meta",
        value: normalizedToken.slice("meta:".length),
      }
    }
    return {
      token: normalizedToken,
      domain: "field",
      value: normalizedToken.slice("field:".length),
    }
  }

  const rebuildComputedOrder = (): void => {
    const stateByName = new Map<string, 0 | 1 | 2>()
    const ordered: string[] = []
    const visit = (name: string): void => {
      const state = stateByName.get(name) ?? 0
      if (state === 2) {
        return
      }
      if (state === 1) {
        throw new Error(`[DataGridComputed] Cycle detected at computed field '${name}'.`)
      }
      const entry = computedFieldsByName.get(name)
      if (!entry) {
        throw new Error(`[DataGridComputed] Missing computed field '${name}'.`)
      }
      stateByName.set(name, 1)
      for (const dependency of entry.deps) {
        if (dependency.domain !== "computed") {
          continue
        }
        if (!computedFieldsByName.has(dependency.value)) {
          throw new Error(
            `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
          )
        }
        visit(dependency.value)
      }
      stateByName.set(name, 2)
      ordered.push(name)
    }
    for (const name of computedFieldsByName.keys()) {
      visit(name)
    }
    computedOrder = ordered
  }

  const registerComputedFieldInternal = (
    definition: DataGridComputedFieldDefinition<T>,
  ): void => {
    const name = normalizeComputedName(definition.name)
    if (computedFieldsByName.has(name)) {
      throw new Error(`[DataGridComputed] Computed field '${name}' is already registered.`)
    }
    if (typeof definition.compute !== "function") {
      throw new Error(`[DataGridComputed] Computed field '${name}' must provide a compute function.`)
    }

    const targetField = normalizeComputedTargetField(definition.field, name)
    const existingFieldOwner = computedFieldNameByTargetField.get(targetField)
    if (existingFieldOwner) {
      throw new Error(
        `[DataGridComputed] Target field '${targetField}' is already owned by computed field '${existingFieldOwner}'.`,
      )
    }

    const rawDeps = Array.isArray(definition.deps) ? definition.deps : []
    const deps = rawDeps.map(resolveComputedDependency)
    for (const dependency of deps) {
      if (dependency.domain !== "computed") {
        continue
      }
      if (dependency.value === name) {
        throw new Error(`[DataGridComputed] Computed field '${name}' cannot depend on itself.`)
      }
      if (!computedFieldsByName.has(dependency.value)) {
        throw new Error(
          `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
        )
      }
    }

    const entry: DataGridRegisteredComputedField = {
      name,
      field: targetField,
      deps,
      compute: definition.compute,
    }
    computedFieldsByName.set(name, entry)
    computedFieldNameByTargetField.set(targetField, name)
    try {
      rebuildComputedOrder()
    } catch (error) {
      computedFieldsByName.delete(name)
      computedFieldNameByTargetField.delete(targetField)
      throw error
    }

    for (const dependency of deps) {
      if (dependency.domain === "meta") {
        continue
      }
      const sourceField = dependency.domain === "computed"
        ? computedFieldsByName.get(dependency.value)?.field
        : dependency.value
      if (!sourceField || sourceField.length === 0) {
        continue
      }
      projectionPolicy.dependencyGraph.registerDependency(
        sourceField,
        targetField,
        { kind: dependency.domain === "field" ? "structural" : "computed" },
      )
    }
  }

  const resolveComputedAffectedNames = (
    changedFields: ReadonlySet<string>,
  ): ReadonlySet<string> => {
    if (computedOrder.length === 0 || changedFields.size === 0) {
      return new Set<string>()
    }
    const affectedFields = projectionPolicy.dependencyGraph.getAffectedFields(changedFields)
    const affectedNames = new Set<string>()
    for (const computedName of computedOrder) {
      const computed = computedFieldsByName.get(computedName)
      if (!computed) {
        continue
      }
      if (affectedFields.has(computed.field)) {
        affectedNames.add(computedName)
      }
    }
    return affectedNames
  }

  const resolveComputedTokenValue = (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
  ): unknown => {
    if (typeof token !== "string") {
      return undefined
    }
    const normalizedTokenInput = token.trim()
    if (normalizedTokenInput.length === 0) {
      return undefined
    }
    if (!normalizedTokenInput.includes(":") && computedFieldsByName.has(normalizedTokenInput)) {
      const computedDependency = computedFieldsByName.get(normalizedTokenInput)
      if (!computedDependency) {
        return undefined
      }
      return readRowField(rowNode, computedDependency.field, computedDependency.field)
    }
    const dependency = resolveComputedDependency(normalizedTokenInput)
    if (dependency.domain === "meta") {
      return undefined
    }
    if (dependency.domain === "computed") {
      const computedDependency = computedFieldsByName.get(dependency.value)
      if (!computedDependency) {
        return undefined
      }
      return readRowField(rowNode, computedDependency.field, computedDependency.field)
    }
    return readRowField(rowNode, dependency.value, dependency.value)
  }

  const applyComputedFieldsToSourceRows = (
    options: ApplyComputedFieldsToSourceRowsOptions = {},
  ): ApplyComputedFieldsToSourceRowsResult => {
    if (computedOrder.length === 0 || sourceRows.length === 0) {
      return {
        changed: false,
        changedRowIds: [],
        computedUpdatesByRowId: new Map<DataGridRowId, Partial<T>>(),
        previousRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
        nextRowsById: new Map<DataGridRowId, DataGridRowNode<T>>(),
      }
    }

    const rowIds = options.rowIds
    let nextSourceRows: DataGridRowNode<T>[] | null = null
    const changedRowIds: DataGridRowId[] = []
    const computedUpdatesByRowId = new Map<DataGridRowId, Partial<T>>()
    const previousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()
    const nextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>()

    for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex += 1) {
      const row = sourceRows[rowIndex]
      if (!row) {
        continue
      }
      if (rowIds && !rowIds.has(row.rowId)) {
        continue
      }
      if (!isRecord(row.data)) {
        continue
      }
      const changedFields = options.changedFieldsByRowId?.get(row.rowId) ?? null
      const affectedNames = changedFields
        ? resolveComputedAffectedNames(changedFields)
        : null
      if (affectedNames && affectedNames.size === 0) {
        continue
      }

      let workingRowNode = row
      let rowPatch: Record<string, unknown> | null = null
      for (const computedName of computedOrder) {
        if (affectedNames && !affectedNames.has(computedName)) {
          continue
        }
        const computed = computedFieldsByName.get(computedName)
        if (!computed) {
          continue
        }
        const nextValue = computed.compute({
          row: workingRowNode.row,
          rowId: workingRowNode.rowId,
          sourceIndex: workingRowNode.sourceIndex,
          get: (token) => resolveComputedTokenValue(workingRowNode, token),
        })
        const previousValue = readRowField(workingRowNode, computed.field, computed.field)
        if (Object.is(nextValue, previousValue)) {
          continue
        }
        rowPatch = rowPatch ?? {}
        rowPatch[computed.field] = nextValue
        const nextData = applyRowDataPatch(
          workingRowNode.data,
          { [computed.field]: nextValue } as Partial<T>,
        )
        if (nextData !== workingRowNode.data) {
          workingRowNode = {
            ...workingRowNode,
            data: nextData,
            row: nextData,
          }
        }
      }

      if (!rowPatch) {
        continue
      }
      if (!nextSourceRows) {
        nextSourceRows = sourceRows.slice()
      }
      const finalizedRow = workingRowNode
      if (finalizedRow.data === row.data && finalizedRow.row === row.row) {
        continue
      }
      nextSourceRows[rowIndex] = finalizedRow
      changedRowIds.push(row.rowId)
      computedUpdatesByRowId.set(row.rowId, rowPatch as Partial<T>)
      previousRowsById.set(row.rowId, row)
      nextRowsById.set(row.rowId, finalizedRow)
    }

    if (nextSourceRows && changedRowIds.length > 0) {
      sourceRows = nextSourceRows
      sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
    }

    return {
      changed: changedRowIds.length > 0,
      changedRowIds,
      computedUpdatesByRowId,
      previousRowsById,
      nextRowsById,
    }
  }

  const getComputedFieldSnapshots = (): readonly DataGridComputedFieldSnapshot[] => {
    return computedOrder
      .map((name): DataGridComputedFieldSnapshot | null => {
        const computed = computedFieldsByName.get(name)
        if (!computed) {
          return null
        }
        return {
          name: computed.name,
          field: computed.field,
          deps: computed.deps.map(dep => dep.token),
        }
      })
      .filter((entry): entry is DataGridComputedFieldSnapshot => entry !== null)
  }

  const resolveInitialComputedRegistrationOrder = (
    definitions: readonly DataGridComputedFieldDefinition<T>[],
  ): readonly DataGridComputedFieldDefinition<T>[] => {
    if (definitions.length === 0) {
      return []
    }
    const byName = new Map<string, DataGridComputedFieldDefinition<T>>()
    for (const definition of definitions) {
      const name = normalizeComputedName(definition.name)
      if (byName.has(name)) {
        throw new Error(`[DataGridComputed] Duplicate computed field '${name}' in initialComputedFields.`)
      }
      byName.set(name, definition)
    }
    const ordered: DataGridComputedFieldDefinition<T>[] = []
    const states = new Map<string, 0 | 1 | 2>()
    const visit = (name: string): void => {
      const state = states.get(name) ?? 0
      if (state === 2) {
        return
      }
      if (state === 1) {
        throw new Error(`[DataGridComputed] Cycle detected at computed field '${name}'.`)
      }
      const definition = byName.get(name)
      if (!definition) {
        throw new Error(`[DataGridComputed] Missing initial computed field '${name}'.`)
      }
      states.set(name, 1)
      for (const rawDependency of Array.isArray(definition.deps) ? definition.deps : []) {
        const dependency = resolveComputedDependency(rawDependency)
        if (dependency.domain !== "computed") {
          continue
        }
        if (byName.has(dependency.value)) {
          visit(dependency.value)
          continue
        }
        if (!computedFieldsByName.has(dependency.value)) {
          throw new Error(
            `[DataGridComputed] Missing dependency 'computed:${dependency.value}' for '${name}'.`,
          )
        }
      }
      states.set(name, 2)
      ordered.push(definition)
    }
    for (const name of byName.keys()) {
      visit(name)
    }
    return ordered
  }

  if (Array.isArray(options.initialComputedFields) && options.initialComputedFields.length > 0) {
    const orderedInitialComputedFields = resolveInitialComputedRegistrationOrder(options.initialComputedFields)
    for (const definition of orderedInitialComputedFields) {
      registerComputedFieldInternal(definition)
    }
    const initialComputedRecompute = applyComputedFieldsToSourceRows()
    if (initialComputedRecompute.changed) {
      bumpRowVersions(rowVersionById, initialComputedRecompute.changedRowIds)
    }
  }

  function ensureActive() {
    lifecycle.ensureActive()
  }

  function invalidateTreeProjectionCaches(): void {
    treeCacheRevision += 1
    treePathProjectionCacheState = null
    treeParentProjectionCacheState = null
    lastTreeProjectionCacheKey = null
    lastTreeExpansionSnapshot = null
  }

  function patchTreeProjectionCacheRowsByIdentity(changedRowIds: readonly DataGridRowId[] = []): void {
    if (!treeData || (!treePathProjectionCacheState && !treeParentProjectionCacheState)) {
      return
    }
    const sourceById = buildRowIdIndex(sourceRows)
    if (treePathProjectionCacheState) {
      treePathProjectionCacheState = {
        key: treePathProjectionCacheState.key,
        cache: treeProjectionRuntime.patchPathCacheRowsByIdentity(
          treePathProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
    if (treeParentProjectionCacheState) {
      treeParentProjectionCacheState = {
        key: treeParentProjectionCacheState.key,
        cache: treeProjectionRuntime.patchParentCacheRowsByIdentity(
          treeParentProjectionCacheState.cache,
          sourceById,
          changedRowIds,
        ),
      }
    }
  }

  function resetGroupByIncrementalAggregationState(): void {
    resetGroupByIncrementalAggregationStateRuntime(groupByIncrementalAggregationState)
  }

  function patchRuntimeGroupAggregates(
    resolveAggregates: (groupKey: string) => Record<string, unknown> | undefined,
  ): void {
    runtimeState.groupedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.groupedRowsProjection,
      resolveAggregates,
    )
    runtimeState.aggregatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.aggregatedRowsProjection,
      resolveAggregates,
    )
    runtimeState.paginatedRowsProjection = patchGroupRowsAggregatesByGroupKey(
      runtimeState.paginatedRowsProjection,
      resolveAggregates,
    )
    runtimeState.rows = patchGroupRowsAggregatesByGroupKey(runtimeState.rows, resolveAggregates)
  }

  function applyIncrementalAggregationPatch(
    changeSet: DataGridPatchChangeSet,
    previousRowsById: ReadonlyMap<DataGridRowId, DataGridRowNode<T>>,
  ): boolean {
    aggregationEngine.setModel(aggregationModel)
    return applyIncrementalAggregationPatchRuntime({
      changedRowIds: changeSet.changedRowIds,
      previousRowsById,
      resolveNextRowById: (rowId) => {
        const rowIndex = sourceRowIndexById.get(rowId)
        if (typeof rowIndex !== "number" || rowIndex < 0 || rowIndex >= sourceRows.length) {
          return undefined
        }
        return sourceRows[rowIndex]
      },
      stageImpact: {
        affectsAggregation: changeSet.stageImpact.affectsAggregation,
        affectsFilter: changeSet.stageImpact.affectsFilter,
        affectsSort: changeSet.stageImpact.affectsSort,
        affectsGroup: changeSet.stageImpact.affectsGroup,
      },
      hasPivotModel: Boolean(pivotModel),
      hasAggregationModel: Boolean(aggregationModel && aggregationModel.columns.length > 0),
      hasTreeData: Boolean(treeData),
      hasGroupBy: Boolean(groupBy),
      groupByState: groupByIncrementalAggregationState,
      treePathCacheState: treePathProjectionCacheState,
      treeParentCacheState: treeParentProjectionCacheState,
      isIncrementalAggregationSupported: () => aggregationEngine.isIncrementalAggregationSupported(),
      createLeafContribution: row => aggregationEngine.createLeafContribution(row),
      applyContributionDelta: (groupState, previous, next) => {
        aggregationEngine.applyContributionDelta(groupState, previous, next)
      },
      finalizeGroupState: groupState => aggregationEngine.finalizeGroupState(groupState),
      patchRuntimeGroupAggregates,
    })
  }

  function resolveFilterPredicate(
    options: { ignoreColumnFilterKey?: string } = {},
  ): (rowNode: DataGridRowNode<T>) => boolean {
    const ignoredColumnKey = typeof options.ignoreColumnFilterKey === "string"
      ? options.ignoreColumnFilterKey.trim()
      : ""
    if (ignoredColumnKey) {
      derivedCacheDiagnostics.filterPredicateMisses += 1
      return createFilterPredicate(filterModel, { ignoreColumnFilterKey: ignoredColumnKey })
    }

    const filterKey = String(runtimeState.filterRevision)
    return filterKey === cachedFilterPredicateKey && cachedFilterPredicate
      ? (() => {
          derivedCacheDiagnostics.filterPredicateHits += 1
          return cachedFilterPredicate as (rowNode: DataGridRowNode<T>) => boolean
        })()
      : (() => {
          const next = createFilterPredicate(filterModel)
          cachedFilterPredicateKey = filterKey
          cachedFilterPredicate = next
          derivedCacheDiagnostics.filterPredicateMisses += 1
          return next
        })()
  }

  function getActiveExpansionStateStore(): {
    expandedByDefault: boolean
    toggledKeys: Set<string>
    setExpandedByDefault: (value: boolean) => void
  } {
    return resolveClientRowExpansionStateStore({
      pivotModel,
      treeDataEnabled: Boolean(treeData),
      expansionExpandedByDefault,
      pivotExpansionExpandedByDefault,
      toggledGroupKeys,
      toggledPivotGroupKeys,
      setExpansionExpandedByDefault: (value: boolean) => {
        expansionExpandedByDefault = value
      },
      setPivotExpansionExpandedByDefault: (value: boolean) => {
        pivotExpansionExpandedByDefault = value
      },
    })
  }

  function getCurrentExpansionSnapshot(): DataGridGroupExpansionSnapshot {
    const expansionSpec = getExpansionSpec()
    const expansionState = getActiveExpansionStateStore()
    return resolveClientRowExpansionSnapshot({
      expansionSpec,
      expansionState,
    })
  }

  const projectionHandlersRuntime = createClientRowProjectionHandlersRuntime<T>({
    runtimeState,
    commitProjectionCycle: (hadActualRecompute) => {
      runtimeStateStore.commitProjectionCycle(hadActualRecompute)
    },
    getSourceRows: () => sourceRows,
    buildSourceById: () => buildRowIdIndex(sourceRows),
    readRowField,
    normalizeText,
    resolveFilterPredicate,
    getTreeData: () => treeData,
    getFilterModel: () => filterModel,
    getSortModel: () => sortModel,
    getGroupBy: () => groupBy,
    getPivotModel: () => pivotModel,
    getAggregationModel: () => aggregationModel,
    getProjectionPolicy: () => projectionPolicy,
    getRowVersionById: () => rowVersionById,
    getTreeCacheRevision: () => treeCacheRevision,
    getPaginationInput: () => paginationInput,
    setPaginationInput: (nextPaginationInput) => {
      paginationInput = nextPaginationInput
    },
    getPagination: () => pagination,
    setPagination: (nextPagination) => {
      pagination = nextPagination
    },
    getViewportRange: () => viewportRange,
    setViewportRange: (range) => {
      viewportRange = range
    },
    normalizeViewportRange,
    getSortValueCacheKey: () => sortValueCacheKey,
    setSortValueCacheKey: (key) => {
      sortValueCacheKey = key
    },
    sortValueCache,
    getGroupValueCacheKey: () => groupValueCacheKey,
    setGroupValueCacheKey: (key) => {
      groupValueCacheKey = key
    },
    groupValueCache,
    getGroupedProjectionGroupIndexByRowId: () => groupedProjectionGroupIndexByRowId,
    setGroupedProjectionGroupIndexByRowId: (index) => {
      groupedProjectionGroupIndexByRowId = index
    },
    getTreePathProjectionCacheState: () => treePathProjectionCacheState,
    setTreePathProjectionCacheState: (state) => {
      treePathProjectionCacheState = state
    },
    getTreeParentProjectionCacheState: () => treeParentProjectionCacheState,
    setTreeParentProjectionCacheState: (state) => {
      treeParentProjectionCacheState = state
    },
    getLastTreeProjectionCacheKey: () => lastTreeProjectionCacheKey,
    setLastTreeProjectionCacheKey: (key) => {
      lastTreeProjectionCacheKey = key
    },
    getLastTreeExpansionSnapshot: () => lastTreeExpansionSnapshot,
    setLastTreeExpansionSnapshot: (snapshot) => {
      lastTreeExpansionSnapshot = snapshot
    },
    getTreeDataDiagnostics: () => treeDataDiagnostics,
    setTreeDataDiagnostics: (diagnostics) => {
      treeDataDiagnostics = diagnostics
    },
    getPivotColumns: () => pivotColumns,
    setPivotColumns: (columns) => {
      pivotColumns = columns
    },
    getPendingPivotValuePatch: () => pendingPivotValuePatch,
    setPendingPivotValuePatch: (rows) => {
      pendingPivotValuePatch = rows
    },
    getCurrentExpansionSnapshot: () => getCurrentExpansionSnapshot(),
    getExpansionToggledKeys: () => getActiveExpansionStateStore().toggledKeys,
    derivedCacheDiagnostics,
    treeProjectionRuntime,
    pivotRuntime,
    aggregationEngine,
    groupByIncrementalAggregationState,
    resetGroupByIncrementalAggregationState,
  })

  const projectionOrchestrator = createClientRowProjectionOrchestrator(
    projectionEngine,
    projectionHandlersRuntime.projectionStageHandlers,
  )
  const computeTransport = options.computeTransport ?? null
  let computeMode: DataGridClientComputeMode = options.computeMode ?? "sync"
  let computeRuntime = createClientRowComputeRuntime({
    mode: computeMode,
    transport: computeTransport,
    orchestrator: projectionOrchestrator,
  })

  const snapshotRuntime = createClientRowSnapshotRuntime<T>({
    runtimeState,
    runtimeStateStore,
    getStaleStages: () => computeRuntime.getStaleStages(),
    getViewportRange: () => viewportRange,
    setViewportRange: (range) => {
      viewportRange = range
    },
    normalizeViewportRange,
    getPagination: () => pagination,
    getSortModel: () => sortModel,
    cloneSortModel,
    getFilterModel: () => filterModel,
    cloneFilterModel,
    isTreeDataEnabled: () => Boolean(treeData),
    getTreeDataDiagnostics: () => treeDataDiagnostics,
    cloneTreeDataDiagnostics: (diagnostics) => createEmptyTreeDataDiagnostics(diagnostics ?? undefined),
    getGroupBy: () => groupBy,
    cloneGroupBySpec,
    getPivotModel: () => pivotModel,
    clonePivotSpec,
    getPivotColumns: () => pivotColumns,
    normalizePivotColumns: (columns) => pivotRuntime.normalizeColumns(columns),
    getExpansionSnapshot: () => getCurrentExpansionSnapshot(),
  })

  const getSnapshot = (): DataGridRowModelSnapshot<T> => snapshotRuntime.getSnapshot()

  function emit() {
    lifecycle.emit(getSnapshot)
  }

  function getExpansionSpec(): DataGridGroupBySpec | null {
    return resolveClientRowExpansionSpec({
      treeDataEnabled: Boolean(treeData),
      pivotModel,
      groupBy,
      expansionExpandedByDefault,
      pivotExpansionExpandedByDefault,
    })
  }

  function applyGroupExpansion(nextExpansion: DataGridGroupExpansionSnapshot | null): boolean {
    const expansionSpec = getExpansionSpec()
    if (!expansionSpec) {
      return false
    }
    return applyClientRowGroupExpansion({
      nextExpansion,
      expansionSpec,
      expansionState: getActiveExpansionStateStore(),
    })
  }

  const stateMutationsRuntime = createClientRowStateMutationsRuntime<T>({
    ensureActive,
    emit,
    recomputeFromStage: (stage) => {
      computeRuntime.recomputeFromStage(stage)
    },
    setProjectionInvalidation: (reasons) => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    bumpSortRevision: () => {
      runtimeStateStore.bumpSortRevision()
    },
    bumpFilterRevision: () => {
      runtimeStateStore.bumpFilterRevision()
    },
    bumpGroupRevision: () => {
      runtimeStateStore.bumpGroupRevision()
    },
    getRuntimeRowCount: () => runtimeState.rows.length,
    getViewportRange: () => viewportRange,
    setViewportRange: (range) => {
      viewportRange = range
    },
    getPaginationInput: () => paginationInput,
    setPaginationInput: (nextPaginationInput) => {
      paginationInput = nextPaginationInput
    },
    getSortModel: () => sortModel,
    setSortModel: (nextSortModel) => {
      sortModel = nextSortModel
    },
    cloneSortModel,
    getFilterModel: () => filterModel,
    setFilterModel: (nextFilterModel) => {
      filterModel = nextFilterModel
    },
    cloneFilterModel,
    isTreeDataEnabled: () => Boolean(treeData),
    getGroupBy: () => groupBy,
    setGroupBy: (nextGroupBy) => {
      groupBy = nextGroupBy
    },
    setExpansionExpandedByDefault: (value) => {
      expansionExpandedByDefault = value
    },
    clearToggledGroupKeys: () => {
      toggledGroupKeys.clear()
    },
    getPivotModel: () => pivotModel,
    setPivotModel: (nextPivotModel) => {
      pivotModel = nextPivotModel
    },
    resetPivotColumns: () => {
      pivotColumns = []
    },
    setPivotExpansionExpandedByDefault: (value) => {
      pivotExpansionExpandedByDefault = value
    },
    clearToggledPivotGroupKeys: () => {
      toggledPivotGroupKeys.clear()
    },
    getAggregationModel: () => aggregationModel,
    setAggregationModel: (nextAggregationModel) => {
      aggregationModel = nextAggregationModel
    },
    invalidateTreeProjectionCaches,
    applyGroupExpansion,
    getExpansionSpec,
    getActiveExpansionStateStore,
  })

  const rowsMutationsRuntime = createClientRowRowsMutationsRuntime<T>({
    ensureActive,
    emit,
    recomputeFromProjectionEntryStage: () => {
      computeRuntime.recomputeFromStage("compute")
    },
    applyComputedFields: () => {
      const computedResult = applyComputedFieldsToSourceRows()
      if (!computedResult.changed) {
        return
      }
      bumpRowVersions(rowVersionById, computedResult.changedRowIds)
    },
    setProjectionInvalidation: (reasons) => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    resetGroupByIncrementalAggregationState,
    invalidateTreeProjectionCaches,
    getSourceRows: () => sourceRows,
    setSourceRows: (rows) => {
      sourceRows = rows
      sourceRowIndexById = buildRowIdPositionIndex(sourceRows)
    },
    normalizeSourceRows,
    reindexSourceRows,
    getRowVersionById: () => rowVersionById,
    setRowVersionById: (index) => {
      rowVersionById = index
    },
    rebuildRowVersionIndex,
    pruneSortCacheRows: (rows) => {
      pruneSortCacheRows(sortValueCache, rows)
    },
  })

  const patchCoordinatorRuntime = createClientRowPatchCoordinatorRuntime<T>({
    ensureActive,
    emit,
    setPendingPivotValuePatch: (patch) => {
      pendingPivotValuePatch = patch
    },
    isDataGridRowId,
    applyRowDataPatch,
    getSourceRows: () => sourceRows,
    getSourceRowIndexById: () => sourceRowIndexById,
    setSourceRows: (rows) => {
      sourceRows = rows as DataGridRowNode<T>[]
    },
    getRowVersionById: () => rowVersionById,
    bumpRowRevision: () => {
      runtimeStateStore.bumpRowRevision()
    },
    setProjectionInvalidation: (reasons) => {
      runtimeStateStore.setProjectionInvalidation(reasons)
    },
    applyComputedFieldsToPatchResult: (patchResult) => {
      const changedFieldsByRowId = new Map<DataGridRowId, ReadonlySet<string>>()
      for (const [rowId, patch] of patchResult.changedUpdatesById.entries()) {
        const fields = new Set<string>()
        if (isRecord(patch)) {
          for (const key of Object.keys(patch)) {
            fields.add(key)
          }
        }
        changedFieldsByRowId.set(rowId, fields)
      }
      const computedResult = applyComputedFieldsToSourceRows({
        rowIds: new Set<DataGridRowId>(patchResult.changedRowIds),
        changedFieldsByRowId,
      })
      if (!computedResult.changed) {
        return patchResult
      }

      const mergedChangedUpdatesById = new Map<DataGridRowId, Partial<T>>(patchResult.changedUpdatesById)
      for (const [rowId, computedPatch] of computedResult.computedUpdatesByRowId.entries()) {
        const existingPatch = mergedChangedUpdatesById.get(rowId)
        if (existingPatch) {
          mergedChangedUpdatesById.set(rowId, mergeRowPatch(existingPatch, computedPatch))
        } else {
          mergedChangedUpdatesById.set(rowId, computedPatch)
        }
      }

      const mergedPreviousRowsById = new Map<DataGridRowId, DataGridRowNode<T>>(patchResult.previousRowsById)
      for (const [rowId, previousRow] of computedResult.previousRowsById.entries()) {
        if (!mergedPreviousRowsById.has(rowId)) {
          mergedPreviousRowsById.set(rowId, previousRow)
        }
      }

      const mergedNextRowsById = new Map<DataGridRowId, DataGridRowNode<T>>(patchResult.nextRowsById)
      for (const [rowId, nextRow] of computedResult.nextRowsById.entries()) {
        mergedNextRowsById.set(rowId, nextRow)
      }

      const changedRowIdSet = new Set<DataGridRowId>(patchResult.changedRowIds)
      for (const rowId of computedResult.changedRowIds) {
        changedRowIdSet.add(rowId)
      }

      return {
        nextSourceRows: sourceRows,
        changed: true,
        changedRowIds: Array.from(changedRowIdSet),
        changedUpdatesById: mergedChangedUpdatesById,
        previousRowsById: mergedPreviousRowsById,
        nextRowsById: mergedNextRowsById,
      } satisfies ApplyClientRowPatchUpdatesResult<T>
    },
    tryApplyFlatProjectionPatch: (changedRowIds, nextRowsById) => {
      if (
        hasActiveFilterModel(filterModel)
        || sortModel.length > 0
        || treeData !== null
        || groupBy !== null
        || pivotModel !== null
        || Boolean(aggregationModel && aggregationModel.columns.length > 0)
        || pagination.enabled
        || computeRuntime.getStaleStages().length > 0
      ) {
        return false
      }
      const sourceCount = sourceRows.length
      if (
        runtimeState.filteredRowsProjection.length !== sourceCount
        || runtimeState.sortedRowsProjection.length !== sourceCount
        || runtimeState.groupedRowsProjection.length !== sourceCount
        || runtimeState.pivotedRowsProjection.length !== sourceCount
        || runtimeState.aggregatedRowsProjection.length !== sourceCount
        || runtimeState.paginatedRowsProjection.length !== sourceCount
        || runtimeState.rows.length !== sourceCount
      ) {
        return false
      }

      const projectionRowsToPatch: DataGridRowNode<T>[][] = []
      const registerProjectionRows = (rows: readonly DataGridRowNode<T>[]) => {
        const mutableRows = rows as DataGridRowNode<T>[]
        if (!projectionRowsToPatch.includes(mutableRows)) {
          projectionRowsToPatch.push(mutableRows)
        }
      }
      registerProjectionRows(runtimeState.filteredRowsProjection)
      registerProjectionRows(runtimeState.sortedRowsProjection)
      registerProjectionRows(runtimeState.groupedRowsProjection)
      registerProjectionRows(runtimeState.pivotedRowsProjection)
      registerProjectionRows(runtimeState.aggregatedRowsProjection)
      registerProjectionRows(runtimeState.paginatedRowsProjection)
      registerProjectionRows(runtimeState.rows)

      for (const rowId of changedRowIds) {
        const position = sourceRowIndexById.get(rowId) ?? -1
        if (position < 0 || position >= sourceCount) {
          continue
        }
        const nextRow = nextRowsById.get(rowId)
        if (!nextRow) {
          continue
        }
        for (const projectionRows of projectionRowsToPatch) {
          const currentRow = projectionRows[position]
          if (!currentRow || (currentRow.data === nextRow.data && currentRow.row === nextRow.row)) {
            continue
          }
          projectionRows[position] = {
            ...currentRow,
            data: nextRow.data,
            row: nextRow.row,
          }
        }
      }

      runtimeStateStore.commitProjectionCycle(false)
      derivedCacheDiagnostics.revisions.row = runtimeState.rowRevision
      derivedCacheDiagnostics.revisions.sort = runtimeState.sortRevision
      derivedCacheDiagnostics.revisions.filter = runtimeState.filterRevision
      derivedCacheDiagnostics.revisions.group = runtimeState.groupRevision
      return true
    },
    getStaleStages: () => computeRuntime.getStaleStages(),
    recomputeWithExecutionPlan: (executionPlan) => {
      computeRuntime.recomputeWithExecutionPlan(executionPlan)
    },
    getFilterModel: () => filterModel,
    getSortModel: () => sortModel,
    getTreeData: () => treeData,
    getGroupBy: () => groupBy,
    getPivotModel: () => pivotModel,
    getAggregationModel: () => aggregationModel,
    getProjectionPolicy: () => projectionPolicy,
    getAllStages: () => DATAGRID_CLIENT_ALL_PROJECTION_STAGES,
    expandStages: expandClientProjectionStages,
    applyIncrementalAggregationPatch,
    clearSortValueCache: () => {
      sortValueCache.clear()
    },
    evictSortValueCacheRows: (rowIds) => {
      for (const rowId of rowIds) {
        sortValueCache.delete(rowId)
      }
    },
    invalidateTreeProjectionCaches,
    patchTreeProjectionCacheRowsByIdentity,
  })

  const recomputeComputedFieldsAndRefresh = (
    rowIds?: ReadonlySet<DataGridRowId>,
  ): number => {
    const computedResult = applyComputedFieldsToSourceRows({
      rowIds,
    })
    if (!computedResult.changed) {
      return 0
    }
    bumpRowVersions(rowVersionById, computedResult.changedRowIds)
    runtimeStateStore.bumpRowRevision()
    resetGroupByIncrementalAggregationState()
    invalidateTreeProjectionCaches()
    runtimeStateStore.setProjectionInvalidation(["computedChanged"])
    computeRuntime.recomputeFromStage("compute")
    emit()
    return computedResult.changedRowIds.length
  }

  runtimeStateStore.setProjectionInvalidation(["rowsChanged"])
  computeRuntime.recomputeFromStage("compute")

  return {
    kind: "client",
    getSnapshot,
    getRowCount() {
      return runtimeState.rows.length
    },
    getRow(index: number) {
      if (!Number.isFinite(index)) {
        return undefined
      }
      return runtimeState.rows[Math.max(0, Math.trunc(index))]
    },
    getRowsInRange(range: DataGridViewportRange) {
      const normalized = normalizeViewportRange(range, runtimeState.rows.length)
      if (runtimeState.rows.length === 0) {
        return []
      }
      return runtimeState.rows.slice(normalized.start, normalized.end + 1)
    },
    setRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsMutationsRuntime.setRows(nextRows)
    },
    replaceRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      rowsMutationsRuntime.setRows(nextRows)
    },
    appendRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      rowsMutationsRuntime.setRows([...sourceRows, ...nextRows])
    },
    prependRows(nextRows: readonly DataGridRowNodeInput<T>[]) {
      if (nextRows.length === 0) {
        return
      }
      rowsMutationsRuntime.setRows([...nextRows, ...sourceRows])
    },
    patchRows(
      updates: readonly DataGridClientRowPatch<T>[],
      options: DataGridClientRowPatchOptions = {},
    ) {
      patchCoordinatorRuntime.patchRows(updates, options)
    },
    registerComputedField(definition: DataGridComputedFieldDefinition<T>) {
      ensureActive()
      registerComputedFieldInternal(definition)
      void recomputeComputedFieldsAndRefresh()
    },
    getComputedFields() {
      return getComputedFieldSnapshots()
    },
    recomputeComputedFields(rowIds?: readonly DataGridRowId[]) {
      ensureActive()
      const normalizedRowIds = Array.isArray(rowIds)
        ? rowIds.filter(isDataGridRowId)
        : []
      return recomputeComputedFieldsAndRefresh(
        normalizedRowIds.length > 0 ? new Set<DataGridRowId>(normalizedRowIds) : undefined,
      )
    },
    reorderRows(input: DataGridClientRowReorderInput) {
      return rowsMutationsRuntime.reorderRows(input)
    },
    setViewportRange(range: DataGridViewportRange) {
      stateMutationsRuntime.setViewportRange(range)
    },
    setPagination(nextPagination: DataGridPaginationInput | null) {
      stateMutationsRuntime.setPagination(nextPagination)
    },
    setPageSize(pageSize: number | null) {
      stateMutationsRuntime.setPageSize(pageSize)
    },
    setCurrentPage(page: number) {
      stateMutationsRuntime.setCurrentPage(page)
    },
    setSortModel(nextSortModel: readonly DataGridSortState[]) {
      stateMutationsRuntime.setSortModel(nextSortModel)
    },
    setFilterModel(nextFilterModel: DataGridFilterSnapshot | null) {
      stateMutationsRuntime.setFilterModel(nextFilterModel)
    },
    setSortAndFilterModel(input: DataGridSortAndFilterModelInput) {
      stateMutationsRuntime.setSortAndFilterModel(input)
    },
    setGroupBy(nextGroupBy: DataGridGroupBySpec | null) {
      stateMutationsRuntime.setGroupBy(nextGroupBy)
    },
    setPivotModel(nextPivotModel: DataGridPivotSpec | null) {
      stateMutationsRuntime.setPivotModel(nextPivotModel)
    },
    getPivotModel() {
      return clonePivotSpec(pivotModel)
    },
    getPivotCellDrilldown(input: DataGridPivotCellDrilldownInput) {
      ensureActive()
      return resolveClientRowPivotCellDrilldown({
        input,
        pivotModel,
        pivotColumns,
        aggregatedRowsProjection: runtimeState.aggregatedRowsProjection,
        pivotedRowsProjection: runtimeState.pivotedRowsProjection,
        groupedRowsProjection: runtimeState.groupedRowsProjection,
        sourceRows,
        isDataGridRowId,
        normalizePivotAxisValue,
        readRowField: (row, key) => readRowField(row, key),
      })
    },
    setAggregationModel(nextAggregationModel: DataGridAggregationModel<T> | null) {
      stateMutationsRuntime.setAggregationModel(nextAggregationModel)
    },
    getAggregationModel() {
      return cloneAggregationModel(aggregationModel)
    },
    getColumnHistogram(columnId: string, options?: DataGridColumnHistogramOptions) {
      ensureActive()
      const normalizedColumnId = columnId.trim()
      if (normalizedColumnId.length === 0) {
        return []
      }

      const scope = options?.scope ?? "filtered"
      if (scope === "sourceAll") {
        return buildColumnHistogram(sourceRows, normalizedColumnId, options)
      }

      if (options?.ignoreSelfFilter === true) {
        const filterPredicate = resolveFilterPredicate({ ignoreColumnFilterKey: normalizedColumnId })
        const rowsForHistogram: DataGridRowNode<T>[] = []
        for (const row of sourceRows) {
          if (filterPredicate(row)) {
            rowsForHistogram.push(row)
          }
        }
        return buildColumnHistogram(rowsForHistogram, normalizedColumnId, options)
      }

      return buildColumnHistogram(runtimeState.filteredRowsProjection, normalizedColumnId, options)
    },
    setGroupExpansion(expansion: DataGridGroupExpansionSnapshot | null) {
      stateMutationsRuntime.setGroupExpansion(expansion)
    },
    toggleGroup(groupKey: string) {
      stateMutationsRuntime.toggleGroup(groupKey)
    },
    expandGroup(groupKey: string) {
      stateMutationsRuntime.expandGroup(groupKey)
    },
    collapseGroup(groupKey: string) {
      stateMutationsRuntime.collapseGroup(groupKey)
    },
    expandAllGroups() {
      stateMutationsRuntime.expandAllGroups()
    },
    collapseAllGroups() {
      stateMutationsRuntime.collapseAllGroups()
    },
    refresh(reason?: DataGridRowModelRefreshReason) {
      ensureActive()
      runtimeStateStore.setProjectionInvalidation(
        reason === "sort-change" ? ["sortChanged"] : ["manualRefresh"],
      )
      computeRuntime.refresh()
      emit()
    },
    subscribe(listener: DataGridRowModelListener<T>) {
      return lifecycle.subscribe(listener)
    },
    getDerivedCacheDiagnostics() {
      return {
        revisions: { ...derivedCacheDiagnostics.revisions },
        filterPredicateHits: derivedCacheDiagnostics.filterPredicateHits,
        filterPredicateMisses: derivedCacheDiagnostics.filterPredicateMisses,
        sortValueHits: derivedCacheDiagnostics.sortValueHits,
        sortValueMisses: derivedCacheDiagnostics.sortValueMisses,
        groupValueHits: derivedCacheDiagnostics.groupValueHits,
        groupValueMisses: derivedCacheDiagnostics.groupValueMisses,
      }
    },
    getComputeMode() {
      return computeMode
    },
    switchComputeMode(nextMode: DataGridClientComputeMode) {
      const normalizedMode: DataGridClientComputeMode = nextMode === "worker" ? "worker" : "sync"
      if (normalizedMode === computeMode) {
        return false
      }
      const previousRuntime = computeRuntime
      computeMode = normalizedMode
      computeRuntime = createClientRowComputeRuntime({
        mode: computeMode,
        transport: computeTransport,
        orchestrator: projectionOrchestrator,
      })
      previousRuntime.dispose()
      return true
    },
    getComputeDiagnostics() {
      return computeRuntime.getDiagnostics()
    },
    dispose() {
      if (!lifecycle.dispose()) {
        return
      }
      computeRuntime.dispose()
      sourceRows = []
      runtimeState.rows = []
      runtimeState.filteredRowsProjection = []
      runtimeState.sortedRowsProjection = []
      runtimeState.groupedRowsProjection = []
      runtimeState.pivotedRowsProjection = []
      runtimeState.aggregatedRowsProjection = []
      runtimeState.paginatedRowsProjection = []
      pivotColumns = []
      rowVersionById.clear()
      resetGroupByIncrementalAggregationState()
      groupedProjectionGroupIndexByRowId = new Map<DataGridRowId, number>()
      toggledPivotGroupKeys.clear()
      sortValueCache.clear()
      groupValueCache.clear()
      computedFieldsByName.clear()
      computedFieldNameByTargetField.clear()
      computedOrder = []
      invalidateTreeProjectionCaches()
      cachedFilterPredicate = null
      cachedFilterPredicateKey = "__none__"
    },
  }
}

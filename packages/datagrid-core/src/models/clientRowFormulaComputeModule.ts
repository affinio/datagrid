import type {
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaContextRecomputeRequest,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaValue,
  DataGridRowId,
} from "./rowModel.js"
import type { DataGridClientComputeModule } from "./clientRowComputeModule.js"
import type { DataGridFormulaFunctionDefinition } from "./formulaEngine.js"
import type {
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
} from "@affino/datagrid-formula-engine"

export interface DataGridClientFormulaComputeModule<T> extends DataGridClientComputeModule<T> {
  registerComputedField: (definition: DataGridComputedFieldDefinition<T>) => void
  registerFormulaField: (definition: DataGridFormulaFieldDefinition) => void
  getComputedFields: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFields: () => readonly DataGridFormulaFieldSnapshot[]
  registerFormulaFunction: (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ) => void
  unregisterFormulaFunction: (name: string) => boolean
  getFormulaFunctionNames: () => readonly string[]
  getFormulaExecutionPlan: () => DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph: () => DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics: () => DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics: () => DataGridFormulaRowRecomputeDiagnostics | null
  recomputeComputedFields: (rowIds?: readonly DataGridRowId[]) => number
  recomputeFormulaContext: (request: DataGridFormulaContextRecomputeRequest) => number
}

export interface CreateClientRowFormulaComputeModuleOptions<T> {
  ensureActive: () => void
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  registerComputedFieldInternal: (definition: DataGridComputedFieldDefinition<T>) => void
  registerFormulaFieldInternal: (definition: DataGridFormulaFieldDefinition) => void
  getComputedFieldSnapshots: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFieldSnapshots: () => readonly DataGridFormulaFieldSnapshot[]
  hasRegisteredFormulaFields: () => boolean
  registerFormulaFunction: (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[]) => unknown),
  ) => void
  unregisterFormulaFunction: (name: string) => boolean
  getFormulaFunctionNames: () => readonly string[]
  getFormulaExecutionPlanSnapshot: () => DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraphSnapshot: () => DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnosticsSnapshot: () => DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnosticsSnapshot: () => DataGridFormulaRowRecomputeDiagnostics | null
  recomputeComputedFieldsAndRefresh: (
    rowIds?: ReadonlySet<DataGridRowId>,
    options?: { contextKeys?: ReadonlySet<string> },
  ) => number
}

export function createClientRowFormulaComputeModule<T>(
  options: CreateClientRowFormulaComputeModuleOptions<T>,
): DataGridClientFormulaComputeModule<T> {
  return {
    id: "formula",
    registerComputedField(definition) {
      options.ensureActive()
      options.registerComputedFieldInternal(definition)
      void options.recomputeComputedFieldsAndRefresh()
    },
    registerFormulaField(definition) {
      options.ensureActive()
      options.registerFormulaFieldInternal(definition)
      void options.recomputeComputedFieldsAndRefresh()
    },
    getComputedFields() {
      return options.getComputedFieldSnapshots()
    },
    getFormulaFields() {
      return options.getFormulaFieldSnapshots()
    },
    registerFormulaFunction(name, definition) {
      options.ensureActive()
      options.registerFormulaFunction(name, definition)
      if (options.hasRegisteredFormulaFields()) {
        void options.recomputeComputedFieldsAndRefresh()
      }
    },
    unregisterFormulaFunction(name) {
      options.ensureActive()
      const unregistered = options.unregisterFormulaFunction(name)
      if (!unregistered) {
        return false
      }
      if (options.hasRegisteredFormulaFields()) {
        void options.recomputeComputedFieldsAndRefresh()
      }
      return true
    },
    getFormulaFunctionNames() {
      return options.getFormulaFunctionNames()
    },
    getFormulaExecutionPlan() {
      return options.getFormulaExecutionPlanSnapshot()
    },
    getFormulaGraph() {
      return options.getFormulaGraphSnapshot()
    },
    getFormulaComputeStageDiagnostics() {
      return options.getFormulaComputeStageDiagnosticsSnapshot()
    },
    getFormulaRowRecomputeDiagnostics() {
      return options.getFormulaRowRecomputeDiagnosticsSnapshot()
    },
    recomputeComputedFields(rowIds) {
      options.ensureActive()
      const normalizedRowIds = Array.isArray(rowIds)
        ? rowIds.filter(options.isDataGridRowId)
        : []
      return options.recomputeComputedFieldsAndRefresh(
        normalizedRowIds.length > 0 ? new Set<DataGridRowId>(normalizedRowIds) : undefined,
      )
    },
    recomputeFormulaContext(request) {
      options.ensureActive()
      const contextKeys = Array.isArray(request.contextKeys)
        ? request.contextKeys
          .filter((value): value is string => typeof value === "string")
          .map(value => value.trim())
          .filter(value => value.length > 0)
        : []
      if (contextKeys.length === 0) {
        return 0
      }
      const normalizedRowIds = Array.isArray(request.rowIds)
        ? request.rowIds.filter(options.isDataGridRowId)
        : []
      return options.recomputeComputedFieldsAndRefresh(
        normalizedRowIds.length > 0 ? new Set<DataGridRowId>(normalizedRowIds) : undefined,
        { contextKeys: new Set<string>(contextKeys) },
      )
    },
  }
}

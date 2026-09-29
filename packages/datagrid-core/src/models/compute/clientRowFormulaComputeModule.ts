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
} from "../rowModel.js"
import type { DataGridClientComputeModule } from "./clientRowComputeModule.js"
import type { DataGridFormulaFunctionDefinition } from "../formula/formulaEngine.js"
import type {
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
} from "@affino/datagrid-formula-engine"

export interface DataGridClientFormulaComputeModule<T> extends DataGridClientComputeModule<T> {
  registerComputedField: (definition: DataGridComputedFieldDefinition<T>) => void
  unregisterComputedField: (name: string) => boolean
  registerFormulaField: (definition: DataGridFormulaFieldDefinition) => void
  unregisterFormulaField: (name: string) => boolean
  getComputedFields: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFields: () => readonly DataGridFormulaFieldSnapshot[]
  registerFormulaFunction: (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: import("../rowModel.js").DataGridComputedFieldComputeContext<unknown>) => unknown),
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
  emit?: () => void
  onFormulaStructureChanged?: (removedField?: string) => void
  isDataGridRowId: (value: unknown) => value is DataGridRowId
  registerComputedFieldInternal: (definition: DataGridComputedFieldDefinition<T>) => void
  registerFormulaFieldInternal: (definition: DataGridFormulaFieldDefinition) => void
  unregisterComputedFieldInternal: (name: string, kind?: "computed" | "formula") => boolean
  getComputedFieldSnapshots: () => readonly DataGridComputedFieldSnapshot[]
  getFormulaFieldSnapshots: () => readonly DataGridFormulaFieldSnapshot[]
  hasRegisteredFormulaFields: () => boolean
  registerFormulaFunction: (
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: import("../rowModel.js").DataGridComputedFieldComputeContext<unknown>) => unknown),
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
  const emitIfNoRowChange = (changedRowCount: number): void => {
    if (changedRowCount === 0) {
      options.emit?.()
    }
  }

  return {
    id: "formula",
    registerComputedField(definition) {
      options.ensureActive()
      options.registerComputedFieldInternal(definition)
      void options.recomputeComputedFieldsAndRefresh()
    },
    unregisterComputedField(name) {
      options.ensureActive()
      const removedField = options.getComputedFieldSnapshots().find(field => field.name === name)?.field
      const unregistered = options.unregisterComputedFieldInternal(name, "computed")
      if (!unregistered) {
        return false
      }
      options.onFormulaStructureChanged?.(removedField)
      emitIfNoRowChange(options.recomputeComputedFieldsAndRefresh())
      return true
    },
    registerFormulaField(definition) {
      options.ensureActive()
      options.registerFormulaFieldInternal(definition)
      options.onFormulaStructureChanged?.()
      emitIfNoRowChange(options.recomputeComputedFieldsAndRefresh())
    },
    unregisterFormulaField(name) {
      options.ensureActive()
      const removedField = options.getFormulaFieldSnapshots().find(field => field.name === name)?.field
      const unregistered = options.unregisterComputedFieldInternal(name, "formula")
      if (!unregistered) {
        return false
      }
      options.onFormulaStructureChanged?.(removedField)
      emitIfNoRowChange(options.recomputeComputedFieldsAndRefresh())
      return true
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
        options.onFormulaStructureChanged?.()
        emitIfNoRowChange(options.recomputeComputedFieldsAndRefresh())
      }
    },
    unregisterFormulaFunction(name) {
      options.ensureActive()
      const unregistered = options.unregisterFormulaFunction(name)
      if (!unregistered) {
        return false
      }
      if (options.hasRegisteredFormulaFields()) {
        options.onFormulaStructureChanged?.()
        emitIfNoRowChange(options.recomputeComputedFieldsAndRefresh())
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

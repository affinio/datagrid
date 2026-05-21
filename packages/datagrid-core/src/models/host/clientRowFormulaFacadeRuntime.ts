import type {
  DataGridComputedFieldComputeContext,
  DataGridComputedFieldDefinition,
  DataGridComputedFieldSnapshot,
  DataGridFormulaComputeStageDiagnostics,
  DataGridFormulaContextRecomputeRequest,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFieldSnapshot,
  DataGridFormulaRowRecomputeDiagnostics,
  DataGridFormulaTablePatch,
  DataGridFormulaTableSource,
  DataGridFormulaValue,
  DataGridRowId,
} from "../rowModel.js"
import type { DataGridFormulaFunctionDefinition } from "../formula/formulaEngine.js"
import type {
  DataGridFormulaExecutionPlanSnapshot,
  DataGridFormulaGraphSnapshot,
} from "@affino/datagrid-formula-engine"

export interface ClientRowFormulaFacadeModule<T> {
  registerComputedField(definition: DataGridComputedFieldDefinition<T>): void
  registerFormulaField(definition: DataGridFormulaFieldDefinition): void
  getComputedFields(): readonly DataGridComputedFieldSnapshot[]
  getFormulaFields(): readonly DataGridFormulaFieldSnapshot[]
  registerFormulaFunction(
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
  ): void
  unregisterFormulaFunction(name: string): boolean
  getFormulaFunctionNames(): readonly string[]
  getFormulaExecutionPlan(): DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph(): DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics(): DataGridFormulaRowRecomputeDiagnostics | null
  recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
  recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest): number
}

export interface CreateClientRowFormulaFacadeRuntimeOptions<T> {
  resolveFormulaModule: () => ClientRowFormulaFacadeModule<T>
  formulaTableHostRuntime: {
    setFormulaTable(name: string, rows: DataGridFormulaTableSource): void
    patchFormulaTables(patch: DataGridFormulaTablePatch): boolean
    removeFormulaTable(name: string): boolean
    getFormulaTableNames(): readonly string[]
  }
}

export interface ClientRowFormulaFacadeRuntime<T> {
  registerComputedField(definition: DataGridComputedFieldDefinition<T>): void
  registerFormulaField(definition: DataGridFormulaFieldDefinition): void
  getComputedFields(): readonly DataGridComputedFieldSnapshot[]
  getFormulaFields(): readonly DataGridFormulaFieldSnapshot[]
  registerFormulaFunction(
    name: string,
    definition: DataGridFormulaFunctionDefinition | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown),
  ): void
  unregisterFormulaFunction(name: string): boolean
  getFormulaFunctionNames(): readonly string[]
  setFormulaTable(name: string, rows: DataGridFormulaTableSource): void
  patchFormulaTables(patch: DataGridFormulaTablePatch): boolean
  removeFormulaTable(name: string): boolean
  getFormulaTableNames(): readonly string[]
  getFormulaExecutionPlan(): DataGridFormulaExecutionPlanSnapshot | null
  getFormulaGraph(): DataGridFormulaGraphSnapshot | null
  getFormulaComputeStageDiagnostics(): DataGridFormulaComputeStageDiagnostics | null
  getFormulaRowRecomputeDiagnostics(): DataGridFormulaRowRecomputeDiagnostics | null
  recomputeComputedFields(rowIds?: readonly DataGridRowId[]): number
  recomputeFormulaContext(request: DataGridFormulaContextRecomputeRequest): number
}

export function createClientRowFormulaFacadeRuntime<T>(
  options: CreateClientRowFormulaFacadeRuntimeOptions<T>,
): ClientRowFormulaFacadeRuntime<T> {
  const resolveModule = options.resolveFormulaModule
  const formulaTables = options.formulaTableHostRuntime

  return {
    registerComputedField(definition) {
      resolveModule().registerComputedField(definition)
    },
    registerFormulaField(definition) {
      resolveModule().registerFormulaField(definition)
    },
    getComputedFields() {
      return resolveModule().getComputedFields()
    },
    getFormulaFields() {
      return resolveModule().getFormulaFields()
    },
    registerFormulaFunction(name, definition) {
      resolveModule().registerFormulaFunction(name, definition)
    },
    unregisterFormulaFunction(name) {
      return resolveModule().unregisterFormulaFunction(name)
    },
    getFormulaFunctionNames() {
      return resolveModule().getFormulaFunctionNames()
    },
    setFormulaTable(name, rows) {
      formulaTables.setFormulaTable(name, rows)
    },
    patchFormulaTables(patch) {
      return formulaTables.patchFormulaTables(patch)
    },
    removeFormulaTable(name) {
      return formulaTables.removeFormulaTable(name)
    },
    getFormulaTableNames() {
      return formulaTables.getFormulaTableNames()
    },
    getFormulaExecutionPlan() {
      return resolveModule().getFormulaExecutionPlan()
    },
    getFormulaGraph() {
      return resolveModule().getFormulaGraph()
    },
    getFormulaComputeStageDiagnostics() {
      return resolveModule().getFormulaComputeStageDiagnostics()
    },
    getFormulaRowRecomputeDiagnostics() {
      return resolveModule().getFormulaRowRecomputeDiagnostics()
    },
    recomputeComputedFields(rowIds) {
      return resolveModule().recomputeComputedFields(rowIds)
    },
    recomputeFormulaContext(request) {
      return resolveModule().recomputeFormulaContext(request)
    },
  }
}

import type {
  CreateClientRowModelOptions,
  DataGridClientComputeMode,
  DataGridColumnDef,
  DataGridComputedFieldDefinition,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFunctionRegistry,
} from "@affino/datagrid-vue"

export interface DataGridAppColumnDef extends DataGridColumnDef {
  formula?: string | null
}

export interface DataGridDeclarativeFormulaOptions<TRow = unknown> {
  formulas?: readonly DataGridFormulaFieldDefinition[] | null
  computedFields?: readonly DataGridComputedFieldDefinition<TRow>[] | null
  formulaFunctions?: DataGridFormulaFunctionRegistry | null
  computeMode?: DataGridClientComputeMode | null
  formulaColumnCacheMaxColumns?: number | null
}

export interface ResolveDataGridFormulaRowModelOptionsInput<TRow = unknown>
  extends DataGridDeclarativeFormulaOptions<TRow> {
  columns?: readonly DataGridAppColumnDef[] | null | undefined
  clientRowModelOptions?: Omit<CreateClientRowModelOptions<TRow>, "rows"> | undefined
}

function cloneFormulas(
  formulas: readonly DataGridFormulaFieldDefinition[] | null | undefined,
): readonly DataGridFormulaFieldDefinition[] {
  if (!formulas || formulas.length === 0) {
    return []
  }
  return formulas.map(entry => ({ ...entry }))
}

function cloneComputedFields<TRow>(
  computedFields: readonly DataGridComputedFieldDefinition<TRow>[] | null | undefined,
): readonly DataGridComputedFieldDefinition<TRow>[] {
  if (!computedFields || computedFields.length === 0) {
    return []
  }
  return computedFields.map(entry => ({ ...entry }))
}

function cloneColumns(
  columns: readonly DataGridAppColumnDef[] | null | undefined,
): readonly DataGridColumnDef[] {
  if (!columns || columns.length === 0) {
    return []
  }
  return columns.map(({ formula: _formula, ...column }) => ({ ...column }))
}

function extractEmbeddedFormulas(
  columns: readonly DataGridAppColumnDef[] | null | undefined,
): readonly DataGridFormulaFieldDefinition[] {
  if (!columns || columns.length === 0) {
    return []
  }
  return columns.flatMap(column => {
    const formula = typeof column.formula === "string" ? column.formula.trim() : ""
    if (!formula) {
      return []
    }
    return [{
      name: column.key,
      formula,
    }]
  })
}

function mergeFormulaDefinitions(
  embeddedFormulas: readonly DataGridFormulaFieldDefinition[],
  formulas: readonly DataGridFormulaFieldDefinition[] | null | undefined,
): readonly DataGridFormulaFieldDefinition[] {
  const merged = new Map<string, DataGridFormulaFieldDefinition>()

  for (const entry of embeddedFormulas) {
    merged.set(entry.name, { ...entry })
  }

  for (const entry of cloneFormulas(formulas)) {
    merged.set(entry.name, entry)
  }

  return Array.from(merged.values())
}

export function resolveDataGridColumns(
  columns: readonly DataGridAppColumnDef[] | null | undefined,
): readonly DataGridColumnDef[] {
  return cloneColumns(columns)
}

export function resolveDataGridFormulaRowModelOptions<TRow = unknown>(
  input: ResolveDataGridFormulaRowModelOptionsInput<TRow>,
): Omit<CreateClientRowModelOptions<TRow>, "rows"> | undefined {
  const baseOptions = input.clientRowModelOptions
  const embeddedFormulas = extractEmbeddedFormulas(input.columns)
  const hasFormulaProp = input.formulas !== undefined
  const hasComputedFieldsProp = input.computedFields !== undefined
  const hasFormulaFunctionsProp = input.formulaFunctions !== undefined
  const hasComputeModeProp = input.computeMode !== undefined
  const hasFormulaColumnCacheProp = input.formulaColumnCacheMaxColumns !== undefined
  const hasEmbeddedFormulas = embeddedFormulas.length > 0

  const initialFormulaFields = hasFormulaProp || hasEmbeddedFormulas
    ? mergeFormulaDefinitions(embeddedFormulas, input.formulas)
    : undefined
  const initialComputedFields = hasComputedFieldsProp ? cloneComputedFields(input.computedFields) : undefined
  const initialFormulaFunctionRegistry = hasFormulaFunctionsProp ? (input.formulaFunctions ?? {}) : undefined
  const computeMode = hasComputeModeProp ? (input.computeMode ?? undefined) : undefined
  const formulaColumnCacheMaxColumns = hasFormulaColumnCacheProp
    ? (input.formulaColumnCacheMaxColumns ?? undefined)
    : undefined

  const hasFormulaOverrides = Boolean(
    hasEmbeddedFormulas
    || hasFormulaProp
    || hasComputedFieldsProp
    || hasFormulaFunctionsProp
    || hasComputeModeProp
    || hasFormulaColumnCacheProp,
  )

  if (!baseOptions && !hasFormulaOverrides) {
    return undefined
  }

  return {
    ...(baseOptions ?? {}),
    ...(hasComputedFieldsProp ? { initialComputedFields } : {}),
    ...(hasFormulaProp || hasEmbeddedFormulas ? { initialFormulaFields } : {}),
    ...(hasFormulaFunctionsProp ? { initialFormulaFunctionRegistry } : {}),
    ...(hasComputeModeProp ? { computeMode } : {}),
    ...(hasFormulaColumnCacheProp ? { formulaColumnCacheMaxColumns } : {}),
  }
}

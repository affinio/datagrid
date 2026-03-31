import type { VNodeChild } from "vue"
import type {
  CreateClientRowModelOptions,
  DataGridCellInteractionInvocationTrigger,
  DataGridCellInteractionKeyboardTrigger,
  DataGridCellInteractionRole,
  DataGridColumnInput,
  DataGridColumnSnapshot,
  DataGridComputedFieldDefinition,
  DataGridFormulaFieldDefinition,
  DataGridFormulaFunctionRegistry,
  DataGridRowNode,
  DataGridRowRenderMeta,
} from "@affino/datagrid-vue"

export interface DataGridAppCellRendererInteractiveContext {
  enabled: boolean
  click: boolean
  keyboard: readonly DataGridCellInteractionKeyboardTrigger[]
  role?: DataGridCellInteractionRole
  ariaLabel?: string
  ariaPressed?: "true" | "false" | "mixed"
  ariaChecked?: "true" | "false" | "mixed"
  ariaDisabled?: "true"
  activate: (trigger?: DataGridCellInteractionInvocationTrigger) => boolean
}

/**
 * High-level authored column contract for `@affino/datagrid-vue-app`.
 */
export interface DataGridAppCellRendererContext<TRow = unknown> {
  row: TRow | undefined
  rowNode: DataGridRowNode<TRow>
  rowOffset: number
  column: DataGridColumnSnapshot
  columnIndex: number
  value: string
  displayValue: string
  interactive: DataGridAppCellRendererInteractiveContext | null
}

export interface DataGridAppGroupCellRendererGroupContext {
  key: string
  field: string
  value: string
  childrenCount: number
  isLabelColumn: boolean
  renderMeta: DataGridRowRenderMeta & {
    isGroup: true
  }
  toggle: () => void
}

export interface DataGridAppGroupCellRendererContext<TRow = unknown>
  extends Omit<DataGridAppCellRendererContext<TRow>, "row" | "rowNode"> {
  row: undefined
  rowNode: DataGridRowNode<TRow> & {
    kind: "group"
  }
  group: DataGridAppGroupCellRendererGroupContext
}

export type DataGridAppCellRenderer<TRow = unknown> = (
  context: DataGridAppCellRendererContext<TRow>,
) => VNodeChild

export type DataGridAppGroupCellRenderer<TRow = unknown> = (
  context: DataGridAppGroupCellRendererContext<TRow>,
) => VNodeChild

export interface DataGridAppColumnInput<TRow = unknown> extends DataGridColumnInput<TRow> {
  formula?: string | null
  cellRenderer?: DataGridAppCellRenderer<TRow> | null
  groupCellRenderer?: DataGridAppGroupCellRenderer<TRow> | null
}

export interface DataGridDeclarativeFormulaOptions<TRow = unknown> {
  formulas?: readonly DataGridFormulaFieldDefinition[] | null
  computedFields?: readonly DataGridComputedFieldDefinition<TRow>[] | null
  formulaFunctions?: DataGridFormulaFunctionRegistry | null
}

export type DataGridAppClientRowModelOptions<TRow = unknown> = Omit<
  CreateClientRowModelOptions<TRow>,
  "rows" | "computeMode" | "workerPatchDispatchThreshold" | "formulaColumnCacheMaxColumns"
>

export interface DataGridAppEnterpriseFormulaRuntimeOptions {
  computeMode?: "sync" | "worker"
  workerPatchDispatchThreshold?: number | null
  formulaColumnCacheMaxColumns?: number | null
}

export interface ResolveDataGridFormulaRowModelOptionsInput<TRow = unknown>
  extends DataGridDeclarativeFormulaOptions<TRow> {
  columns?: readonly DataGridAppColumnInput[] | null | undefined
  clientRowModelOptions?: DataGridAppClientRowModelOptions<TRow> | undefined
  enterpriseClientRowModelOptions?: DataGridAppEnterpriseFormulaRuntimeOptions | undefined
}

const CLIENT_ROW_MODEL_OPTIONS_CACHE = new WeakMap<
  object,
  DataGridAppClientRowModelOptions<unknown>
>()
const MERGED_ROW_MODEL_OPTIONS_CACHE = new WeakMap<
  object,
  WeakMap<object, Omit<CreateClientRowModelOptions<unknown>, "rows">>
>()

function cloneClientRowModelOptions<TRow>(
  options: DataGridAppClientRowModelOptions<TRow> | undefined,
): DataGridAppClientRowModelOptions<TRow> | undefined {
  if (!options) {
    return undefined
  }
  const cached = CLIENT_ROW_MODEL_OPTIONS_CACHE.get(options as object)
  if (cached) {
    return cached as DataGridAppClientRowModelOptions<TRow>
  }
  const normalizedExpandedByDefault = options.initialTreeData?.expandedByDefault ?? false
  if (options.initialTreeData?.expandedByDefault === normalizedExpandedByDefault) {
    CLIENT_ROW_MODEL_OPTIONS_CACHE.set(options as object, options as DataGridAppClientRowModelOptions<unknown>)
    return options
  }
  const cloned: DataGridAppClientRowModelOptions<TRow> = {
    ...options,
  }
  if (options.initialTreeData) {
    cloned.initialTreeData = {
      ...options.initialTreeData,
      expandedByDefault: normalizedExpandedByDefault,
    }
  }
  CLIENT_ROW_MODEL_OPTIONS_CACHE.set(options as object, cloned as DataGridAppClientRowModelOptions<unknown>)
  return cloned
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
  columns: readonly DataGridAppColumnInput[] | null | undefined,
): readonly DataGridColumnInput[] {
  if (!columns || columns.length === 0) {
    return []
  }
  return columns.map(({ formula: _formula, ...column }) => ({ ...column }))
}

function extractEmbeddedFormulas(
  columns: readonly DataGridAppColumnInput[] | null | undefined,
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
  columns: readonly DataGridAppColumnInput[] | null | undefined,
): readonly DataGridColumnInput[] {
  return cloneColumns(columns)
}

export function resolveDataGridFormulaRowModelOptions<TRow = unknown>(
  input: ResolveDataGridFormulaRowModelOptionsInput<TRow>,
): Omit<CreateClientRowModelOptions<TRow>, "rows"> | undefined {
  const baseOptions = cloneClientRowModelOptions(input.clientRowModelOptions)
  const enterpriseOptions = input.enterpriseClientRowModelOptions
  const embeddedFormulas = extractEmbeddedFormulas(input.columns)
  const hasFormulaProp = input.formulas !== undefined
  const hasComputedFieldsProp = input.computedFields !== undefined
  const hasFormulaFunctionsProp = input.formulaFunctions !== undefined
  const hasEmbeddedFormulas = embeddedFormulas.length > 0

  const initialFormulaFields = hasFormulaProp || hasEmbeddedFormulas
    ? mergeFormulaDefinitions(embeddedFormulas, input.formulas)
    : undefined
  const initialComputedFields = hasComputedFieldsProp ? cloneComputedFields(input.computedFields) : undefined
  const initialFormulaFunctionRegistry = hasFormulaFunctionsProp ? (input.formulaFunctions ?? {}) : undefined

  const hasFormulaOverrides = Boolean(
    hasEmbeddedFormulas
    || hasFormulaProp
    || hasComputedFieldsProp
    || hasFormulaFunctionsProp
  )

  if (!baseOptions && !hasFormulaOverrides) {
    if (!enterpriseOptions) {
      return undefined
    }
    return {
      ...enterpriseOptions,
    }
  }

  if (!hasFormulaOverrides) {
    if (baseOptions && !enterpriseOptions) {
      return baseOptions
    }
    if (!baseOptions && enterpriseOptions) {
      return enterpriseOptions
    }
    if (baseOptions && enterpriseOptions) {
      let byEnterprise = MERGED_ROW_MODEL_OPTIONS_CACHE.get(baseOptions as object)
      if (!byEnterprise) {
        byEnterprise = new WeakMap<object, Omit<CreateClientRowModelOptions<unknown>, "rows">>()
        MERGED_ROW_MODEL_OPTIONS_CACHE.set(baseOptions as object, byEnterprise)
      }
      const cached = byEnterprise.get(enterpriseOptions as object)
      if (cached) {
        return cached as Omit<CreateClientRowModelOptions<TRow>, "rows">
      }
      const merged = {
        ...baseOptions,
        ...enterpriseOptions,
      }
      byEnterprise.set(
        enterpriseOptions as object,
        merged as Omit<CreateClientRowModelOptions<unknown>, "rows">,
      )
      return merged
    }
  }

  return {
    ...(baseOptions ?? {}),
    ...(hasComputedFieldsProp ? { initialComputedFields } : {}),
    ...(hasFormulaProp || hasEmbeddedFormulas ? { initialFormulaFields } : {}),
    ...(hasFormulaFunctionsProp ? { initialFormulaFunctionRegistry } : {}),
    ...(enterpriseOptions?.computeMode ? { computeMode: enterpriseOptions.computeMode } : {}),
    ...(enterpriseOptions?.workerPatchDispatchThreshold !== undefined
      ? { workerPatchDispatchThreshold: enterpriseOptions.workerPatchDispatchThreshold }
      : {}),
    ...(enterpriseOptions?.formulaColumnCacheMaxColumns !== undefined
      ? { formulaColumnCacheMaxColumns: enterpriseOptions.formulaColumnCacheMaxColumns }
      : {}),
  }
}

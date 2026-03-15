import { formatDataGridCellValue } from "../columns/formatting.js"
import type { DataGridColumnDef } from "../models/columnModel.js"

export type DataGridCellTypeId =
  | "text"
  | "number"
  | "currency"
  | "checkbox"
  | "select"
  | "date"
  | "formula"
  | "percent"

export type DataGridCellKeyboardAction =
  | "none"
  | "navigate"
  | "startEdit"
  | "openSelect"
  | "toggle"

export type DataGridCellClickAction = "none" | "toggle"

export type DataGridCellEditorMode = "none" | "text" | "select"

export interface DataGridCellTypeOption {
  label: string
  value: unknown
}

export interface DataGridCellRenderModel {
  value: unknown
  formattedValue: string
  displayValue: string
  cellType: string
  editable: boolean
  selected: boolean
  focused: boolean
  editorMode: DataGridCellEditorMode
  clickAction: DataGridCellClickAction
}

export interface DataGridCellTypeContext {
  column: DataGridColumnDef<any>
  row?: unknown
  value: unknown
}

export interface DataGridCellParserContext {
  column: DataGridColumnDef<any>
  row?: unknown
  draft: string
}

export interface DataGridCellKeyboardContext {
  column: DataGridColumnDef<any>
  row?: unknown
  editable: boolean
  key: string
  printable: boolean
}

export interface DataGridCellTypeDefinition {
  id: string
  formatter?: (value: unknown, context: DataGridCellTypeContext) => string
  displayFormatter?: (formattedValue: string, context: DataGridCellTypeContext) => string
  parser?: (draft: string, context: DataGridCellParserContext) => unknown
  keyboard?: Partial<Record<"enter" | "space" | "f2" | "printable", DataGridCellKeyboardAction>>
  editorMode?: DataGridCellEditorMode
  clickAction?: DataGridCellClickAction
}

export interface DataGridCellTypeRegistry {
  get(id: string): DataGridCellTypeDefinition | undefined
  has(id: string): boolean
  register(definition: DataGridCellTypeDefinition): DataGridCellTypeRegistry
  snapshot(): Readonly<Record<string, DataGridCellTypeDefinition>>
}

export interface CreateDataGridCellTypeRegistryOptions {
  definitions?: readonly DataGridCellTypeDefinition[]
}

export interface ResolveDataGridCellTypeOptions<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  registry?: DataGridCellTypeRegistry
}

export interface BuildDataGridCellRenderModelOptions<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  row?: TRow | null | undefined
  value?: unknown
  editable?: boolean
  selected?: boolean
  focused?: boolean
  registry?: DataGridCellTypeRegistry
}

export interface ParseDataGridCellDraftValueOptions<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  row?: TRow | null | undefined
  draft: string
  registry?: DataGridCellTypeRegistry
}

export interface ResolveDataGridCellKeyboardActionOptions<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  row?: TRow | null | undefined
  editable: boolean
  key: string
  printable?: boolean
  registry?: DataGridCellTypeRegistry
}

export interface ResolveDataGridCellClickActionOptions<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  row?: TRow | null | undefined
  editable: boolean
  registry?: DataGridCellTypeRegistry
}

export interface ToggleDataGridCellValueOptions<TRow = unknown> {
  column: DataGridColumnDef<TRow>
  row?: TRow | null | undefined
  value?: unknown
}

const DEFAULT_TEXT_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "text",
  formatter: value => value == null ? "" : String(value),
  parser: draft => draft,
  editorMode: "text",
  clickAction: "none",
  keyboard: {
    enter: "startEdit",
    f2: "startEdit",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_NUMBER_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "number",
  formatter: (value, context) => formatDataGridCellValue(value, context.column),
  parser: draft => parseNumericDraft(draft),
  editorMode: "text",
  clickAction: "none",
  keyboard: {
    enter: "startEdit",
    f2: "startEdit",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_CURRENCY_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "currency",
  formatter: (value, context) => formatDataGridCellValue(value, context.column),
  parser: draft => parseCurrencyDraft(draft),
  editorMode: "text",
  clickAction: "none",
  keyboard: {
    enter: "startEdit",
    f2: "startEdit",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_PERCENT_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "percent",
  formatter: (value, context) => formatDataGridCellValue(value, context.column),
  parser: draft => parsePercentDraft(draft),
  editorMode: "text",
  clickAction: "none",
  keyboard: {
    enter: "startEdit",
    f2: "startEdit",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_CHECKBOX_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "checkbox",
  formatter: value => coerceBoolean(value) ? "true" : "false",
  displayFormatter: (_, context) => coerceBoolean(context.value) ? "☑" : "☐",
  parser: draft => parseBooleanDraft(draft),
  editorMode: "none",
  clickAction: "toggle",
  keyboard: {
    enter: "toggle",
    f2: "none",
    printable: "none",
    space: "toggle",
  },
}

const DEFAULT_SELECT_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "select",
  formatter: (value, context) => formatSelectValue(value, context.column, context.row),
  parser: (draft, context) => parseSelectDraft(draft, context.column, context.row),
  editorMode: "select",
  clickAction: "none",
  keyboard: {
    enter: "openSelect",
    f2: "openSelect",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_DATE_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "date",
  formatter: (value, context) => formatDataGridCellValue(value, context.column),
  parser: draft => parseDateDraft(draft),
  editorMode: "text",
  clickAction: "none",
  keyboard: {
    enter: "startEdit",
    f2: "startEdit",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_FORMULA_CELL_TYPE: DataGridCellTypeDefinition = {
  id: "formula",
  formatter: value => value == null ? "" : String(value),
  parser: draft => draft,
  editorMode: "text",
  clickAction: "none",
  keyboard: {
    enter: "startEdit",
    f2: "startEdit",
    printable: "startEdit",
    space: "navigate",
  },
}

const DEFAULT_CELL_TYPE_DEFINITIONS: readonly DataGridCellTypeDefinition[] = Object.freeze([
  DEFAULT_TEXT_CELL_TYPE,
  DEFAULT_NUMBER_CELL_TYPE,
  DEFAULT_CURRENCY_CELL_TYPE,
  DEFAULT_PERCENT_CELL_TYPE,
  DEFAULT_CHECKBOX_CELL_TYPE,
  DEFAULT_SELECT_CELL_TYPE,
  DEFAULT_DATE_CELL_TYPE,
  DEFAULT_FORMULA_CELL_TYPE,
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function readRowValue<TRow>(row: TRow | null | undefined, column: DataGridColumnDef<TRow>): unknown {
  if (typeof column.accessor === "function" && row != null) {
    return column.accessor(row)
  }
  if (typeof column.valueGetter === "function" && row != null) {
    return column.valueGetter(row)
  }
  if (row == null || !isRecord(row)) {
    return undefined
  }
  const field = typeof column.field === "string" && column.field.length > 0 ? column.field : column.key
  const rowRecord = row as unknown as Record<string, unknown>
  return rowRecord[field]
}

function normalizeNumericText(draft: string): string {
  return draft
    .trim()
    .replace(/\s+/g, "")
    .replace(/,/g, "")
}

function parseNumericDraft(draft: string): unknown {
  const normalized = normalizeNumericText(draft)
  if (normalized.length === 0) {
    return ""
  }
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : draft
}

function parseCurrencyDraft(draft: string): unknown {
  const normalized = normalizeNumericText(draft).replace(/[^\d.+\-]/g, "")
  if (normalized.length === 0) {
    return ""
  }
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : draft
}

function parsePercentDraft(draft: string): unknown {
  const trimmed = draft.trim()
  if (trimmed.length === 0) {
    return ""
  }
  const hasPercentSuffix = trimmed.endsWith("%")
  const normalized = normalizeNumericText(trimmed.replace(/%/g, ""))
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric)) {
    return draft
  }
  return hasPercentSuffix ? numeric / 100 : numeric
}

function parseDateDraft(draft: string): unknown {
  const trimmed = draft.trim()
  if (trimmed.length === 0) {
    return ""
  }
  const timestamp = Date.parse(trimmed)
  return Number.isFinite(timestamp) ? new Date(timestamp) : draft
}

function coerceBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    return value !== 0
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return normalized === "true"
      || normalized === "1"
      || normalized === "yes"
      || normalized === "y"
      || normalized === "on"
  }
  return false
}

function parseBooleanDraft(draft: string): boolean {
  return coerceBoolean(draft)
}

function normalizeSelectOption(option: unknown): DataGridCellTypeOption {
  if (isRecord(option) && typeof option.label === "string") {
    return {
      label: option.label,
      value: "value" in option ? option.value : option.label,
    }
  }
  return {
    label: String(option ?? ""),
    value: option,
  }
}

function resolveColumnOptions<TRow>(
  column: DataGridColumnDef<TRow>,
  row: TRow | null | undefined,
): readonly DataGridCellTypeOption[] {
  const rawOptions = column.presentation?.options
  const resolved = typeof rawOptions === "function"
    ? (row != null ? rawOptions(row) : [])
    : rawOptions
  if (isPromiseLike<readonly unknown[]>(resolved)) {
    return []
  }
  return Array.isArray(resolved) ? resolved.map(normalizeSelectOption) : []
}

function formatSelectValue<TRow>(
  value: unknown,
  column: DataGridColumnDef<TRow>,
  row: TRow | null | undefined,
): string {
  const match = resolveColumnOptions(column, row).find(option => Object.is(option.value, value))
  return match ? match.label : (value == null ? "" : String(value))
}

function parseSelectDraft<TRow>(
  draft: string,
  column: DataGridColumnDef<TRow>,
  row: TRow | null | undefined,
): unknown {
  const trimmed = draft.trim()
  const match = resolveColumnOptions(column, row).find(option => (
    option.label === trimmed || String(option.value ?? "") === trimmed
  ))
  return match ? match.value : draft
}

function isPromiseLike<TValue>(value: unknown): value is PromiseLike<TValue> {
  return typeof value === "object"
    && value !== null
    && "then" in value
    && typeof (value as { then?: unknown }).then === "function"
}

function normalizeCellTypeId(typeId: string | undefined | null): string | null {
  if (typeof typeId !== "string") {
    return null
  }
  const normalized = typeId.trim()
  return normalized.length > 0 ? normalized : null
}

const defaultRegistry = createDataGridCellTypeRegistry()

export function createDataGridCellTypeRegistry(
  options: CreateDataGridCellTypeRegistryOptions = {},
): DataGridCellTypeRegistry {
  const definitions = new Map<string, DataGridCellTypeDefinition>()

  const registerDefinition = (definition: DataGridCellTypeDefinition) => {
    const normalizedId = normalizeCellTypeId(definition.id)
    if (!normalizedId) {
      throw new Error("[DataGridCellTypeRegistry] cell type id must be a non-empty string.")
    }
    definitions.set(normalizedId, Object.freeze({ ...definition, id: normalizedId }))
  }

  for (const definition of DEFAULT_CELL_TYPE_DEFINITIONS) {
    registerDefinition(definition)
  }
  for (const definition of options.definitions ?? []) {
    registerDefinition(definition)
  }

  return {
    get(id) {
      return definitions.get(id)
    },
    has(id) {
      return definitions.has(id)
    },
    register(definition) {
      registerDefinition(definition)
      return this
    },
    snapshot() {
      return Object.freeze(Object.fromEntries(definitions.entries()))
    },
  }
}

export function resolveDataGridCellType<TRow = unknown>(
  options: ResolveDataGridCellTypeOptions<TRow>,
): DataGridCellTypeDefinition {
  const registry = options.registry ?? defaultRegistry
  const cellType = normalizeCellTypeId(options.column.cellType)
  return cellType
    ? (registry.get(cellType) ?? registry.get("text") ?? DEFAULT_TEXT_CELL_TYPE)
    : (registry.get("text") ?? DEFAULT_TEXT_CELL_TYPE)
}

export function buildDataGridCellRenderModel<TRow = unknown>(
  options: BuildDataGridCellRenderModelOptions<TRow>,
): DataGridCellRenderModel {
  const value = arguments.length > 0 && "value" in options
    ? options.value
    : readRowValue(options.row, options.column)
  const resolvedType = resolveDataGridCellType({
    column: options.column,
    registry: options.registry,
  })
  const formattedValue = resolvedType.formatter
    ? resolvedType.formatter(value, {
      column: options.column,
      row: options.row,
      value,
    })
    : formatDataGridCellValue(value, options.column)
  const displayValue = resolvedType.displayFormatter
    ? resolvedType.displayFormatter(formattedValue, {
      column: options.column,
      row: options.row,
      value,
    })
    : formattedValue

  return {
    value,
    formattedValue,
    displayValue,
    cellType: resolvedType.id,
    editable: options.editable === true,
    selected: options.selected === true,
    focused: options.focused === true,
    editorMode: resolvedType.editorMode ?? "text",
    clickAction: resolvedType.clickAction ?? "none",
  }
}

export function parseDataGridCellDraftValue<TRow = unknown>(
  options: ParseDataGridCellDraftValueOptions<TRow>,
): unknown {
  const resolvedType = resolveDataGridCellType({
    column: options.column,
    registry: options.registry,
  })
  if (!resolvedType.parser) {
    return options.draft
  }
  return resolvedType.parser(options.draft, {
    column: options.column,
    row: options.row,
    draft: options.draft,
  })
}

export function resolveDataGridCellKeyboardAction<TRow = unknown>(
  options: ResolveDataGridCellKeyboardActionOptions<TRow>,
): DataGridCellKeyboardAction {
  if (!options.editable) {
    if (options.key === " " || options.key === "Spacebar") {
      return "navigate"
    }
    return "none"
  }
  const resolvedType = resolveDataGridCellType({
    column: options.column,
    registry: options.registry,
  })
  const keyboard = resolvedType.keyboard ?? {}

  if (options.key === "Enter") {
    return keyboard.enter ?? "startEdit"
  }
  if (options.key === " " || options.key === "Spacebar") {
    return keyboard.space ?? "navigate"
  }
  if (options.key === "F2") {
    return keyboard.f2 ?? "startEdit"
  }
  if (options.printable === true) {
    return keyboard.printable ?? "startEdit"
  }
  return "none"
}

export function resolveDataGridCellClickAction<TRow = unknown>(
  options: ResolveDataGridCellClickActionOptions<TRow>,
): DataGridCellClickAction {
  if (!options.editable) {
    return "none"
  }
  const resolvedType = resolveDataGridCellType({
    column: options.column,
    registry: options.registry,
  })
  return resolvedType.clickAction ?? "none"
}

export function toggleDataGridCellValue<TRow = unknown>(
  options: ToggleDataGridCellValueOptions<TRow>,
): boolean {
  const value = arguments.length > 0 && "value" in options
    ? options.value
    : readRowValue(options.row, options.column)
  return !coerceBoolean(value)
}
import { BASE_ROW_HEIGHT } from "../utils/constants"
import type {
  UiTableColumn,
  UiTableConfig,
  UiTableEventHandlers,
  UiTableFilterOptionLoader,
  UiTableLazyLoader,
  UiTableSelectionMetricDefinition,
  UiTableSelectionMetricsConfig,
  UiTableSelectionMetricsProp,
  UiTableStyleConfig,
} from "../types"
import type { UiTableColumnGroupDef } from "../types/column"
import type { UiTablePluginDefinition } from "../../plugins"

type RowData = Record<string, unknown>
type RowKey = string | number

export interface NormalizedSelectionState {
  enabled: boolean
  controlled: boolean
  mode: "cell" | "row"
  showSelectionColumn: boolean
  selected?: (RowData | RowKey)[]
}

export interface NormalizedTableProps {
  rows: any[]
  columns: UiTableColumn[]
  columnGroups: UiTableColumnGroupDef[]
  config: UiTableConfig
  tableId: string
  loading: boolean
  rowHeightMode: "fixed" | "auto"
  rowHeight: number
  summaryRow: Record<string, any> | null
  debugViewport: boolean
  inlineControls: boolean
  showRowIndexColumn: boolean
  selection: NormalizedSelectionState
  selectionMetrics: UiTableSelectionMetricsConfig
  hoverable: boolean
  styleConfig: UiTableStyleConfig | null
  showZoomControl: boolean
  hasMore?: boolean
  totalRows?: number
  pageSize: number
  autoLoadOnScroll: boolean
  loadOnMount: boolean
  lazyLoader?: UiTableLazyLoader
  serverSideModel: boolean
  filterOptionLoader?: UiTableFilterOptionLoader
  events: UiTableEventHandlers
  plugins: UiTablePluginDefinition[]
}

export interface UiTableProps {
  rows?: any[]
  totalRows?: number
  loading?: boolean
  rowHeightMode?: "fixed" | "auto"
  columns?: UiTableColumn[]
  columnGroups?: UiTableColumnGroupDef[]
  tableId?: string
  summaryRow?: Record<string, any> | null
  debugViewport?: boolean
  inlineControls?: boolean
  showRowIndexColumn?: boolean
  selectable?: boolean
  fullRowSelectionMode?: boolean
  selected?: (RowData | RowKey)[]
  hoverable?: boolean
  styleConfig?: UiTableStyleConfig
  rowHeight?: number
  showSelectionColumn?: boolean
  showZoom?: boolean
  selectionMetrics?: UiTableSelectionMetricsProp
  hasMore?: boolean
  pageSize?: number
  autoLoadOnScroll?: boolean
  loadOnMount?: boolean
  lazyLoader?: UiTableLazyLoader
  serverSideModel?: boolean
  filterOptionLoader?: UiTableFilterOptionLoader
  config?: UiTableConfig
  events?: UiTableEventHandlers
  plugins?: UiTablePluginDefinition[]
}

export interface NormalizedTableDataSection {
  rows: any[]
  totalRows?: number
  summaryRow: Record<string, any> | null
  loading: boolean
}

export interface NormalizedTableModelSection {
  tableId: string
  columns: UiTableColumn[]
  columnGroups: UiTableColumnGroupDef[]
  selection: NormalizedSelectionState
  selectionMetrics: UiTableSelectionMetricsConfig
}

export interface NormalizedTableViewSection {
  rowHeightMode: "fixed" | "auto"
  rowHeight: number
  debugViewport: boolean
  inlineControls: boolean
  showRowIndexColumn: boolean
  hoverable: boolean
  styleConfig: UiTableStyleConfig | null
  showZoomControl: boolean
}

export interface NormalizedTableInteractionSection {
  hasMore?: boolean
  pageSize: number
  autoLoadOnScroll: boolean
  loadOnMount: boolean
  lazyLoader?: UiTableLazyLoader
  serverSideModel: boolean
  filterOptionLoader?: UiTableFilterOptionLoader
  events: UiTableEventHandlers
  plugins: UiTablePluginDefinition[]
}

export interface NormalizedTableConfigSections {
  config: UiTableConfig
  data: NormalizedTableDataSection
  model: NormalizedTableModelSection
  view: NormalizedTableViewSection
  interaction: NormalizedTableInteractionSection
}

export const DEFAULT_LAZY_PAGE_SIZE = 200

export const DEFAULT_SELECTION_METRIC_DEFINITIONS: ReadonlyArray<UiTableSelectionMetricDefinition> = [
  { id: "count", label: "Count", precision: 0 },
  { id: "sum", label: "Sum" },
  { id: "min", label: "Min" },
  { id: "max", label: "Max" },
  { id: "avg", label: "Average", precision: 2 },
]

export const BUILTIN_SELECTION_METRIC_LABELS: Record<string, string> = DEFAULT_SELECTION_METRIC_DEFINITIONS.reduce(
  (acc, metric) => {
    acc[metric.id] = metric.label ?? metric.id
    return acc
  },
  {} as Record<string, string>,
)

const DEFAULT_SELECTION_METRICS_DISABLED: UiTableSelectionMetricsConfig = {
  enabled: false,
  metrics: [],
}

type SelectionMetricLike = UiTableSelectionMetricDefinition | undefined | null

function normalizeSelectionMetricDefinition(
  definition: SelectionMetricLike,
): UiTableSelectionMetricDefinition | null {
  if (!definition || typeof definition !== "object") {
    return null
  }
  const id = String(definition.id ?? "").trim()
  if (!id) {
    return null
  }
  const label = typeof definition.label === "string" && definition.label.trim().length ? definition.label : undefined
  const precision = typeof definition.precision === "number" && Number.isFinite(definition.precision)
    ? Math.max(0, Math.floor(definition.precision))
    : undefined
  const compute = typeof definition.compute === "function" ? definition.compute : undefined
  const formatter = typeof definition.formatter === "function" ? definition.formatter : undefined
  return {
    id,
    label,
    precision,
    compute,
    formatter,
  }
}

function coerceArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? [...value] as T[] : []
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

export function normalizeSelectionMetrics(
  input: UiTableSelectionMetricsProp | undefined,
): UiTableSelectionMetricsConfig {
  if (input === undefined || input === null || input === false) {
    return DEFAULT_SELECTION_METRICS_DISABLED
  }

  if (input === true) {
    return {
      enabled: true,
      metrics: DEFAULT_SELECTION_METRIC_DEFINITIONS.map(def => ({ ...def })),
    }
  }

  let enabled = true
  let definitions: UiTableSelectionMetricDefinition[] = []

  if (Array.isArray(input)) {
    const normalized: Array<UiTableSelectionMetricDefinition | null> = input.map(normalizeSelectionMetricDefinition)
    definitions = normalized.filter((metric): metric is UiTableSelectionMetricDefinition => metric !== null)
  } else {
    const candidateEnabled = typeof input.enabled === "boolean" ? input.enabled : undefined
    enabled = candidateEnabled ?? true
    const normalized: Array<UiTableSelectionMetricDefinition | null> = Array.isArray(input.metrics)
      ? input.metrics.map(normalizeSelectionMetricDefinition)
      : []
    definitions = normalized.filter((metric): metric is UiTableSelectionMetricDefinition => metric !== null)
  }

  if (!definitions.length && enabled) {
    definitions = DEFAULT_SELECTION_METRIC_DEFINITIONS.map(def => ({ ...def }))
  }

  return {
    enabled: enabled && definitions.length > 0,
    metrics: definitions,
  }
}

export function normalizePlugins(
  input: UiTablePluginDefinition | UiTablePluginDefinition[] | null | undefined,
): UiTablePluginDefinition[] {
  if (!input) return []
  const list = Array.isArray(input) ? input : [input]
  return list.filter((entry): entry is UiTablePluginDefinition => Boolean(entry))
}

function cloneConfig(config: UiTableConfig | undefined): UiTableConfig {
  return {
    ...(config ?? {}),
    data: { ...(config?.data ?? {}) },
    columns: { ...(config?.columns ?? {}) },
    features: { ...(config?.features ?? {}) },
    appearance: { ...(config?.appearance ?? {}) },
    load: { ...(config?.load ?? {}) },
    debug: { ...(config?.debug ?? {}) },
    state: { ...(config?.state ?? {}) },
    selection: { ...(config?.selection ?? {}) },
  }
}

function normalizeSelectedRows(source: unknown): Array<RowData | RowKey> | undefined {
  if (!Array.isArray(source)) {
    return undefined
  }
  const selected = source.filter((item): item is RowData | RowKey => item !== undefined && item !== null)
  return selected
}

/**
 * Migration adapter for legacy flat component props.
 * Translates historical top-level props into canonical config sections.
 */
export function migrateLegacyUiTableConfig(raw: UiTableProps): UiTableConfig {
  const config = cloneConfig(raw.config)

  const data = config.data ?? {}
  const columns = config.columns ?? {}
  const features = config.features ?? {}
  const appearance = config.appearance ?? {}
  const load = config.load ?? {}
  const debug = config.debug ?? {}
  const state = config.state ?? {}
  const selectionFromFeatures = features.selection ?? {}
  const selection = {
    ...selectionFromFeatures,
    ...(config.selection ?? {}),
  }

  if (raw.tableId !== undefined) {
    config.tableId = raw.tableId
  }

  if (raw.rows !== undefined) {
    data.rows = coerceArray(raw.rows)
  }
  if (raw.totalRows !== undefined) {
    data.totalRows = asFiniteNumber(raw.totalRows)
  }
  if (raw.summaryRow !== undefined) {
    data.summaryRow = raw.summaryRow ?? null
  }

  if (raw.columns !== undefined) {
    columns.definitions = coerceArray<UiTableColumn>(raw.columns)
  }
  if (raw.columnGroups !== undefined) {
    columns.groups = coerceArray<UiTableColumnGroupDef>(raw.columnGroups)
  }

  if (raw.rowHeightMode !== undefined) {
    appearance.rowHeightMode = raw.rowHeightMode
  }
  if (raw.rowHeight !== undefined) {
    appearance.rowHeight = raw.rowHeight
  }
  if (raw.styleConfig !== undefined) {
    appearance.styleConfig = raw.styleConfig
  }

  if (raw.inlineControls !== undefined) {
    features.inlineControls = Boolean(raw.inlineControls)
  }
  if (raw.showRowIndexColumn !== undefined) {
    features.rowIndexColumn = Boolean(raw.showRowIndexColumn)
  }
  if (raw.hoverable !== undefined) {
    features.hoverable = Boolean(raw.hoverable)
  }
  if (raw.showZoom !== undefined) {
    features.zoom = Boolean(raw.showZoom)
  }
  if (raw.selectionMetrics !== undefined) {
    features.selectionMetrics = raw.selectionMetrics
  }

  if (raw.selectable !== undefined) {
    selection.enabled = Boolean(raw.selectable)
  }
  if (raw.fullRowSelectionMode === true) {
    selection.mode = "row"
  }
  if (raw.showSelectionColumn !== undefined) {
    selection.showSelectionColumn = Boolean(raw.showSelectionColumn)
  }
  if (raw.selected !== undefined) {
    const selected = normalizeSelectedRows(raw.selected) ?? []
    selection.selected = selected
    state.selected = selected
  }

  if (raw.hasMore !== undefined) {
    load.hasMore = asBoolean(raw.hasMore)
  }
  if (raw.pageSize !== undefined) {
    load.pageSize = asFiniteNumber(raw.pageSize)
  }
  if (raw.autoLoadOnScroll !== undefined) {
    load.autoLoadOnScroll = Boolean(raw.autoLoadOnScroll)
  }
  if (raw.loadOnMount !== undefined) {
    load.loadOnMount = Boolean(raw.loadOnMount)
  }
  if (raw.lazyLoader !== undefined) {
    load.lazyLoader = raw.lazyLoader
  }
  if (raw.serverSideModel !== undefined) {
    load.serverSideModel = Boolean(raw.serverSideModel)
  }
  if (raw.filterOptionLoader !== undefined) {
    load.filterOptionLoader = raw.filterOptionLoader
  }

  if (raw.debugViewport !== undefined) {
    debug.viewport = Boolean(raw.debugViewport)
  }
  if (raw.loading !== undefined) {
    state.loading = Boolean(raw.loading)
  }

  if (raw.events !== undefined) {
    config.events = {
      ...(config.events ?? {}),
      ...(raw.events ?? {}),
    }
  }

  if (raw.plugins !== undefined) {
    config.plugins = normalizePlugins(raw.plugins)
  }

  config.data = data
  config.columns = columns
  config.features = features
  config.appearance = appearance
  config.load = load
  config.debug = debug
  config.state = state
  config.selection = selection

  return config
}

export function normalizeTableDataSection(config: UiTableConfig): NormalizedTableDataSection {
  const dataConfig = config.data ?? {}
  const stateConfig = config.state ?? {}

  return {
    rows: coerceArray(dataConfig.rows),
    totalRows: asFiniteNumber(dataConfig.totalRows),
    summaryRow: dataConfig.summaryRow ?? null,
    loading: Boolean(stateConfig.loading ?? false),
  }
}

export function normalizeTableModelSection(config: UiTableConfig): NormalizedTableModelSection {
  const columnConfig = config.columns ?? {}
  const featureConfig = config.features ?? {}
  const stateConfig = config.state ?? {}
  const selection = {
    ...(featureConfig.selection ?? {}),
    ...(config.selection ?? {}),
  }

  const selectionEnabled = selection.enabled !== undefined ? Boolean(selection.enabled) : false
  const selectionMode: "cell" | "row" = selection.mode === "row" ? "row" : "cell"
  const selectionShowSelectionColumn = selectionEnabled
    ? selection.showSelectionColumn !== undefined
      ? Boolean(selection.showSelectionColumn)
      : true
    : false
  const selectionSelected = normalizeSelectedRows(
    selection.selected ?? stateConfig.selected,
  )
  const selectionControlled = selectionEnabled && selectionSelected !== undefined

  return {
    tableId: config.tableId ?? "default",
    columns: coerceArray<UiTableColumn>(columnConfig.definitions),
    columnGroups: coerceArray<UiTableColumnGroupDef>(columnConfig.groups),
    selection: {
      enabled: selectionEnabled,
      controlled: selectionControlled,
      mode: selectionMode,
      showSelectionColumn: selectionShowSelectionColumn,
      selected: selectionSelected,
    },
    selectionMetrics: normalizeSelectionMetrics(
      (featureConfig.selectionMetrics ?? config.selectionMetrics) as UiTableSelectionMetricsProp | undefined,
    ),
  }
}

export function normalizeTableViewSection(config: UiTableConfig): NormalizedTableViewSection {
  const appearance = config.appearance ?? {}
  const featureConfig = config.features ?? {}
  const debug = config.debug ?? {}

  const rowHeightMode: "fixed" | "auto" = appearance.rowHeightMode === "auto" ? "auto" : "fixed"
  const rowHeightCandidate = asFiniteNumber(appearance.rowHeight)

  return {
    rowHeightMode,
    rowHeight: Math.max(1, rowHeightCandidate ?? BASE_ROW_HEIGHT),
    debugViewport: Boolean(debug.viewport ?? false),
    inlineControls: featureConfig.inlineControls !== undefined ? Boolean(featureConfig.inlineControls) : true,
    showRowIndexColumn: Boolean(featureConfig.rowIndexColumn),
    hoverable: featureConfig.hoverable === undefined ? true : Boolean(featureConfig.hoverable),
    styleConfig: appearance.styleConfig ?? null,
    showZoomControl: Boolean(featureConfig.zoom ?? false),
  }
}

export function normalizeTableInteractionSection(config: UiTableConfig): NormalizedTableInteractionSection {
  const load = config.load ?? {}

  const pageSizeCandidate = asFiniteNumber(load.pageSize)
  const pageSize = pageSizeCandidate !== undefined
    ? Math.max(1, Math.floor(pageSizeCandidate))
    : DEFAULT_LAZY_PAGE_SIZE
  const hasMore = asBoolean(load.hasMore)

  return {
    hasMore,
    pageSize,
    autoLoadOnScroll: Boolean(load.autoLoadOnScroll ?? false),
    loadOnMount: Boolean(load.loadOnMount ?? false),
    lazyLoader: load.lazyLoader,
    serverSideModel: Boolean(load.serverSideModel ?? false),
    filterOptionLoader: load.filterOptionLoader,
    events: { ...(config.events ?? {}) },
    plugins: normalizePlugins(config.plugins),
  }
}

export function normalizeTableConfigSections(raw: UiTableProps): NormalizedTableConfigSections {
  const config = migrateLegacyUiTableConfig(raw)
  const data = normalizeTableDataSection(config)
  const model = normalizeTableModelSection(config)
  const view = normalizeTableViewSection(config)
  const interaction = normalizeTableInteractionSection(config)

  return {
    config,
    data,
    model,
    view,
    interaction,
  }
}

export function normalizeTableProps(raw: UiTableProps): NormalizedTableProps {
  const sections = normalizeTableConfigSections(raw)

  return {
    rows: sections.data.rows,
    columns: sections.model.columns,
    columnGroups: sections.model.columnGroups,
    config: sections.config,
    tableId: sections.model.tableId,
    loading: sections.data.loading,
    rowHeightMode: sections.view.rowHeightMode,
    rowHeight: sections.view.rowHeight,
    summaryRow: sections.data.summaryRow,
    debugViewport: sections.view.debugViewport,
    inlineControls: sections.view.inlineControls,
    showRowIndexColumn: sections.view.showRowIndexColumn,
    selection: sections.model.selection,
    selectionMetrics: sections.model.selectionMetrics,
    hoverable: sections.view.hoverable,
    styleConfig: sections.view.styleConfig,
    showZoomControl: sections.view.showZoomControl,
    hasMore: sections.interaction.hasMore,
    totalRows: sections.data.totalRows,
    pageSize: sections.interaction.pageSize,
    autoLoadOnScroll: sections.interaction.autoLoadOnScroll,
    loadOnMount: sections.interaction.loadOnMount,
    lazyLoader: sections.interaction.lazyLoader,
    serverSideModel: sections.interaction.serverSideModel,
    filterOptionLoader: sections.interaction.filterOptionLoader,
    events: sections.interaction.events,
    plugins: sections.interaction.plugins,
  }
}

import { computed, type ComputedRef, type Ref } from "vue"
import {
  buildDataGridChromeRenderModel,
  type DataGridChromeRowBand,
  type DataGridChromeRenderModel,
} from "@affino/datagrid-chrome"
import type {
  DataGridTableStageBodyColumn,
  DataGridTableStageBodyRow,
} from "./dataGridTableStageBody.types"
import type {
  DataGridTableStageLayoutSection,
  DataGridTableStageRowsSection,
  DataGridTableStageViewportSection,
} from "./dataGridTableStage.types"
import { resolveDataGridVirtualChromeRowMetrics } from "./dataGridChromeCanvasMath"

interface DataGridPivotHeaderMeta {
  groupLabels?: readonly string[]
}

export interface UseDataGridStageChromeModelOptions {
  mode: Ref<string>
  rowHeightMode: Ref<string>
  layout: Ref<DataGridTableStageLayoutSection>
  viewport: Ref<DataGridTableStageViewportSection>
  rows: Ref<DataGridTableStageRowsSection<Record<string, unknown>>>
  visibleColumns: Ref<readonly DataGridTableStageBodyColumn[]>
  renderedColumns: Ref<readonly DataGridTableStageBodyColumn[]>
  displayRows: Ref<readonly DataGridTableStageBodyRow[]>
  pinnedBottomRows: Ref<readonly DataGridTableStageBodyRow[]>
  selectionTotalRowCount: Ref<number | null | undefined>
  leftPaneWidth: Ref<number>
  rightPaneWidth: Ref<number>
  bodyViewportScrollTop: Ref<number>
  bodyViewportScrollLeft: Ref<number>
  bodyViewportClientWidth: Ref<number>
  bodyViewportClientHeight: Ref<number>
  pinnedBottomViewportClientHeight: Ref<number>
  headerShellHeight: Ref<number>
  headerViewportClientWidth: Ref<number>
  bodyViewportEl: Ref<HTMLElement | null>
  indexColumnWidthPx: Ref<number>
  pinnedLeftColumns: Ref<readonly DataGridTableStageBodyColumn[]>
  pinnedRightColumns: Ref<readonly DataGridTableStageBodyColumn[]>
  resolveColumnWidth: (column: DataGridTableStageBodyColumn) => number
  resolveLeftColumnSpacerWidth: () => number
  resolveRightColumnSpacerWidth: () => number
  resolveAbsoluteRowIndex: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  resolveViewportRowOffset: (row: DataGridTableStageBodyRow, rowOffset: number) => number
  isHoveredRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  isStripedRow: (row: DataGridTableStageBodyRow, rowOffset: number) => boolean
  readPivotHeaderMeta: (column: DataGridTableStageBodyColumn) => DataGridPivotHeaderMeta | null
}

export interface UseDataGridStageChromeModelResult {
  chromeRenderModel: ComputedRef<DataGridChromeRenderModel>
  headerChromeRenderModel: ComputedRef<DataGridChromeRenderModel>
  pinnedBottomChromeRenderModel: ComputedRef<DataGridChromeRenderModel>
  hasPivotHeaderGroups: ComputedRef<boolean>
  rowMetrics: ComputedRef<readonly { top: number; height: number }[]>
  pinnedBottomRowMetrics: ComputedRef<readonly { top: number; height: number }[]>
  rowMetricsSignature: ComputedRef<string>
  pinnedBottomRowMetricsSignature: ComputedRef<string>
  rowBandsSignature: ComputedRef<string>
  pinnedBottomRowBandsSignature: ComputedRef<string>
  leftChromeColumnsSignature: ComputedRef<string>
  centerChromeColumnsSignature: ComputedRef<string>
  rightChromeColumnsSignature: ComputedRef<string>
  headerPivotGroupsSignature: ComputedRef<string>
  resolveVisibleRowMetricsFromDom: (fallbackMetrics: readonly { top: number; height: number }[]) => readonly { top: number; height: number }[]
}

function resolveVisibleRowMetricsFromDom(
  bodyViewportEl: Ref<HTMLElement | null>,
  displayRows: Ref<readonly DataGridTableStageBodyRow[]>,
  fallbackMetrics: readonly { top: number; height: number }[],
): readonly { top: number; height: number }[] {
  if (displayRows.value.length !== fallbackMetrics.length) {
    return fallbackMetrics
  }
  const viewport = bodyViewportEl.value
  if (!viewport) {
    return fallbackMetrics
  }
  const viewportRect = viewport.getBoundingClientRect()
  const rowElements = Array.from(
    viewport.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row"),
  )
  if (rowElements.length !== displayRows.value.length) {
    return fallbackMetrics
  }
  return rowElements.map(rowElement => {
    const rowRect = rowElement.getBoundingClientRect()
    return {
      top: viewport.scrollTop + (rowRect.top - viewportRect.top),
      height: rowRect.height,
    }
  })
}

function resolveChromeRowBandKind(
  rows: Ref<DataGridTableStageRowsSection<Record<string, unknown>>>,
  isHoveredRow: UseDataGridStageChromeModelOptions["isHoveredRow"],
  isStripedRow: UseDataGridStageChromeModelOptions["isStripedRow"],
  row: DataGridTableStageBodyRow,
  rowOffset: number,
): string | null {
  if (isHoveredRow(row, rowOffset)) {
    return "hover"
  }
  const className = rows.value.rowClass(row)
  if (className.includes("row--group") && className.includes("row--pivot")) {
    return "pivot-group"
  }
  if (className.includes("row--group")) {
    return "group"
  }
  if (className.includes("row--tree")) {
    return "tree"
  }
  if (className.includes("row--pivot")) {
    return "pivot"
  }
  if (isStripedRow(row, rowOffset)) {
    return "striped"
  }
  return "base"
}

export function useDataGridStageChromeModel(
  options: UseDataGridStageChromeModelOptions,
): UseDataGridStageChromeModelResult {
  const hasPivotHeaderGroups = computed(() => {
    if (options.mode.value !== "pivot") {
      return false
    }
    return options.visibleColumns.value.some(column => (options.readPivotHeaderMeta(column)?.groupLabels?.length ?? 0) > 0)
  })

  const buildEstimatedVisibleRowMetrics = (): readonly { top: number; height: number }[] => {
    const virtualMetrics = resolveDataGridVirtualChromeRowMetrics({
      rowStart: resolveViewportRowStart(),
      rowEnd: resolveViewportRowEnd(),
      rowTotal: resolveVirtualRowTotal(),
      topSpacerHeight: options.viewport.value?.topSpacerHeight ?? 0,
      baseRowHeight: resolveBaseRowHeight(),
      resolveRowHeight: options.viewport.value?.resolveRowHeight,
      resolveRowOffset: options.viewport.value?.resolveRowOffset,
    })
    return virtualMetrics.map(metric => ({
      top: metric.top,
      height: metric.height,
    }))
  }

  function resolveViewportRowStart(): number {
    return options.viewport.value?.viewportRowStart ?? 0
  }

  function resolveViewportRowEnd(): number {
    const explicitEnd = options.viewport.value?.viewportRowEnd
    if (Number.isFinite(explicitEnd)) {
      return Math.max(resolveViewportRowStart(), Math.trunc(explicitEnd as number))
    }
    const actualCount = options.displayRows.value.length
    return actualCount > 0
      ? resolveViewportRowStart() + actualCount - 1
      : resolveViewportRowStart() - 1
  }

  function resolveVirtualRowTotal(): number {
    const explicitTotal = options.viewport.value?.virtualRowTotal
    if (Number.isFinite(explicitTotal)) {
      return Math.max(0, Math.trunc(explicitTotal as number))
    }
    return Math.max(
      resolveViewportRowEnd() + 1,
      options.displayRows.value.length,
      options.selectionTotalRowCount.value ?? 0,
    )
  }

  function resolveBaseRowHeight(): number {
    const explicitHeight = options.viewport.value?.baseRowHeight
    if (Number.isFinite(explicitHeight) && (explicitHeight as number) > 0) {
      return Math.max(1, Math.trunc(explicitHeight as number))
    }
    const firstRow = options.displayRows.value[0]
    if (firstRow) {
      const style = options.rows.value?.rowStyle(firstRow, options.resolveViewportRowOffset(firstRow, 0)) ?? {}
      const rawHeight = style.height ?? style.minHeight
      const parsedHeight = Number.parseFloat(String(rawHeight ?? ""))
      return Math.max(1, Number.isFinite(parsedHeight) ? Math.trunc(parsedHeight) : 31)
    }
    return 31
  }

  const rowMetrics = computed(() => {
    const estimated = buildEstimatedVisibleRowMetrics()
    if (options.mode.value === "base" && options.rowHeightMode.value === "auto") {
      options.bodyViewportScrollTop.value
      return resolveVisibleRowMetricsFromDom(options.bodyViewportEl, options.displayRows, estimated)
    }
    return estimated
  })

  const pinnedBottomRowMetrics = computed(() => {
    const metrics: Array<{ top: number; height: number }> = []
    let currentTop = 0
    options.pinnedBottomRows.value.forEach((row, rowOffset) => {
      const style = options.rows.value?.rowStyle(row, options.resolveViewportRowOffset(row, rowOffset)) ?? {}
      const parsedHeight = Number.parseFloat(String(style.height ?? style.minHeight ?? ""))
      const height = Number.isFinite(parsedHeight) ? Math.max(1, Math.trunc(parsedHeight)) : 31
      metrics.push({
        top: currentTop,
        height,
      })
      currentTop += height
    })
    return metrics
  })

  const rowBands = computed<readonly DataGridChromeRowBand[]>(() => {
    const viewportRowStart = resolveViewportRowStart()
    const virtualBands = rowMetrics.value.map((metric, metricOffset) => {
      const absoluteRowIndex = viewportRowStart + metricOffset
      return {
        rowIndex: metricOffset,
        top: metric.top,
        height: metric.height,
        kind: options.rows.value.stripedRows === true && absoluteRowIndex % 2 === 1 ? "striped" : "base",
      }
    })
    const loadedBands = options.displayRows.value.flatMap((row, rowOffset) => {
      const metricOffset = options.resolveAbsoluteRowIndex(row, rowOffset) - viewportRowStart
      const metric = rowMetrics.value[metricOffset]
      const kind = resolveChromeRowBandKind(options.rows, options.isHoveredRow, options.isStripedRow, row, options.resolveViewportRowOffset(row, rowOffset))
      if (!metric || !kind) {
        return []
      }
      return [{
        rowIndex: metricOffset,
        top: metric.top,
        height: metric.height,
        kind,
      }]
    })
    return [
      ...virtualBands,
      ...loadedBands,
    ]
  })

  const pinnedBottomRowBands = computed<readonly DataGridChromeRowBand[]>(() => (
    options.pinnedBottomRows.value.flatMap((row, rowOffset) => {
      const metric = pinnedBottomRowMetrics.value[rowOffset]
      const kind = resolveChromeRowBandKind(
        options.rows,
        options.isHoveredRow,
        options.isStripedRow,
        row,
        options.resolveViewportRowOffset(row, rowOffset),
      )
      if (!metric || !kind) {
        return []
      }
      return [{
        rowIndex: rowOffset,
        top: metric.top,
        height: metric.height,
        kind,
      }]
    })
  ))

  const chromeRenderModel = computed(() => (
    buildDataGridChromeRenderModel({
      rowMetrics: rowMetrics.value,
      rowBands: rowBands.value,
      scrollTop: options.bodyViewportScrollTop.value,
      leftPaneWidth: options.leftPaneWidth.value,
      centerPaneWidth: options.bodyViewportClientWidth.value,
      rightPaneWidth: options.rightPaneWidth.value,
      viewportHeight: options.bodyViewportClientHeight.value,
      leftColumnWidths: [
        options.indexColumnWidthPx.value,
        ...(options.pinnedLeftColumns.value ?? []).map(options.resolveColumnWidth),
      ].filter(width => width > 0),
      centerColumnWidths: [
        options.resolveLeftColumnSpacerWidth(),
        ...(options.renderedColumns.value ?? []).map(options.resolveColumnWidth),
        options.resolveRightColumnSpacerWidth(),
      ].filter(width => width > 0),
      rightColumnWidths: (options.pinnedRightColumns.value ?? []).map(options.resolveColumnWidth),
      centerScrollLeft: options.bodyViewportScrollLeft.value,
    })
  ))

  const headerChromeRenderModel = computed(() => (
    buildDataGridChromeRenderModel({
      rowMetrics: options.headerShellHeight.value > 0
        ? [{ top: 0, height: options.headerShellHeight.value }]
        : [],
      rowBands: [],
      scrollTop: 0,
      leftPaneWidth: options.leftPaneWidth.value,
      centerPaneWidth: options.headerViewportClientWidth.value,
      rightPaneWidth: options.rightPaneWidth.value,
      viewportHeight: options.headerShellHeight.value,
      leftColumnWidths: [
        options.indexColumnWidthPx.value,
        ...(options.pinnedLeftColumns.value ?? []).map(options.resolveColumnWidth),
      ].filter(width => width > 0),
      centerColumnWidths: [
        options.resolveLeftColumnSpacerWidth(),
        ...(options.renderedColumns.value ?? []).map(options.resolveColumnWidth),
        options.resolveRightColumnSpacerWidth(),
      ].filter(width => width > 0),
      rightColumnWidths: (options.pinnedRightColumns.value ?? []).map(options.resolveColumnWidth),
      centerScrollLeft: options.bodyViewportScrollLeft.value,
    })
  ))

  const pinnedBottomChromeRenderModel = computed(() => (
    buildDataGridChromeRenderModel({
      rowMetrics: pinnedBottomRowMetrics.value,
      rowBands: pinnedBottomRowBands.value,
      scrollTop: 0,
      leftPaneWidth: options.leftPaneWidth.value,
      centerPaneWidth: options.bodyViewportClientWidth.value,
      rightPaneWidth: options.rightPaneWidth.value,
      viewportHeight: options.pinnedBottomViewportClientHeight.value,
      leftColumnWidths: [
        options.indexColumnWidthPx.value,
        ...(options.pinnedLeftColumns.value ?? []).map(options.resolveColumnWidth),
      ].filter(width => width > 0),
      centerColumnWidths: [
        options.resolveLeftColumnSpacerWidth(),
        ...(options.renderedColumns.value ?? []).map(options.resolveColumnWidth),
        options.resolveRightColumnSpacerWidth(),
      ].filter(width => width > 0),
      rightColumnWidths: (options.pinnedRightColumns.value ?? []).map(options.resolveColumnWidth),
      centerScrollLeft: options.bodyViewportScrollLeft.value,
    })
  ))

  const rowMetricsSignature = computed(() => (
    rowMetrics.value.map(metric => `${metric.top}:${metric.height}`).join("|")
  ))

  const pinnedBottomRowMetricsSignature = computed(() => (
    pinnedBottomRowMetrics.value.map(metric => `${metric.top}:${metric.height}`).join("|")
  ))

  const rowBandsSignature = computed(() => (
    rowBands.value.map(band => `${band.kind}:${band.top}:${band.height}`).join("|")
  ))

  const pinnedBottomRowBandsSignature = computed(() => (
    pinnedBottomRowBands.value.map(band => `${band.kind}:${band.top}:${band.height}`).join("|")
  ))

  const leftChromeColumnsSignature = computed(() => (
    [
      options.indexColumnWidthPx.value,
      ...(options.pinnedLeftColumns.value ?? []).map(options.resolveColumnWidth),
    ].join("|")
  ))

  const centerChromeColumnsSignature = computed(() => (
    [
      options.resolveLeftColumnSpacerWidth(),
      ...(options.renderedColumns.value ?? []).map(options.resolveColumnWidth),
      options.resolveRightColumnSpacerWidth(),
    ].join("|")
  ))

  const rightChromeColumnsSignature = computed(() => (
    (options.pinnedRightColumns.value ?? []).map(options.resolveColumnWidth).join("|")
  ))

  const headerPivotGroupsSignature = computed(() => (
    hasPivotHeaderGroups.value
      ? options.visibleColumns.value
        .map(column => `${column.key}:${options.readPivotHeaderMeta(column)?.groupLabels?.join(">") ?? ""}`)
        .join("|")
      : "none"
  ))

  return {
    chromeRenderModel,
    headerChromeRenderModel,
    pinnedBottomChromeRenderModel,
    hasPivotHeaderGroups,
    rowMetrics,
    pinnedBottomRowMetrics,
    rowMetricsSignature,
    pinnedBottomRowMetricsSignature,
    rowBandsSignature,
    pinnedBottomRowBandsSignature,
    leftChromeColumnsSignature,
    centerChromeColumnsSignature,
    rightChromeColumnsSignature,
    headerPivotGroupsSignature,
    resolveVisibleRowMetricsFromDom: (fallbackMetrics) => (
      resolveVisibleRowMetricsFromDom(options.bodyViewportEl, options.displayRows, fallbackMetrics)
    ),
  }
}

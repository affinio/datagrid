import { COLUMN_VIRTUALIZATION_BUFFER } from "../dom/gridUtils"
import type { DataGridColumn } from "../types"
import {
	computeColumnLayout,
	type ColumnLayoutMetric,
	type ColumnLayoutOutput,
} from "../virtualization/horizontalLayout"
import type { HorizontalVirtualizerMeta } from "../virtualization/horizontalVirtualizer"
import type { DataGridViewportControllerOptions } from "./dataGridViewportTypes"

type LayoutOutput = ColumnLayoutOutput<DataGridColumn>
type ResolvePinMode = BuildHorizontalMetaInput["resolvePinMode"]

interface LayoutCacheEntry {
	columns: readonly DataGridColumn[]
	zoom: number
	resolvePinMode: ResolvePinMode
	layout: LayoutOutput
}

const layoutCache: Array<LayoutCacheEntry | null> = [null, null]
let layoutCacheWriteIndex = 0

function resolveCachedLayout(
	columns: readonly DataGridColumn[],
	zoom: number,
	resolvePinMode: ResolvePinMode,
): LayoutOutput {
	for (let index = 0; index < layoutCache.length; index += 1) {
		const cached = layoutCache[index]
		if (
			cached &&
			cached.columns === columns &&
			cached.zoom === zoom &&
			cached.resolvePinMode === resolvePinMode
		) {
			return cached.layout
		}
	}

	const layout = computeColumnLayout({
		columns,
		zoom,
		resolvePinMode,
	})

	layoutCache[layoutCacheWriteIndex] = {
		columns,
		zoom,
		resolvePinMode,
		layout,
	}
	layoutCacheWriteIndex = (layoutCacheWriteIndex + 1) % layoutCache.length

	return layout
}

export interface DataGridViewportHorizontalMeta extends HorizontalVirtualizerMeta<DataGridColumn> {
	scrollableColumns: DataGridColumn[]
	scrollableIndices: LayoutOutput["scrollableIndices"]
	metrics: LayoutOutput["scrollableMetrics"]
	pinnedLeft: ColumnLayoutMetric<DataGridColumn>[]
	pinnedRight: ColumnLayoutMetric<DataGridColumn>[]
	indexColumnWidth: number
	effectiveViewport: number
	version: number
	scrollVelocity: number
}

export interface BuildHorizontalMetaInput {
	columns: DataGridColumn[]
	layoutScale: number
	resolvePinMode: DataGridViewportControllerOptions["resolvePinMode"]
	viewportWidth: number
	cachedNativeScrollWidth: number
	cachedContainerWidth: number
	lastScrollDirection: number
	smoothedHorizontalVelocity: number
	lastSignature: string
	version: number
	scrollWidth?: number
}

export interface BuildHorizontalMetaResult {
	meta: DataGridViewportHorizontalMeta
	version: number
	signature: string
}

export function buildHorizontalMeta({
	columns,
	layoutScale,
	resolvePinMode,
	viewportWidth,
	cachedNativeScrollWidth,
	cachedContainerWidth,
	lastScrollDirection,
	smoothedHorizontalVelocity,
	lastSignature,
	version,
	scrollWidth,
}: BuildHorizontalMetaInput): BuildHorizontalMetaResult {
	const layout = resolveCachedLayout(columns, layoutScale, resolvePinMode)

	// Legacy compatibility field: index column width is no longer injected as a synthetic viewport inset.
	// The viewport math is driven by real pinned column widths from column layout only.
	const indexColumnWidth = 0
	const containerWidthForColumns = Math.max(0, viewportWidth)

	let nativeScrollLimit = 0
	const measuredWidth = Number.isFinite(scrollWidth) ? (scrollWidth as number) : -1
	if (measuredWidth >= 0 && viewportWidth >= 0) {
		nativeScrollLimit = Math.max(0, measuredWidth - viewportWidth)
	} else if (cachedNativeScrollWidth >= 0 && cachedContainerWidth >= 0) {
		nativeScrollLimit = Math.max(0, cachedNativeScrollWidth - cachedContainerWidth)
	}

	const effectiveViewport = Math.max(0, containerWidthForColumns - layout.pinnedLeftWidth - layout.pinnedRightWidth)
	const stableNativeLimit = Math.round(nativeScrollLimit)
	const signature = `${layout.scrollableColumns.length}|${layout.scrollableMetrics.totalWidth}|${layout.zoom}|${containerWidthForColumns}|${layout.pinnedLeftWidth}|${layout.pinnedRightWidth}|${stableNativeLimit}`
	const nextVersion = signature === lastSignature ? version : version + 1

	const meta: DataGridViewportHorizontalMeta = {
		scrollableColumns: layout.scrollableColumns,
		scrollableIndices: layout.scrollableIndices,
		metrics: layout.scrollableMetrics,
		pinnedLeft: layout.pinnedLeft,
		pinnedRight: layout.pinnedRight,
		pinnedLeftWidth: layout.pinnedLeftWidth,
		pinnedRightWidth: layout.pinnedRightWidth,
		zoom: layout.zoom,
		containerWidthForColumns,
		scrollDirection: lastScrollDirection,
		nativeScrollLimit,
		buffer: COLUMN_VIRTUALIZATION_BUFFER,
		indexColumnWidth,
		effectiveViewport,
		version: nextVersion,
		scrollVelocity: smoothedHorizontalVelocity,
	}

	return {
		meta,
		version: nextVersion,
		signature,
	}
}

import type { DataGridTableStageHistoryAdapter } from "./stage/useDataGridTableStageHistory"

export interface DataGridHistoryController {
  canUndo: () => boolean
  canRedo: () => boolean
  runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
}

export type DataGridHistoryShortcutsMode = "grid" | "window"
export type DataGridHistoryControlsMode = "toolbar" | "external-only"

export interface DataGridHistoryOptions {
  enabled?: boolean
  depth?: number
  shortcuts?: boolean | DataGridHistoryShortcutsMode
  controls?: boolean | DataGridHistoryControlsMode
  adapter?: DataGridTableStageHistoryAdapter
}

export type DataGridHistoryProp = boolean | DataGridHistoryOptions

export interface DataGridResolvedHistoryOptions {
  enabled: boolean
  depth: number | undefined
  shortcuts: false | DataGridHistoryShortcutsMode
  controls: false | DataGridHistoryControlsMode
  adapter?: DataGridTableStageHistoryAdapter
}

function normalizePositiveInteger(value: number | undefined): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined
  }
  const normalized = Math.trunc(value as number)
  return normalized > 0 ? normalized : undefined
}

function resolveHistoryShortcuts(
  value: DataGridHistoryOptions["shortcuts"],
): DataGridResolvedHistoryOptions["shortcuts"] {
  if (value === false) {
    return false
  }
  if (value === "window") {
    return "window"
  }
  return "grid"
}

function resolveHistoryControls(
  value: DataGridHistoryOptions["controls"],
): DataGridResolvedHistoryOptions["controls"] {
  if (value === true || value === "toolbar") {
    return "toolbar"
  }
  if (value === "external-only") {
    return "external-only"
  }
  return false
}

export function createDisabledDataGridHistoryController(): DataGridHistoryController {
  return {
    canUndo: () => false,
    canRedo: () => false,
    runHistoryAction: async () => null,
  }
}

export function resolveDataGridHistory(
  value: DataGridHistoryProp | undefined,
): DataGridResolvedHistoryOptions {
  if (value === false) {
    return {
      enabled: false,
      depth: undefined,
      shortcuts: false,
      controls: false,
    }
  }

  const options = typeof value === "object" && value !== null ? value : {}
  const enabled = value === undefined || value === true || options.enabled !== false
  if (!enabled) {
    return {
      enabled: false,
      depth: undefined,
      shortcuts: false,
      controls: false,
    }
  }

  return {
    enabled: true,
    depth: normalizePositiveInteger(options.depth),
    shortcuts: resolveHistoryShortcuts(options.shortcuts),
    controls: resolveHistoryControls(options.controls),
    adapter: options.adapter,
  }
}
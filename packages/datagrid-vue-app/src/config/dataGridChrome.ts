export type DataGridToolbarPlacement = "stacked" | "integrated" | "hidden"

export type DataGridChromeDensity = "comfortable" | "compact"

export interface DataGridChromeOptions {
  density?: DataGridChromeDensity | null
  toolbarPlacement?: DataGridToolbarPlacement | null
  toolbarGap?: number | null
  workspaceGap?: number | null
}

export type DataGridChromeProp = DataGridChromeDensity | DataGridChromeOptions | null

export interface DataGridResolvedChromeOptions {
  density: DataGridChromeDensity
  toolbarPlacement: DataGridToolbarPlacement
  toolbarGap: number
  workspaceGap: number
}

const DEFAULT_DENSITY: DataGridChromeDensity = "comfortable"

const DEFAULT_GAPS_BY_DENSITY: Readonly<Record<DataGridChromeDensity, {
  toolbarGap: number
  workspaceGap: number
}>> = {
  comfortable: {
    toolbarGap: 10,
    workspaceGap: 12,
  },
  compact: {
    toolbarGap: 6,
    workspaceGap: 8,
  },
}

function normalizeDensity(input: DataGridChromeDensity | null | undefined): DataGridChromeDensity {
  return input === "compact" ? "compact" : DEFAULT_DENSITY
}

function normalizeToolbarPlacement(
  input: DataGridToolbarPlacement | null | undefined,
): DataGridToolbarPlacement {
  return input === "integrated" || input === "hidden" || input === "stacked"
    ? input
    : "stacked"
}

function normalizeGap(value: number | null | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(0, value as number)
}

export function resolveDataGridChrome(
  input: DataGridChromeProp | undefined,
): DataGridResolvedChromeOptions {
  const options = typeof input === "object" && input !== null ? input : null
  const density = normalizeDensity(typeof input === "string" ? input : options?.density)
  const defaults = DEFAULT_GAPS_BY_DENSITY[density]
  return {
    density,
    toolbarPlacement: normalizeToolbarPlacement(options?.toolbarPlacement),
    toolbarGap: normalizeGap(options?.toolbarGap, defaults.toolbarGap),
    workspaceGap: normalizeGap(options?.workspaceGap, defaults.workspaceGap),
  }
}
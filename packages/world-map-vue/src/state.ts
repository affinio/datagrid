import type { WorldMapCountryId } from "@affino/world-map-core"

export interface WorldMapViewState {
  zoom: number
  panX: number
  panY: number
}

export interface WorldMapSelectionState {
  selectedCountryId: WorldMapCountryId | null
  selectedMarkerId: string | null
}

export interface WorldMapUnifiedState {
  version: 1
  selection: WorldMapSelectionState
  view: WorldMapViewState
}

export interface WorldMapStateMigrateOptions {
  strict?: boolean
}

export interface WorldMapStateApplyOptions {
  applySelection?: boolean
  applyView?: boolean
  strict?: boolean
}

function cloneSerializable<T>(value: T): T {
  const structuredCloneRef = (globalThis as typeof globalThis & {
    structuredClone?: <U>(input: U) => U
  }).structuredClone
  if (typeof structuredCloneRef === "function") {
    try {
      return structuredCloneRef(value)
    } catch {
      // Fall through to JSON clone.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return value
  }
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeSelectionState(value: unknown): WorldMapSelectionState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const selection = value as Partial<WorldMapSelectionState>
  const selectedCountryId = typeof selection.selectedCountryId === "string"
    ? selection.selectedCountryId
    : selection.selectedCountryId === null
      ? null
      : null
  const selectedMarkerId = typeof selection.selectedMarkerId === "string"
    ? selection.selectedMarkerId
    : selection.selectedMarkerId === null
      ? null
      : null

  return {
    selectedCountryId,
    selectedMarkerId,
  }
}

function normalizeViewState(value: unknown): WorldMapViewState | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const view = value as Partial<WorldMapViewState>
  const zoom = normalizeFiniteNumber(view.zoom)
  const panX = normalizeFiniteNumber(view.panX)
  const panY = normalizeFiniteNumber(view.panY)
  if (zoom === null || panX === null || panY === null) {
    return null
  }

  return {
    zoom,
    panX,
    panY,
  }
}

export function migrateWorldMapState(
  state: unknown,
  options: WorldMapStateMigrateOptions = {},
): WorldMapUnifiedState | null {
  if (!state || typeof state !== "object") {
    if (options.strict) {
      throw new Error("[WorldMap] State migration failed: input must be an object.")
    }
    return null
  }

  const candidate = state as { version?: unknown; selection?: unknown; view?: unknown }
  if (candidate.version !== 1) {
    if (options.strict) {
      throw new Error(`[WorldMap] Unsupported state version: ${String(candidate.version)}`)
    }
    return null
  }

  const selection = normalizeSelectionState(candidate.selection)
  const view = normalizeViewState(candidate.view)
  if (!selection || !view) {
    if (options.strict) {
      throw new Error("[WorldMap] State migration failed: invalid selection or view payload.")
    }
    return null
  }

  return cloneSerializable({
    version: 1 as const,
    selection,
    view,
  })
}


import type {
  DataGridGetStateOptions,
  DataGridSetStateOptions,
  DataGridUnifiedState,
} from "@affino/datagrid-vue/headless"
import type { DataGridSavedViewStorageLike } from "./dataGridSavedView"

export type DataGridStatePersistenceStorage =
  | "local"
  | "session"
  | DataGridSavedViewStorageLike

export interface DataGridPersistenceChangeEvent {
  key: string
  status: "loading" | "ready" | "saving" | "error"
  operation?: "load" | "save"
  error?: unknown
}

export interface DataGridStatePersistenceOptions {
  key: string
  load?: (context: { key: string }) => unknown | Promise<unknown>
  save?: (context: { key: string; state: DataGridUnifiedState<Record<string, unknown>> }) => void | Promise<void>
  includeSelection?: boolean
  includeGroupExpansion?: boolean
  storage?: DataGridStatePersistenceStorage | null
  includeViewportPosition?: boolean
  restoreOnReady?: boolean
  debounceMs?: number
  setOptions?: DataGridSetStateOptions
}

export type DataGridStatePersistenceProp =
  | string
  | false
  | DataGridStatePersistenceOptions
  | null
  | undefined

export interface DataGridResolvedStatePersistenceOptions extends Pick<DataGridStatePersistenceOptions, "load" | "save"> {
  key: string
  storage: DataGridStatePersistenceStorage
  includeSelection: boolean
  includeGroupExpansion: boolean
  includeViewportPosition: boolean
  restoreOnReady: boolean
  debounceMs: number
  getOptions: DataGridGetStateOptions
  setOptions: DataGridSetStateOptions
}

function normalizeDebounceMs(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 150
  }
  return Math.max(0, Math.trunc(value as number))
}

export function resolveDataGridStatePersistence(
  input: DataGridStatePersistenceProp,
): DataGridResolvedStatePersistenceOptions | null {
  if (!input) {
    return null
  }

  const options: DataGridStatePersistenceOptions = typeof input === "string"
    ? { key: input }
    : input
  const key = options.key.trim()
  if (!key) {
    return null
  }
  const includeViewportPosition = options.includeViewportPosition === true
  const restoreOnReady = options.restoreOnReady !== false

  return {
    key,
    load: options.load,
    save: options.save,
    includeSelection: options.includeSelection === true,
    includeGroupExpansion: options.includeGroupExpansion === true,
    storage: options.storage ?? "local",
    includeViewportPosition,
    restoreOnReady,
    debounceMs: normalizeDebounceMs(options.debounceMs),
    getOptions: { includeViewportPosition },
    setOptions: {
      applySelection: options.includeSelection === true,
      applyViewport: false,
      ...(options.setOptions ?? {}),
      applyViewportPosition: includeViewportPosition,
    },
  }
}

export function resolveDataGridStatePersistenceStorage(
  storage: DataGridStatePersistenceStorage,
): DataGridSavedViewStorageLike | null {
  if (typeof storage === "object" && storage !== null) {
    return storage
  }
  if (typeof window === "undefined") {
    return null
  }
  return storage === "session" ? window.sessionStorage : window.localStorage
}

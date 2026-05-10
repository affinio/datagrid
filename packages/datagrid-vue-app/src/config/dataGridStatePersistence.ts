import type {
  DataGridGetStateOptions,
  DataGridSetStateOptions,
} from "@affino/datagrid-vue"
import type { DataGridSavedViewStorageLike } from "./dataGridSavedView"

export type DataGridStatePersistenceStorage =
  | "local"
  | "session"
  | DataGridSavedViewStorageLike

export interface DataGridStatePersistenceOptions {
  key: string
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

export interface DataGridResolvedStatePersistenceOptions {
  key: string
  storage: DataGridStatePersistenceStorage
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
  const includeViewportPosition = options.includeViewportPosition !== false
  const restoreOnReady = options.restoreOnReady !== false

  return {
    key,
    storage: options.storage ?? "local",
    includeViewportPosition,
    restoreOnReady,
    debounceMs: normalizeDebounceMs(options.debounceMs),
    getOptions: { includeViewportPosition },
    setOptions: {
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

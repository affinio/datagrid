export const DATA_GRID_PINNED_NATIVE_SCROLL_QUERY_PARAM = "dgPinnedNativeScroll"
export const DATA_GRID_PINNED_NATIVE_SCROLL_STORAGE_KEY = "affino:datagrid:pinned-native-scroll"

function normalizePinnedNativeScrollToken(value: unknown): boolean | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim().toLowerCase()
  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "prototype") {
    return true
  }
  if (normalized === "0" || normalized === "false" || normalized === "off") {
    return false
  }
  return null
}

function readSearchParam(): string | null {
  const location = globalThis.location
  if (!location || typeof location.search !== "string") {
    return null
  }
  try {
    return new URLSearchParams(location.search).get(DATA_GRID_PINNED_NATIVE_SCROLL_QUERY_PARAM)
  } catch {
    return null
  }
}

function readStorageToken(): string | null {
  try {
    return globalThis.localStorage?.getItem(DATA_GRID_PINNED_NATIVE_SCROLL_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

export function resolveDataGridPinnedNativeScrollPrototypeEnabled(): boolean {
  const queryValue = normalizePinnedNativeScrollToken(readSearchParam())
  if (queryValue !== null) {
    return queryValue
  }
  return normalizePinnedNativeScrollToken(readStorageToken()) ?? false
}

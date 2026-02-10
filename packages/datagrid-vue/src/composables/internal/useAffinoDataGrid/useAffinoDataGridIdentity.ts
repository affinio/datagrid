import { isRef, ref, type Ref } from "vue"

export type MaybeRef<T> = T | Ref<T>

export function toReadonlyRef<T>(source: MaybeRef<T>): Ref<T> {
  if (isRef(source)) {
    return source as Ref<T>
  }
  return ref(source) as Ref<T>
}

export function fallbackResolveRowKey<TRow>(row: TRow, index: number): string {
  const candidate = row as { rowId?: unknown; id?: unknown; key?: unknown }
  if (typeof candidate.rowId === "string" || typeof candidate.rowId === "number") {
    const rowKey = String(candidate.rowId).trim()
    if (rowKey.length > 0) {
      return rowKey
    }
  }
  if (typeof candidate.id === "string" || typeof candidate.id === "number") {
    const rowKey = String(candidate.id).trim()
    if (rowKey.length > 0) {
      return rowKey
    }
  }
  if (typeof candidate.key === "string" || typeof candidate.key === "number") {
    const rowKey = String(candidate.key).trim()
    if (rowKey.length > 0) {
      return rowKey
    }
  }
  throw new Error(
    `[AffinoDataGrid] Missing stable row identity at index ${index}. ` +
    "Provide features.selection.resolveRowKey(row, index) or include non-empty rowId/id/key.",
  )
}

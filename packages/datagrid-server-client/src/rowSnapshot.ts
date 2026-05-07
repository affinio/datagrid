import type { DataGridDataSourceRowEntry, DataGridRowKind } from "@affino/datagrid-core"

export type ServerRowSnapshotLike<T> =
  | T
  | {
      rowId: string | number
      index: number
      row: T
      kind?: string
      groupMeta?: unknown
      state?: unknown
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function normalizeRowSnapshots<T>(
  rows: readonly ServerRowSnapshotLike<T>[] | null | undefined,
): readonly DataGridDataSourceRowEntry<T>[] | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }

  const normalized: DataGridDataSourceRowEntry<T>[] = []
  for (const entry of rows) {
    if (!entry || typeof entry !== "object") {
      continue
    }
    if ("row" in entry && "rowId" in entry) {
      const snapshot = entry as {
        rowId?: unknown
        index?: unknown
        row?: T
        kind?: unknown
        groupMeta?: unknown
        state?: unknown
      }
      if (typeof snapshot.index !== "number" || !Number.isFinite(snapshot.index)) {
        continue
      }
      if (typeof snapshot.rowId !== "string" && typeof snapshot.rowId !== "number") {
        continue
      }
      if (typeof snapshot.row === "undefined") {
        continue
      }
      normalized.push({
        index: Math.max(0, Math.trunc(snapshot.index)),
        rowId: snapshot.rowId,
        row: snapshot.row,
        ...(typeof snapshot.kind === "string" ? { kind: snapshot.kind as DataGridRowKind } : {}),
        ...(isRecord(snapshot.groupMeta) ? { groupMeta: snapshot.groupMeta } : {}),
        ...(isRecord(snapshot.state) ? { state: snapshot.state } : {}),
      })
      continue
    }

    const rawRow = entry as T & { id?: unknown; index?: unknown }
    if (typeof rawRow.id !== "string" && typeof rawRow.id !== "number") {
      continue
    }
    if (typeof rawRow.index !== "number" || !Number.isFinite(rawRow.index)) {
      continue
    }
    normalized.push({
      index: Math.max(0, Math.trunc(rawRow.index)),
      rowId: rawRow.id,
      row: entry as T,
    })
  }

  return normalized.length > 0 ? normalized : null
}

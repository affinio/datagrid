import type { DataGridApi, DataGridRowId, DataGridRowNode, DataGridTreeDataSpec } from "@affino/datagrid-core"

/** Applies the same default group-column presentation used by the Vue app. */
export function createDomGroupingPresentationController<TRow>(
  api: DataGridApi<TRow>,
  treeData: DataGridTreeDataSpec<TRow> | null | undefined,
) {
  const visibilityBeforeGrouping = new Map<string, boolean>()
  const parentDepthByRowId = new Map<string, number>()
  let labelColumnKey: string | null = null
  let syncing = false
  let parentDepthRevision: number | undefined

  const rowIdKey = (rowId: DataGridRowId): string => `${typeof rowId}:${String(rowId)}`
  const syncParentLeafDepths = (): void => {
    if (treeData?.mode !== "parent") return
    const revision = api.rows.getSnapshot().revision
    if (revision !== undefined && revision === parentDepthRevision) return
    parentDepthByRowId.clear()
    for (let index = 0; index < api.rows.getCount(); index += 1) {
      const row = api.rows.get(index)
      if (row?.kind === "group" && row.groupMeta?.groupField === "parent") {
        parentDepthByRowId.set(rowIdKey(row.rowId), row.groupMeta.level)
      }
    }
    parentDepthRevision = revision
  }

  const getLeafDepth = (row: DataGridRowNode<TRow>): number => {
    if (row.kind !== "leaf" || !treeData) return 0
    if (treeData.mode === "path") {
      try {
        return Math.max(0, treeData.getDataPath(row.data, row.sourceIndex).length)
      } catch {
        return 0
      }
    }
    const parentId = treeData.getParentId(row.data, row.sourceIndex)
    return parentId == null ? 0 : (parentDepthByRowId.get(rowIdKey(parentId)) ?? -1) + 1
  }

  const sync = (): string | null => {
    if (syncing) return labelColumnKey
    syncing = true
    try {
      const groupBy = api.rows.getSnapshot().groupBy
      const groupedFields = new Set(groupBy?.fields ?? [])
      const treeActive = api.rows.getSnapshot().treeDataDiagnostics != null
      syncParentLeafDepths()
      const columnsApi = api.columns
      const snapshot = columnsApi.getSnapshot()

      if (groupedFields.size === 0 && !treeActive) {
        for (const [key, visible] of visibilityBeforeGrouping) {
          if (columnsApi.get(key)?.visible !== visible) columnsApi.setVisibility(key, visible)
        }
        visibilityBeforeGrouping.clear()
        labelColumnKey = null
        return null
      }

      const previouslyVisible = snapshot.columns.filter(column => (
        visibilityBeforeGrouping.get(column.key) ?? column.visible
      ))
      const ungrouped = previouslyVisible.filter(column => !groupedFields.has(column.key))
      labelColumnKey = ungrouped[0]?.key ?? previouslyVisible[0]?.key ?? null

      const suppressed = new Set(treeActive
        ? []
        : [...groupedFields].filter(key => key !== labelColumnKey))
      for (const [key, visible] of visibilityBeforeGrouping) {
        if (suppressed.has(key)) continue
        if (columnsApi.get(key)?.visible !== visible) columnsApi.setVisibility(key, visible)
        visibilityBeforeGrouping.delete(key)
      }
      for (const key of suppressed) {
        if (!visibilityBeforeGrouping.has(key)) {
          const column = columnsApi.get(key)
          if (column) visibilityBeforeGrouping.set(key, column.visible)
        }
        if (columnsApi.get(key)?.visible) columnsApi.setVisibility(key, false)
      }

      if (labelColumnKey) {
        const labelColumn = columnsApi.get(labelColumnKey)
        if (labelColumn?.pin && labelColumn.pin !== "none") columnsApi.setPin(labelColumnKey, "none")
        const current = columnsApi.getSnapshot()
        if (current.order[0] !== labelColumnKey) {
          columnsApi.setOrder([labelColumnKey, ...current.order.filter(key => key !== labelColumnKey)])
          const centerOrder = current.zoneOrder.center ?? current.centerColumns.map(column => column.key)
          columnsApi.setZoneOrder("center", [labelColumnKey, ...centerOrder.filter(key => key !== labelColumnKey)])
        }
      }
      return labelColumnKey
    } finally {
      syncing = false
    }
  }

  return {
    sync,
    getLabelColumnKey: () => labelColumnKey,
    getLeafDepth,
    dispose() {
      for (const [key, visible] of visibilityBeforeGrouping) {
        if (api.columns.get(key)?.visible !== visible) api.columns.setVisibility(key, visible)
      }
      visibilityBeforeGrouping.clear()
    },
  }
}

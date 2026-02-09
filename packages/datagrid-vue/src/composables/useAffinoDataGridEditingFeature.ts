import { ref, type Ref } from "vue"
import type { DataGridColumnDef } from "@affino/datagrid-core"

export type AffinoEditingMode = "cell" | "row"

export interface AffinoEditingSession {
  rowKey: string
  columnKey: string
  mode: AffinoEditingMode
  draft: string
}

export interface AffinoEditingFeatureInput<TRow> {
  enabled?: boolean
  mode?: AffinoEditingMode
  enum?: boolean
  onCommit?: (session: AffinoEditingSession, context: {
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
  }) => void | Promise<void>
}

export interface NormalizedAffinoEditingFeature<TRow> {
  enabled: boolean
  mode: AffinoEditingMode
  enum: boolean
  onCommit?: AffinoEditingFeatureInput<TRow>["onCommit"]
}

export interface UseAffinoDataGridEditingFeatureOptions<TRow> {
  rows: Ref<readonly TRow[]>
  columns: Ref<readonly DataGridColumnDef[]>
  feature: NormalizedAffinoEditingFeature<TRow>
}

export interface UseAffinoDataGridEditingFeatureResult<TRow> {
  editingEnabled: Ref<boolean>
  editingMode: Ref<AffinoEditingMode>
  editingEnum: Ref<boolean>
  activeSession: Ref<AffinoEditingSession | null>
  beginEdit: (session: Omit<AffinoEditingSession, "mode"> & { mode?: AffinoEditingMode }) => boolean
  updateDraft: (draft: string) => boolean
  cancelEdit: () => boolean
  commitEdit: () => Promise<boolean>
  isCellEditing: (rowKey: string, columnKey: string) => boolean
  resolveCellDraft: (params: {
    row: TRow
    columnKey: string
    value?: unknown
  }) => string
}

export function normalizeEditingFeature<TRow>(
  input: boolean | AffinoEditingFeatureInput<TRow> | undefined,
): NormalizedAffinoEditingFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      mode: "cell",
      enum: false,
    }
  }
  if (!input) {
    return {
      enabled: false,
      mode: "cell",
      enum: false,
    }
  }
  return {
    enabled: input.enabled ?? true,
    mode: input.mode ?? "cell",
    enum: input.enum ?? false,
    onCommit: input.onCommit,
  }
}

export function useAffinoDataGridEditingFeature<TRow>(
  options: UseAffinoDataGridEditingFeatureOptions<TRow>,
): UseAffinoDataGridEditingFeatureResult<TRow> {
  const editingEnabled = ref(options.feature.enabled)
  const editingMode = ref<AffinoEditingMode>(options.feature.mode)
  const editingEnum = ref(options.feature.enum)
  const activeSession = ref<AffinoEditingSession | null>(null)

  const beginEdit = (session: Omit<AffinoEditingSession, "mode"> & { mode?: AffinoEditingMode }): boolean => {
    if (!editingEnabled.value) {
      return false
    }
    activeSession.value = {
      rowKey: session.rowKey,
      columnKey: session.columnKey,
      mode: session.mode ?? editingMode.value,
      draft: session.draft,
    }
    return true
  }

  const updateDraft = (draft: string): boolean => {
    if (!activeSession.value) {
      return false
    }
    activeSession.value = {
      ...activeSession.value,
      draft,
    }
    return true
  }

  const cancelEdit = (): boolean => {
    if (!activeSession.value) {
      return false
    }
    activeSession.value = null
    return true
  }

  const commitEdit = async (): Promise<boolean> => {
    if (!activeSession.value) {
      return false
    }
    const session = activeSession.value
    activeSession.value = null

    if (!options.feature.onCommit) {
      return true
    }

    await options.feature.onCommit(session, {
      rows: options.rows.value,
      columns: options.columns.value,
    })
    return true
  }

  const isCellEditing = (rowKey: string, columnKey: string): boolean => (
    activeSession.value?.rowKey === rowKey && activeSession.value?.columnKey === columnKey
  )

  const resolveCellDraft = (params: {
    row: TRow
    columnKey: string
    value?: unknown
  }): string => {
    if (params.value !== undefined && params.value !== null) {
      return String(params.value)
    }
    const candidate = params.row as Record<string, unknown>
    const fromRow = candidate[params.columnKey]
    return fromRow === undefined || fromRow === null ? "" : String(fromRow)
  }

  return {
    editingEnabled,
    editingMode,
    editingEnum,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
  }
}

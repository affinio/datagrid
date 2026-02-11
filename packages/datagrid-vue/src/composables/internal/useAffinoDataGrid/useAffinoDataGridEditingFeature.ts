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
  enumEditor?: {
    enabled?: boolean
    primitive?: "affino-listbox" | "affino-menu"
    resolveOptions?: (context: {
      row: TRow
      rowKey: string
      columnKey: string
      value: unknown
      rows: readonly TRow[]
      columns: readonly DataGridColumnDef[]
    }) => readonly { label: string; value: unknown }[]
  }
  onCommit?: (session: AffinoEditingSession, context: {
    rows: readonly TRow[]
    columns: readonly DataGridColumnDef[]
  }) => void | Promise<void>
}

export interface NormalizedAffinoEditingFeature<TRow> {
  enabled: boolean
  mode: AffinoEditingMode
  enum: boolean
  enumEditor: {
    enabled: boolean
    primitive: "affino-listbox" | "affino-menu"
    resolveOptions?: NonNullable<AffinoEditingFeatureInput<TRow>["enumEditor"]>["resolveOptions"]
  }
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
  enumEditorEnabled: Ref<boolean>
  enumEditorPrimitive: Ref<"affino-listbox" | "affino-menu">
  resolveEnumEditorOptions: (params: {
    row: TRow
    rowKey: string
    columnKey: string
    value: unknown
  }) => readonly { label: string; value: unknown }[]
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
      enumEditor: {
        enabled: false,
        primitive: "affino-listbox",
      },
    }
  }
  if (!input) {
    return {
      enabled: false,
      mode: "cell",
      enum: false,
      enumEditor: {
        enabled: false,
        primitive: "affino-listbox",
      },
    }
  }
  const enumEditorEnabled = input.enumEditor?.enabled ?? input.enum ?? false
  return {
    enabled: input.enabled ?? true,
    mode: input.mode ?? "cell",
    enum: input.enum ?? false,
    enumEditor: {
      enabled: enumEditorEnabled,
      primitive: input.enumEditor?.primitive ?? "affino-listbox",
      resolveOptions: input.enumEditor?.resolveOptions,
    },
    onCommit: input.onCommit,
  }
}

export function useAffinoDataGridEditingFeature<TRow>(
  options: UseAffinoDataGridEditingFeatureOptions<TRow>,
): UseAffinoDataGridEditingFeatureResult<TRow> {
  const editingEnabled = ref(options.feature.enabled)
  const editingMode = ref<AffinoEditingMode>(options.feature.mode)
  const editingEnum = ref(options.feature.enum)
  const enumEditorEnabled = ref(options.feature.enumEditor.enabled)
  const enumEditorPrimitive = ref<"affino-listbox" | "affino-menu">(options.feature.enumEditor.primitive)
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

  const resolveEnumEditorOptions = (params: {
    row: TRow
    rowKey: string
    columnKey: string
    value: unknown
  }): readonly { label: string; value: unknown }[] => {
    const customOptions = options.feature.enumEditor.resolveOptions?.({
      row: params.row,
      rowKey: params.rowKey,
      columnKey: params.columnKey,
      value: params.value,
      rows: options.rows.value,
      columns: options.columns.value,
    })
    if (Array.isArray(customOptions)) {
      return customOptions
    }

    const column = options.columns.value.find(entry => entry.key === params.columnKey)
    const meta = (column?.meta ?? {}) as Record<string, unknown>
    const metaOptions = meta.options
    if (!Array.isArray(metaOptions)) {
      return []
    }
    return metaOptions
      .map(option => {
        if (!option || typeof option !== "object") {
          return null
        }
        const entry = option as { label?: unknown; value?: unknown }
        return {
          label: typeof entry.label === "string" ? entry.label : String(entry.value ?? ""),
          value: entry.value,
        }
      })
      .filter((entry): entry is { label: string; value: unknown } => entry !== null)
  }

  return {
    editingEnabled,
    editingMode,
    editingEnum,
    enumEditorEnabled,
    enumEditorPrimitive,
    resolveEnumEditorOptions,
    activeSession,
    beginEdit,
    updateDraft,
    cancelEdit,
    commitEdit,
    isCellEditing,
    resolveCellDraft,
  }
}

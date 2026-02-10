import { computed, ref, type ComputedRef, type Ref } from "vue"
import type { AffinoDataGridRowMutationOptions } from "./useAffinoDataGridFeatureSuite"

export interface AffinoClipboardFeatureInput<TRow> {
  enabled?: boolean
  useSystemClipboard?: boolean
  serializeRows?: (rows: readonly TRow[]) => string
  parseRows?: (text: string) => readonly TRow[]
}

export interface NormalizedAffinoClipboardFeature<TRow> {
  enabled: boolean
  useSystemClipboard: boolean
  serializeRows: (rows: readonly TRow[]) => string
  parseRows: (text: string) => readonly TRow[]
}

export interface UseAffinoDataGridClipboardFeatureOptions<TRow> {
  rows: Ref<readonly TRow[]>
  selectedRowKeySet: Ref<Set<string>>
  feature: NormalizedAffinoClipboardFeature<TRow>
  resolveRowKey: (row: TRow, index: number) => string
  replaceRows: (rows: readonly TRow[], options?: AffinoDataGridRowMutationOptions) => Promise<boolean>
}

export interface UseAffinoDataGridClipboardFeatureResult<TRow> {
  clipboardEnabled: Ref<boolean>
  lastCopiedText: ComputedRef<string>
  copyText: (text: string) => Promise<boolean>
  readText: () => Promise<string>
  copyRows: (rows?: readonly TRow[]) => Promise<boolean>
  parseRows: (text: string) => readonly TRow[]
  resolveSelectedRows: () => readonly TRow[]
  copySelectedRows: () => Promise<boolean>
  clearSelectedRows: () => Promise<number>
  cutSelectedRows: () => Promise<number>
  pasteRowsAppend: () => Promise<number>
}

export function normalizeClipboardFeature<TRow>(
  input: boolean | AffinoClipboardFeatureInput<TRow> | undefined,
): NormalizedAffinoClipboardFeature<TRow> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      useSystemClipboard: true,
      serializeRows: rows => JSON.stringify(rows),
      parseRows: text => {
        try {
          const parsed = JSON.parse(text)
          return Array.isArray(parsed) ? (parsed as readonly TRow[]) : []
        } catch {
          return []
        }
      },
    }
  }
  if (!input) {
    return {
      enabled: false,
      useSystemClipboard: true,
      serializeRows: rows => JSON.stringify(rows),
      parseRows: () => [],
    }
  }
  return {
    enabled: input.enabled ?? true,
    useSystemClipboard: input.useSystemClipboard ?? true,
    serializeRows: input.serializeRows ?? (rows => JSON.stringify(rows)),
    parseRows: input.parseRows ?? (() => []),
  }
}

export function useAffinoDataGridClipboardFeature<TRow>(
  options: UseAffinoDataGridClipboardFeatureOptions<TRow>,
): UseAffinoDataGridClipboardFeatureResult<TRow> {
  const clipboardEnabled = ref(options.feature.enabled)
  const clipboardBuffer = ref("")
  const lastCopiedText = computed(() => clipboardBuffer.value)

  const copyText = async (text: string): Promise<boolean> => {
    if (!clipboardEnabled.value) {
      return false
    }
    clipboardBuffer.value = text
    if (!options.feature.useSystemClipboard) {
      return true
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      }
      return true
    } catch {
      return false
    }
  }

  const readText = async (): Promise<string> => {
    if (!clipboardEnabled.value) {
      return ""
    }
    if (!options.feature.useSystemClipboard) {
      return clipboardBuffer.value
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        clipboardBuffer.value = text
        return text
      }
    } catch {
      // Ignore clipboard read failures and fall back to in-memory value.
    }

    return clipboardBuffer.value
  }

  const copyRows = async (rowsOverride?: readonly TRow[]): Promise<boolean> => {
    const payload = options.feature.serializeRows(rowsOverride ?? options.rows.value)
    return copyText(payload)
  }

  const parseRows = (text: string): readonly TRow[] => options.feature.parseRows(text)

  const resolveSelectedRows = (): readonly TRow[] => options.rows.value.filter((row, index) => (
    options.selectedRowKeySet.value.has(options.resolveRowKey(row, index))
  ))

  const copySelectedRows = async (): Promise<boolean> => copyRows(resolveSelectedRows())

  const removeSelectedRows = async (mutation: {
    intent: string
    label: string
  }): Promise<number> => {
    const selectedKeys = options.selectedRowKeySet.value
    if (!selectedKeys.size) {
      return 0
    }
    const nextRows = options.rows.value.filter((row, index) => !selectedKeys.has(options.resolveRowKey(row, index)))
    const affected = options.rows.value.length - nextRows.length
    if (affected <= 0) {
      return 0
    }
    const didReplace = await options.replaceRows(nextRows, {
      intent: mutation.intent,
      label: mutation.label,
      clearSelection: true,
    })
    if (!didReplace) {
      return 0
    }
    return affected
  }

  const clearSelectedRows = async (): Promise<number> => removeSelectedRows({
    intent: "clear",
    label: "Clear selected rows",
  })

  const cutSelectedRows = async (): Promise<number> => {
    const copied = await copySelectedRows()
    if (!copied) {
      return 0
    }
    return removeSelectedRows({
      intent: "cut",
      label: "Cut selected rows",
    })
  }

  const pasteRowsAppend = async (): Promise<number> => {
    const text = await readText()
    if (!text) {
      return 0
    }
    const parsedRows = parseRows(text)
    if (parsedRows.length === 0) {
      return 0
    }
    const nextRows = [...options.rows.value, ...parsedRows]
    const didReplace = await options.replaceRows(nextRows, {
      intent: "paste",
      label: "Paste rows append",
    })
    if (!didReplace) {
      return 0
    }
    return parsedRows.length
  }

  return {
    clipboardEnabled,
    lastCopiedText,
    copyText,
    readText,
    copyRows,
    parseRows,
    resolveSelectedRows,
    copySelectedRows,
    clearSelectedRows,
    cutSelectedRows,
    pasteRowsAppend,
  }
}

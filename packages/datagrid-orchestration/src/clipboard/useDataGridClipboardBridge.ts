import { readClipboardText, writeClipboardText } from "../internal/browserClipboard"
import type { DataGridWritableRef } from "../internal/dataGridWritableRef"

export interface DataGridClipboardRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface UseDataGridClipboardBridgeOptions<
  TRow,
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
> {
  copiedSelectionRange: DataGridWritableRef<TRange | null>
  lastCopiedPayload: DataGridWritableRef<string>
  resolveCopyRange: () => TRange | null
  getRowAtIndex: (rowIndex: number) => TRow | undefined
  getColumnKeyAtIndex: (columnIndex: number) => string | null
  getCellValue: (row: TRow, columnKey: string) => unknown
  setLastAction: (message: string) => void
  closeContextMenu: () => void
  copiedSelectionFlashMs?: number
  isColumnCopyable?: (columnKey: string) => boolean
  writeClipboardText?: (payload: string) => Promise<void>
  readClipboardText?: () => Promise<string>
}

export interface UseDataGridClipboardBridgeResult<
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
> {
  copySelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>
  readClipboardPayload: () => Promise<string>
  parseClipboardMatrix: (payload: string) => string[][]
  clearCopiedSelectionFlash: () => void
  flashCopiedSelection: (range: TRange) => void
  dispose: () => void
}

const DEFAULT_FLASH_MS = 1200
const FIELD_SEPARATOR = "\t"
const ROW_SEPARATOR = "\n"

function normalizeClipboardValue(value: unknown): string {
  if (typeof value === "undefined" || value === null) {
    return ""
  }
  return String(value)
}

export function serializeDataGridClipboardTsvField(value: unknown): string {
  const normalized = normalizeClipboardValue(value).replace(/\r\n/g, ROW_SEPARATOR).replace(/\r/g, ROW_SEPARATOR)
  if (
    normalized.includes(FIELD_SEPARATOR)
    || normalized.includes(ROW_SEPARATOR)
    || normalized.includes("\"")
  ) {
    return `"${normalized.replace(/"/g, "\"\"")}"`
  }
  return normalized
}

export function parseDataGridClipboardTsv(payload: string): string[][] {
  const normalized = payload.replace(/\r\n/g, ROW_SEPARATOR).replace(/\r/g, ROW_SEPARATOR)
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotedField = false
  let atFieldStart = true

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (inQuotedField) {
      if (char === "\"") {
        const next = normalized[index + 1]
        if (next === "\"") {
          field += "\""
          index += 1
        } else {
          inQuotedField = false
          atFieldStart = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === "\"" && atFieldStart) {
      inQuotedField = true
      atFieldStart = false
      continue
    }

    if (char === FIELD_SEPARATOR) {
      row.push(field)
      field = ""
      atFieldStart = true
      continue
    }

    if (char === ROW_SEPARATOR) {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      atFieldStart = true
      continue
    }

    field += char
    atFieldStart = false
  }

  row.push(field)
  rows.push(row)

  if (normalized.endsWith(ROW_SEPARATOR) && rows.length > 1) {
    const trailing = rows[rows.length - 1]
    if (trailing?.length === 1 && trailing[0] === "") {
      rows.pop()
    }
  }

  return rows.length ? rows : [[]]
}

export function useDataGridClipboardBridge<
  TRow,
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
>(
  options: UseDataGridClipboardBridgeOptions<TRow, TRange>,
): UseDataGridClipboardBridgeResult<TRange> {
  let copiedSelectionResetTimer: ReturnType<typeof setTimeout> | null = null

  const flashMs = Number.isFinite(options.copiedSelectionFlashMs)
    ? Math.max(0, Math.trunc(options.copiedSelectionFlashMs as number))
    : DEFAULT_FLASH_MS

  const canCopyColumn = options.isColumnCopyable ?? (columnKey => columnKey !== "select")

  function clearCopiedSelectionFlash() {
    options.copiedSelectionRange.value = null
    if (copiedSelectionResetTimer !== null) {
      clearTimeout(copiedSelectionResetTimer)
      copiedSelectionResetTimer = null
    }
  }

  function flashCopiedSelection(range: TRange) {
    options.copiedSelectionRange.value = { ...range } as TRange
    if (copiedSelectionResetTimer !== null) {
      clearTimeout(copiedSelectionResetTimer)
    }
    if (flashMs === 0) {
      return
    }
    copiedSelectionResetTimer = setTimeout(() => {
      options.copiedSelectionRange.value = null
      copiedSelectionResetTimer = null
    }, flashMs)
  }

  function buildCopyPayload(range: TRange): string {
    const rows: string[] = []
    for (let rowIndex = range.startRow; rowIndex <= range.endRow; rowIndex += 1) {
      const row = options.getRowAtIndex(rowIndex)
      if (!row) {
        continue
      }
      const cells: string[] = []
      for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
        const columnKey = options.getColumnKeyAtIndex(columnIndex)
        if (!columnKey || !canCopyColumn(columnKey)) {
          continue
        }
        cells.push(serializeDataGridClipboardTsvField(options.getCellValue(row, columnKey)))
      }
      rows.push(cells.join(FIELD_SEPARATOR))
    }
    return rows.join(ROW_SEPARATOR)
  }

  async function writeClipboardPayload(payload: string): Promise<void> {
    await writeClipboardText(payload, {
      writeClipboardText: options.writeClipboardText,
    })
  }

  async function copySelection(trigger: "keyboard" | "context-menu"): Promise<boolean> {
    const range = options.resolveCopyRange()
    if (!range) {
      options.setLastAction("Copy skipped: no active selection")
      return false
    }
    const payload = buildCopyPayload(range)
    if (!payload) {
      options.setLastAction("Copy skipped: empty selection")
      return false
    }
    let systemClipboardWritten = true
    try {
      await writeClipboardPayload(payload)
    } catch {
      systemClipboardWritten = false
    }
    options.lastCopiedPayload.value = payload
    flashCopiedSelection(range)
    options.closeContextMenu()
    const rows = range.endRow - range.startRow + 1
    const columns = range.endColumn - range.startColumn + 1
    options.setLastAction(
      systemClipboardWritten
        ? `Copied ${rows}x${columns} cells (${trigger})`
        : `Copied ${rows}x${columns} cells (${trigger}); system clipboard unavailable, using in-memory clipboard`,
    )
    return true
  }

  async function readClipboardPayload(): Promise<string> {
    try {
      const payload = await readClipboardText({
        readClipboardText: options.readClipboardText,
      })
      if (typeof payload === "string") {
        return payload
      }
    } catch {
      const fallback = options.lastCopiedPayload.value
      options.setLastAction(
        fallback
          ? "Paste using in-memory clipboard: system clipboard unavailable"
          : "Paste skipped: system clipboard unavailable and no in-memory clipboard payload",
      )
      return fallback
    }
    return options.lastCopiedPayload.value
  }

  function parseClipboardMatrix(payload: string): string[][] {
    return parseDataGridClipboardTsv(payload)
  }

  function dispose() {
    if (copiedSelectionResetTimer !== null) {
      clearTimeout(copiedSelectionResetTimer)
      copiedSelectionResetTimer = null
    }
  }

  return {
    copySelection,
    readClipboardPayload,
    parseClipboardMatrix,
    clearCopiedSelectionFlash,
    flashCopiedSelection,
    dispose,
  }
}

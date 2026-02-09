import type { DataGridWritableRef } from "./dataGridWritableRef"

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

function normalizeClipboardValue(value: unknown): string {
  if (typeof value === "undefined" || value === null) {
    return ""
  }
  return String(value)
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
        cells.push(normalizeClipboardValue(options.getCellValue(row, columnKey)))
      }
      rows.push(cells.join("\t"))
    }
    return rows.join("\n")
  }

  async function writeClipboardPayload(payload: string): Promise<void> {
    if (options.writeClipboardText) {
      await options.writeClipboardText(payload)
      return
    }
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(payload)
      return
    }
    throw new Error("Clipboard API unavailable")
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
    try {
      await writeClipboardPayload(payload)
    } catch {
      // Clipboard permissions can be unavailable in some environments.
    }
    options.lastCopiedPayload.value = payload
    flashCopiedSelection(range)
    options.closeContextMenu()
    const rows = range.endRow - range.startRow + 1
    const columns = range.endColumn - range.startColumn + 1
    options.setLastAction(`Copied ${rows}x${columns} cells (${trigger})`)
    return true
  }

  async function readClipboardPayload(): Promise<string> {
    if (options.readClipboardText) {
      try {
        const payload = await options.readClipboardText()
        if (typeof payload === "string") {
          return payload
        }
      } catch {
        // Fallback to in-memory payload.
      }
      return options.lastCopiedPayload.value
    }
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.readText === "function"
    ) {
      try {
        return await navigator.clipboard.readText()
      } catch {
        // Fallback to in-memory payload.
      }
    }
    return options.lastCopiedPayload.value
  }

  function parseClipboardMatrix(payload: string): string[][] {
    const normalized = payload.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const rows = normalized
      .split("\n")
      .filter(row => row.length > 0)
      .map(row => row.split("\t"))
    return rows.length ? rows : [[]]
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

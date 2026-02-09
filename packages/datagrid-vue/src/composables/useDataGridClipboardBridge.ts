import { onBeforeUnmount } from "vue"
import {
  useDataGridClipboardBridge as useDataGridClipboardBridgeCore,
  type DataGridClipboardRange,
  type UseDataGridClipboardBridgeOptions,
  type UseDataGridClipboardBridgeResult as DataGridClipboardBridgeCoreResult,
} from "@affino/datagrid-orchestration"

export type {
  DataGridClipboardRange,
  UseDataGridClipboardBridgeOptions,
}

export interface UseDataGridClipboardBridgeResult<
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
> {
  copySelection: (trigger: "keyboard" | "context-menu") => Promise<boolean>
  readClipboardPayload: () => Promise<string>
  parseClipboardMatrix: (payload: string) => string[][]
  clearCopiedSelectionFlash: () => void
  flashCopiedSelection: (range: TRange) => void
}

export function useDataGridClipboardBridge<
  TRow,
  TRange extends DataGridClipboardRange = DataGridClipboardRange,
>(
  options: UseDataGridClipboardBridgeOptions<TRow, TRange>,
): UseDataGridClipboardBridgeResult<TRange> {
  const bridge: DataGridClipboardBridgeCoreResult<TRange> = useDataGridClipboardBridgeCore(options)
  onBeforeUnmount(() => {
    bridge.dispose()
  })
  const { dispose: _dispose, ...result } = bridge
  return result
}

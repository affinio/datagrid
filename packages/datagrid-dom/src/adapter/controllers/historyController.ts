import type {
  DataGridApi,
  DataGridClientRowPatch,
  DataGridRowId,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import {
  useDataGridHistoryActionRunner,
  useDataGridIntentHistory,
  type DataGridIntentTransactionDescriptor,
} from "@affino/datagrid-orchestration"

type HistoryPatch<TRow> = Pick<DataGridClientRowPatch<TRow>, "rowId" | "data">

interface HistorySnapshot<TRow> {
  patches: readonly HistoryPatch<TRow>[]
  selection: DataGridSelectionSnapshot | null
}

export interface DomHistoryIntent<TRow> extends DataGridIntentTransactionDescriptor {
  before: HistorySnapshot<TRow>
  after: HistorySnapshot<TRow>
}

export function createDomHistoryController<TRow>(options: {
  grid: HTMLElement
  getApi: () => DataGridApi<TRow> | null
  runWithRenderBatch: (operation: () => Promise<void>) => Promise<void>
  commitInlineEdit: () => Promise<void>
  setLastAction: (message: string) => void
}) {
  const hasInlineEditor = (): boolean => options.grid.querySelector(".affino-grid-dom__editor") != null
  const history = useDataGridIntentHistory<HistorySnapshot<TRow>>({
    captureSnapshot: () => ({ patches: [], selection: null }),
    applySnapshot: async snapshot => {
      const api = options.getApi()
      if (!api) throw new Error("DataGrid runtime is not available for history replay.")
      await options.runWithRenderBatch(async () => {
        await api.rows.applyEdits(snapshot.patches, { source: "grid" })
        if (api.selection.hasSupport()) {
          if (snapshot.selection) api.selection.setSnapshot(snapshot.selection, { origin: "datagrid-dom-history" })
          else api.selection.clear({ origin: "datagrid-dom-history" })
        }
      })
      options.grid.focus({ preventScroll: true })
    },
  })

  const actionRunner = useDataGridHistoryActionRunner({
    hasInlineEditor,
    commitInlineEdit: () => { void options.commitInlineEdit() },
    closeContextMenu: () => undefined,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    runHistoryAction: history.runHistoryAction,
    setLastAction: options.setLastAction,
  })

  function recordIntent(intent: DomHistoryIntent<TRow>): Promise<string | null> {
    const { before, after, ...descriptor } = intent
    return history.recordIntentTransaction(
      descriptor,
      cloneHistorySnapshot(before),
      cloneHistorySnapshot(after),
    )
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return
    const key = event.key.toLowerCase()
    const direction = key === "z"
      ? event.shiftKey ? "redo" : "undo"
      : key === "y" && !event.shiftKey ? "redo" : null
    if (!direction) return
    event.preventDefault()

    void runHistoryAction(direction, "keyboard")
  }

  async function runHistoryAction(direction: "undo" | "redo", trigger: "keyboard" | "control"): Promise<boolean> {
    if (hasInlineEditor()) await options.commitInlineEdit()
    return actionRunner.runHistoryAction(direction, trigger)
  }

  return {
    transactionService: history.transactionService,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    recordIntent,
    onKeyDown,
    runHistoryAction,
    subscribeSnapshot: history.subscribeSnapshot,
  }
}

export function createHistorySnapshot<TRow>(
  patches: readonly HistoryPatch<TRow>[],
  selection: DataGridSelectionSnapshot | null,
): HistorySnapshot<TRow> {
  return { patches: patches.map(cloneHistoryPatch), selection }
}

export function createHistoryPatch<TRow>(
  rowId: DataGridRowId,
  data: Partial<TRow>,
): HistoryPatch<TRow> {
  return { rowId, data: { ...data } }
}

function cloneHistorySnapshot<TRow>(snapshot: HistorySnapshot<TRow>): HistorySnapshot<TRow> {
  return {
    patches: snapshot.patches.map(cloneHistoryPatch),
    selection: snapshot.selection,
  }
}

function cloneHistoryPatch<TRow>(patch: HistoryPatch<TRow>): HistoryPatch<TRow> {
  return { rowId: patch.rowId, data: { ...patch.data } }
}

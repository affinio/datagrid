import type {
  DataGridRowModelSnapshot,
  DataGridRowSelectionSnapshot,
  DataGridSelectionSnapshot,
} from "@affino/datagrid-core"
import { onBeforeUnmount } from "vue"

interface DataGridApiRowsChangedEvent<TRow = unknown> {
  snapshot: DataGridRowModelSnapshot<TRow>
}

interface DataGridApiSelectionChangedEvent {
  snapshot: DataGridSelectionSnapshot | null
}

interface DataGridApiRowSelectionChangedEvent {
  snapshot: DataGridRowSelectionSnapshot | null
}

export interface UseDataGridEventBridgeOptions<TRow = unknown> {
  grid: {
    api: {
      events: {
        on(event: "rows:changed", listener: (payload: DataGridApiRowsChangedEvent<TRow>) => void): () => void
        on(event: "selection:changed", listener: (payload: DataGridApiSelectionChangedEvent) => void): () => void
        on(event: "row-selection:changed", listener: (payload: DataGridApiRowSelectionChangedEvent) => void): () => void
      }
    }
    on(event: "row-select", listener: (payload?: unknown) => void): () => void
    on(event: "row-selection-change", listener: (payload?: unknown) => void): () => void
    on(event: "selection:changed", listener: (payload?: unknown) => void): () => void
  }
  emit: {
    (event: "cell-change", payload: DataGridApiRowsChangedEvent<TRow>): void
    (event: "selection-change", payload: DataGridApiSelectionChangedEvent): void
    (event: "row-selection-change", payload: DataGridApiRowSelectionChangedEvent): void
    (event: "row-select", payload?: unknown): void
  }
}

export function useDataGridEventBridge<TRow = unknown>(options: UseDataGridEventBridgeOptions<TRow>): void {
  const unsubs: Array<() => void> = []

  unsubs.push(options.grid.api.events.on("rows:changed", payload => {
    options.emit("cell-change", payload)
  }))

  unsubs.push(options.grid.api.events.on("selection:changed", payload => {
    options.emit("selection-change", payload)
  }))

  unsubs.push(options.grid.api.events.on("row-selection:changed", payload => {
    options.emit("row-selection-change", payload)
  }))

  unsubs.push(options.grid.on("row-select", payload => {
    options.emit("row-select", payload)
  }))

  unsubs.push(options.grid.on("row-selection-change", payload => {
    const candidate = payload as { snapshot?: DataGridApiRowSelectionChangedEvent["snapshot"] } | undefined
    options.emit("row-selection-change", {
      snapshot: candidate?.snapshot ?? null,
    })
  }))

  unsubs.push(options.grid.on("selection:changed", payload => {
    const candidate = payload as { snapshot?: DataGridApiSelectionChangedEvent["snapshot"] } | undefined
    options.emit("selection-change", {
      snapshot: candidate?.snapshot ?? null,
    })
  }))

  onBeforeUnmount(() => {
    for (const unsubscribe of unsubs) {
      unsubscribe()
    }
  })
}

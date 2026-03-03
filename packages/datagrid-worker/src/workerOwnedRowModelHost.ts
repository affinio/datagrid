import {
  createClientRowModel,
  type CreateClientRowModelOptions,
  type DataGridRowNodeInput,
} from "@affino/datagrid-core"
import type {
  DataGridWorkerMessageEvent,
  DataGridWorkerMessageSource,
  DataGridWorkerMessageTarget,
} from "./postMessageTransport.js"
import {
  createDataGridWorkerRowModelUpdateMessage,
  isDataGridWorkerRowModelCommandMessage,
  type DataGridWorkerRowModelCommand,
  type DataGridWorkerRowModelUpdatePayload,
} from "./workerOwnedRowModelProtocol.js"

export interface CreateDataGridWorkerOwnedRowModelHostOptions<T = unknown>
  extends Omit<CreateClientRowModelOptions<T>, "rows"> {
  rows?: readonly DataGridRowNodeInput<T>[]
  source: DataGridWorkerMessageSource
  target: DataGridWorkerMessageTarget
  channel?: string | null
}

export interface DataGridWorkerOwnedRowModelHost {
  dispose: () => void
}

function executeCommand<T>(
  model: ReturnType<typeof createClientRowModel<T>>,
  command: DataGridWorkerRowModelCommand<T>,
): void {
  switch (command.type) {
    case "sync":
      return
    case "set-rows": {
      const setRows = (model as unknown as {
        setRows?: (rows: readonly DataGridRowNodeInput<T>[]) => void
      }).setRows
      setRows?.(command.rows)
      return
    }
    case "patch-rows": {
      model.patchRows(command.updates, command.options)
      return
    }
    case "set-viewport-range":
      model.setViewportRange(command.range)
      return
    case "set-pagination":
      model.setPagination(command.pagination)
      return
    case "set-page-size":
      model.setPageSize(command.pageSize)
      return
    case "set-current-page":
      model.setCurrentPage(command.page)
      return
    case "set-sort-model":
      model.setSortModel(command.sortModel)
      return
    case "set-filter-model":
      model.setFilterModel(command.filterModel)
      return
    case "set-sort-and-filter-model":
      model.setSortAndFilterModel?.(command.input)
      return
    case "set-group-by":
      model.setGroupBy(command.groupBy)
      return
    case "set-pivot-model":
      model.setPivotModel(command.pivotModel)
      return
    case "set-aggregation-model":
      model.setAggregationModel(command.aggregationModel)
      return
    case "set-group-expansion":
      model.setGroupExpansion(command.expansion)
      return
    case "toggle-group":
      model.toggleGroup(command.groupKey)
      return
    case "expand-group":
      model.expandGroup(command.groupKey)
      return
    case "collapse-group":
      model.collapseGroup(command.groupKey)
      return
    case "expand-all-groups":
      model.expandAllGroups()
      return
    case "collapse-all-groups":
      model.collapseAllGroups()
      return
    case "refresh":
      model.refresh(command.reason)
      return
  }
}

export function createDataGridWorkerOwnedRowModelHost<T = unknown>(
  options: CreateDataGridWorkerOwnedRowModelHostOptions<T>,
): DataGridWorkerOwnedRowModelHost {
  const {
    source,
    target,
    channel,
    rows,
    ...clientRowModelOptions
  } = options
  const model = createClientRowModel<T>({
    ...clientRowModelOptions,
    rows: rows ?? [],
  })
  let disposed = false

  const emitUpdate = (requestId = 0): void => {
    if (disposed) {
      return
    }
    const snapshot = model.getSnapshot()
    const visibleRange = {
      start: snapshot.viewportRange.start,
      end: snapshot.viewportRange.end,
    }
    const visibleRows = model.getRowsInRange(visibleRange)
    const payload: DataGridWorkerRowModelUpdatePayload<T> = {
      snapshot,
      aggregationModel: model.getAggregationModel(),
      visibleRows,
      visibleRange,
    }
    const message = createDataGridWorkerRowModelUpdateMessage(
      requestId,
      payload,
      channel,
    )
    target.postMessage(message)
  }

  const onMessage = (event: DataGridWorkerMessageEvent): void => {
    if (disposed) {
      return
    }
    if (!isDataGridWorkerRowModelCommandMessage<T>(event.data, channel)) {
      return
    }
    const commandMessage = event.data
    executeCommand(model, commandMessage.payload)
    emitUpdate(commandMessage.requestId)
  }

  source.addEventListener("message", onMessage)
  emitUpdate(0)

  return {
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      source.removeEventListener("message", onMessage)
      model.dispose()
    },
  }
}

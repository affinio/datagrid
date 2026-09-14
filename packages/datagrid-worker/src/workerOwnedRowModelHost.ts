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
  DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION,
  createDataGridWorkerRowModelUpdateMessage,
  isDataGridWorkerRowModelCommandMessage,
  type DataGridWorkerRowModelCommand,
  type DataGridWorkerRowModelUpdatePayload,
  type DataGridWorkerVisibleRowDelta,
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
    case "register-formula-field":
      model.registerFormulaField?.(command.definition)
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
  let previousVisibleRange: { start: number; end: number } | null = null
  let previousVisibleRows: Readonly<ReturnType<typeof model.getRowsInRange>> = []

  const emitUpdate = (requestId = 0, error: unknown = null): void => {
    if (disposed) {
      return
    }
    const snapshot = model.getSnapshot()
    const visibleRange = {
      start: snapshot.viewportRange.start,
      end: snapshot.viewportRange.end,
    }
    const visibleRows = error ? [] : model.getRowsInRange(visibleRange)
    const canDelta = !error
      && previousVisibleRange?.start === visibleRange.start
      && previousVisibleRange.end === visibleRange.end
      && previousVisibleRows.length === visibleRows.length
    const visibleRowsDelta: DataGridWorkerVisibleRowDelta<T>[] = []
    if (canDelta) {
      for (let index = 0; index < visibleRows.length; index += 1) {
        if (previousVisibleRows[index] !== visibleRows[index]) {
          visibleRowsDelta.push({ index, row: visibleRows[index]! })
        }
      }
    }
    const useDelta = canDelta && visibleRowsDelta.length <= Math.max(1, Math.floor(visibleRows.length / 2))
    const payload: DataGridWorkerRowModelUpdatePayload<T> = {
      schemaVersion: DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION,
      snapshot: error
        ? {
          ...snapshot,
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }
        : snapshot,
      aggregationModel: model.getAggregationModel(),
      formulaFields: model.getFormulaFields?.() ?? [],
      formulaExecutionPlan: model.getFormulaExecutionPlan?.() ?? null,
      formulaComputeStageDiagnostics: model.getFormulaComputeStageDiagnostics?.() ?? null,
      visibleRows: useDelta ? [] : visibleRows,
      ...(useDelta ? { visibleRowsMode: "delta" as const, visibleRowsDelta } : { visibleRowsMode: "full" as const }),
      visibleRange,
    }
    previousVisibleRange = visibleRange
    previousVisibleRows = visibleRows
    const message = createDataGridWorkerRowModelUpdateMessage(
      requestId,
      payload,
      channel,
    )
    try {
      target.postMessage(message)
    } catch (postError) {
      // A row payload can fail structured cloning independently of command execution.
      // Retry once with a terminal, metadata-only snapshot so the request is observable.
      const reason = postError instanceof Error ? postError.message : String(postError)
      const safePayload: DataGridWorkerRowModelUpdatePayload<T> = {
        schemaVersion: DATAGRID_WORKER_ROW_MODEL_PAYLOAD_SCHEMA_VERSION,
        snapshot: {
          ...snapshot,
          loading: false,
          error: new Error(`[AffinoDataGrid worker] update dispatch failed: ${reason}`),
        },
        aggregationModel: null,
        formulaFields: [],
        formulaExecutionPlan: null,
        formulaComputeStageDiagnostics: null,
        visibleRows: [],
        visibleRowsMode: "full",
        visibleRange,
      }
      try {
        target.postMessage(createDataGridWorkerRowModelUpdateMessage(requestId, safePayload, channel))
      } catch {
        // If the transport itself is unavailable, there is no channel left for a reply.
      }
    }
  }

  const onMessage = (event: DataGridWorkerMessageEvent): void => {
    if (disposed) {
      return
    }
    if (!isDataGridWorkerRowModelCommandMessage<T>(event.data, channel)) {
      return
    }
    const commandMessage = event.data
    try {
      executeCommand(model, commandMessage.payload)
      emitUpdate(commandMessage.requestId)
    } catch (error) {
      emitUpdate(commandMessage.requestId, error)
    }
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

import type {
  DataGridClientComputeMode,
  DataGridColumnModel,
  DataGridRowModel,
} from "../models"
import type {
  DataGridApiCapabilities,
  DataGridApiMetaNamespace,
  DataGridApiProjectionMode,
  DataGridApiRuntimeInfo,
  DataGridApiSchemaSnapshot,
} from "./gridApiContracts"

export interface DataGridApiMetaMethods {
  getSchema: DataGridApiMetaNamespace["getSchema"]
  getRowModelKind: DataGridApiMetaNamespace["getRowModelKind"]
  getApiVersion: DataGridApiMetaNamespace["getApiVersion"]
  getProtocolVersion: DataGridApiMetaNamespace["getProtocolVersion"]
  getApiCapabilities: DataGridApiMetaNamespace["getCapabilities"]
  getRuntimeInfo: DataGridApiMetaNamespace["getRuntimeInfo"]
}

export interface CreateDataGridApiMetaMethodsInput<TRow = unknown> {
  rowModel: DataGridRowModel<TRow>
  columnModel: DataGridColumnModel
  lifecycleState: () => DataGridApiRuntimeInfo["lifecycleState"]
  getProjectionMode: () => DataGridApiProjectionMode
  getComputeMode: () => DataGridClientComputeMode | null
  getCapabilities: () => DataGridApiCapabilities
  getApiVersion: () => string
  getProtocolVersion: () => string
}

function cloneCapabilities(capabilities: DataGridApiCapabilities): DataGridApiCapabilities {
  return {
    patch: capabilities.patch,
    dataMutation: capabilities.dataMutation,
    backpressureControl: capabilities.backpressureControl,
    compute: capabilities.compute,
    selection: capabilities.selection,
    transaction: capabilities.transaction,
    histogram: capabilities.histogram,
    sortFilterBatch: capabilities.sortFilterBatch,
  }
}

export function createDataGridApiMetaMethods<TRow = unknown>(
  input: CreateDataGridApiMetaMethodsInput<TRow>,
): DataGridApiMetaMethods {
  const { rowModel, columnModel } = input

  return {
    getSchema() {
      const columnsSnapshot = columnModel.getSnapshot()
      const schema: DataGridApiSchemaSnapshot = {
        rowModelKind: rowModel.kind,
        columns: columnsSnapshot.columns.map(column => {
          const meta = column.column.meta
          const metaKeys = meta && typeof meta === "object"
            ? Object.keys(meta).sort((left, right) => left.localeCompare(right))
            : []
          return {
            key: column.key,
            label: typeof column.column.label === "string" && column.column.label.length > 0
              ? column.column.label
              : column.key,
            visible: column.visible,
            pin: column.pin,
            width: column.width,
            hasMeta: metaKeys.length > 0,
            metaKeys,
          }
        }),
      }
      return schema
    },
    getRowModelKind() {
      return rowModel.kind
    },
    getApiVersion() {
      return input.getApiVersion()
    },
    getProtocolVersion() {
      return input.getProtocolVersion()
    },
    getApiCapabilities() {
      return cloneCapabilities(input.getCapabilities())
    },
    getRuntimeInfo() {
      const snapshot = rowModel.getSnapshot()
      return {
        lifecycleState: input.lifecycleState(),
        apiVersion: input.getApiVersion(),
        protocolVersion: input.getProtocolVersion(),
        rowModelKind: rowModel.kind,
        rowCount: snapshot.rowCount,
        revision: typeof snapshot.revision === "number" ? snapshot.revision : null,
        loading: snapshot.loading,
        warming: snapshot.warming === true,
        viewportRange: snapshot.viewportRange,
        projectionMode: input.getProjectionMode(),
        computeMode: input.getComputeMode(),
      }
    },
  }
}

import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue"
import {
  createClientRowModel,
  type ClientRowModel,
  type CreateClientRowModelOptions,
  type DataGridRowModel,
  type DataGridRowNodeInput,
} from "@affino/datagrid-vue"

function getProjectionStageNow(): number {
  const performanceApi = globalThis.performance
  if (performanceApi && typeof performanceApi.now === "function") {
    return performanceApi.now()
  }
  return Date.now()
}

const defaultProjectionStageTimer: NonNullable<CreateClientRowModelOptions<unknown>["projectionStageTimer"]> = (_stage, run) => {
  const startedAt = getProjectionStageNow()
  const result = run()
  return {
    result,
    duration: Math.max(0, getProjectionStageNow() - startedAt),
  }
}

function resolveClientRowModelOptions(
  value: Omit<CreateClientRowModelOptions<unknown>, "rows"> | undefined,
): Omit<CreateClientRowModelOptions<unknown>, "rows"> {
  return {
    projectionStageTimer: defaultProjectionStageTimer,
    ...(value ?? {}),
  }
}

export interface UseDataGridAppRowModelOptions {
  rows: Ref<readonly unknown[]>
  rowModel: Ref<DataGridRowModel<unknown> | undefined>
  clientRowModelOptions: Ref<Omit<CreateClientRowModelOptions<unknown>, "rows"> | undefined>
  onOwnedRowModelRecreated?: () => void
}

export interface UseDataGridAppRowModelResult {
  dataGridInstanceKey: Ref<number>
  resolvedRowModel: Ref<DataGridRowModel<unknown>>
  disposeOwnedRowModel: (model: DataGridRowModel<unknown> | null) => void
}

export function useDataGridAppRowModel(
  options: UseDataGridAppRowModelOptions,
): UseDataGridAppRowModelResult {
  const dataGridInstanceKey = ref(0)
  const fallbackRowModel = createClientRowModel<unknown>()
  const internalRowModel = shallowRef<ClientRowModel<unknown> | null>(
    options.rowModel.value
      ? null
      : createClientRowModel<unknown>({
          rows: options.rows.value as readonly DataGridRowNodeInput<unknown>[],
          ...resolveClientRowModelOptions(options.clientRowModelOptions.value),
        }),
  )

  const disposeOwnedRowModel = (model: DataGridRowModel<unknown> | null): void => {
    if (!model || model === options.rowModel.value) {
      return
    }
    if ("dispose" in model && typeof model.dispose === "function") {
      model.dispose()
    }
  }

  const recreateInternalRowModel = (): void => {
    if (options.rowModel.value) {
      return
    }
    disposeOwnedRowModel(internalRowModel.value)
    internalRowModel.value = createClientRowModel<unknown>({
      rows: options.rows.value as readonly DataGridRowNodeInput<unknown>[],
      ...resolveClientRowModelOptions(options.clientRowModelOptions.value),
    })
    dataGridInstanceKey.value += 1
    options.onOwnedRowModelRecreated?.()
  }

  const resolvedRowModel = computed<DataGridRowModel<unknown>>(() => {
    return options.rowModel.value ?? internalRowModel.value ?? fallbackRowModel
  })

  watch(
    options.rows,
    nextRows => {
      if (!internalRowModel.value) {
        return
      }
      internalRowModel.value.setRows(nextRows as readonly DataGridRowNodeInput<unknown>[])
    },
    { deep: false },
  )

  watch(
    options.clientRowModelOptions,
    () => {
      recreateInternalRowModel()
    },
    { deep: true },
  )

  watch(
    options.rowModel,
    nextRowModel => {
      if (nextRowModel) {
        disposeOwnedRowModel(internalRowModel.value)
        internalRowModel.value = null
        dataGridInstanceKey.value += 1
        return
      }
      if (!internalRowModel.value) {
        recreateInternalRowModel()
      }
    },
  )

  onBeforeUnmount(() => {
    disposeOwnedRowModel(internalRowModel.value)
    disposeOwnedRowModel(fallbackRowModel)
  })

  return {
    dataGridInstanceKey,
    resolvedRowModel,
    disposeOwnedRowModel,
  }
}

import { computed, type Ref } from "vue"
import type { DataGridAppMode } from "./index"

export interface UseDataGridAppModeMetaOptions {
  mode: Ref<DataGridAppMode>
}

export interface UseDataGridAppModeMetaResult {
  modeBadge: Ref<string>
  modeHint: Ref<string>
}

export function useDataGridAppModeMeta(
  options: UseDataGridAppModeMetaOptions,
): UseDataGridAppModeMetaResult {
  const modeBadge = computed(() => {
    if (options.mode.value === "tree") {
      return "Tree"
    }
    if (options.mode.value === "pivot") {
      return "Pivot"
    }
    if (options.mode.value === "worker") {
      return "Worker"
    }
    return "Base"
  })

  const modeHint = computed(() => {
    if (options.mode.value === "tree") {
      return "Tree mode: grouped path rows are highlighted."
    }
    if (options.mode.value === "pivot") {
      return "Pivot mode: aggregate/group rows are highlighted."
    }
    if (options.mode.value === "worker") {
      return "Worker mode: row-model updates are served through worker host."
    }
    return "Base mode: flat client row model."
  })

  return {
    modeBadge,
    modeHint,
  }
}

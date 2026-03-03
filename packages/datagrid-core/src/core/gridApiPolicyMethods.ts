import type { DataGridApiProjectionMode } from "./gridApiContracts"

export interface DataGridApiPolicyMethods {
  getProjectionMode: () => DataGridApiProjectionMode
  setProjectionMode: (mode: DataGridApiProjectionMode) => DataGridApiProjectionMode
}

export interface CreateDataGridApiPolicyMethodsInput {
  getProjectionMode: () => DataGridApiProjectionMode
  setProjectionMode: (mode: DataGridApiProjectionMode) => void
}

function normalizeProjectionMode(mode: DataGridApiProjectionMode): DataGridApiProjectionMode {
  if (mode === "mutable" || mode === "immutable" || mode === "excel-like") {
    return mode
  }
  return "excel-like"
}

export function createDataGridApiPolicyMethods(
  input: CreateDataGridApiPolicyMethodsInput,
): DataGridApiPolicyMethods {
  return {
    getProjectionMode() {
      return input.getProjectionMode()
    },
    setProjectionMode(mode: DataGridApiProjectionMode) {
      const normalized = normalizeProjectionMode(mode)
      input.setProjectionMode(normalized)
      return input.getProjectionMode()
    },
  }
}

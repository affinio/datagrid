import type {
  DataGridClientComputeDiagnostics,
  DataGridClientComputeMode,
} from "../models"
import {
  assertComputeCapability,
  type DataGridComputeCapability,
} from "./gridApiCapabilities"

export interface DataGridApiComputeMethods {
  hasComputeSupport: () => boolean
  getComputeMode: () => DataGridClientComputeMode | null
  switchComputeMode: (mode: DataGridClientComputeMode) => boolean
  getComputeDiagnostics: () => DataGridClientComputeDiagnostics | null
}

export interface CreateDataGridApiComputeMethodsInput {
  getComputeCapability: () => DataGridComputeCapability | null
}

export function createDataGridApiComputeMethods(
  input: CreateDataGridApiComputeMethodsInput,
): DataGridApiComputeMethods {
  const { getComputeCapability } = input

  return {
    hasComputeSupport() {
      return getComputeCapability() !== null
    },
    getComputeMode() {
      const capability = getComputeCapability()
      if (!capability) {
        return null
      }
      return capability.getComputeMode()
    },
    switchComputeMode(mode: DataGridClientComputeMode) {
      const capability = assertComputeCapability(getComputeCapability())
      return capability.switchComputeMode(mode)
    },
    getComputeDiagnostics() {
      const capability = getComputeCapability()
      if (!capability) {
        return null
      }
      return capability.getComputeDiagnostics()
    },
  }
}

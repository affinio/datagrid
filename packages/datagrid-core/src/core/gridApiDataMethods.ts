import type {
  DataGridBackpressureControlCapability,
} from "./gridApiCapabilities"
import {
  assertBackpressureControlCapability,
} from "./gridApiCapabilities"

export interface DataGridApiDataMethods {
  hasBackpressureControlSupport: () => boolean
  pauseBackpressure: () => boolean
  resumeBackpressure: () => boolean
  flushBackpressure: () => Promise<void>
}

export interface CreateDataGridApiDataMethodsInput {
  getBackpressureControlCapability: () => DataGridBackpressureControlCapability | null
}

export function createDataGridApiDataMethods(
  input: CreateDataGridApiDataMethodsInput,
): DataGridApiDataMethods {
  const { getBackpressureControlCapability } = input
  return {
    hasBackpressureControlSupport() {
      return getBackpressureControlCapability() !== null
    },
    pauseBackpressure() {
      const capability = assertBackpressureControlCapability(getBackpressureControlCapability())
      return capability.pauseBackpressure()
    },
    resumeBackpressure() {
      const capability = assertBackpressureControlCapability(getBackpressureControlCapability())
      return capability.resumeBackpressure()
    },
    async flushBackpressure() {
      const capability = assertBackpressureControlCapability(getBackpressureControlCapability())
      await capability.flushBackpressure()
    },
  }
}

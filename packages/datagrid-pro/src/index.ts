import {
  clearProLicense,
  getProLicenseState,
  hasProLicense,
  registerProLicense,
  type DataGridProLicenseState,
} from "@affino/datagrid"

export interface EnableProFeaturesOptions {
  licenseKey: string
  source?: string
}

export class DataGridProLicenseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DataGridProLicenseError"
  }
}

export function enableProFeatures(
  options: EnableProFeaturesOptions,
): DataGridProLicenseState {
  if (!options || typeof options !== "object") {
    throw new DataGridProLicenseError("[DataGrid Pro] enableProFeatures(options) expects an object with licenseKey.")
  }
  const source = typeof options.source === "string" && options.source.trim().length > 0
    ? options.source.trim()
    : "datagrid-pro"
  try {
    return registerProLicense(options.licenseKey, source)
  } catch (error) {
    if (error instanceof Error) {
      throw new DataGridProLicenseError(error.message)
    }
    throw error
  }
}

export function disableProFeatures(): void {
  clearProLicense()
}

export function isProFeaturesEnabled(): boolean {
  return hasProLicense()
}

export function assertProFeaturesEnabled(): void {
  if (isProFeaturesEnabled()) {
    return
  }
  throw new DataGridProLicenseError(
    "[DataGrid Pro] Pro features are not enabled. Call enableProFeatures({ licenseKey }) first.",
  )
}

export {
  getProLicenseState,
}

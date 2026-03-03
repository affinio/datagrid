export interface DataGridProLicenseState {
  licenseKey: string
  source: string
  activatedAt: string
}

const DATAGRID_PRO_LICENSE_SYMBOL = Symbol.for("affino.datagrid.pro-license")

function readGlobalLicenseState(): DataGridProLicenseState | null {
  const scope = globalThis as Record<PropertyKey, unknown>
  const raw = scope[DATAGRID_PRO_LICENSE_SYMBOL]
  if (!raw || typeof raw !== "object") {
    return null
  }
  const candidate = raw as Partial<DataGridProLicenseState>
  if (
    typeof candidate.licenseKey !== "string" ||
    typeof candidate.source !== "string" ||
    typeof candidate.activatedAt !== "string"
  ) {
    return null
  }
  return {
    licenseKey: candidate.licenseKey,
    source: candidate.source,
    activatedAt: candidate.activatedAt,
  }
}

export function normalizeDataGridLicenseKey(licenseKey: string | null | undefined): string | null {
  if (typeof licenseKey !== "string") {
    return null
  }
  const normalized = licenseKey.trim()
  if (normalized.length < 8) {
    return null
  }
  return normalized
}

export function registerProLicense(
  licenseKey: string,
  source = "runtime",
): DataGridProLicenseState {
  const normalized = normalizeDataGridLicenseKey(licenseKey)
  if (!normalized) {
    throw new Error('[DataGrid] Pro license key must be a non-empty string with at least 8 characters.')
  }
  const nextState: DataGridProLicenseState = Object.freeze({
    licenseKey: normalized,
    source: source.trim().length > 0 ? source.trim() : "runtime",
    activatedAt: new Date().toISOString(),
  })
  const scope = globalThis as Record<PropertyKey, unknown>
  scope[DATAGRID_PRO_LICENSE_SYMBOL] = nextState
  return nextState
}

export function clearProLicense(): void {
  const scope = globalThis as Record<PropertyKey, unknown>
  delete scope[DATAGRID_PRO_LICENSE_SYMBOL]
}

export function getProLicenseState(): DataGridProLicenseState | null {
  return readGlobalLicenseState()
}

export function hasProLicense(
  input: {
    licenseKey?: string | null
  } = {},
): boolean {
  const inline = normalizeDataGridLicenseKey(input.licenseKey ?? null)
  if (inline) {
    return true
  }
  return getProLicenseState() !== null
}

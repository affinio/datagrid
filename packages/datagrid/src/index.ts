import {
  createDataGridApi as createCoreDataGridApi,
  type CreateDataGridApiOptions,
  type DataGridApi,
} from "@affino/datagrid-core"
import {
  createDataGridVueRuntime,
  type CreateDataGridVueRuntimeOptions,
  type DataGridVueRuntime,
} from "@affino/datagrid-vue"
import {
  createCommunityApiFacade,
  DataGridProFeatureRequiredError,
  DATAGRID_COMMUNITY_BLOCKED_FEATURES,
} from "./communityApiFacade"
import {
  clearProLicense,
  getProLicenseState,
  hasProLicense,
  normalizeDataGridLicenseKey,
  registerProLicense,
  type DataGridProLicenseState,
} from "./license"

export {
  DataGrid,
  AffinoDataGridSimple,
  useAffinoDataGridMinimal,
} from "@affino/datagrid-vue"

export {
  createClientRowModel,
  createDataGridColumnModel,
  createDataGridCore,
  createDataGridSelectionSummary,
} from "@affino/datagrid-core"

export type {
  CreateClientRowModelOptions,
  CreateDataGridColumnModelOptions,
  CreateDataGridCoreOptions,
  DataGridApi,
  DataGridColumnDef,
  DataGridRowModelKind,
  DataGridRowNode,
  DataGridRowNodeInput,
  DataGridSelectionSummarySnapshot,
  DataGridSortState,
  DataGridFilterSnapshot,
  DataGridGroupBySpec,
  DataGridPivotSpec,
  DataGridClientRowPatch,
} from "@affino/datagrid-core"

export type DataGridCommercialTier = "community" | "pro"

export interface CreateDataGridApiCommercialOptions<TRow = unknown>
  extends CreateDataGridApiOptions<TRow> {
  licenseKey?: string | null
}

export interface CreateDataGridRuntimeOptions<TRow = unknown>
  extends CreateDataGridVueRuntimeOptions<TRow> {
  licenseKey?: string | null
}

export interface DataGridRuntime<TRow = unknown> extends DataGridVueRuntime<TRow> {}

export function resolveDataGridTier(
  input: {
    licenseKey?: string | null
  } = {},
): DataGridCommercialTier {
  return hasProLicense(input) ? "pro" : "community"
}

function resolveLicenseInput(licenseKey: string | null | undefined): string | null {
  const normalized = normalizeDataGridLicenseKey(licenseKey ?? null)
  if (!normalized) {
    return null
  }
  registerProLicense(normalized, "inline")
  return normalized
}

export function createDataGridApi<TRow = unknown>(
  options: CreateDataGridApiCommercialOptions<TRow>,
): DataGridApi<TRow> {
  const { licenseKey, ...coreOptions } = options
  const inlineLicense = resolveLicenseInput(licenseKey ?? null)
  const api = createCoreDataGridApi(coreOptions)
  if (inlineLicense || resolveDataGridTier() === "pro") {
    return api
  }
  return createCommunityApiFacade(api)
}

export function createDataGridRuntime<TRow = unknown>(
  options: CreateDataGridRuntimeOptions<TRow>,
): DataGridRuntime<TRow> {
  const { licenseKey, ...runtimeOptions } = options
  const inlineLicense = resolveLicenseInput(licenseKey ?? null)
  const runtime = createDataGridVueRuntime(runtimeOptions)
  if (inlineLicense || resolveDataGridTier() === "pro") {
    return runtime
  }
  runtime.api = createCommunityApiFacade(runtime.api)
  return runtime
}

export {
  DataGridProFeatureRequiredError,
  DATAGRID_COMMUNITY_BLOCKED_FEATURES,
  registerProLicense,
  clearProLicense,
  hasProLicense,
  getProLicenseState,
}

export type {
  DataGridProLicenseState,
}

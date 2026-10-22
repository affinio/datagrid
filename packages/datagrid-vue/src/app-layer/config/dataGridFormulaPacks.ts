import {
  listDataGridFormulaPackNames,
  type DataGridFormulaPackName,
} from "@affino/datagrid-formula-engine"

export interface DataGridFormulaPacksOptions {
  enabled: boolean
  packs: readonly DataGridFormulaPackName[]
}

export type DataGridFormulaPacksProp =
  | boolean
  | readonly DataGridFormulaPackName[]
  | {
      enabled?: boolean
      packs?: readonly DataGridFormulaPackName[]
    }
  | null

type DataGridFormulaPacksConfig = Exclude<DataGridFormulaPacksProp, boolean | readonly DataGridFormulaPackName[] | null>

export function resolveDataGridFormulaPacks(
  input: DataGridFormulaPacksProp | undefined,
): DataGridFormulaPacksOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      packs: input ? listDataGridFormulaPackNames() : [],
    }
  }
  if (Array.isArray(input)) {
    return {
      enabled: input.length > 0,
      packs: input,
    }
  }
  if (!input) {
    return {
      enabled: false,
      packs: [],
    }
  }

  const options = input as DataGridFormulaPacksConfig
  const packs = options.packs ?? listDataGridFormulaPackNames()
  return {
    enabled: options.enabled ?? true,
    packs,
  }
}

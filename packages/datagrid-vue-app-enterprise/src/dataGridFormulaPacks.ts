import {
  listDataGridEnterpriseFormulaPackNames,
  type DataGridEnterpriseFormulaPackName,
} from "@affino/datagrid-formula-engine-enterprise"

export interface DataGridFormulaPacksOptions {
  enabled: boolean
  packs: readonly DataGridEnterpriseFormulaPackName[]
}

export type DataGridFormulaPacksProp =
  | boolean
  | readonly DataGridEnterpriseFormulaPackName[]
  | {
      enabled?: boolean
      packs?: readonly DataGridEnterpriseFormulaPackName[]
    }
  | null

type DataGridFormulaPacksConfig = Exclude<DataGridFormulaPacksProp, boolean | readonly DataGridEnterpriseFormulaPackName[] | null>

export function resolveDataGridFormulaPacks(
  input: DataGridFormulaPacksProp | undefined,
): DataGridFormulaPacksOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      packs: input ? listDataGridEnterpriseFormulaPackNames() : [],
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
  const packs = options.packs ?? listDataGridEnterpriseFormulaPackNames()
  return {
    enabled: options.enabled ?? true,
    packs,
  }
}

import {
  coerceFormulaValueToNumber,
  isFormulaValueBlank,
  type DataGridComputedFieldComputeContext,
  type DataGridFormulaFunctionDefinition,
  type DataGridFormulaFunctionRegistry,
  type DataGridFormulaScalarValue,
  type DataGridFormulaValue,
} from "@affino/datagrid-formula-engine"

export type DataGridEnterpriseFormulaPackName = "finance"

type DataGridFormulaFunctionRegistryEntry =
  | DataGridFormulaFunctionDefinition
  | ((args: readonly DataGridFormulaValue[], context?: DataGridComputedFieldComputeContext<unknown>) => unknown)

function expandFormulaValue(value: DataGridFormulaValue | undefined): readonly DataGridFormulaScalarValue[] {
  if (Array.isArray(value)) {
    return value
  }
  return [(value ?? null) as DataGridFormulaScalarValue]
}

function resolveFallback(value: DataGridFormulaValue | undefined, fallback: number): number {
  return isFormulaValueBlank(value ?? null) ? fallback : coerceFormulaValueToNumber(value ?? null)
}

export const DATAGRID_FINANCE_FORMULA_FUNCTIONS = Object.freeze({
  SAFE_DIVIDE: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const denominator = coerceFormulaValueToNumber(args[1] ?? null)
      if (denominator === 0) {
        return resolveFallback(args[2], 0)
      }
      return coerceFormulaValueToNumber(args[0] ?? null) / denominator
    },
  },
  PERCENT_DELTA: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const previous = coerceFormulaValueToNumber(args[1] ?? null)
      if (previous === 0) {
        return resolveFallback(args[2], 0)
      }
      const current = coerceFormulaValueToNumber(args[0] ?? null)
      return ((current - previous) / Math.abs(previous)) * 100
    },
  },
  CLAMP: {
    arity: 3,
    compute: args => {
      const value = coerceFormulaValueToNumber(args[0] ?? null)
      const firstBound = coerceFormulaValueToNumber(args[1] ?? null)
      const secondBound = coerceFormulaValueToNumber(args[2] ?? null)
      const min = Math.min(firstBound, secondBound)
      const max = Math.max(firstBound, secondBound)
      return Math.min(max, Math.max(min, value))
    },
  },
  WEIGHTED_AVG: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const values = expandFormulaValue(args[0])
      const weights = expandFormulaValue(args[1])
      const limit = Math.min(values.length, weights.length)
      let weightedSum = 0
      let totalWeight = 0

      for (let index = 0; index < limit; index += 1) {
        const value = coerceFormulaValueToNumber(values[index] ?? null)
        const weight = coerceFormulaValueToNumber(weights[index] ?? null)
        weightedSum += value * weight
        totalWeight += weight
      }

      if (totalWeight === 0) {
        return resolveFallback(args[2], 0)
      }
      return weightedSum / totalWeight
    },
  },
}) satisfies Readonly<Record<string, DataGridFormulaFunctionDefinition>>

export const DATAGRID_ENTERPRISE_FORMULA_PACKS = Object.freeze({
  finance: DATAGRID_FINANCE_FORMULA_FUNCTIONS,
}) satisfies Readonly<Record<DataGridEnterpriseFormulaPackName, DataGridFormulaFunctionRegistry>>

const DATAGRID_ENTERPRISE_FORMULA_PACK_NAMES = Object.freeze(
  Object.keys(DATAGRID_ENTERPRISE_FORMULA_PACKS) as DataGridEnterpriseFormulaPackName[],
)

export function listDataGridEnterpriseFormulaPackNames(): readonly DataGridEnterpriseFormulaPackName[] {
  return DATAGRID_ENTERPRISE_FORMULA_PACK_NAMES
}

export function mergeDataGridFormulaFunctionRegistries(
  ...registries: readonly (DataGridFormulaFunctionRegistry | null | undefined)[]
): DataGridFormulaFunctionRegistry {
  const merged: Record<string, DataGridFormulaFunctionRegistryEntry> = {}

  for (const registry of registries) {
    if (!registry) {
      continue
    }
    Object.assign(merged, registry)
  }

  return Object.freeze(merged)
}

export function resolveDataGridEnterpriseFormulaFunctions(
  packNames: readonly DataGridEnterpriseFormulaPackName[] | null | undefined = DATAGRID_ENTERPRISE_FORMULA_PACK_NAMES,
): DataGridFormulaFunctionRegistry {
  if (!packNames || packNames.length === 0) {
    return Object.freeze({})
  }

  return mergeDataGridFormulaFunctionRegistries(
    ...packNames.map(packName => DATAGRID_ENTERPRISE_FORMULA_PACKS[packName]),
  )
}

import {
  type DataGridFormulaValue,
  type DataGridFormulaScalarValue,
  areFormulaValuesEqual,
  coerceFormulaValueToNumber,
  compareFormulaValues,
} from "../values.js"
import {
  collectFilteredValues,
  collectFormulaTableRelatedValues,
  collectFormulaTableValues,
  collectValuesFromArgs,
  computeAverage,
  createFormulaTableContextKey,
  defineFormulaFunctions,
  expandFormulaValue,
  type FormulaCriterionEntry,
  formulaValueMatchesCriterion,
  normalizeFormulaTableName,
  resolveFormulaLiteralText,
  stringifyFormulaScalarValue,
  toDistinctFormulaValues,
  toNumericFormulaValues,
} from "../functionHelpers.js"
function resolveFormulaRelationAggregateMethod(value: DataGridFormulaValue): string {
  if (Array.isArray(value)) {
    return resolveFormulaRelationAggregateMethod(value[0] ?? "")
  }
  return String(value ?? "").trim().toLowerCase()
}

function computeFormulaRelationRollupValue(
  values: readonly DataGridFormulaScalarValue[],
  methodValue: DataGridFormulaValue,
  emptyValue: DataGridFormulaValue | undefined,
): DataGridFormulaValue {
  const method = resolveFormulaRelationAggregateMethod(methodValue)
  switch (method) {
    case "count":
      return values.length
    case "sum":
      return toNumericFormulaValues(values).reduce((sum, value) => sum + value, 0)
    case "avg":
    case "average":
      return computeAverage(values)
    case "min":
      if (values.length === 0) {
        return emptyValue ?? 0
      }
      return [...values].sort((left, right) => compareFormulaValues(left, right))[0] ?? (emptyValue ?? 0)
    case "max":
      if (values.length === 0) {
        return emptyValue ?? 0
      }
      return [...values].sort((left, right) => compareFormulaValues(right, left))[0] ?? (emptyValue ?? 0)
    case "join":
      return values
        .map(value => stringifyFormulaScalarValue(value))
        .filter(value => value.length > 0)
        .join(", ")
    case "first":
    default:
      return values[0] ?? (emptyValue ?? null)
  }
}

export const DATAGRID_ADVANCED_FORMULA_FUNCTIONS = defineFormulaFunctions({
  ARRAY: {
    compute: args => Object.freeze([...collectValuesFromArgs(args)]),
  },
  AVERAGEIF: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const criteriaRange = expandFormulaValue(args[0] ?? null)
      const criterion = args[1] ?? null
      const averageRange = expandFormulaValue(args[2] ?? args[0] ?? null)
      return computeAverage(collectFilteredValues(averageRange, [{ range: criteriaRange, criterion }]))
    },
  },
  CHOOSE: {
    arity: { min: 2 },
    compute: args => {
      const index = Math.trunc(coerceFormulaValueToNumber(args[0] ?? null))
      if (index < 1 || index >= args.length) {
        return 0
      }
      return args[index] ?? 0
    },
  },
  COLLECT: {
    arity: { min: 3 },
    compute: args => {
      const values = expandFormulaValue(args[0] ?? null)
      const criteria: FormulaCriterionEntry[] = []
      for (let index = 1; index < args.length; index += 2) {
        criteria.push({
          range: expandFormulaValue(args[index] ?? null),
          criterion: (args[index + 1] ?? null) as DataGridFormulaValue,
        })
      }
      return Object.freeze([...collectFilteredValues(values, criteria)])
    },
  },
  COUNTIFS: {
    arity: { min: 2 },
    compute: args => {
      const firstRange = expandFormulaValue(args[0] ?? null)
      const criteria: FormulaCriterionEntry[] = []
      for (let index = 0; index < args.length; index += 2) {
        criteria.push({
          range: expandFormulaValue(args[index] ?? null),
          criterion: (args[index + 1] ?? null) as DataGridFormulaValue,
        })
      }
      return collectFilteredValues(firstRange, criteria).length
    },
  },
  DISTINCT: {
    arity: 1,
    compute: args => toDistinctFormulaValues(expandFormulaValue(args[0] ?? null)),
  },
  INDEX: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const source = expandFormulaValue(args[0] ?? null)
      const index = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      if (index < 1 || index > source.length) {
        return args[2] ?? 0
      }
      return source[index - 1] ?? (args[2] ?? 0)
    },
  },
  MATCH: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const needle = args[0] ?? null
      const haystack = expandFormulaValue(args[1] ?? null)
      const matchMode = Math.trunc(coerceFormulaValueToNumber(args[2] ?? 0))
      if (matchMode !== 0) {
        return 0
      }
      for (let index = 0; index < haystack.length; index += 1) {
        if (areFormulaValuesEqual(needle, haystack[index] ?? null)) {
          return index + 1
        }
      }
      return 0
    },
  },
  RANGE: {
    compute: args => Object.freeze([...collectValuesFromArgs(args)]),
  },
  SUMIF: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const criteriaRange = expandFormulaValue(args[0] ?? null)
      const criterion = args[1] ?? null
      const sumRange = expandFormulaValue(args[2] ?? args[0] ?? null)
      return toNumericFormulaValues(collectFilteredValues(sumRange, [{ range: criteriaRange, criterion }]))
        .reduce((sum, value) => sum + value, 0)
    },
  },
  SUMIFS: {
    arity: { min: 3 },
    compute: args => {
      const sumRange = expandFormulaValue(args[0] ?? null)
      const criteria: FormulaCriterionEntry[] = []
      for (let index = 1; index < args.length; index += 2) {
        criteria.push({
          range: expandFormulaValue(args[index] ?? null),
          criterion: (args[index + 1] ?? null) as DataGridFormulaValue,
        })
      }
      return toNumericFormulaValues(collectFilteredValues(sumRange, criteria))
        .reduce((sum, value) => sum + value, 0)
    },
  },
  TABLE: {
    arity: { min: 1, max: 2 },
    requiresRuntimeContext: true,
    resolveContextKeys: (args) => {
      const literalTableName = resolveFormulaLiteralText(args[0])
      return [literalTableName ? createFormulaTableContextKey(literalTableName) : "tables"]
    },
    compute: (args, context) => {
      const tableName = normalizeFormulaTableName(args[0] ?? null)
      if (tableName.length === 0) {
        return Object.freeze([])
      }
      return collectFormulaTableValues(
        context?.getContextValue?.(createFormulaTableContextKey(tableName)),
        args[1],
      )
    },
  },
  RELATED: {
    arity: { min: 4, max: 5 },
    requiresRuntimeContext: true,
    resolveContextKeys: (args) => {
      const literalTableName = resolveFormulaLiteralText(args[0])
      return [literalTableName ? createFormulaTableContextKey(literalTableName) : "tables"]
    },
    compute: (args, context) => {
      const tableName = normalizeFormulaTableName(args[0] ?? null)
      if (tableName.length === 0) {
        return args[4] ?? null
      }
      const values = collectFormulaTableRelatedValues(
        context?.getContextValue?.(createFormulaTableContextKey(tableName)),
        args[2],
        args[1] ?? null,
        args[3],
      )
      return values[0] ?? (args[4] ?? null)
    },
  },
  ROLLUP: {
    arity: { min: 5, max: 6 },
    requiresRuntimeContext: true,
    resolveContextKeys: (args) => {
      const literalTableName = resolveFormulaLiteralText(args[0])
      return [literalTableName ? createFormulaTableContextKey(literalTableName) : "tables"]
    },
    compute: (args, context) => {
      const tableName = normalizeFormulaTableName(args[0] ?? null)
      if (tableName.length === 0) {
        return args[5] ?? 0
      }
      const values = collectFormulaTableRelatedValues(
        context?.getContextValue?.(createFormulaTableContextKey(tableName)),
        args[1],
        args[2] ?? null,
        args[3],
      )
      return computeFormulaRelationRollupValue(values, args[4] ?? "first", args[5])
    },
  },
  XLOOKUP: {
    arity: { min: 3, max: 5 },
    compute: args => {
      const needle = args[0] ?? null
      const lookupValues = expandFormulaValue(args[1] ?? null)
      const returnValues = expandFormulaValue(args[2] ?? null)
      const notFound = args[3] ?? 0
      const matchMode = Math.trunc(coerceFormulaValueToNumber(args[4] ?? 0))
      if (matchMode !== 0) {
        return notFound
      }
      for (let index = 0; index < lookupValues.length; index += 1) {
        if (areFormulaValuesEqual(needle, lookupValues[index] ?? null)) {
          return returnValues[index] ?? notFound
        }
      }
      return notFound
    },
  },
  COUNTIF: {
    arity: 2,
    compute: args => expandFormulaValue(args[0] ?? null)
      .filter(value => formulaValueMatchesCriterion(value, args[1] ?? null)).length,
  },
  VLOOKUP: {
    arity: { min: 3, max: 4 },
    compute: args => {
      const needle = args[0] ?? null
      const lookupValues = expandFormulaValue(args[1] ?? null)
      const columnNumber = Math.trunc(coerceFormulaValueToNumber(args[2] ?? null))
      const exact = Math.trunc(coerceFormulaValueToNumber(args[3] ?? 0)) === 0
      if (!exact || columnNumber !== 1) {
        return 0
      }
      return lookupValues.find(value => areFormulaValuesEqual(value, needle)) ?? 0
    },
  },
})

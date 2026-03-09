import {
  type DataGridFormulaValue,
  areFormulaValuesEqual,
  coerceFormulaValueToNumber,
} from "../values.js"
import {
  collectFilteredValues,
  collectValuesFromArgs,
  computeAverage,
  defineFormulaFunctions,
  expandFormulaValue,
  type FormulaCriterionEntry,
  formulaValueMatchesCriterion,
  toDistinctFormulaValues,
  toNumericFormulaValues,
} from "../functionHelpers.js"

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

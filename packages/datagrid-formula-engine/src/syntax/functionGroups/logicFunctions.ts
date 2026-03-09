import {
  areFormulaValuesEqual,
  coerceFormulaValueToBoolean,
  isFormulaErrorValue,
  isFormulaValueBlank,
} from "../values.js"
import {
  booleanResult,
  defaultIfEmpty,
  defineFormulaFunctions,
  expandFormulaArgs,
  expandFormulaValue,
  formulaValueMatchesCriterion,
  normalizeTextSearch,
} from "../functionHelpers.js"

export const DATAGRID_LOGIC_FORMULA_FUNCTIONS = defineFormulaFunctions({
  AND: {
    arity: { min: 1 },
    compute: args => booleanResult(args.every(value => coerceFormulaValueToBoolean(value ?? null))),
  },
  CONTAINS: {
    arity: 2,
    compute: args => {
      const needle = normalizeTextSearch(args[0] ?? null)
      if (needle.length === 0) {
        return false
      }
      return expandFormulaValue(args[1] ?? null)
        .some(value => normalizeTextSearch(value).includes(needle))
    },
  },
  HAS: {
    arity: 2,
    compute: args => expandFormulaValue(args[0] ?? null)
      .some(value => areFormulaValuesEqual(value, args[1] ?? null)),
  },
  IF: {
    arity: 3,
    compute: args => (coerceFormulaValueToBoolean(args[0] ?? null) ? args[1] ?? 0 : args[2] ?? 0),
  },
  IFERROR: {
    arity: 2,
    compute: args => (isFormulaErrorValue(args[0] ?? null) ? args[1] ?? 0 : args[0] ?? 0),
  },
  IFS: {
    arity: { min: 2 },
    compute: args => {
      for (let index = 0; index < args.length; index += 2) {
        if (coerceFormulaValueToBoolean(args[index] ?? null)) {
          return args[index + 1] ?? 0
        }
      }
      return 0
    },
  },
  COALESCE: {
    arity: { min: 1 },
    compute: args => {
      for (const value of args) {
        if (!isFormulaValueBlank(value ?? null)) {
          return value
        }
      }
      return 0
    },
  },
  IN: {
    arity: { min: 2 },
    compute: args => expandFormulaArgs(args.slice(1)).some(value => areFormulaValuesEqual(args[0] ?? null, value)) ? 1 : 0,
  },
  ISBLANK: {
    arity: 1,
    compute: args => isFormulaValueBlank(args[0] ?? null),
  },
  ISBOOLEAN: {
    arity: 1,
    compute: args => typeof defaultIfEmpty(args[0], null) === "boolean",
  },
  ISDATE: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      if (Array.isArray(value)) {
        return value[0] instanceof Date
      }
      return value instanceof Date
    },
  },
  ISERROR: {
    arity: 1,
    compute: args => isFormulaErrorValue(args[0] ?? null),
  },
  ISEVEN: {
    arity: 1,
    compute: args => {
      const value = Number(args[0] ?? 0)
      return Number.isInteger(value) && value % 2 === 0
    },
  },
  ISNUMBER: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      if (Array.isArray(value)) {
        return typeof value[0] === "number"
      }
      return typeof value === "number"
    },
  },
  ISODD: {
    arity: 1,
    compute: args => {
      const value = Number(args[0] ?? 0)
      return Number.isInteger(value) && Math.abs(value % 2) === 1
    },
  },
  ISTEXT: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      if (Array.isArray(value)) {
        return typeof value[0] === "string"
      }
      return typeof value === "string"
    },
  },
  NOT: {
    arity: 1,
    compute: args => !coerceFormulaValueToBoolean(args[0] ?? null),
  },
  OR: {
    arity: { min: 1 },
    compute: args => args.some(value => coerceFormulaValueToBoolean(value ?? null)),
  },
  COUNTIF: {
    arity: 2,
    compute: args => expandFormulaValue(args[0] ?? null)
      .filter(value => formulaValueMatchesCriterion(value, args[1] ?? null)).length,
  },
})

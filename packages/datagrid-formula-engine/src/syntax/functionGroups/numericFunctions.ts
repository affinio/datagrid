import {
  coerceFormulaValueToNumber,
} from "../values.js"
import {
  collectValuesFromArgs,
  computeAverage,
  computeMedian,
  computePercentile,
  computeStdDev,
  countPresentValues,
  defineFormulaFunctions,
  expandFormulaArgs,
  expandFormulaValue,
  toNumericFormulaValues,
} from "../functionHelpers.js"

function ceilToMultiple(value: number, multiple: number): number {
  if (!Number.isFinite(multiple) || multiple === 0) {
    return 0
  }
  const significance = Math.abs(multiple)
  return Math.sign(value || 1) * Math.ceil(Math.abs(value) / significance) * significance
}

function floorToMultiple(value: number, multiple: number): number {
  if (!Number.isFinite(multiple) || multiple === 0) {
    return 0
  }
  const significance = Math.abs(multiple)
  if (value >= 0) {
    return Math.floor(value / significance) * significance
  }
  return -Math.floor(Math.abs(value) / significance) * significance
}

function roundToMultiple(value: number, multiple: number): number {
  if (!Number.isFinite(multiple) || multiple === 0) {
    return 0
  }
  const significance = Math.abs(multiple)
  return Math.round(value / significance) * significance
}

export const DATAGRID_NUMERIC_FORMULA_FUNCTIONS = defineFormulaFunctions({
  ABS: {
    arity: 1,
    compute: args => Math.abs(coerceFormulaValueToNumber(args[0] ?? null)),
  },
  AVG: {
    compute: args => computeAverage(expandFormulaArgs(args)),
  },
  AVERAGE: {
    compute: args => computeAverage(expandFormulaArgs(args)),
  },
  AVGW: {
    arity: 2,
    compute: args => {
      const values = toNumericFormulaValues(expandFormulaValue(args[0] ?? null))
      const weights = toNumericFormulaValues(expandFormulaValue(args[1] ?? null))
      const length = Math.min(values.length, weights.length)
      if (length === 0) {
        return 0
      }
      let weightedTotal = 0
      let weightTotal = 0
      for (let index = 0; index < length; index += 1) {
        const weight = weights[index] ?? 0
        weightedTotal += (values[index] ?? 0) * weight
        weightTotal += weight
      }
      return weightTotal === 0 ? 0 : weightedTotal / weightTotal
    },
  },
  CEIL: {
    arity: { min: 1, max: 2 },
    compute: args => ceilToMultiple(
      coerceFormulaValueToNumber(args[0] ?? null),
      Math.abs(coerceFormulaValueToNumber(args[1] ?? 1)),
    ),
  },
  CEILING: {
    arity: { min: 1, max: 2 },
    compute: args => ceilToMultiple(
      coerceFormulaValueToNumber(args[0] ?? null),
      Math.abs(coerceFormulaValueToNumber(args[1] ?? 1)),
    ),
  },
  CHAR: {
    arity: 1,
    compute: args => String.fromCharCode(Math.trunc(coerceFormulaValueToNumber(args[0] ?? null))),
  },
  COUNT: {
    compute: args => countPresentValues(expandFormulaArgs(args)),
  },
  COUNTM: {
    compute: args => countPresentValues(expandFormulaArgs(args)),
  },
  DECTOHEX: {
    arity: 1,
    compute: args => Math.trunc(coerceFormulaValueToNumber(args[0] ?? null)).toString(16).toUpperCase(),
  },
  FLOOR: {
    arity: { min: 1, max: 2 },
    compute: args => floorToMultiple(
      coerceFormulaValueToNumber(args[0] ?? null),
      Math.abs(coerceFormulaValueToNumber(args[1] ?? 1)),
    ),
  },
  HEXTODEC: {
    arity: 1,
    compute: args => {
      const raw = String(args[0] ?? "").trim()
      if (raw.length === 0) {
        return 0
      }
      const parsed = Number.parseInt(raw, 16)
      return Number.isFinite(parsed) ? parsed : 0
    },
  },
  INT: {
    arity: 1,
    compute: args => Math.trunc(coerceFormulaValueToNumber(args[0] ?? null)),
  },
  LARGE: {
    arity: 2,
    compute: args => {
      const values = [...toNumericFormulaValues(expandFormulaValue(args[0] ?? null))].sort((left, right) => right - left)
      const rank = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      return rank < 1 || rank > values.length ? 0 : (values[rank - 1] ?? 0)
    },
  },
  MAX: {
    compute: args => {
      const values = toNumericFormulaValues(expandFormulaArgs(args))
      return values.length === 0 ? 0 : Math.max(...values)
    },
  },
  MEDIAN: {
    compute: args => computeMedian(expandFormulaArgs(args)),
  },
  MIN: {
    compute: args => {
      const values = toNumericFormulaValues(expandFormulaArgs(args))
      return values.length === 0 ? 0 : Math.min(...values)
    },
  },
  MOD: {
    arity: 2,
    compute: args => {
      const left = coerceFormulaValueToNumber(args[0] ?? null)
      const right = coerceFormulaValueToNumber(args[1] ?? null)
      return right === 0 ? 0 : left % right
    },
  },
  MROUND: {
    arity: 2,
    compute: args => roundToMultiple(
      coerceFormulaValueToNumber(args[0] ?? null),
      Math.abs(coerceFormulaValueToNumber(args[1] ?? null)),
    ),
  },
  NPV: {
    arity: { min: 2 },
    compute: args => {
      const rate = coerceFormulaValueToNumber(args[0] ?? null)
      const cashFlows = toNumericFormulaValues(collectValuesFromArgs(args, 1))
      return cashFlows.reduce((sum, value, index) => sum + (value / ((1 + rate) ** (index + 1))), 0)
    },
  },
  PERCENTILE: {
    arity: 2,
    compute: args => computePercentile(
      expandFormulaValue(args[0] ?? null),
      coerceFormulaValueToNumber(args[1] ?? null),
    ),
  },
  POW: {
    arity: 2,
    compute: args => Math.pow(
      coerceFormulaValueToNumber(args[0] ?? null),
      coerceFormulaValueToNumber(args[1] ?? null),
    ),
  },
  RANKAVG: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const target = coerceFormulaValueToNumber(args[0] ?? null)
      const values = [...toNumericFormulaValues(expandFormulaValue(args[1] ?? null))]
      const descending = coerceFormulaValueToNumber(args[2] ?? 0) !== 1
      const sorted = [...values].sort((left, right) => descending ? right - left : left - right)
      const matchingRanks = sorted
        .map((value, index) => (value === target ? index + 1 : null))
        .filter((value): value is number => value !== null)
      if (matchingRanks.length === 0) {
        return 0
      }
      return matchingRanks.reduce((sum, value) => sum + value, 0) / matchingRanks.length
    },
  },
  RANKEQ: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const target = coerceFormulaValueToNumber(args[0] ?? null)
      const values = [...toNumericFormulaValues(expandFormulaValue(args[1] ?? null))]
      const descending = coerceFormulaValueToNumber(args[2] ?? 0) !== 1
      const sorted = [...values].sort((left, right) => descending ? right - left : left - right)
      const rank = sorted.findIndex(value => value === target)
      return rank < 0 ? 0 : rank + 1
    },
  },
  ROUND: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const value = coerceFormulaValueToNumber(args[0] ?? null)
      const digits = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      const factor = 10 ** Math.abs(digits)
      if (digits >= 0) {
        return Math.round(value * factor) / factor
      }
      return Math.round(value / factor) * factor
    },
  },
  ROUNDDOWN: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const value = coerceFormulaValueToNumber(args[0] ?? null)
      const digits = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      const factor = 10 ** Math.abs(digits)
      if (digits >= 0) {
        return Math.trunc(value * factor) / factor
      }
      return Math.trunc(value / factor) * factor
    },
  },
  ROUNDUP: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const value = coerceFormulaValueToNumber(args[0] ?? null)
      const digits = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      const factor = 10 ** Math.abs(digits)
      if (digits >= 0) {
        return Math.sign(value || 1) * Math.ceil(Math.abs(value) * factor) / factor
      }
      return Math.sign(value || 1) * Math.ceil(Math.abs(value) / factor) * factor
    },
  },
  SMALL: {
    arity: 2,
    compute: args => {
      const values = [...toNumericFormulaValues(expandFormulaValue(args[0] ?? null))].sort((left, right) => left - right)
      const rank = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      return rank < 1 || rank > values.length ? 0 : (values[rank - 1] ?? 0)
    },
  },
  STDEVA: {
    compute: args => computeStdDev(expandFormulaArgs(args), "sample"),
  },
  STDEVP: {
    compute: args => computeStdDev(expandFormulaArgs(args), "population"),
  },
  STDEVPA: {
    compute: args => computeStdDev(expandFormulaArgs(args), "population"),
  },
  STDEVS: {
    compute: args => computeStdDev(expandFormulaArgs(args), "sample"),
  },
  SUM: {
    compute: args => toNumericFormulaValues(expandFormulaArgs(args)).reduce((sum, value) => sum + value, 0),
  },
  UNICHAR: {
    arity: 1,
    compute: args => String.fromCodePoint(Math.trunc(coerceFormulaValueToNumber(args[0] ?? null))),
  },
})

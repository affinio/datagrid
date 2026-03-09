import {
  coerceFormulaValueToNumber,
} from "../values.js"
import {
  addCalendarDays,
  addWorkingDays,
  coerceFormulaValueToDate,
  countDaysBetween,
  countWorkingDays,
  defineFormulaFunctions,
  normalizeHolidayTimes,
  parseTimeLikeValue,
} from "../functionHelpers.js"

function stripTime(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function resolveWeekNumber(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1)
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.floor((current - startOfYear) / 86_400_000 / 7) + 1
}

export const DATAGRID_DATE_FORMULA_FUNCTIONS = defineFormulaFunctions({
  DATE: {
    arity: 3,
    compute: args => {
      const year = Math.trunc(coerceFormulaValueToNumber(args[0] ?? null))
      const month = Math.trunc(coerceFormulaValueToNumber(args[1] ?? null))
      const day = Math.trunc(coerceFormulaValueToNumber(args[2] ?? null))
      return new Date(Date.UTC(year, month - 1, day))
    },
  },
  DATEONLY: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? stripTime(date) : null
    },
  },
  DAY: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCDate() : 0
    },
  },
  MONTH: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCMonth() + 1 : 0
    },
  },
  NETDAYS: {
    arity: 2,
    compute: args => {
      const start = coerceFormulaValueToDate(args[0] ?? null)
      const end = coerceFormulaValueToDate(args[1] ?? null)
      if (!start || !end) {
        return 0
      }
      return countDaysBetween(start, end, false)
    },
  },
  NETWORKDAY: {
    arity: { min: 2 },
    compute: args => {
      const start = coerceFormulaValueToDate(args[0] ?? null)
      const end = coerceFormulaValueToDate(args[1] ?? null)
      if (!start || !end) {
        return 0
      }
      return countWorkingDays(start, end, normalizeHolidayTimes(args.slice(2)))
    },
  },
  NETWORKDAYS: {
    arity: { min: 2 },
    compute: args => {
      const start = coerceFormulaValueToDate(args[0] ?? null)
      const end = coerceFormulaValueToDate(args[1] ?? null)
      if (!start || !end) {
        return 0
      }
      return countWorkingDays(start, end, normalizeHolidayTimes(args.slice(2)))
    },
  },
  TIME: {
    arity: { min: 1, max: 3 },
    compute: args => parseTimeLikeValue(args[0] ?? null),
  },
  TODAY: {
    arity: { min: 0, max: 1 },
    compute: args => {
      const now = new Date()
      const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const offset = Math.trunc(coerceFormulaValueToNumber(args[0] ?? 0))
      return addCalendarDays(base, offset)
    },
  },
  WEEKDAY: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCDay() + 1 : 0
    },
  },
  WEEKNUMBER: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? resolveWeekNumber(date) : 0
    },
  },
  WORKDAY: {
    arity: { min: 2 },
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      if (!date) {
        return null
      }
      return addWorkingDays(date, coerceFormulaValueToNumber(args[1] ?? 0), normalizeHolidayTimes(args.slice(2)))
    },
  },
  YEAR: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      return date ? date.getUTCFullYear() : 0
    },
  },
  YEARDAY: {
    arity: 1,
    compute: args => {
      const date = coerceFormulaValueToDate(args[0] ?? null)
      if (!date) {
        return 0
      }
      const start = Date.UTC(date.getUTCFullYear(), 0, 1)
      const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      return Math.floor((current - start) / 86_400_000) + 1
    },
  },
})

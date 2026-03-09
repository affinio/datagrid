import type {
  DataGridFormulaFunctionDefinition,
} from "./analysis.js"
import type {
  DataGridFormulaScalarValue,
  DataGridFormulaValue,
} from "../coreTypes.js"
import {
  areFormulaValuesEqual,
  compareFormulaValues,
  coerceFormulaValueToBoolean,
  coerceFormulaValueToNumber,
  isFormulaErrorValue,
  isFormulaValuePresent,
} from "./values.js"

export type {
  DataGridFormulaFunctionDefinition,
}

export interface FormulaCriterionEntry {
  range: readonly DataGridFormulaScalarValue[]
  criterion: DataGridFormulaValue
}

export function defineFormulaFunctions(
  entries: Readonly<Record<string, DataGridFormulaFunctionDefinition>>,
): Readonly<Record<string, DataGridFormulaFunctionDefinition>> {
  return entries
}

function coerceFormulaValueToScalar(value: DataGridFormulaValue): DataGridFormulaScalarValue {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value as DataGridFormulaScalarValue
}

export function expandFormulaValue(value: DataGridFormulaValue): readonly DataGridFormulaScalarValue[] {
  if (Array.isArray(value)) {
    return value
  }
  return [value as DataGridFormulaScalarValue]
}

export function expandFormulaArgs(args: readonly DataGridFormulaValue[]): readonly DataGridFormulaScalarValue[] {
  const expanded: DataGridFormulaScalarValue[] = []
  for (const value of args) {
    expanded.push(...expandFormulaValue(value))
  }
  return expanded
}

export function coerceFormulaValueToDate(value: DataGridFormulaValue): Date | null {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (scalarValue === null) {
    return null
  }
  if (isFormulaErrorValue(scalarValue)) {
    return null
  }
  if (scalarValue instanceof Date) {
    return Number.isNaN(scalarValue.getTime()) ? null : scalarValue
  }
  if (typeof scalarValue === "number") {
    if (!Number.isFinite(scalarValue)) {
      return null
    }
    const date = new Date(scalarValue)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof scalarValue === "string") {
    const text = scalarValue.trim()
    if (text.length === 0) {
      return null
    }
    const timestamp = Date.parse(text)
    if (!Number.isFinite(timestamp)) {
      return null
    }
    const date = new Date(timestamp)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

export function stringifyFormulaScalarValue(value: DataGridFormulaScalarValue): string {
  if (value === null) {
    return ""
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString()
  }
  if (isFormulaErrorValue(value)) {
    return value.message
  }
  return String(value)
}

export function flattenFormulaValuesToStrings(values: readonly DataGridFormulaValue[]): readonly string[] {
  return expandFormulaArgs(values).map(value => stringifyFormulaScalarValue(value))
}

function tryCoerceComparableNumber(value: DataGridFormulaValue): number | null {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (scalarValue === null) {
    return null
  }
  if (isFormulaErrorValue(scalarValue)) {
    return null
  }
  if (typeof scalarValue === "number") {
    return Number.isFinite(scalarValue) ? scalarValue : 0
  }
  if (typeof scalarValue === "boolean") {
    return scalarValue ? 1 : 0
  }
  if (scalarValue instanceof Date) {
    return Number.isNaN(scalarValue.getTime()) ? null : scalarValue.getTime()
  }
  const text = scalarValue.trim()
  if (text.length === 0) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeCriterionOperand(text: string): string {
  const trimmed = text.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function formulaValueMatchesCriterion(
  candidate: DataGridFormulaValue,
  criterion: DataGridFormulaValue,
): boolean {
  if (typeof criterion !== "string") {
    return areFormulaValuesEqual(candidate, criterion)
  }

  const trimmedCriterion = criterion.trim()
  const match = /^(<=|>=|<>|!=|=|<|>)(.*)$/.exec(trimmedCriterion)
  const operator = match?.[1] ?? "="
  const rawOperand = normalizeCriterionOperand(match?.[2] ?? trimmedCriterion)
  const operandValue: DataGridFormulaValue = rawOperand

  if (operator === "=" && !match) {
    return areFormulaValuesEqual(candidate, operandValue)
  }

  if (operator === "=" || operator === "<>" || operator === "!=") {
    const equals = areFormulaValuesEqual(candidate, operandValue)
    return operator === "=" ? equals : !equals
  }

  const compared = (() => {
    const left = tryCoerceComparableNumber(candidate)
    const right = tryCoerceComparableNumber(operandValue)
    if (left !== null && right !== null) {
      return left - right
    }
    const candidateDate = coerceFormulaValueToDate(candidate)
    const operandDate = coerceFormulaValueToDate(operandValue)
    if (candidateDate && operandDate) {
      return candidateDate.getTime() - operandDate.getTime()
    }
    return compareFormulaValues(candidate, operandValue)
  })()

  switch (operator) {
    case ">":
      return compared > 0
    case ">=":
      return compared >= 0
    case "<":
      return compared < 0
    case "<=":
      return compared <= 0
    default:
      return false
  }
}

export function collectFilteredValues(
  values: readonly DataGridFormulaScalarValue[],
  criteria: ReadonlyArray<{ range: readonly DataGridFormulaScalarValue[]; criterion: DataGridFormulaValue }>,
): readonly DataGridFormulaScalarValue[] {
  const filtered: DataGridFormulaScalarValue[] = []
  for (let index = 0; index < values.length; index += 1) {
    const matches = criteria.every(({ range, criterion }) => formulaValueMatchesCriterion(range[index] ?? null, criterion))
    if (matches) {
      filtered.push(values[index] ?? null)
    }
  }
  return filtered
}

export function toDistinctFormulaValues(values: readonly DataGridFormulaScalarValue[]): readonly DataGridFormulaScalarValue[] {
  const distinct: DataGridFormulaScalarValue[] = []
  for (const value of values) {
    if (distinct.some(entry => areFormulaValuesEqual(entry, value))) {
      continue
    }
    distinct.push(value)
  }
  return Object.freeze(distinct)
}

export function toNumericFormulaValues(values: readonly DataGridFormulaScalarValue[]): readonly number[] {
  return values.map(value => coerceFormulaValueToNumber(value ?? null))
}

export function toStrictNumericFormulaValues(values: readonly DataGridFormulaScalarValue[]): readonly number[] {
  const numeric: number[] = []
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      numeric.push(value)
      continue
    }
    if (typeof value === "boolean") {
      numeric.push(value ? 1 : 0)
      continue
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      numeric.push(value.getTime())
    }
  }
  return numeric
}

export function computeAverage(values: readonly DataGridFormulaScalarValue[]): number {
  if (values.length === 0) {
    return 0
  }
  const numeric = toNumericFormulaValues(values)
  const total = numeric.reduce((sum, value) => sum + value, 0)
  return total / numeric.length
}

export function computeMedian(values: readonly DataGridFormulaScalarValue[]): number {
  const numeric = [...toNumericFormulaValues(values)].sort((left, right) => left - right)
  if (numeric.length === 0) {
    return 0
  }
  const middle = Math.floor(numeric.length / 2)
  if (numeric.length % 2 === 0) {
    return (numeric[middle - 1] + numeric[middle]) / 2
  }
  return numeric[middle] ?? 0
}

export function computePercentile(values: readonly DataGridFormulaScalarValue[], percentile: number): number {
  const numeric = [...toNumericFormulaValues(values)].sort((left, right) => left - right)
  if (numeric.length === 0) {
    return 0
  }
  const clampedPercentile = Math.max(0, Math.min(1, percentile))
  const position = (numeric.length - 1) * clampedPercentile
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  if (lowerIndex === upperIndex) {
    return numeric[lowerIndex] ?? 0
  }
  const lower = numeric[lowerIndex] ?? 0
  const upper = numeric[upperIndex] ?? lower
  const weight = position - lowerIndex
  return lower + (upper - lower) * weight
}

function computeVariance(values: readonly number[], mode: "sample" | "population"): number {
  if (values.length === 0 || (mode === "sample" && values.length < 2)) {
    return 0
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const squared = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0)
  return squared / (mode === "sample" ? values.length - 1 : values.length)
}

export function computeStdDev(values: readonly DataGridFormulaScalarValue[], mode: "sample" | "population"): number {
  const numeric = toNumericFormulaValues(values)
  return Math.sqrt(computeVariance(numeric, mode))
}

export function isWeekday(date: Date): boolean {
  const day = date.getUTCDay()
  return day !== 0 && day !== 6
}

export function normalizeHolidayTimes(values: readonly DataGridFormulaValue[]): ReadonlySet<number> {
  const holidayTimes = new Set<number>()
  for (const value of values) {
    for (const entry of expandFormulaValue(value)) {
      const date = coerceFormulaValueToDate(entry)
      if (!date) {
        continue
      }
      holidayTimes.add(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    }
  }
  return holidayTimes
}

function stripUtcTime(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function addCalendarDays(date: Date, days: number): Date {
  const next = stripUtcTime(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function countDaysBetween(start: Date, end: Date, inclusive: boolean): number {
  const left = stripUtcTime(start)
  const right = stripUtcTime(end)
  const diff = Math.round((right.getTime() - left.getTime()) / 86_400_000)
  return inclusive ? diff + 1 : diff
}

export function countWorkingDays(start: Date, end: Date, holidays: ReadonlySet<number>): number {
  const direction = start.getTime() <= end.getTime() ? 1 : -1
  let cursor = stripUtcTime(start)
  const target = stripUtcTime(end)
  let count = 0
  while ((direction > 0 && cursor.getTime() <= target.getTime()) || (direction < 0 && cursor.getTime() >= target.getTime())) {
    const time = cursor.getTime()
    if (isWeekday(cursor) && !holidays.has(time)) {
      count += direction
    }
    cursor = addCalendarDays(cursor, direction)
  }
  return count
}

export function addWorkingDays(start: Date, days: number, holidays: ReadonlySet<number>): Date {
  let remaining = Math.trunc(days)
  let cursor = stripUtcTime(start)
  const direction = remaining >= 0 ? 1 : -1
  while (remaining !== 0) {
    cursor = addCalendarDays(cursor, direction)
    const time = cursor.getTime()
    if (isWeekday(cursor) && !holidays.has(time)) {
      remaining -= direction
    }
  }
  return cursor
}

export function countPresentValues(values: readonly DataGridFormulaScalarValue[]): number {
  return values.reduce<number>((count, value) => (isFormulaValuePresent(value ?? null) ? count + 1 : count), 0)
}

export function booleanResult(value: boolean): boolean {
  return value
}

export function normalizeTextSearch(value: DataGridFormulaValue): string {
  const scalar = coerceFormulaValueToScalar(value)
  if (scalar === null || isFormulaErrorValue(scalar)) {
    return ""
  }
  return String(scalar).toLowerCase()
}

export function collectValuesFromArgs(args: readonly DataGridFormulaValue[], startIndex = 0): readonly DataGridFormulaScalarValue[] {
  return expandFormulaArgs(args.slice(startIndex))
}

export function defaultIfEmpty<T>(value: T | undefined, fallback: T): T {
  return typeof value === "undefined" ? fallback : value
}

export function parseTimeLikeValue(value: DataGridFormulaValue): Date | null {
  const scalar = coerceFormulaValueToScalar(value)
  if (scalar === null || isFormulaErrorValue(scalar)) {
    return null
  }
  if (scalar instanceof Date) {
    return Number.isNaN(scalar.getTime()) ? null : scalar
  }
  if (typeof scalar === "number") {
    const date = new Date(scalar)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const text = String(scalar).trim()
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (!match) {
    return coerceFormulaValueToDate(text)
  }
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null
  }
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds))
}

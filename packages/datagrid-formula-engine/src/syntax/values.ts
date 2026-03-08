import type {
  DataGridFormulaRuntimeErrorCode,
  DataGridFormulaRuntimeError,
  DataGridFormulaErrorValue,
  DataGridFormulaScalarValue,
  DataGridFormulaArrayValue,
  DataGridFormulaValue,
} from "../coreTypes.js"
import type {
  DataGridFormulaRuntimeErrorPolicy,
} from "./analysis.js"
import {
  DataGridFormulaEvaluationError,
} from "./ast.js"

export type {
  DataGridFormulaRuntimeErrorPolicy,
} from "./analysis.js"

export type {
  DataGridFormulaRuntimeErrorCode,
  DataGridFormulaRuntimeError,
  DataGridFormulaErrorValue,
  DataGridFormulaScalarValue,
  DataGridFormulaArrayValue,
  DataGridFormulaValue,
} from "../coreTypes.js"

export function isFormulaErrorValue(value: unknown): value is DataGridFormulaErrorValue {
  return typeof value === "object"
    && value !== null
    && (value as { kind?: unknown }).kind === "error"
    && typeof (value as { code?: unknown }).code === "string"
    && typeof (value as { message?: unknown }).message === "string"
}

export function isFormulaArrayValue(value: unknown): value is DataGridFormulaArrayValue {
  return Array.isArray(value)
}

export function createFormulaErrorValue(
  input: Pick<DataGridFormulaRuntimeError, "code" | "message">,
): DataGridFormulaErrorValue {
  return {
    kind: "error",
    code: input.code,
    message: input.message,
  }
}

function throwForFormulaErrorValue(value: DataGridFormulaErrorValue): never {
  throw new DataGridFormulaEvaluationError({
    code: value.code,
    message: value.message,
  })
}

export function findFormulaErrorValue(
  values: readonly DataGridFormulaValue[],
): DataGridFormulaErrorValue | null {
  for (const value of values) {
    if (isFormulaErrorValue(value)) {
      return value
    }
  }
  return null
}

function normalizeFormulaScalarValue(value: unknown): DataGridFormulaScalarValue {
  if (value === null || typeof value === "undefined") {
    return null
  }
  if (isFormulaErrorValue(value)) {
    return value
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return value
  }
  if (typeof value === "bigint") {
    return Number(value)
  }
  return null
}

function normalizeFormulaArrayValue(value: readonly unknown[]): DataGridFormulaArrayValue {
  const normalized: DataGridFormulaScalarValue[] = []
  for (const entry of value) {
    if (Array.isArray(entry)) {
      normalized.push(...normalizeFormulaArrayValue(entry))
      continue
    }
    normalized.push(normalizeFormulaScalarValue(entry))
  }
  return Object.freeze(normalized)
}

function coerceFormulaValueToScalar(value: DataGridFormulaValue): DataGridFormulaScalarValue {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return value as DataGridFormulaScalarValue
}

function coerceFormulaValueToStrictNumber(value: DataGridFormulaValue): number | null {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (scalarValue === null) {
    return null
  }
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
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

export function normalizeFormulaValue(value: unknown): DataGridFormulaValue {
  if (Array.isArray(value)) {
    return normalizeFormulaArrayValue(value)
  }
  return normalizeFormulaScalarValue(value)
}

export function isFormulaValueBlank(value: DataGridFormulaValue): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 || value.every(item => item === null)
  }
  return value === null
}

export function isFormulaValueEmptyText(value: DataGridFormulaValue): boolean {
  return typeof value === "string" && value.length === 0
}

export function coerceFormulaValueToNumber(value: DataGridFormulaValue): number {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
  }
  if (typeof scalarValue === "number") {
    return Number.isFinite(scalarValue) ? scalarValue : 0
  }
  if (scalarValue instanceof Date) {
    return Number.isNaN(scalarValue.getTime()) ? 0 : scalarValue.getTime()
  }
  if (typeof scalarValue === "boolean") {
    return scalarValue ? 1 : 0
  }
  if (typeof scalarValue === "string") {
    const next = Number(scalarValue)
    return Number.isFinite(next) ? next : 0
  }
  return 0
}

export function coerceFormulaValueToBoolean(value: DataGridFormulaValue): boolean {
  const scalarValue = coerceFormulaValueToScalar(value)
  if (isFormulaErrorValue(scalarValue)) {
    throwForFormulaErrorValue(scalarValue)
  }
  if (typeof scalarValue === "boolean") {
    return scalarValue
  }
  if (typeof scalarValue === "string") {
    if (scalarValue.trim().length === 0) {
      return false
    }
    const parsed = Number(scalarValue)
    if (Number.isFinite(parsed)) {
      return parsed !== 0
    }
    return true
  }
  if (scalarValue instanceof Date) {
    return !Number.isNaN(scalarValue.getTime())
  }
  return coerceFormulaValueToNumber(scalarValue) !== 0
}

export function isFormulaValuePresent(value: DataGridFormulaValue): boolean {
  return !isFormulaValueBlank(value)
}

export function areFormulaValuesEqual(
  left: DataGridFormulaValue,
  right: DataGridFormulaValue,
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    for (let index = 0; index < left.length; index += 1) {
      if (!areFormulaValuesEqual(left[index] ?? null, right[index] ?? null)) {
        return false
      }
    }
    return true
  }
  if (isFormulaErrorValue(left)) {
    throwForFormulaErrorValue(left)
  }
  if (isFormulaErrorValue(right)) {
    throwForFormulaErrorValue(right)
  }
  if (left === null || right === null) {
    return left === right
  }
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime()
  }
  if (typeof left === "string" && typeof right === "string") {
    return left === right
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left === right
  }
  const leftNumeric = coerceFormulaValueToStrictNumber(left)
  const rightNumeric = coerceFormulaValueToStrictNumber(right)
  if (leftNumeric !== null && rightNumeric !== null) {
    return leftNumeric === rightNumeric
  }
  return false
}

export function compareFormulaValues(
  left: DataGridFormulaValue,
  right: DataGridFormulaValue,
): number {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left)) {
      return -1
    }
    if (!Array.isArray(right)) {
      return 1
    }
    const maxLength = Math.max(left.length, right.length)
    for (let index = 0; index < maxLength; index += 1) {
      const compared = compareFormulaValues(left[index] ?? null, right[index] ?? null)
      if (compared !== 0) {
        return compared
      }
    }
    return 0
  }
  if (isFormulaErrorValue(left)) {
    throwForFormulaErrorValue(left)
  }
  if (isFormulaErrorValue(right)) {
    throwForFormulaErrorValue(right)
  }
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return -1
  }
  if (right === null) {
    return 1
  }
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right)
  }
  const leftNumeric = coerceFormulaValueToStrictNumber(left)
  const rightNumeric = coerceFormulaValueToStrictNumber(right)
  if (leftNumeric !== null && rightNumeric !== null) {
    return leftNumeric - rightNumeric
  }
  return String(left).localeCompare(String(right))
}

export function createFormulaRuntimeError(
  code: DataGridFormulaRuntimeErrorCode,
  message: string,
  input: Partial<DataGridFormulaRuntimeError> = {},
): DataGridFormulaRuntimeError {
  return {
    code,
    message,
    ...input,
  }
}

export function normalizeFormulaRuntimeError(
  error: unknown,
  input: {
    formulaName: string
    field: string
    formula: string
    rowId: string | number
    sourceIndex: number
  },
): DataGridFormulaRuntimeError {
  if (error instanceof DataGridFormulaEvaluationError) {
    return {
      ...error.runtimeError,
      formulaName: error.runtimeError.formulaName ?? input.formulaName,
      field: error.runtimeError.field ?? input.field,
      formula: error.runtimeError.formula ?? input.formula,
      rowId: error.runtimeError.rowId ?? input.rowId,
      sourceIndex: error.runtimeError.sourceIndex ?? input.sourceIndex,
    }
  }
  const message = error instanceof Error
    ? error.message
    : String(error ?? "Formula evaluation failed.")
  return createFormulaRuntimeError("EVAL_ERROR", message, {
    formulaName: input.formulaName,
    field: input.field,
    formula: input.formula,
    rowId: input.rowId,
    sourceIndex: input.sourceIndex,
  })
}

export function formulaNumberIsTruthy(value: unknown): boolean {
  return coerceFormulaValueToBoolean(normalizeFormulaValue(value))
}

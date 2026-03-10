import type {
  DataGridFormulaScalarValue,
} from "../../coreTypes.js"
import {
  coerceFormulaValueToNumber,
} from "../values.js"
import {
  defineFormulaFunctions,
  expandFormulaArgs,
  stringifyFormulaScalarValue,
} from "../functionHelpers.js"

export const DATAGRID_TEXT_FORMULA_FUNCTIONS = defineFormulaFunctions({
  CONCAT: {
    compute: args => expandFormulaArgs(args)
      .map(value => stringifyFormulaScalarValue(value))
      .join(""),
  },
  FIND: {
    arity: { min: 2, max: 3 },
    compute: args => {
      const searchFor = String(args[0] ?? "")
      const text = String(args[1] ?? "")
      const startPosition = Math.max(1, Math.trunc(coerceFormulaValueToNumber(args[2] ?? 1)))
      const index = text.indexOf(searchFor, startPosition - 1)
      return index < 0 ? 0 : index + 1
    },
  },
  JOIN: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const delimiter = args.length > 1 ? String(args[1] ?? "") : ""
      return expandFormulaArgs([args[0] ?? null]).map(value => stringifyFormulaScalarValue(value)).join(delimiter)
    },
  },
  LEFT: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const text = String(args[0] ?? "")
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[1] ?? text.length)))
      return text.slice(0, count)
    },
  },
  LEN: {
    arity: 1,
    compute: args => {
      const value = args[0] ?? null
      if (Array.isArray(value)) {
        return value.length
      }
      return stringifyFormulaScalarValue((value ?? null) as DataGridFormulaScalarValue).length
    },
  },
  LOWER: {
    arity: 1,
    compute: args => String(args[0] ?? "").toLowerCase(),
  },
  MID: {
    arity: 3,
    compute: args => {
      const text = String(args[0] ?? "")
      const start = Math.max(1, Math.trunc(coerceFormulaValueToNumber(args[1] ?? 1)))
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[2] ?? 0)))
      return text.slice(start - 1, start - 1 + count)
    },
  },
  REPLACE: {
    arity: 4,
    compute: args => {
      const text = String(args[0] ?? "")
      const start = Math.max(1, Math.trunc(coerceFormulaValueToNumber(args[1] ?? 1)))
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[2] ?? 0)))
      const nextText = String(args[3] ?? "")
      return `${text.slice(0, start - 1)}${nextText}${text.slice(start - 1 + count)}`
    },
  },
  RIGHT: {
    arity: { min: 1, max: 2 },
    compute: args => {
      const text = String(args[0] ?? "")
      const count = Math.max(0, Math.trunc(coerceFormulaValueToNumber(args[1] ?? text.length)))
      return count >= text.length ? text : text.slice(text.length - count)
    },
  },
  SUBSTITUTE: {
    arity: { min: 3, max: 4 },
    compute: args => {
      const text = String(args[0] ?? "")
      const oldText = String(args[1] ?? "")
      const newText = String(args[2] ?? "")
      const replaceNum = Math.trunc(coerceFormulaValueToNumber(args[3] ?? 0))
      if (oldText.length === 0) {
        return text
      }
      if (replaceNum <= 0) {
        return text.split(oldText).join(newText)
      }
      let seen = 0
      return text.split(oldText).join("\u0000").split("\u0000").reduce((result, part, index) => {
        if (index === 0) {
          return part
        }
        seen += 1
        return `${result}${seen === replaceNum ? newText : oldText}${part}`
      }, "")
    },
  },
  TRIM: {
    arity: 1,
    compute: args => String(args[0] ?? "").trim(),
  },
  UPPER: {
    arity: 1,
    compute: args => String(args[0] ?? "").toUpperCase(),
  },
  VALUE: {
    arity: 1,
    compute: args => coerceFormulaValueToNumber(args[0] ?? null),
  },
})

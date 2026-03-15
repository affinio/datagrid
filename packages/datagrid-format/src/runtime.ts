import type {
  DataGridCellFormatColumnLike,
  DataGridColumnDateTimeFormatOptions,
  DataGridColumnNumberFormatOptions,
  DataGridFormatDataType,
} from "./contracts.js"

const numberFormatterCache = new Map<string, Intl.NumberFormat>()
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()

function normalizeNumberFormatOptions(
  options: DataGridColumnNumberFormatOptions,
): Intl.NumberFormatOptions {
  const style = options.style ?? "decimal"
  const normalized: Intl.NumberFormatOptions = {
    style,
  }
  if (typeof options.currency === "string" && options.currency.trim().length > 0) {
    normalized.currency = options.currency.trim().toUpperCase()
  }
  if (options.currencyDisplay) {
    normalized.currencyDisplay = options.currencyDisplay
  }
  if (typeof options.useGrouping === "boolean") {
    normalized.useGrouping = options.useGrouping
  }
  if (typeof options.minimumFractionDigits === "number") {
    normalized.minimumFractionDigits = options.minimumFractionDigits
  }
  if (typeof options.maximumFractionDigits === "number") {
    normalized.maximumFractionDigits = options.maximumFractionDigits
  }
  if (typeof options.minimumIntegerDigits === "number") {
    normalized.minimumIntegerDigits = options.minimumIntegerDigits
  }
  if (style === "currency" && !normalized.currency) {
    normalized.style = "decimal"
  }
  return normalized
}

function stringifyCachePart(value: string | number | boolean | undefined): string {
  return value == null ? "" : String(value)
}

function buildNumberFormatterCacheKey(
  locale: string | undefined,
  options: Intl.NumberFormatOptions,
): string {
  return [
    locale ?? "",
    stringifyCachePart(options.style),
    stringifyCachePart(options.currency),
    stringifyCachePart(options.currencyDisplay),
    stringifyCachePart(options.useGrouping),
    stringifyCachePart(options.minimumFractionDigits),
    stringifyCachePart(options.maximumFractionDigits),
    stringifyCachePart(options.minimumIntegerDigits),
  ].join("|")
}

function resolveNumberFormatter(
  options: DataGridColumnNumberFormatOptions,
): Intl.NumberFormat {
  const locale = typeof options.locale === "string" && options.locale.trim().length > 0
    ? options.locale.trim()
    : undefined
  const normalizedOptions = normalizeNumberFormatOptions(options)
  const cacheKey = buildNumberFormatterCacheKey(locale, normalizedOptions)
  const cached = numberFormatterCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const formatter = new Intl.NumberFormat(locale, normalizedOptions)
  numberFormatterCache.set(cacheKey, formatter)
  return formatter
}

function normalizeDateTimeFormatOptions(
  options: DataGridColumnDateTimeFormatOptions,
): Intl.DateTimeFormatOptions {
  const normalized: Intl.DateTimeFormatOptions = {}
  if (options.timeZone) {
    normalized.timeZone = options.timeZone
  }
  if (typeof options.hour12 === "boolean") {
    normalized.hour12 = options.hour12
  }
  if (options.weekday) {
    normalized.weekday = options.weekday
  }
  if (options.era) {
    normalized.era = options.era
  }
  if (options.year) {
    normalized.year = options.year
  }
  if (options.month) {
    normalized.month = options.month
  }
  if (options.day) {
    normalized.day = options.day
  }
  if (options.hour) {
    normalized.hour = options.hour
  }
  if (options.minute) {
    normalized.minute = options.minute
  }
  if (options.second) {
    normalized.second = options.second
  }
  if (options.timeZoneName) {
    normalized.timeZoneName = options.timeZoneName
  }
  return normalized
}

function buildDateTimeFormatterCacheKey(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return [
    locale ?? "",
    stringifyCachePart(options.timeZone),
    stringifyCachePart(options.hour12),
    stringifyCachePart(options.weekday),
    stringifyCachePart(options.era),
    stringifyCachePart(options.year),
    stringifyCachePart(options.month),
    stringifyCachePart(options.day),
    stringifyCachePart(options.hour),
    stringifyCachePart(options.minute),
    stringifyCachePart(options.second),
    stringifyCachePart(options.timeZoneName),
  ].join("|")
}

function resolveDateTimeFormatter(
  options: DataGridColumnDateTimeFormatOptions,
): Intl.DateTimeFormat {
  const locale = typeof options.locale === "string" && options.locale.trim().length > 0
    ? options.locale.trim()
    : undefined
  const normalizedOptions = normalizeDateTimeFormatOptions(options)
  const cacheKey = buildDateTimeFormatterCacheKey(locale, normalizedOptions)
  const cached = dateTimeFormatterCache.get(cacheKey)
  if (cached) {
    return cached
  }
  const formatter = new Intl.DateTimeFormat(locale, normalizedOptions)
  dateTimeFormatterCache.set(cacheKey, formatter)
  return formatter
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "bigint") {
    const coerced = Number(value)
    return Number.isFinite(coerced) ? coerced : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }
    const coerced = Number(trimmed)
    return Number.isFinite(coerced) ? coerced : null
  }
  return null
}

function coerceDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null
  }
  if (typeof value === "number") {
    const coerced = new Date(value)
    return Number.isFinite(coerced.getTime()) ? coerced : null
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }
    const coerced = new Date(trimmed)
    return Number.isFinite(coerced.getTime()) ? coerced : null
  }
  return null
}

export function resolveDefaultDataGridDateTimeFormat(
  dataType: DataGridFormatDataType | undefined,
): DataGridColumnDateTimeFormatOptions | null {
  if (dataType === "date") {
    return {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }
  }
  if (dataType === "datetime") {
    return {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  }
  return null
}

export function formatDataGridCellValue<TRow = unknown>(
  value: unknown,
  column?: DataGridCellFormatColumnLike<TRow> | null,
): string {
  if (value == null) {
    return ""
  }

  const numberFormat = column?.presentation?.format?.number
  if (numberFormat) {
    const numericValue = coerceFiniteNumber(value)
    if (numericValue != null) {
      return resolveNumberFormatter(numberFormat).format(numericValue)
    }
  }

  const dateTimeFormat = column?.presentation?.format?.dateTime
    ?? resolveDefaultDataGridDateTimeFormat(column?.dataType)
  if (dateTimeFormat) {
    const dateValue = coerceDateValue(value)
    if (dateValue) {
      return resolveDateTimeFormatter(dateTimeFormat).format(dateValue)
    }
  }

  return String(value)
}

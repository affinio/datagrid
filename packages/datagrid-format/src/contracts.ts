export type DataGridFormatDataType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "currency"
  | "percent"

export interface DataGridColumnNumberFormatOptions {
  locale?: string
  style?: "decimal" | "currency" | "percent"
  currency?: string
  currencyDisplay?: Intl.NumberFormatOptions["currencyDisplay"]
  useGrouping?: boolean
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  minimumIntegerDigits?: number
}

export interface DataGridColumnDateTimeFormatOptions {
  locale?: string
  timeZone?: string
  hour12?: boolean
  weekday?: Intl.DateTimeFormatOptions["weekday"]
  era?: Intl.DateTimeFormatOptions["era"]
  year?: Intl.DateTimeFormatOptions["year"]
  month?: Intl.DateTimeFormatOptions["month"]
  day?: Intl.DateTimeFormatOptions["day"]
  hour?: Intl.DateTimeFormatOptions["hour"]
  minute?: Intl.DateTimeFormatOptions["minute"]
  second?: Intl.DateTimeFormatOptions["second"]
  timeZoneName?: Intl.DateTimeFormatOptions["timeZoneName"]
}

export interface DataGridColumnFormat {
  number?: DataGridColumnNumberFormatOptions
  dateTime?: DataGridColumnDateTimeFormatOptions
}

export interface DataGridColumnFormatPresentation {
  format?: DataGridColumnFormat
}

export interface DataGridCellFormatColumnLike<TRow = unknown> {
  dataType?: DataGridFormatDataType
  presentation?: DataGridColumnFormatPresentation | null
  meta?: Record<string, unknown>
  field?: Extract<keyof TRow, string> | string
}

const FIELD_SEPARATOR = "\t"
const ROW_SEPARATOR = "\n"

function normalizeClipboardValue(value: unknown): string {
  if (typeof value === "undefined" || value === null) {
    return ""
  }
  return String(value)
}

export function serializeDataGridClipboardTsvField(value: unknown): string {
  const normalized = normalizeClipboardValue(value).replace(/\r\n/g, ROW_SEPARATOR).replace(/\r/g, ROW_SEPARATOR)
  if (
    normalized.includes(FIELD_SEPARATOR)
    || normalized.includes(ROW_SEPARATOR)
    || normalized.includes("\"")
  ) {
    return `"${normalized.replace(/"/g, "\"\"")}"`
  }
  return normalized
}

export function parseDataGridClipboardTsv(payload: string): string[][] {
  const normalized = payload.replace(/\r\n/g, ROW_SEPARATOR).replace(/\r/g, ROW_SEPARATOR)
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotedField = false
  let atFieldStart = true

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (inQuotedField) {
      if (char === "\"") {
        const next = normalized[index + 1]
        if (next === "\"") {
          field += "\""
          index += 1
        } else {
          inQuotedField = false
          atFieldStart = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === "\"" && atFieldStart) {
      inQuotedField = true
      atFieldStart = false
      continue
    }

    if (char === FIELD_SEPARATOR) {
      row.push(field)
      field = ""
      atFieldStart = true
      continue
    }

    if (char === ROW_SEPARATOR) {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
      atFieldStart = true
      continue
    }

    field += char
    atFieldStart = false
  }

  row.push(field)
  rows.push(row)

  if (normalized.endsWith(ROW_SEPARATOR) && rows.length > 1) {
    const trailing = rows[rows.length - 1]
    if (trailing?.length === 1 && trailing[0] === "") {
      rows.pop()
    }
  }

  return rows.length ? rows : [[]]
}

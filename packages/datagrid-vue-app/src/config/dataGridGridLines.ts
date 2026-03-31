export type DataGridGridLinesPreset = "all" | "rows" | "columns" | "none"

export type DataGridGridLinesHeaderMode = "columns" | "none"

export interface DataGridGridLinesOptions {
  body: DataGridGridLinesPreset
  header: DataGridGridLinesHeaderMode
  pinnedSeparators: boolean
  bodyRows: boolean
  bodyColumns: boolean
  headerColumns: boolean
}

export type DataGridGridLinesProp =
  | DataGridGridLinesPreset
  | {
      body?: DataGridGridLinesPreset | null
      header?: DataGridGridLinesHeaderMode | null
      pinnedSeparators?: boolean
    }
  | null

const DEFAULT_BODY_MODE: DataGridGridLinesPreset = "all"

const DEFAULT_HEADER_BY_BODY: Record<DataGridGridLinesPreset, DataGridGridLinesHeaderMode> = {
  all: "columns",
  rows: "none",
  columns: "columns",
  none: "none",
}

function normalizeBodyMode(input: DataGridGridLinesPreset | null | undefined): DataGridGridLinesPreset {
  return input === "rows" || input === "columns" || input === "none" || input === "all"
    ? input
    : DEFAULT_BODY_MODE
}

function normalizeHeaderMode(
  input: DataGridGridLinesHeaderMode | null | undefined,
  body: DataGridGridLinesPreset,
): DataGridGridLinesHeaderMode {
  return input === "columns" || input === "none"
    ? input
    : DEFAULT_HEADER_BY_BODY[body]
}

function resolvePinnedSeparatorsDefault(
  body: DataGridGridLinesPreset,
  header: DataGridGridLinesHeaderMode,
): boolean {
  return body !== "none" || header === "columns"
}

function createResolvedGridLines(options: {
  body: DataGridGridLinesPreset
  header: DataGridGridLinesHeaderMode
  pinnedSeparators: boolean
}): DataGridGridLinesOptions {
  const bodyRows = options.body === "all" || options.body === "rows"
  const bodyColumns = options.body === "all" || options.body === "columns"
  const headerColumns = options.header === "columns"
  return {
    body: options.body,
    header: options.header,
    pinnedSeparators: options.pinnedSeparators,
    bodyRows,
    bodyColumns,
    headerColumns,
  }
}

export function resolveDataGridGridLines(
  input: DataGridGridLinesProp | undefined,
): DataGridGridLinesOptions {
  if (typeof input === "string") {
    const body = normalizeBodyMode(input)
    const header = DEFAULT_HEADER_BY_BODY[body]
    return createResolvedGridLines({
      body,
      header,
      pinnedSeparators: resolvePinnedSeparatorsDefault(body, header),
    })
  }

  const body = normalizeBodyMode(input?.body)
  const header = normalizeHeaderMode(input?.header, body)
  return createResolvedGridLines({
    body,
    header,
    pinnedSeparators: typeof input?.pinnedSeparators === "boolean"
      ? input.pinnedSeparators
      : resolvePinnedSeparatorsDefault(body, header),
  })
}

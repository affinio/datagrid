import type {
  DataGridApi,
  DataGridColumnSnapshot,
  DataGridRowNode,
} from "@affino/datagrid-core"

export type DataGridDomFormulaFieldIndex = ReadonlyMap<string, { field: string }>

export function createDataGridDomFormulaFieldIndex<TRow>(
  api: DataGridApi<TRow>,
): DataGridDomFormulaFieldIndex {
  return new Map(api.rows.getFormulaFields().map(formula => [formula.field, formula] as const))
}

export function resolveDataGridDomFormulaCellValue<TRow>(input: {
  row: DataGridRowNode<TRow>
  column: DataGridColumnSnapshot
  formulaFields: DataGridDomFormulaFieldIndex | null
}): { matched: true; value: unknown } | { matched: false } {
  const { row, column, formulaFields } = input
  if (!formulaFields || typeof column.column.accessor === "function" || typeof column.column.valueGetter === "function") {
    return { matched: false }
  }
  const targetField = typeof column.column.field === "string" ? column.column.field : column.key
  const formulaField = formulaFields.get(targetField)
  if (!formulaField) return { matched: false }

  return {
    matched: true,
    value: readRowPath(row.row, formulaField.field),
  }
}

function readRowPath(row: unknown, path: string): unknown {
  let current = row
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object" || !(segment in current)) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

# @affino/export-xlsx

Standalone `.xlsx` writer for typed worksheet documents. It has no DataGrid or UI dependency.

Supported baseline:

- multiple worksheets
- string, number, boolean, date, and formula cells
- shared strings and XML escaping
- sheet-name sanitization to Excel-safe names
- cell number formats, bold text, font and fill colors
- column widths and frozen header rows
- Node.js and browser-friendly `Uint8Array` output

Out of scope:

- images, comments, charts, tables, workbook metadata
- row heights and merged cells

## Install

```bash
pnpm add @affino/export-xlsx
```

## Usage

```ts
import { writeXlsx } from "@affino/export-xlsx"

const bytes = writeXlsx({
  sheets: [
    {
      name: "Data",
      rows: [
        [
          { type: "string", value: "Name" },
          { type: "string", value: "Amount" },
          { type: "string", value: "Total" },
        ],
        [
          { type: "string", value: "Alice" },
          { type: "number", value: 42 },
          { type: "formula", value: "B2*2" },
        ],
      ],
    },
  ],
})

// Node.js
import { writeFileSync } from "node:fs"
writeFileSync("export.xlsx", Buffer.from(bytes))
```

Browser download:

```ts
import { writeXlsx } from "@affino/export-xlsx"

const bytes = writeXlsx({
  sheets: [
    {
      name: "Data",
      rows: [
        [{ type: "string", value: "Hello" }],
      ],
    },
  ],
})

const blob = new Blob([bytes], {
  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
})
const url = URL.createObjectURL(blob)
const link = document.createElement("a")
link.href = url
link.download = "export.xlsx"
link.click()
URL.revokeObjectURL(url)
```

## Demo (realistic workbook)

Generate a richer demo file (200 rows, formulas, totals, second metadata sheet):

```bash
pnpm --filter @affino/export-xlsx demo:generate
```

Output:

- `packages/export-xlsx/artifacts/demo/export-xlsx-demo.xlsx`

## API

- `writeXlsx(input)`
- `new XlsxWriter().writeXlsx(input)`
- `columnToExcel(index)`

Workbook input:

```ts
interface XlsxSheetInput {
  name: string
  rows: readonly WorksheetRow[]
  columns?: readonly { width?: number }[]
  headerRows?: number
  freezeRows?: number
  rowOutlineLevels?: readonly number[]
}

interface XlsxWorkbookInput {
  sheets: readonly XlsxSheetInput[]
}
```

Notes:

- workbook must contain at least one sheet
- invalid and duplicate sheet names are normalized to Excel-safe unique names
- formulas may be passed as `"A1+B1"` or `"=A1+B1"`
- non-finite numeric values are rejected
- dates are serialized as Excel date serials using UTC timestamps
- `freezeRows` freezes the requested number of top rows; `headerRows` applies default header styling
- widths use Excel character units and are clamped to the supported range

Cell type:

```ts
type WorksheetCell =
  | { type: "string"; value: string; style?: WorksheetCellStyle }
  | { type: "number"; value: number; style?: WorksheetCellStyle }
  | { type: "boolean"; value: boolean; style?: WorksheetCellStyle }
  | { type: "date"; value: Date; style?: WorksheetCellStyle }
  | { type: "formula"; value: string; cachedValue?: string | number | boolean; style?: WorksheetCellStyle }

interface WorksheetCellStyle {
  bold?: boolean
  indent?: number
  numberFormat?: string
  fillColor?: string
  fontColor?: string
}
```

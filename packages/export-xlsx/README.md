# @affino/export-xlsx

Minimal standalone `.xlsx` writer.

Supported baseline:

- multiple worksheets
- string, number, boolean, and formula cells
- shared strings and XML escaping
- sheet-name sanitization to Excel-safe names
- Node.js and browser-friendly `Uint8Array` output

Out of scope in `0.1.x`:

- styling and number formats
- column widths, row heights, merges, frozen panes
- dates/times as first-class cell types
- images, comments, charts, tables, workbook metadata

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
}

interface XlsxWorkbookInput {
  sheets: readonly XlsxSheetInput[]
}
```

Notes:

- workbook must contain at least one sheet
- empty or invalid sheet names are normalized to `Sheet1`, `Sheet2`, ...
- formulas may be passed as `"A1+B1"` or `"=A1+B1"`
- non-finite numeric values are written as `0`

Cell type:

```ts
type WorksheetCell =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "formula"; value: string }
```

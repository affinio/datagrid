# @affino/export-xlsx

Minimal standalone `.xlsx` writer.

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

## API

- `writeXlsx(input)`
- `new XlsxWriter().writeXlsx(input)`
- `columnToExcel(index)`

Cell type:

```ts
type WorksheetCell =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "formula"; value: string }
```

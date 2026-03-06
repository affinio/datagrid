import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { writeXlsx } from "../dist/index.js"

const rowCount = 200

const header = [
  { type: "string", value: "Order ID" },
  { type: "string", value: "Region" },
  { type: "string", value: "Price" },
  { type: "string", value: "Qty" },
  { type: "string", value: "Revenue" },
  { type: "string", value: "Tax 10%" },
  { type: "string", value: "Total" },
  { type: "string", value: "Priority" },
]

const regions = ["EMEA", "APAC", "NA", "LATAM"]

const rows = [header]
for (let index = 0; index < rowCount; index += 1) {
  const rowNumber = index + 2
  const orderId = `ORD-${String(index + 1).padStart(5, "0")}`
  const region = regions[index % regions.length]
  const price = Number((20 + (index % 37) * 3.15).toFixed(2))
  const qty = 1 + (index % 9)
  const priority = index % 7 === 0

  rows.push([
    { type: "string", value: orderId },
    { type: "string", value: region },
    { type: "number", value: price },
    { type: "number", value: qty },
    { type: "formula", value: `C${rowNumber}*D${rowNumber}` },
    { type: "formula", value: `E${rowNumber}*0.1` },
    { type: "formula", value: `E${rowNumber}+F${rowNumber}` },
    { type: "boolean", value: priority },
  ])
}

const totalsRow = rowCount + 2
rows.push([
  { type: "string", value: "TOTAL" },
  { type: "string", value: "" },
  { type: "string", value: "" },
  { type: "string", value: "" },
  { type: "formula", value: `SUM(E2:E${rowCount + 1})` },
  { type: "formula", value: `SUM(F2:F${rowCount + 1})` },
  { type: "formula", value: `SUM(G2:G${rowCount + 1})` },
  { type: "string", value: "" },
])

const workbook = writeXlsx({
  sheets: [
    {
      name: "Orders",
      rows,
    },
    {
      name: "Meta",
      rows: [
        [
          { type: "string", value: "Generated at" },
          { type: "string", value: new Date().toISOString() },
        ],
        [
          { type: "string", value: "Rows" },
          { type: "number", value: rowCount },
        ],
        [
          { type: "string", value: "Totals row" },
          { type: "number", value: totalsRow },
        ],
      ],
    },
  ],
})

const outDir = join(process.cwd(), "artifacts", "demo")
mkdirSync(outDir, { recursive: true })

const outPath = join(outDir, "export-xlsx-demo.xlsx")
writeFileSync(outPath, Buffer.from(workbook))

console.log(`Demo file written: ${outPath}`)

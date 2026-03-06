import { describe, expect, it } from "vitest"
import { strFromU8, unzipSync } from "fflate"
import { columnToExcel, writeXlsx } from "../xlsxWriter.js"

describe("xlsxWriter", () => {
  it("converts zero-based index to Excel column labels", () => {
    expect(columnToExcel(0)).toBe("A")
    expect(columnToExcel(25)).toBe("Z")
    expect(columnToExcel(26)).toBe("AA")
    expect(columnToExcel(51)).toBe("AZ")
    expect(columnToExcel(52)).toBe("BA")
  })

  it("builds a minimal valid xlsx zip with workbook, worksheet, styles and shared strings", () => {
    const bytes = writeXlsx({
      sheets: [
        {
          name: "Data",
          rows: [
            [
              { type: "string", value: "Hello" },
              { type: "number", value: 42 },
              { type: "boolean", value: true },
              { type: "formula", value: "B1*2" },
            ],
          ],
        },
      ],
    })

    const zipEntries = unzipSync(bytes)
    const fileNames = Object.keys(zipEntries)

    expect(fileNames).toHaveLength(7)
    expect(fileNames).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/sharedStrings.xml",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]))

    const workbookXml = strFromU8(zipEntries["xl/workbook.xml"]!)
    const worksheetXml = strFromU8(zipEntries["xl/worksheets/sheet1.xml"]!)
    const sharedStringsXml = strFromU8(zipEntries["xl/sharedStrings.xml"]!)

    expect(workbookXml).toContain("<sheet name=\"Data\" sheetId=\"1\" r:id=\"rId1\"/>")
    expect(worksheetXml).toContain("<row r=\"1\">")
    expect(worksheetXml).toContain("<c r=\"A1\" t=\"s\"><v>0</v></c>")
    expect(worksheetXml).toContain("<c r=\"B1\"><v>42</v></c>")
    expect(worksheetXml).toContain("<c r=\"C1\" t=\"b\"><v>1</v></c>")
    expect(worksheetXml).toContain("<c r=\"D1\"><f>B1*2</f><v>0</v></c>")
    expect(sharedStringsXml).toContain("<sst")
    expect(sharedStringsXml).toContain("<si><t>Hello</t></si>")
  })
})

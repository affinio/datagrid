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

  it("writes multiple sheets, sanitizes sheet names, deduplicates shared strings and escapes xml", () => {
    const bytes = writeXlsx({
      sheets: [
        {
          name: "Revenue/EMEA:*?[] 2026",
          rows: [
            [
              { type: "string", value: "A&B <North>" },
              { type: "string", value: "repeat" },
            ],
            [
              { type: "string", value: "repeat" },
              { type: "formula", value: "=A1" },
            ],
          ],
        },
        {
          name: " ",
          rows: [
            [
              { type: "boolean", value: false },
            ],
          ],
        },
      ],
    })

    const zipEntries = unzipSync(bytes)
    const workbookXml = strFromU8(zipEntries["xl/workbook.xml"]!)
    const sheet1Xml = strFromU8(zipEntries["xl/worksheets/sheet1.xml"]!)
    const sheet2Xml = strFromU8(zipEntries["xl/worksheets/sheet2.xml"]!)
    const sharedStringsXml = strFromU8(zipEntries["xl/sharedStrings.xml"]!)

    expect(workbookXml).toContain("<sheet name=\"Revenue_EMEA_____ 2026\" sheetId=\"1\" r:id=\"rId1\"/>")
    expect(workbookXml).toContain("<sheet name=\"Sheet2\" sheetId=\"2\" r:id=\"rId2\"/>")
    expect(sheet1Xml).toContain("<c r=\"A1\" t=\"s\"><v>0</v></c>")
    expect(sheet1Xml).toContain("<c r=\"B1\" t=\"s\"><v>1</v></c>")
    expect(sheet1Xml).toContain("<c r=\"A2\" t=\"s\"><v>1</v></c>")
    expect(sheet1Xml).toContain("<c r=\"B2\"><f>A1</f><v>0</v></c>")
    expect(sheet2Xml).toContain("<c r=\"A1\" t=\"b\"><v>0</v></c>")
    expect(sharedStringsXml).toContain("count=\"3\"")
    expect(sharedStringsXml).toContain("uniqueCount=\"2\"")
    expect(sharedStringsXml).toContain("<si><t>A&amp;B &lt;North&gt;</t></si>")
  })

  it("rejects empty workbooks", () => {
    expect(() => writeXlsx({ sheets: [] })).toThrow("Workbook must contain at least one sheet")
  })
})

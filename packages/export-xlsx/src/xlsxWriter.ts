import { strToU8, zipSync } from "fflate"

export type WorksheetCell =
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "boolean"; value: boolean }
  | { type: "formula"; value: string }

export type WorksheetRow = readonly (WorksheetCell | null | undefined)[]

export interface WorksheetModel {
  rows: readonly WorksheetRow[]
}

export interface XlsxSheetInput {
  name: string
  rows: readonly WorksheetRow[]
}

export interface XlsxWorkbookInput {
  sheets: readonly XlsxSheetInput[]
}

interface SharedStringsState {
  unique: string[]
  byValue: Map<string, number>
  totalCount: number
}

interface BuildXmlResult {
  workbookXml: string
  workbookRelsXml: string
  sheetsXml: readonly string[]
  sharedStringsXml: string
  stylesXml: string
  contentTypesXml: string
  rootRelsXml: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function normalizeFormulaExpression(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return "0"
  }
  return trimmed.startsWith("=") ? trimmed.slice(1) : trimmed
}

function sanitizeSheetName(value: string, fallbackIndex: number): string {
  const source = value.trim().length > 0 ? value.trim() : `Sheet${fallbackIndex + 1}`
  const replaced = source.replace(/[\\/*?:\[\]]/g, "_")
  const truncated = replaced.slice(0, 31)
  return truncated.length > 0 ? truncated : `Sheet${fallbackIndex + 1}`
}

export function columnToExcel(index: number): string {
  let current = Math.trunc(index)
  if (!Number.isFinite(current) || current < 0) {
    current = 0
  }
  let output = ""
  current += 1

  while (current > 0) {
    const mod = (current - 1) % 26
    output = String.fromCharCode(65 + mod) + output
    current = Math.floor((current - mod) / 26)
  }

  return output
}

export class XlsxWriter {
  private sharedStrings: SharedStringsState = {
    unique: [],
    byValue: new Map<string, number>(),
    totalCount: 0,
  }

  writeXlsx(input: XlsxWorkbookInput): Uint8Array {
    const sheets = Array.isArray(input.sheets) ? input.sheets : []
    if (sheets.length === 0) {
      throw new Error("[XlsxWriter] Workbook must contain at least one sheet.")
    }

    this.resetSharedStrings()
    const xml = this.buildXml(sheets)
    return this.buildZip(xml)
  }

  writeWorkbook(sheetNames: readonly string[]): string {
    const sheetsXml = sheetNames
      .map((sheetName, index) => {
        const escaped = escapeXml(sheetName)
        return `<sheet name="${escaped}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
      })
      .join("")

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      `<sheets>${sheetsXml}</sheets>`,
      "</workbook>",
    ].join("")
  }

  writeWorksheet(model: WorksheetModel): string {
    const rows = Array.isArray(model.rows) ? model.rows : []
    const rowXml: string[] = []

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      const cells: string[] = []

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const cell = row[columnIndex]
        if (!cell) {
          continue
        }
        const ref = `${columnToExcel(columnIndex)}${rowIndex + 1}`
        if (cell.type === "string") {
          const sharedStringIndex = this.registerSharedString(cell.value)
          cells.push(`<c r="${ref}" t="s"><v>${sharedStringIndex}</v></c>`)
          continue
        }
        if (cell.type === "number") {
          const value = Number.isFinite(cell.value) ? cell.value : 0
          cells.push(`<c r="${ref}"><v>${value}</v></c>`)
          continue
        }
        if (cell.type === "boolean") {
          cells.push(`<c r="${ref}" t="b"><v>${cell.value ? 1 : 0}</v></c>`)
          continue
        }

        const expression = escapeXml(normalizeFormulaExpression(cell.value))
        cells.push(`<c r="${ref}"><f>${expression}</f><v>0</v></c>`)
      }

      if (cells.length > 0) {
        rowXml.push(`<row r="${rowIndex + 1}">${cells.join("")}</row>`)
      }
    }

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      `<sheetData>${rowXml.join("")}</sheetData>`,
      "</worksheet>",
    ].join("")
  }

  writeSharedStrings(): string {
    const totalCount = this.sharedStrings.totalCount
    const uniqueCount = this.sharedStrings.unique.length
    const items = this.sharedStrings.unique
      .map(value => `<si><t>${escapeXml(value)}</t></si>`)
      .join("")

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalCount}" uniqueCount="${uniqueCount}">${items}</sst>`,
    ].join("")
  }

  writeStyles(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
      '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>',
      '<borders count="1"><border/></borders>',
      '<cellStyleXfs count="1"><xf/></cellStyleXfs>',
      '<cellXfs count="1"><xf xfId="0"/></cellXfs>',
      "</styleSheet>",
    ].join("")
  }

  buildZip(parts: BuildXmlResult): Uint8Array {
    const files: Record<string, Uint8Array> = {
      "[Content_Types].xml": strToU8(parts.contentTypesXml),
      "_rels/.rels": strToU8(parts.rootRelsXml),
      "xl/workbook.xml": strToU8(parts.workbookXml),
      "xl/_rels/workbook.xml.rels": strToU8(parts.workbookRelsXml),
      "xl/styles.xml": strToU8(parts.stylesXml),
      "xl/sharedStrings.xml": strToU8(parts.sharedStringsXml),
    }

    for (let sheetIndex = 0; sheetIndex < parts.sheetsXml.length; sheetIndex += 1) {
      files[`xl/worksheets/sheet${sheetIndex + 1}.xml`] = strToU8(parts.sheetsXml[sheetIndex] ?? "")
    }

    return zipSync(files, { level: 6 })
  }

  private buildXml(sheets: readonly XlsxSheetInput[]): BuildXmlResult {
    const sheetNames = sheets.map((sheet, index) => sanitizeSheetName(sheet.name, index))
    const sheetsXml = sheets.map(sheet => this.writeWorksheet({ rows: sheet.rows }))

    return {
      workbookXml: this.writeWorkbook(sheetNames),
      workbookRelsXml: this.writeWorkbookRels(sheets.length),
      sheetsXml,
      sharedStringsXml: this.writeSharedStrings(),
      stylesXml: this.writeStyles(),
      contentTypesXml: this.writeContentTypes(sheets.length),
      rootRelsXml: this.writeRootRels(),
    }
  }

  private writeRootRels(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      "</Relationships>",
    ].join("")
  }

  private writeWorkbookRels(sheetCount: number): string {
    const sheetRelationships = new Array<string>(sheetCount)
    for (let index = 0; index < sheetCount; index += 1) {
      sheetRelationships[index] = `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    }

    const styleRelId = sheetCount + 1
    const sharedStringsRelId = sheetCount + 2

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      sheetRelationships.join(""),
      `<Relationship Id="rId${styleRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
      `<Relationship Id="rId${sharedStringsRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`,
      "</Relationships>",
    ].join("")
  }

  private writeContentTypes(sheetCount: number): string {
    const sheetOverrides = new Array<string>(sheetCount)
    for (let index = 0; index < sheetCount; index += 1) {
      sheetOverrides[index] = `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    }

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
      sheetOverrides.join(""),
      "</Types>",
    ].join("")
  }

  private registerSharedString(value: string): number {
    this.sharedStrings.totalCount += 1
    const normalized = value ?? ""
    const existing = this.sharedStrings.byValue.get(normalized)
    if (typeof existing === "number") {
      return existing
    }

    const index = this.sharedStrings.unique.length
    this.sharedStrings.unique.push(normalized)
    this.sharedStrings.byValue.set(normalized, index)
    return index
  }

  private resetSharedStrings(): void {
    this.sharedStrings = {
      unique: [],
      byValue: new Map<string, number>(),
      totalCount: 0,
    }
  }
}

export function writeXlsx(input: XlsxWorkbookInput): Uint8Array {
  return new XlsxWriter().writeXlsx(input)
}

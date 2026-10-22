import { strToU8, zipSync } from "fflate"

export type WorksheetCell =
  | { type: "string"; value: string; style?: WorksheetCellStyle }
  | { type: "number"; value: number; style?: WorksheetCellStyle }
  | { type: "boolean"; value: boolean; style?: WorksheetCellStyle }
  | { type: "date"; value: Date; style?: WorksheetCellStyle }
  | { type: "formula"; value: string; cachedValue?: string | number | boolean; style?: WorksheetCellStyle }

export interface WorksheetCellStyle {
  bold?: boolean
  indent?: number
  numberFormat?: string
  fillColor?: string
  fontColor?: string
}

export interface XlsxColumnInput {
  width?: number
}

export type WorksheetRow = readonly (WorksheetCell | null | undefined)[]

export interface WorksheetModel {
  rows: readonly WorksheetRow[]
  columns?: readonly XlsxColumnInput[]
  freezeRows?: number
  headerRows?: number
  headerStyle?: WorksheetCellStyle
  rowOutlineLevels?: readonly number[]
}

export interface XlsxSheetInput {
  name: string
  rows: readonly WorksheetRow[]
  columns?: readonly XlsxColumnInput[]
  freezeRows?: number
  headerRows?: number
  headerStyle?: WorksheetCellStyle
  rowOutlineLevels?: readonly number[]
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

interface XlsxStyleRecord {
  fontId: number
  fillId: number
  numberFormatId: number
  indent: number
}

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, character => `_x${character.charCodeAt(0).toString(16).padStart(4, "0")}_`)
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

function makeUniqueSheetNames(sheets: readonly XlsxSheetInput[]): string[] {
  const used = new Set<string>()
  return sheets.map((sheet, index) => {
    const base = sanitizeSheetName(sheet.name, index).replace(/^'+|'+$/g, "_")
    let candidate = base
    let suffix = 2
    while (used.has(candidate.toLocaleLowerCase("en-US"))) {
      const ending = ` (${suffix++})`
      candidate = `${base.slice(0, Math.max(1, 31 - ending.length))}${ending}`
    }
    used.add(candidate.toLocaleLowerCase("en-US"))
    return candidate
  })
}

function normalizeArgb(color: string | undefined): string | undefined {
  if (!color) return undefined
  const normalized = color.trim().replace(/^#/, "")
  if (/^[\da-f]{6}$/i.test(normalized)) return `FF${normalized.toUpperCase()}`
  if (/^[\da-f]{8}$/i.test(normalized)) return normalized.toUpperCase()
  const rgb = color.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)$/i)
  if (rgb) {
    const channels = rgb.slice(1, 4).map(channel => Math.max(0, Math.min(255, Math.round(Number(channel))))
      .toString(16).padStart(2, "0").toUpperCase())
    const alpha = Math.max(0, Math.min(255, Math.round(Number(rgb[4] ?? 1) * 255))).toString(16).padStart(2, "0").toUpperCase()
    return `${alpha}${channels.join("")}`
  }
  return undefined
}

function excelDateSerial(value: Date): number {
  const timestamp = value.getTime()
  if (!Number.isFinite(timestamp)) throw new Error("[XlsxWriter] Date cell must contain a valid Date.")
  return (timestamp - Date.UTC(1899, 11, 30)) / 86_400_000
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
  private readonly styles = new Map<string, XlsxStyleRecord>()
  private readonly styleIds = new Map<string, number>()
  private readonly fonts = new Map<string, string>()
  private readonly fontIds = new Map<string, number>()
  private readonly fills = new Map<string, string>()
  private readonly fillIds = new Map<string, number>()
  private readonly numberFormats = new Map<string, number>()
  private containsFormula = false

  writeXlsx(input: XlsxWorkbookInput): Uint8Array {
    const sheets = Array.isArray(input.sheets) ? input.sheets : []
    if (sheets.length === 0) {
      throw new Error("[XlsxWriter] Workbook must contain at least one sheet.")
    }
    if (sheets.length > 255) throw new Error("[XlsxWriter] Workbook cannot contain more than 255 sheets.")

    this.resetSharedStrings()
    this.styles.clear()
    this.styleIds.clear()
    this.fonts.clear()
    this.fontIds.clear()
    this.fills.clear()
    this.fillIds.clear()
    this.numberFormats.clear()
    this.containsFormula = false
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
      this.containsFormula ? '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>' : "",
      "</workbook>",
    ].join("")
  }

  writeWorksheet(model: WorksheetModel): string {
    const rows = Array.isArray(model.rows) ? model.rows : []
    if (rows.length > 1_048_576) throw new Error("[XlsxWriter] Worksheet cannot contain more than 1,048,576 rows.")
    const rowXml: string[] = []

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      if (row.length > 16_384) throw new Error("[XlsxWriter] Worksheet cannot contain more than 16,384 columns.")
      const cells: string[] = []

      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        const cell = row[columnIndex]
        if (!cell) {
          continue
        }
        const ref = `${columnToExcel(columnIndex)}${rowIndex + 1}`
        const headerStyle = rowIndex < (model.headerRows ?? 0)
          ? { bold: true, fillColor: "FFF1F3F5", ...model.headerStyle }
          : undefined
        const styleId = this.registerStyle(headerStyle ? { ...headerStyle, ...cell.style } : cell.style)
        const styleAttribute = styleId > 0 ? ` s="${styleId}"` : ""
        if (cell.type === "string") {
          const sharedStringIndex = this.registerSharedString(cell.value)
          cells.push(`<c r="${ref}" t="s"${styleAttribute}><v>${sharedStringIndex}</v></c>`)
          continue
        }
        if (cell.type === "number") {
          if (!Number.isFinite(cell.value)) throw new Error(`[XlsxWriter] Number cell ${ref} must be finite.`)
          cells.push(`<c r="${ref}"${styleAttribute}><v>${cell.value}</v></c>`)
          continue
        }
        if (cell.type === "boolean") {
          cells.push(`<c r="${ref}" t="b"${styleAttribute}><v>${cell.value ? 1 : 0}</v></c>`)
          continue
        }
        if (cell.type === "date") {
          const serial = excelDateSerial(cell.value)
          cells.push(`<c r="${ref}"${styleAttribute}><v>${serial}</v></c>`)
          continue
        }

        const expression = escapeXml(normalizeFormulaExpression(cell.value))
        this.containsFormula = true
        const cachedValue = cell.cachedValue ?? 0
        const cachedType = typeof cachedValue === "string" ? " t=\"str\"" : typeof cachedValue === "boolean" ? " t=\"b\"" : ""
        const cachedText = typeof cachedValue === "boolean" ? (cachedValue ? "1" : "0") : String(cachedValue)
        cells.push(`<c r="${ref}"${cachedType}${styleAttribute}><f>${expression}</f><v>${escapeXml(cachedText)}</v></c>`)
      }

      if (cells.length > 0) {
        const outlineLevel = Math.max(0, Math.min(7, Math.trunc(model.rowOutlineLevels?.[rowIndex] ?? 0)))
        rowXml.push(`<row r="${rowIndex + 1}"${outlineLevel > 0 ? ` outlineLevel="${outlineLevel}"` : ""}>${cells.join("")}</row>`)
      }
    }

    const freezeRows = Math.max(0, Math.min(rows.length, Math.trunc(model.freezeRows ?? 0)))
    const sheetViews = freezeRows > 0
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : ""
    const widthColumns = model.columns?.map((column, index) => {
      const width = column.width
      if (typeof width !== "number" || !Number.isFinite(width)) return ""
      const normalizedWidth = Math.max(1, Math.min(255, width))
      return `<col min="${index + 1}" max="${index + 1}" width="${normalizedWidth}" customWidth="1"/>`
    }).filter(Boolean) ?? []
    const cols = widthColumns.length > 0 ? `<cols>${widthColumns.join("")}</cols>` : ""
    const hasOutline = model.rowOutlineLevels?.some(level => level > 0) ?? false
    const sheetProperties = hasOutline ? '<sheetPr><outlinePr summaryBelow="0"/></sheetPr>' : ""
    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      sheetProperties,
      sheetViews,
      cols,
      `<sheetData>${rowXml.join("")}</sheetData>`,
      "</worksheet>",
    ].join("")
  }

  writeSharedStrings(): string {
    const totalCount = this.sharedStrings.totalCount
    const uniqueCount = this.sharedStrings.unique.length
    const items = this.sharedStrings.unique
      .map(value => `<si><t${/^\s|\s$/.test(value) ? ' xml:space="preserve"' : ""}>${escapeXml(value)}</t></si>`)
      .join("")

    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalCount}" uniqueCount="${uniqueCount}">${items}</sst>`,
    ].join("")
  }

  writeStyles(): string {
    const fonts = ['<font><sz val="11"/><name val="Calibri"/></font>']
    for (const fontXml of this.fonts.values()) fonts.push(fontXml)
    const fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      ...this.fills.values(),
    ]
    const customNumberFormats = Array.from(this.numberFormats.entries())
      .map(([format, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(format)}"/>`)
    const cellXfs = ['<xf xfId="0"/>']
    for (const style of this.styles.values()) {
      const alignment = style.indent > 0 ? ` applyAlignment="1"><alignment indent="${style.indent}"/></xf>` : "/>"
      cellXfs.push(`<xf numFmtId="${style.numberFormatId}" fontId="${style.fontId}" fillId="${style.fillId}" borderId="0" xfId="0" applyNumberFormat="${style.numberFormatId ? 1 : 0}" applyFont="${style.fontId ? 1 : 0}" applyFill="${style.fillId > 1 ? 1 : 0}"${alignment}`)
    }
    return [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      customNumberFormats.length ? `<numFmts count="${customNumberFormats.length}">${customNumberFormats.join("")}</numFmts>` : "",
      `<fonts count="${fonts.length}">${fonts.join("")}</fonts>`,
      `<fills count="${fills.length}">${fills.join("")}</fills>`,
      '<borders count="1"><border/></borders>',
      '<cellStyleXfs count="1"><xf/></cellStyleXfs>',
      `<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>`,
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
    const sheetNames = makeUniqueSheetNames(sheets)
    const sheetsXml = sheets.map(sheet => this.writeWorksheet({
      rows: sheet.rows,
      columns: sheet.columns,
      freezeRows: sheet.freezeRows ?? sheet.headerRows,
      headerRows: sheet.headerRows,
      headerStyle: sheet.headerStyle,
      rowOutlineLevels: sheet.rowOutlineLevels,
    }))

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

  private registerStyle(style: WorksheetCellStyle | undefined): number {
    if (!style) return 0
    const fillColor = normalizeArgb(style.fillColor)
    const fontColor = normalizeArgb(style.fontColor)
    const bold = style.bold === true
    const numberFormat = style.numberFormat?.trim() ?? ""
    const indent = Math.max(0, Math.min(15, Math.trunc(style.indent ?? 0)))
    if (!bold && !fillColor && !fontColor && !numberFormat && indent === 0) return 0
    const key = JSON.stringify([bold, fillColor, fontColor, numberFormat, indent])
    const existingStyleId = this.styleIds.get(key)
    if (existingStyleId !== undefined) return existingStyleId

    let fontId = 0
    if (bold || fontColor) {
      const fontKey = JSON.stringify([bold, fontColor])
      let fontIndex = this.fontIds.get(fontKey)
      if (fontIndex === undefined) {
        fontIndex = this.fonts.size
        this.fonts.set(fontKey, `<font>${bold ? "<b/>" : ""}${fontColor ? `<color rgb="${fontColor}"/>` : ""}<sz val="11"/><name val="Calibri"/></font>`)
        this.fontIds.set(fontKey, fontIndex)
      }
      fontId = fontIndex + 1
    }
    let fillId = 0
    if (fillColor) {
      let fillIndex = this.fillIds.get(fillColor)
      if (fillIndex === undefined) {
        fillIndex = this.fills.size
        this.fills.set(fillColor, `<fill><patternFill patternType="solid"><fgColor rgb="${fillColor}"/><bgColor indexed="64"/></patternFill></fill>`)
        this.fillIds.set(fillColor, fillIndex)
      }
      fillId = fillIndex + 2
    }
    let numberFormatId = 0
    if (numberFormat) {
      const existingFormat = this.numberFormats.get(numberFormat)
      if (typeof existingFormat === "number") numberFormatId = existingFormat
      else {
        numberFormatId = 164 + this.numberFormats.size
        this.numberFormats.set(numberFormat, numberFormatId)
      }
    }
    this.styles.set(key, { fontId, fillId, numberFormatId, indent })
    const styleId = this.styles.size
    this.styleIds.set(key, styleId)
    return styleId
  }
}

export function writeXlsx(input: XlsxWorkbookInput): Uint8Array {
  return new XlsxWriter().writeXlsx(input)
}

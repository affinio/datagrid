import {
  createDataGridSpreadsheetWorkbookModel,
  type DataGridSpreadsheetWorkbookModel,
} from "@affino/datagrid-core"
import { createSpreadsheetDemoWorkbookModel } from "../spreadsheetDemoWorkbook"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
  allowSheetQualifiedReferences: true as const,
}

export interface SheetsAppScenarioSection {
  id: string
  label: string
  sheetIds: readonly string[]
}

export interface SheetsAppFormulaExample {
  label: string
  formula: string
  sheetId: string
}

export interface SheetsAppQuickLink {
  label: string
  sheetId: string
}

export interface SheetsAppScenario {
  id: string
  name: string
  description: string
  accentColor: string
  workbookModel: DataGridSpreadsheetWorkbookModel
  sections: readonly SheetsAppScenarioSection[]
  quickLinks: readonly SheetsAppQuickLink[]
  formulaExamples: readonly SheetsAppFormulaExample[]
  notes: readonly string[]
}

function addRevenueOpsFormulaLabSheet(workbook: DataGridSpreadsheetWorkbookModel): void {
  if (workbook.getSheet("formula-lab")) {
    return
  }

  workbook.addSheet({
    id: "formula-lab",
    name: "Formula lab",
    sheetModelOptions: {
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
      sheetStyle: {
        background: "rgba(241, 248, 244, 0.92)",
      },
      columns: [
        { key: "probe", title: "Probe", style: { fontWeight: 600 } },
        { key: "left", title: "Left", style: { textAlign: "right" } },
        { key: "right", title: "Right", style: { textAlign: "right" } },
        { key: "sum", title: "Sum", style: { textAlign: "right", fontWeight: 600 } },
        { key: "ratio", title: "Ratio", style: { textAlign: "right" } },
        { key: "external", title: "Cross-sheet", style: { textAlign: "right" } },
        { key: "note", title: "Why it helps debug" },
      ],
      rows: [
        {
          id: "lab-1",
          cells: {
            probe: "Row arithmetic",
            left: 12,
            right: 4,
            sum: "=[left]@row + [right]@row",
            ratio: "=SAFE_DIVIDE([left]@row, [right]@row, 0)",
            external: "=orders![total]1",
            note: "Single-row edits, autocomplete, and cross-sheet refs in one place.",
          },
        },
        {
          id: "lab-2",
          cells: {
            probe: "Division guard",
            left: 18,
            right: 0,
            sum: "=[left]@row + [right]@row",
            ratio: "=SAFE_DIVIDE([left]@row, [right]@row, 0)",
            external: "=orders![total]2",
            note: "Useful when checking zero divisors and stale formula diagnostics.",
          },
        },
        {
          id: "lab-3",
          cells: {
            probe: "Workbook scan",
            left: 7,
            right: 5,
            sum: "=SUM(TABLE('orders', 'total'))",
            ratio: "=MAX(TABLE('orders-by-customer', 'revenue'))",
            external: "='orders enriched'![tier]1",
            note: "Exercises table scans plus refs into materialized view sheets.",
          },
        },
      ],
    },
  })

  workbook.sync()
}

function createRevenueOpsScenario(): SheetsAppScenario {
  const workbookModel = createSpreadsheetDemoWorkbookModel()
  addRevenueOpsFormulaLabSheet(workbookModel)
  workbookModel.setActiveSheet("formula-lab")

  return {
    id: "revenue-ops",
    name: "Revenue Ops",
    description: "Полноценный workbook-поток с cross-sheet refs, joins, pivots и отдельной лабораторией формул.",
    accentColor: "#1f8f52",
    workbookModel,
    sections: [
      {
        id: "editable",
        label: "Editable sheets",
        sheetIds: ["formula-lab", "orders", "customers", "summary"],
      },
      {
        id: "views",
        label: "Derived views",
        sheetIds: ["orders-by-customer", "orders-enriched", "orders-pivot"],
      },
    ],
    quickLinks: [
      { label: "Formula lab", sheetId: "formula-lab" },
      { label: "Orders", sheetId: "orders" },
      { label: "Summary", sheetId: "summary" },
      { label: "Pivot", sheetId: "orders-pivot" },
    ],
    formulaExamples: [
      { label: "Row math", formula: "=[qty]@row * [price]@row", sheetId: "orders" },
      { label: "Direct ref", formula: "=orders![total]1 + orders![total]2", sheetId: "summary" },
      { label: "Workbook scan", formula: "=SUM(TABLE('orders', 'total'))", sheetId: "formula-lab" },
    ],
    notes: [
      "Использует локальные workspace-пакеты без публикации в npm.",
      "Удобен для проверки materialized views после правок formula engine.",
      "Formula lab держит самые частые баговые сценарии рядом с основным workbook flow.",
    ],
  }
}

function createFormulaQaScenario(): SheetsAppScenario {
  const workbookModel = createDataGridSpreadsheetWorkbookModel({
    activeSheetId: "scratchpad",
    sheets: [
      {
        id: "scratchpad",
        name: "Scratchpad",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(255, 255, 255, 0.88)",
          },
          columns: [
            { key: "probe", title: "Probe", style: { fontWeight: 600 } },
            { key: "status", title: "Status" },
            { key: "a", title: "A", style: { textAlign: "right" } },
            { key: "b", title: "B", style: { textAlign: "right" } },
            { key: "total", title: "Total", style: { textAlign: "right", fontWeight: 600 } },
            { key: "safe", title: "Safe divide", style: { textAlign: "right" } },
            { key: "lookupRate", title: "Rate", style: { textAlign: "right" } },
            { key: "weighted", title: "Weighted", style: { textAlign: "right", fontWeight: 600 } },
          ],
          rows: [
            {
              id: "scratch-1",
              cells: {
                probe: "Nominal",
                status: "pass",
                a: 14,
                b: 7,
                total: "=[a]@row + [b]@row",
                safe: "=SAFE_DIVIDE([a]@row, [b]@row, 0)",
                lookupRate: "=lookup![rate]1",
                weighted: "=[total]@row * [lookupRate]@row",
              },
            },
            {
              id: "scratch-2",
              cells: {
                probe: "Zero divisor",
                status: "warning",
                a: 9,
                b: 0,
                total: "=[a]@row + [b]@row",
                safe: "=SAFE_DIVIDE([a]@row, [b]@row, 0)",
                lookupRate: "=lookup![rate]2",
                weighted: "=[total]@row * [lookupRate]@row",
              },
            },
            {
              id: "scratch-3",
              cells: {
                probe: "Cross-sheet",
                status: "pass",
                a: 21,
                b: 6,
                total: "=lookup![base]1 + [a]@row",
                safe: "=SAFE_DIVIDE([total]@row, [b]@row, 0)",
                lookupRate: "=lookup![rate]3",
                weighted: "=[total]@row * [lookupRate]@row",
              },
            },
          ],
        },
      },
      {
        id: "lookup",
        name: "Lookup",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(255, 249, 240, 0.9)",
          },
          columns: [
            { key: "label", title: "Label", style: { fontWeight: 600 } },
            { key: "base", title: "Base", style: { textAlign: "right" } },
            { key: "rate", title: "Rate", style: { textAlign: "right" } },
          ],
          rows: [
            { id: "lookup-1", cells: { label: "North", base: 3, rate: 1.15 } },
            { id: "lookup-2", cells: { label: "West", base: 5, rate: 0.92 } },
            { id: "lookup-3", cells: { label: "Enterprise", base: 8, rate: 1.42 } },
          ],
        },
      },
      {
        id: "qa-summary",
        name: "QA Summary",
        sheetModelOptions: {
          referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
          sheetStyle: {
            background: "rgba(245, 250, 255, 0.92)",
          },
          columns: [
            { key: "metric", title: "Metric", style: { fontWeight: 600 } },
            { key: "value", title: "Value", style: { textAlign: "right", fontWeight: 700 } },
            { key: "note", title: "Expectation" },
          ],
          rows: [
            {
              id: "summary-1",
              cells: {
                metric: "Weighted total",
                value: "=SUM(TABLE('scratchpad', 'weighted'))",
                note: "Workbook scan across the editable probe sheet.",
              },
            },
            {
              id: "summary-2",
              cells: {
                metric: "First scratch total",
                value: "=scratchpad![total]1",
                note: "Direct sheet-qualified reference into the probe grid.",
              },
            },
            {
              id: "summary-3",
              cells: {
                metric: "Broken reference",
                value: "=scratchpad![missing]1",
                note: "Intentionally invalid so diagnostics stay easy to reproduce.",
              },
            },
          ],
        },
      },
      {
        id: "scratchpad-by-status",
        name: "Scratchpad by status",
        kind: "view",
        sourceSheetId: "scratchpad",
        sheetModelOptions: {
          sheetStyle: {
            background: "rgba(240, 253, 250, 0.9)",
          },
        },
        pipeline: [
          {
            type: "group",
            by: [{ key: "status", label: "Status" }],
            aggregations: [
              { key: "rows", agg: "count", label: "Rows" },
              { key: "weightedTotal", field: "weighted", agg: "sum", label: "Weighted total" },
            ],
          },
        ],
      },
    ],
  })
  workbookModel.sync()

  return {
    id: "formula-qa",
    name: "Formula QA",
    description: "Компактный workspace для изоляции багов: guards, direct refs, view materialization и намеренные ошибки.",
    accentColor: "#295f40",
    workbookModel,
    sections: [
      {
        id: "editable",
        label: "Editable sheets",
        sheetIds: ["scratchpad", "lookup", "qa-summary"],
      },
      {
        id: "views",
        label: "Derived views",
        sheetIds: ["scratchpad-by-status"],
      },
    ],
    quickLinks: [
      { label: "Scratchpad", sheetId: "scratchpad" },
      { label: "Lookup", sheetId: "lookup" },
      { label: "QA summary", sheetId: "qa-summary" },
      { label: "Grouped view", sheetId: "scratchpad-by-status" },
    ],
    formulaExamples: [
      { label: "Guarded divide", formula: "=SAFE_DIVIDE([a]@row, [b]@row, 0)", sheetId: "scratchpad" },
      { label: "Cross-sheet rate", formula: "=lookup![rate]1", sheetId: "scratchpad" },
      { label: "Intentional error", formula: "=scratchpad![missing]1", sheetId: "qa-summary" },
    ],
    notes: [
      "Небольшой набор листов, чтобы быстрее воспроизводить edge cases.",
      "Есть намеренно сломанная формула, чтобы тестировать диагностику и UX ошибок.",
      "Групповой view помогает ловить рассинхрон после пересчета editable sheet.",
    ],
  }
}

export function createSheetsAppScenarios(): SheetsAppScenario[] {
  return [
    createRevenueOpsScenario(),
    createFormulaQaScenario(),
  ]
}

export function recreateSheetsAppScenario(id: string): SheetsAppScenario {
  return id === "formula-qa"
    ? createFormulaQaScenario()
    : createRevenueOpsScenario()
}

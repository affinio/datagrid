import { describe, expect, it } from "vitest"
import {
  buildDataGridCellRenderModel,
  createDataGridCellTypeRegistry,
  parseDataGridCellDraftValue,
  resolveDataGridCellClickAction,
  resolveDataGridCellKeyboardAction,
  resolveDataGridCellType,
  toggleDataGridCellValue,
} from "../runtime.js"

describe("data grid cell engine", () => {
  it("resolves cell types from the canonical cellType contract", () => {
    expect(resolveDataGridCellType({
      column: { key: "approved", cellType: "checkbox" },
    }).id).toBe("checkbox")

    expect(resolveDataGridCellType({
      column: { key: "status", cellType: "select" },
    }).id).toBe("select")

    expect(resolveDataGridCellType({
      column: { key: "amount", cellType: "currency" },
    }).id).toBe("currency")
  })

  it("builds display models through the resolved formatter", () => {
    expect(buildDataGridCellRenderModel({
      column: { key: "approved", cellType: "checkbox" },
      value: true,
      editable: true,
    })).toMatchObject({
      formattedValue: "true",
      displayValue: "☑",
      cellType: "checkbox",
      clickAction: "toggle",
      editorMode: "none",
    })

    expect(buildDataGridCellRenderModel({
      column: {
        key: "amount",
        cellType: "currency",
        presentation: {
          format: {
            number: {
              locale: "en-GB",
              style: "currency",
              currency: "GBP",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          },
        },
      },
      value: 1234.5,
    })).toMatchObject({
      formattedValue: "£1,234.50",
      displayValue: "£1,234.50",
    })
  })

  it("parses typed drafts back into raw values", () => {
    expect(parseDataGridCellDraftValue({
      column: { key: "amount", cellType: "currency" },
      draft: "£1,200.50",
    })).toBe(1200.5)

    expect(parseDataGridCellDraftValue({
      column: { key: "approved", cellType: "checkbox" },
      draft: "true",
    })).toBe(true)

    expect(parseDataGridCellDraftValue({
      column: {
        key: "status",
        cellType: "select",
        presentation: {
          options: ["Pending", "Approved", "Rejected"],
        },
      },
      draft: "Approved",
    })).toBe("Approved")
  })

  it("resolves keyboard and click behavior from the cell type", () => {
    expect(resolveDataGridCellKeyboardAction({
      column: { key: "approved", cellType: "checkbox" },
      editable: true,
      key: " ",
    })).toBe("toggle")

    expect(resolveDataGridCellKeyboardAction({
      column: { key: "status", cellType: "select" },
      editable: true,
      key: "Enter",
    })).toBe("openSelect")

    expect(resolveDataGridCellClickAction({
      column: { key: "approved", cellType: "checkbox" },
      editable: true,
    })).toBe("toggle")
  })

  it("supports registry overrides without changing grid code", () => {
    const registry = createDataGridCellTypeRegistry({
      definitions: [{
        id: "tag",
        formatter: value => `[${String(value ?? "")}]`,
        displayFormatter: formattedValue => formattedValue.toUpperCase(),
        parser: draft => draft.trim(),
        editorMode: "text",
      }],
    })

    expect(buildDataGridCellRenderModel({
      column: { key: "status", cellType: "tag" },
      value: "hot",
      registry,
    })).toMatchObject({
      formattedValue: "[hot]",
      displayValue: "[HOT]",
    })

    expect(toggleDataGridCellValue({
      column: { key: "approved", cellType: "checkbox" },
      value: false,
    })).toBe(true)
  })
})
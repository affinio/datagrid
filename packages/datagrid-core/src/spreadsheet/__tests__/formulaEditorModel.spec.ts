import { describe, expect, it } from "vitest"
import {
  analyzeDataGridSpreadsheetCellInput,
  createDataGridSpreadsheetCellFormulaModel,
  createDataGridSpreadsheetCellFormulaRuntimeModel,
  mapDataGridSpreadsheetCellFormulaModelReferences,
  mapDataGridSpreadsheetCellFormulaRuntimeModelBindings,
  renderDataGridSpreadsheetCellFormulaModel,
  renderDataGridSpreadsheetCellFormulaRuntimeModel,
} from "../formulaEditorModel.js"

const SPREADSHEET_REFERENCE_OPTIONS = {
  syntax: "smartsheet" as const,
  smartsheetAbsoluteRowBase: 1 as const,
}

describe("spreadsheet formula model helpers", () => {
  it("mutates normalized references and renders updated formula text", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=[qty]2 + [price]@row", {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })
    const model = createDataGridSpreadsheetCellFormulaModel(analysis, {
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })

    expect(model).not.toBeNull()

    const nextModel = mapDataGridSpreadsheetCellFormulaModelReferences(model!, (reference) => {
      if (reference.referenceName !== "qty") {
        return null
      }
      return {
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rowSelector: {
          kind: "absolute",
          rowIndex: 2,
        },
      }
    }, {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })

    expect(renderDataGridSpreadsheetCellFormulaModel(nextModel, {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })).toBe("=[qty]3 + [price]@row")
  })

  it("renders raw text overrides such as #REF!", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=[qty]2 + [price]@row", {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })
    const model = createDataGridSpreadsheetCellFormulaModel(analysis, {
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })

    expect(model).not.toBeNull()

    const nextModel = mapDataGridSpreadsheetCellFormulaModelReferences(model!, (reference) => {
      if (reference.referenceName !== "qty") {
        return null
      }
      return {
        rawText: "#REF!",
      }
    }, {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })

    expect(renderDataGridSpreadsheetCellFormulaModel(nextModel, {
      currentRowIndex: 0,
      referenceParserOptions: SPREADSHEET_REFERENCE_OPTIONS,
    })).toBe("=#REF! + [price]@row")
  })

  it("rewrites only targeted sheet-qualified absolute references", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=orders![qty]2 + customers![tier]2 + [price]@row", {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })
    const model = createDataGridSpreadsheetCellFormulaModel(analysis, {
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })

    expect(model).not.toBeNull()

    const nextModel = mapDataGridSpreadsheetCellFormulaModelReferences(model!, (reference) => {
      if (reference.sheetReference !== "orders" || reference.rowSelector.kind !== "absolute") {
        return null
      }
      return {
        sheetReference: reference.sheetReference,
        referenceName: reference.referenceName,
        rowSelector: {
          kind: "absolute",
          rowIndex: reference.rowSelector.rowIndex + 1,
        },
        outputSyntax: reference.outputSyntax,
      }
    }, {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })

    expect(renderDataGridSpreadsheetCellFormulaModel(nextModel, {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })).toBe("=orders![qty]3 + customers![tier]2 + [price]@row")
  })

  it("mutates runtime bindings separately from editor spans and preserves rendered text parity", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=orders![qty]2 + [price]@row", {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })
    const model = createDataGridSpreadsheetCellFormulaModel(analysis, {
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })
    const runtimeModel = createDataGridSpreadsheetCellFormulaRuntimeModel(analysis)

    expect(model).not.toBeNull()
    expect(runtimeModel).not.toBeNull()

    const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(runtimeModel!, (binding) => {
      if (binding.kind !== "reference" || binding.sheetReference !== "orders") {
        return null
      }
      return {
        sheetReference: binding.sheetReference,
        referenceName: binding.referenceName,
        rowSelector: {
          kind: "absolute",
          rowIndex: 2,
        },
      }
    }, {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })

    expect(renderDataGridSpreadsheetCellFormulaRuntimeModel(nextRuntimeModel, model!, {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })).toBe("=orders![qty]3 + [price]@row")
  })

  it("renders runtime invalid bindings as #REF! while keeping editor model untouched", () => {
    const analysis = analyzeDataGridSpreadsheetCellInput("=orders![qty]2 + [price]@row", {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })
    const model = createDataGridSpreadsheetCellFormulaModel(analysis, {
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })
    const runtimeModel = createDataGridSpreadsheetCellFormulaRuntimeModel(analysis)

    expect(model).not.toBeNull()
    expect(runtimeModel).not.toBeNull()

    const nextRuntimeModel = mapDataGridSpreadsheetCellFormulaRuntimeModelBindings(runtimeModel!, (binding) => {
      if (binding.kind !== "reference" || binding.sheetReference !== "orders") {
        return null
      }
      return { kind: "invalid" }
    }, {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })

    expect(renderDataGridSpreadsheetCellFormulaRuntimeModel(nextRuntimeModel, model!, {
      currentRowIndex: 0,
      referenceParserOptions: {
        ...SPREADSHEET_REFERENCE_OPTIONS,
        allowSheetQualifiedReferences: true,
      },
    })).toBe("=#REF! + [price]@row")
    expect(model!.rawInput).toBe("=orders![qty]2 + [price]@row")
  })
})

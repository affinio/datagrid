import {
  createDataGridSpreadsheetSheetModel,
  type DataGridSpreadsheetCellStylePatch,
  type DataGridSpreadsheetReferenceSheet,
  type DataGridSpreadsheetSheetModel,
  type DataGridSpreadsheetSheetState,
} from "./sheet.js"
import { isTypedPlainSpreadsheetSheetState } from "./sheetStateGuards.js"
import type {
  DataGridSpreadsheetWorkbookViewDefinition,
  DataGridSpreadsheetWorkbookViewSheetModelOptions,
} from "./viewPipeline.js"
import {
  createDataGridSpreadsheetDerivedSheetRuntime,
  type DataGridSpreadsheetDerivedSheetRuntime,
} from "./derivedSheetRuntime.js"

export type CreateSpreadsheetWorkbookSheetStateExportInput =
  | {
    id: string
    name: string
    kind: "data"
    viewDefinition: null
    viewSheetModelOptions: null
    derivedRuntime: null
    sheetState: DataGridSpreadsheetSheetState
    runtimeManagedFormulaTableAliases: ReadonlySet<string>
  }
  | {
    id: string
    name: string
    kind: "view"
    viewDefinition: DataGridSpreadsheetWorkbookViewDefinition
    viewSheetModelOptions: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
    derivedRuntime: DataGridSpreadsheetDerivedSheetRuntime
    sheetState: null
    runtimeManagedFormulaTableAliases: ReadonlySet<string>
  }

export interface SpreadsheetWorkbookPersistedViewSheetStateLike {
  id: string
  name: string
  kind: "view"
  viewDefinition: DataGridSpreadsheetWorkbookViewDefinition
  sheetState: DataGridSpreadsheetSheetState
}

export interface SpreadsheetWorkbookPersistedDataSheetStateLike {
  id: string
  name: string
  kind: "data"
  viewDefinition: null
  sheetState: DataGridSpreadsheetSheetState
}

export type SpreadsheetWorkbookPersistedSheetStateLike =
  | SpreadsheetWorkbookPersistedDataSheetStateLike
  | SpreadsheetWorkbookPersistedViewSheetStateLike

export type SpreadsheetWorkbookRestoreDescriptor =
  | {
    id: string
    name: string
    kind: "data"
    viewDefinition: null
    sheetState: DataGridSpreadsheetSheetState
    viewSheetModelOptions: null
    initialDerivedRuntime: null
  }
  | {
    id: string
    name: string
    kind: "view"
    viewDefinition: DataGridSpreadsheetWorkbookViewDefinition
    sheetState: DataGridSpreadsheetSheetState
    viewSheetModelOptions: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
    initialDerivedRuntime: DataGridSpreadsheetDerivedSheetRuntime
  }

export interface HydrateSpreadsheetWorkbookDataSheetModelOptions {
  sheetState: DataGridSpreadsheetSheetState
  sheetModelOptions: DataGridSpreadsheetWorkbookViewSheetModelOptions | null
  sheetId: string
  sheetName: string
  resolveSheetReference: (sheetReference: string) => DataGridSpreadsheetReferenceSheet | null
}

export type SpreadsheetWorkbookSheetStateExportPayload =
  | {
    id: string
    name: string
    kind: "data"
    viewDefinition: null
    sheetState: DataGridSpreadsheetSheetState
  }
  | {
    id: string
    name: string
    kind: "view"
    viewDefinition: DataGridSpreadsheetWorkbookViewDefinition
    sheetState: DataGridSpreadsheetSheetState
  }

export function normalizeSpreadsheetWorkbookViewSheetModelOptions(
  options: DataGridSpreadsheetWorkbookViewSheetModelOptions | null | undefined,
): DataGridSpreadsheetWorkbookViewSheetModelOptions | null {
  if (!options) {
    return {
      rawInputRetention: "formula-only",
    }
  }
  return {
    sheetStyle: options.sheetStyle ?? null,
    functionRegistry: options.functionRegistry,
    referenceParserOptions: options.referenceParserOptions,
    runtimeErrorPolicy: options.runtimeErrorPolicy ?? "error-value",
    rawInputRetention: options.rawInputRetention ?? "formula-only",
    resolveContextValue: options.resolveContextValue,
  }
}

export function resolveSpreadsheetWorkbookViewSheetModelOptionsFromState(
  state: DataGridSpreadsheetSheetState,
): DataGridSpreadsheetWorkbookViewSheetModelOptions {
  return {
    sheetStyle: state.sheetStyle ?? null,
    functionRegistry: state.functionRegistry,
    referenceParserOptions: state.referenceParserOptions,
    runtimeErrorPolicy: state.runtimeErrorPolicy,
    rawInputRetention: "formula-only",
    resolveContextValue: state.resolveContextValue,
  }
}

export function createMetadataOnlyDerivedRuntimeFromSheetState(
  state: DataGridSpreadsheetSheetState,
): DataGridSpreadsheetDerivedSheetRuntime {
  return createDataGridSpreadsheetDerivedSheetRuntime({
    columns: state.columns.map(column => ({
      key: column.key,
      title: column.title,
      formulaAlias: column.formulaAlias,
      style: column.style ?? null,
    })),
    rows: Object.freeze([]),
  })
}

function createSpreadsheetWorkbookDataSheetModelBaseOptions(
  options: HydrateSpreadsheetWorkbookDataSheetModelOptions,
): Omit<Parameters<typeof createDataGridSpreadsheetSheetModel>[0], "rows"> {
  const { sheetState, sheetModelOptions, sheetId, sheetName } = options
  return {
    sheetId,
    sheetName,
    columns: sheetState.columns.map(column => ({
      key: column.key,
      title: column.title,
      formulaAlias: column.formulaAlias,
      style: column.style,
    })),
    sheetStyle: sheetState.sheetStyle,
    formulaTables: sheetState.formulaTables,
    functionRegistry: sheetModelOptions?.functionRegistry ?? sheetState.functionRegistry,
    referenceParserOptions: sheetModelOptions?.referenceParserOptions ?? sheetState.referenceParserOptions,
    runtimeErrorPolicy: sheetModelOptions?.runtimeErrorPolicy ?? sheetState.runtimeErrorPolicy,
    rawInputRetention: sheetModelOptions?.rawInputRetention,
    resolveContextValue: sheetModelOptions?.resolveContextValue ?? sheetState.resolveContextValue,
    resolveSheetReference: (sheetReference) => options.resolveSheetReference(sheetReference),
  }
}

export function hydrateSpreadsheetWorkbookDataSheetModel(
  options: HydrateSpreadsheetWorkbookDataSheetModelOptions,
): DataGridSpreadsheetSheetModel {
  const {
    sheetState,
    sheetId,
  } = options

  const baseOptions = createSpreadsheetWorkbookDataSheetModelBaseOptions(options)

  if (isTypedPlainSpreadsheetSheetState(sheetState)) {
    const sheetModel = createDataGridSpreadsheetSheetModel({
      ...baseOptions,
      rows: [],
    })
    sheetModel.restoreState(sheetState)
    return sheetModel
  }

  const cellStylePatches: DataGridSpreadsheetCellStylePatch[] = []
  const rows = sheetState.rows.map((row, rowIndex) => {
    const cells: Record<string, string> = {}
    for (const cell of row.cells) {
      cells[cell.columnKey] = cell.rawInput
      if (cell.style != null) {
        cellStylePatches.push({
          cell: {
            sheetId,
            rowId: row.id,
            rowIndex,
            columnKey: cell.columnKey,
          },
          style: cell.style,
        })
      }
    }
    return {
      id: row.id,
      style: row.style,
      cells,
    }
  })

  const sheetModel = createDataGridSpreadsheetSheetModel({
    ...baseOptions,
    rows,
  })

  if (cellStylePatches.length > 0) {
    sheetModel.setCellStyles(cellStylePatches)
  }

  return sheetModel
}

export function createSpreadsheetWorkbookSheetStateExport(
  input: CreateSpreadsheetWorkbookSheetStateExportInput,
): SpreadsheetWorkbookSheetStateExportPayload {
  if (input.kind === "view") {
    return {
      id: input.id,
      name: input.name,
      kind: "view",
      viewDefinition: input.viewDefinition,
      sheetState: {
        sheetId: input.id,
        sheetName: input.name,
        columns: Object.freeze(input.derivedRuntime.columns.map(column => ({
          key: column.key,
          title: column.title,
          formulaAlias: column.formulaAlias,
          style: column.style,
        }))),
        rows: Object.freeze([]),
        sheetStyle: input.viewSheetModelOptions?.sheetStyle ?? null,
        formulaTables: Object.freeze([]),
        functionRegistry: input.viewSheetModelOptions?.functionRegistry,
        referenceParserOptions: input.viewSheetModelOptions?.referenceParserOptions,
        runtimeErrorPolicy: input.viewSheetModelOptions?.runtimeErrorPolicy ?? "error-value",
        resolveContextValue: input.viewSheetModelOptions?.resolveContextValue,
      },
    }
  }

  return {
    id: input.id,
    name: input.name,
    kind: "data",
    viewDefinition: null,
    sheetState: {
      ...input.sheetState,
      sheetId: input.id,
      sheetName: input.name,
      formulaTables: Object.freeze(
        input.sheetState.formulaTables.filter(binding => !input.runtimeManagedFormulaTableAliases.has(
          String(binding.name ?? "").trim().toLowerCase(),
        )),
      ),
    },
  }
}

export function createSpreadsheetWorkbookRestoreDescriptor(
  persistedSheet: SpreadsheetWorkbookPersistedSheetStateLike,
  options: {
    normalizeSheetId: (value: unknown) => string
    normalizeSheetName: (value: unknown) => string
  },
): SpreadsheetWorkbookRestoreDescriptor {
  const id = options.normalizeSheetId(persistedSheet.id)
  const name = options.normalizeSheetName(persistedSheet.name)
  if (persistedSheet.kind === "view") {
    if (!persistedSheet.viewDefinition) {
      throw new Error(
        `[DataGridSpreadsheetWorkbook] view sheet '${id}' is missing its definition during restore.`,
      )
    }
    return {
      id,
      name,
      kind: "view",
      viewDefinition: persistedSheet.viewDefinition,
      sheetState: persistedSheet.sheetState,
      viewSheetModelOptions: resolveSpreadsheetWorkbookViewSheetModelOptionsFromState(
        persistedSheet.sheetState,
      ),
      initialDerivedRuntime: createMetadataOnlyDerivedRuntimeFromSheetState(persistedSheet.sheetState),
    }
  }
  return {
    id,
    name,
    kind: "data",
    viewDefinition: null,
    sheetState: persistedSheet.sheetState,
    viewSheetModelOptions: null,
    initialDerivedRuntime: null,
  }
}

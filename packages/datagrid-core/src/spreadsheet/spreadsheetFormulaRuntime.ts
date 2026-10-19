import {
  createFormulaErrorValue,
  type DataGridCompiledFormulaField,
} from "../models/formula/formulaEngine.js"
import type {
  DataGridComputedFieldComputeContext,
  DataGridFormulaErrorValue,
  DataGridFormulaValue,
} from "../models/formula/formulaContracts.js"
import type {
  DataGridSpreadsheetCellAddress,
  DataGridSpreadsheetCellFormulaModel,
  DataGridSpreadsheetCellFormulaRuntimeModel,
  DataGridSpreadsheetCellInputAnalysis,
  DataGridSpreadsheetFormulaReferenceSpan,
} from "./formulaEditorModel.js"
import { cloneCellAddress } from "./spreadsheetCellRuntime.js"
import type { DataGridSpreadsheetFormulaStructuralCellSnapshot } from "./sheetModel.js"

export interface SpreadsheetFormulaCellState {
  key: string
  address: DataGridSpreadsheetCellAddress
  analysis: DataGridSpreadsheetCellInputAnalysis
  formulaModel: DataGridSpreadsheetCellFormulaModel
  formulaRuntime: DataGridSpreadsheetCellFormulaRuntimeModel
  compiled: DataGridCompiledFormulaField<Record<string, unknown>> | null
  dependencies: readonly DataGridSpreadsheetCellAddress[]
  dependencyKeys: readonly string[]
  contextKeys: readonly string[]
}

export interface SpreadsheetFormulaStateMaps {
  analysisByCellKey: Map<string, DataGridSpreadsheetCellInputAnalysis>
  formulaCellByKey: Map<string, SpreadsheetFormulaCellState>
  dependentsByCellKey: Map<string, Set<string>>
}

export type SpreadsheetFormulaCellEvaluator = (
  formulaCell: SpreadsheetFormulaCellState,
  dirtyFormulaKeys: ReadonlySet<string> | null,
  cache: Map<string, DataGridFormulaValue>,
  visiting: Set<string>,
) => DataGridFormulaValue

export function createSpreadsheetFormulaEvaluator(options: {
  formulaCells: ReadonlyMap<string, SpreadsheetFormulaCellState>
  createContext: (
    formulaCell: SpreadsheetFormulaCellState,
    dirtyFormulaKeys: ReadonlySet<string> | null,
    cache: Map<string, DataGridFormulaValue>,
    visiting: Set<string>,
    evaluateFormulaCell: SpreadsheetFormulaCellEvaluator,
  ) => DataGridComputedFieldComputeContext<Record<string, unknown>>
  setResolvedValue: (cellKey: string, value: unknown) => boolean
}): {
  evaluateFormulaCell: SpreadsheetFormulaCellEvaluator
  applyFormulaEvaluation(dirtyFormulaKeys: ReadonlySet<string> | null): boolean
} {
  function evaluateFormulaCell(
    formulaCell: SpreadsheetFormulaCellState,
    dirtyFormulaKeys: ReadonlySet<string> | null,
    cache: Map<string, DataGridFormulaValue>,
    visiting: Set<string>,
  ): DataGridFormulaValue {
    const cached = cache.get(formulaCell.key)
    if (typeof cached !== "undefined") {
      return cached
    }
    if (!formulaCell.analysis.isFormulaValid || !formulaCell.compiled) {
      const errorValue = createSpreadsheetFormulaDiagnosticError(formulaCell.analysis)
      cache.set(formulaCell.key, errorValue)
      return errorValue
    }
    if (visiting.has(formulaCell.key)) {
      const errorValue = createFormulaErrorValue({
        code: "EVAL_ERROR",
        message: `Circular spreadsheet formula dependency at row ${formulaCell.address.rowIndex + 1}, column '${formulaCell.address.columnKey}'.`,
      })
      cache.set(formulaCell.key, errorValue)
      return errorValue
    }
    visiting.add(formulaCell.key)
    const nextValue = formulaCell.compiled.compute(
      options.createContext(formulaCell, dirtyFormulaKeys, cache, visiting, evaluateFormulaCell),
    )
    visiting.delete(formulaCell.key)
    cache.set(formulaCell.key, nextValue)
    return nextValue
  }

  function applyFormulaEvaluation(dirtyFormulaKeys: ReadonlySet<string> | null): boolean {
    if (options.formulaCells.size === 0) {
      return false
    }
    const cache = new Map<string, DataGridFormulaValue>()
    const visiting = new Set<string>()
    let changed = false
    for (const formulaCell of options.formulaCells.values()) {
      if (dirtyFormulaKeys && !dirtyFormulaKeys.has(formulaCell.key)) {
        continue
      }
      const nextValue = evaluateFormulaCell(formulaCell, dirtyFormulaKeys, cache, visiting)
      if (options.setResolvedValue(formulaCell.key, nextValue)) {
        changed = true
      }
    }
    return changed
  }

  return { evaluateFormulaCell, applyFormulaEvaluation }
}

export function createSpreadsheetFormulaStructuralCellSnapshot(
  formulaCell: SpreadsheetFormulaCellState,
): DataGridSpreadsheetFormulaStructuralCellSnapshot {
  return {
    address: cloneCellAddress(formulaCell.address),
    formula: formulaCell.formulaModel.formula ?? formulaCell.analysis.formula ?? "",
    contextKeys: formulaCell.contextKeys,
    dependencies: formulaCell.dependencies,
    formulaModel: formulaCell.formulaModel,
    formulaRuntime: formulaCell.formulaRuntime,
  }
}

export function createCompiledSpreadsheetFormulaTemplate(
  formulaModel: DataGridSpreadsheetCellFormulaModel,
  createReferenceToken: (index: number) => string,
): string {
  let nextFormula = formulaModel.rawInput
  const references = [...formulaModel.references].sort((left, right) => right.span.start - left.span.start)
  for (const reference of references) {
    nextFormula = `${nextFormula.slice(0, reference.span.start)}${createReferenceToken(reference.index)}${nextFormula.slice(reference.span.end)}`
  }
  return nextFormula
}

export function setSpreadsheetFormulaDependentLinkInMap(
  map: Map<string, Set<string>>,
  sourceCellKey: string,
  dependentCellKey: string,
): void {
  const dependents = map.get(sourceCellKey)
  if (dependents) {
    dependents.add(dependentCellKey)
    return
  }
  map.set(sourceCellKey, new Set([dependentCellKey]))
}

export function deleteSpreadsheetFormulaDependentLink(
  map: Map<string, Set<string>>,
  sourceCellKey: string,
  dependentCellKey: string,
): void {
  const dependents = map.get(sourceCellKey)
  if (!dependents) {
    return
  }
  dependents.delete(dependentCellKey)
  if (dependents.size === 0) {
    map.delete(sourceCellKey)
  }
}

export function collectSpreadsheetFormulaDependentClosure(
  seedCellKeys: ReadonlySet<string>,
  dependentsByCellKey: ReadonlyMap<string, ReadonlySet<string>>,
  formulaCellByKey: ReadonlyMap<string, SpreadsheetFormulaCellState>,
): ReadonlySet<string> {
  const visited = new Set<string>()
  const queue = [...seedCellKeys]
  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || visited.has(current)) {
      continue
    }
    visited.add(current)
    const directDependents = dependentsByCellKey.get(current)
    if (!directDependents) {
      continue
    }
    for (const dependent of directDependents) {
      if (!visited.has(dependent)) {
        queue.push(dependent)
      }
    }
  }
  const dirtyFormulaKeys = new Set<string>()
  for (const cellKey of visited) {
    if (formulaCellByKey.has(cellKey)) {
      dirtyFormulaKeys.add(cellKey)
    }
  }
  return dirtyFormulaKeys
}

export function areSpreadsheetFormulaNumberArraysEqual(
  left: readonly number[],
  right: readonly number[],
): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

export function canPreserveMovedSpreadsheetFormulaValueOnInsert(
  formulaCell: SpreadsheetFormulaCellState,
  insertIndex: number,
  isCurrentSheetReference: (sheetReference: string | null | undefined) => boolean,
): boolean {
  for (const reference of formulaCell.analysis.references) {
    if (!isCurrentSheetReference(reference.sheetReference)) {
      continue
    }
    if (
      reference.rowSelector.kind !== "current"
      && reference.rowSelector.kind !== "relative"
    ) {
      return false
    }
    for (const targetRowIndex of reference.targetRowIndexes) {
      if (targetRowIndex < insertIndex) {
        return false
      }
    }
  }
  return true
}

export function canPreserveMovedSpreadsheetFormulaValueOnRemove(
  formulaCell: SpreadsheetFormulaCellState,
  removeIndex: number,
  removedRowCount: number,
  isCurrentSheetReference: (sheetReference: string | null | undefined) => boolean,
): boolean {
  for (const reference of formulaCell.analysis.references) {
    if (!isCurrentSheetReference(reference.sheetReference)) {
      continue
    }
    if (
      reference.rowSelector.kind !== "current"
      && reference.rowSelector.kind !== "relative"
    ) {
      return false
    }
    for (const targetRowIndex of reference.targetRowIndexes) {
      if (targetRowIndex < removeIndex + removedRowCount) {
        return false
      }
    }
  }
  return true
}

export function shiftSpreadsheetFormulaAnalysisByRowOffset(
  analysis: DataGridSpreadsheetCellInputAnalysis,
  rowOffset: number,
): DataGridSpreadsheetCellInputAnalysis {
  if (analysis.kind !== "formula" || analysis.references.length === 0 || rowOffset === 0) {
    return analysis
  }

  let changed = false
  const nextReferences = analysis.references.map((reference): DataGridSpreadsheetFormulaReferenceSpan => {
    if (
      reference.rowSelector.kind !== "current"
      && reference.rowSelector.kind !== "relative"
      && reference.rowSelector.kind !== "window"
    ) {
      return reference
    }
    const nextTargetRowIndexes = Object.freeze(reference.targetRowIndexes.map(targetRowIndex => targetRowIndex + rowOffset))
    if (areSpreadsheetFormulaNumberArraysEqual(reference.targetRowIndexes, nextTargetRowIndexes)) {
      return reference
    }
    changed = true
    return Object.freeze({
      ...reference,
      targetRowIndexes: nextTargetRowIndexes,
    })
  })

  if (!changed) {
    return analysis
  }
  return {
    ...analysis,
    references: Object.freeze(nextReferences),
  }
}

export function createSpreadsheetFormulaDiagnosticError(
  analysis: DataGridSpreadsheetCellInputAnalysis,
): DataGridFormulaErrorValue {
  const firstDiagnostic = analysis.diagnostics[0]
  return createFormulaErrorValue({
    code: "EVAL_ERROR",
    message: firstDiagnostic?.message ?? "Invalid spreadsheet formula.",
  })
}

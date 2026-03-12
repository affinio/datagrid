import type {
  DataGridComputedDependencyToken,
  DataGridFormulaMetaField,
  DataGridFormulaReferenceRowDomain,
  DataGridRowNode,
} from "../rowModel.js"
import {
  isDataGridFormulaMetaField,
  parseDataGridComputedDependencyToken,
} from "../rowModel.js"
import { normalizeDataGridDependencyToken } from "../dependency/dependencyModel.js"
import { parseFormulaReferenceSegments } from "../formula/formulaEngine.js"
import type {
  ClientRowComputedRegistryRuntimeState,
  DataGridComputedColumnReadContext,
  DataGridComputedTokenReader,
  DataGridRegisteredComputedField,
  DataGridResolvedComputedDependency,
} from "./clientRowComputedRegistryRuntime.js"

type DataGridCompiledPathSegment = string | number

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function compileDataGridPathSegments(path: string): readonly DataGridCompiledPathSegment[] {
  const segments = parseFormulaReferenceSegments(path)
  return Object.freeze([...segments])
}

export function createCompiledDataGridRowDataReader(
  field: string,
): (source: unknown) => unknown {
  const normalizedField = field.trim()
  if (normalizedField.length === 0) {
    return () => undefined
  }
  const compiledSegments = compileDataGridPathSegments(normalizedField)
  return (source: unknown) => {
    if (!isRecord(source)) {
      return undefined
    }
    const directValue = (source as Record<string, unknown>)[normalizedField]
    if (typeof directValue !== "undefined") {
      return directValue
    }
    let current: unknown = source
    for (const segment of compiledSegments) {
      if (typeof segment === "number") {
        if (!Array.isArray(current) || segment >= current.length) {
          return undefined
        }
        current = current[segment]
        continue
      }
      if (!isRecord(current) || !(segment in current)) {
        return undefined
      }
      current = (current as Record<string, unknown>)[segment]
    }
    return current
  }
}

function resolveDataGridFormulaMetaValue<T>(
  rowNode: DataGridRowNode<T>,
  key: DataGridFormulaMetaField,
): unknown {
  if (key === "rowId") {
    return rowNode.rowId
  }
  if (key === "rowKey") {
    return rowNode.rowKey
  }
  if (key === "sourceIndex") {
    return rowNode.sourceIndex
  }
  if (key === "originalIndex") {
    return rowNode.originalIndex
  }
  if (key === "kind") {
    return rowNode.kind
  }
  return rowNode.kind === "group"
}

function createColumnAwareFieldReader<T>(
  field: string,
  readField: (rowNode: DataGridRowNode<T>) => unknown,
): DataGridComputedTokenReader<T> {
  return (
    rowNode: DataGridRowNode<T>,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => {
    if (
      columnReadContext
      && typeof rowIndex === "number"
      && rowIndex >= 0
    ) {
      return columnReadContext.readFieldAtRow(field, rowIndex, rowNode)
    }
    return readField(rowNode)
  }
}

function resolveRowDomainIndexes(
  rowDomain: DataGridFormulaReferenceRowDomain,
  rowIndex: number | undefined,
): readonly number[] | null {
  const rowDomainWindowKind = "win" + "dow"
  const absoluteRowDomainWindowKind = `absolute-${rowDomainWindowKind}`
  if (rowDomain.kind === "current") {
    return typeof rowIndex === "number" ? [rowIndex] : null
  }
  if (rowDomain.kind === "absolute") {
    return [rowDomain.rowIndex]
  }
  if (rowDomain.kind === absoluteRowDomainWindowKind) {
    const indexes: number[] = []
    for (let targetRowIndex = rowDomain.startRowIndex; targetRowIndex <= rowDomain.endRowIndex; targetRowIndex += 1) {
      indexes.push(targetRowIndex)
    }
    return indexes
  }
  if (typeof rowIndex !== "number") {
    return null
  }
  if (rowDomain.kind === "relative") {
    return [rowIndex + rowDomain.offset]
  }
  const indexes: number[] = []
  const step = rowDomain.startOffset <= rowDomain.endOffset ? 1 : -1
  for (
    let offset = rowDomain.startOffset;
    step > 0 ? offset <= rowDomain.endOffset : offset >= rowDomain.endOffset;
    offset += step
  ) {
    indexes.push(rowIndex + offset)
  }
  return indexes
}

function createRowAwareTokenReader<T>(options: {
  rowDomain: DataGridFormulaReferenceRowDomain
  readCurrent: (rowNode: DataGridRowNode<T>) => unknown
  readAtRow: (
    rowNode: DataGridRowNode<T>,
    targetRowIndex: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => unknown
}): DataGridComputedTokenReader<T> {
  const { rowDomain, readCurrent, readAtRow } = options
  const rowDomainWindowKind = "win" + "dow"
  const absoluteRowDomainWindowKind = `absolute-${rowDomainWindowKind}`
  const isWindowRowDomain = rowDomain.kind === rowDomainWindowKind || rowDomain.kind === absoluteRowDomainWindowKind
  return (
    rowNode: DataGridRowNode<T>,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => {
    const targetIndexes = resolveRowDomainIndexes(rowDomain, rowIndex)
    if (!targetIndexes || targetIndexes.length === 0) {
      return isWindowRowDomain ? Object.freeze([]) : undefined
    }
    const readValueAtIndex = (targetRowIndex: number): unknown => {
      if (typeof rowIndex === "number" && targetRowIndex === rowIndex) {
        const cachedCurrentValue = readAtRow(rowNode, targetRowIndex, columnReadContext)
        return typeof cachedCurrentValue === "undefined"
          ? readCurrent(rowNode)
          : cachedCurrentValue
      }
      return readAtRow(rowNode, targetRowIndex, columnReadContext)
    }
    if (isWindowRowDomain) {
      const values: unknown[] = []
      for (const targetRowIndex of targetIndexes) {
        if (targetRowIndex < 0) {
          continue
        }
        const value = readValueAtIndex(targetRowIndex)
        if (typeof value === "undefined") {
          continue
        }
        values.push(value)
      }
      return Object.freeze(values)
    }
    const [targetRowIndex] = targetIndexes
    if (typeof targetRowIndex !== "number" || targetRowIndex < 0) {
      return undefined
    }
    return readValueAtIndex(targetRowIndex)
  }
}

function createComputedFieldReader<T>(
  computedDependency: DataGridRegisteredComputedField<T> | undefined,
  rowDomain: DataGridFormulaReferenceRowDomain,
  resolveRowFieldReader: (fieldInput: string) => (rowNode: DataGridRowNode<T>) => unknown,
): DataGridComputedTokenReader<T> {
  if (!computedDependency) {
    return () => undefined
  }
  const field = computedDependency.field
  const readField = resolveRowFieldReader(field)
  return createRowAwareTokenReader({
    rowDomain,
    readCurrent: readField,
    readAtRow: (rowNode, targetRowIndex, columnReadContext) => (
      columnReadContext
        ? columnReadContext.readFieldAtRow(field, targetRowIndex, rowNode)
        : undefined
    ),
  })
}

function createDeferredComputedFieldReader<T>(options: {
  computedName: string
  rowDomain: DataGridFormulaReferenceRowDomain
  state: ClientRowComputedRegistryRuntimeState<T>
  resolveRowFieldReader: (fieldInput: string) => (rowNode: DataGridRowNode<T>) => unknown,
}): DataGridComputedTokenReader<T> {
  const { computedName, rowDomain, state, resolveRowFieldReader } = options
  return (
    rowNode: DataGridRowNode<T>,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ) => {
    const computedDependency = state.computedFieldsByName.get(computedName)
    if (!computedDependency) {
      return undefined
    }
    const field = computedDependency.field
    return createRowAwareTokenReader({
      rowDomain,
      readCurrent: resolveRowFieldReader(field),
      readAtRow: (currentRowNode, targetRowIndex, targetColumnReadContext) => (
        targetColumnReadContext
          ? targetColumnReadContext.readFieldAtRow(field, targetRowIndex, currentRowNode)
          : undefined
      ),
    })(rowNode, rowIndex, columnReadContext)
  }
}

export function createComputedRegistryTokenResolverRuntime<T>(options: {
  state: ClientRowComputedRegistryRuntimeState<T>
  resolveRowFieldValue?: (
    rowNode: DataGridRowNode<T>,
    field: string,
    readBaseValue: (rowNode: DataGridRowNode<T>) => unknown,
  ) => unknown
}) {
  const { state, resolveRowFieldValue } = options

  const resolveComputedDependency = (
    value: DataGridComputedDependencyToken,
  ): DataGridResolvedComputedDependency => {
    const parsedToken = parseDataGridComputedDependencyToken(value)
    if (parsedToken) {
      return {
        token: normalizeDataGridDependencyToken(String(value), parsedToken.domain),
        domain: parsedToken.domain,
        value: parsedToken.name,
        rowDomain: parsedToken.rowDomain,
      }
    }
    const normalizedToken = normalizeDataGridDependencyToken(String(value), "field")
    if (normalizedToken.startsWith("computed:")) {
      return {
        token: normalizedToken,
        domain: "computed",
        value: normalizedToken.slice("computed:".length),
        rowDomain: { kind: "current" },
      }
    }
    if (normalizedToken.startsWith("meta:")) {
      return {
        token: normalizedToken,
        domain: "meta",
        value: normalizedToken.slice("meta:".length),
        rowDomain: { kind: "current" },
      }
    }
    return {
      token: normalizedToken,
      domain: "field",
      value: normalizedToken.slice("field:".length),
      rowDomain: { kind: "current" },
    }
  }

  const resolveRowFieldReader = (
    fieldInput: string,
  ): ((rowNode: DataGridRowNode<T>) => unknown) => {
    const field = fieldInput.trim()
    if (field.length === 0) {
      return () => undefined
    }
    const cachedReader = state.rowFieldReaderCache.get(field)
    if (cachedReader) {
      return cachedReader
    }
    const readDataValue = createCompiledDataGridRowDataReader(field)
    const nextReader = (rowNode: DataGridRowNode<T>): unknown => {
      const readBaseValue = (inputRowNode: DataGridRowNode<T>): unknown => {
        return readDataValue(inputRowNode.data as unknown)
      }
      return resolveRowFieldValue
        ? resolveRowFieldValue(rowNode, field, readBaseValue)
        : readBaseValue(rowNode)
    }
    state.rowFieldReaderCache.set(field, nextReader)
    return nextReader
  }

  const createDependencyReader = (
    dependency: DataGridResolvedComputedDependency,
  ): DataGridComputedTokenReader<T> => {
    if (dependency.domain === "meta") {
      if (!isDataGridFormulaMetaField(dependency.value)) {
        return () => undefined
      }
      const metaField = dependency.value
      return createRowAwareTokenReader({
        rowDomain: dependency.rowDomain,
        readCurrent: (rowNode) => resolveDataGridFormulaMetaValue(rowNode, metaField),
        readAtRow: (rowNode, targetRowIndex, columnReadContext) => {
          if (!columnReadContext || targetRowIndex < 0) {
            return undefined
          }
          return columnReadContext.readFieldAtRow(String(metaField), targetRowIndex, rowNode)
        },
      })
    }
    if (dependency.domain === "computed") {
      const computedDependency = state.computedFieldsByName.get(dependency.value)
      return computedDependency
        ? createComputedFieldReader(computedDependency, dependency.rowDomain, resolveRowFieldReader)
        : createDeferredComputedFieldReader({
            computedName: dependency.value,
            rowDomain: dependency.rowDomain,
            state,
            resolveRowFieldReader,
          })
    }
    return createRowAwareTokenReader({
      rowDomain: dependency.rowDomain,
      readCurrent: resolveRowFieldReader(dependency.value),
      readAtRow: (rowNode, targetRowIndex, columnReadContext) => (
        columnReadContext
          ? columnReadContext.readFieldAtRow(dependency.value, targetRowIndex, rowNode)
          : undefined
      ),
    })
  }

  const createTokenReader = (tokenInput: string): DataGridComputedTokenReader<T> => {
    if (!tokenInput.includes(":")) {
      const computedDependency = state.computedFieldsByName.get(tokenInput)
      if (computedDependency) {
        return createComputedFieldReader(computedDependency, { kind: "current" }, resolveRowFieldReader)
      }
      return createColumnAwareFieldReader(tokenInput, resolveRowFieldReader(tokenInput))
    }

    const dependency = resolveComputedDependency(tokenInput)
    return createDependencyReader(dependency)
  }

  const resolveComputedTokenValue = (
    rowNode: DataGridRowNode<T>,
    token: DataGridComputedDependencyToken,
    rowIndex?: number,
    columnReadContext?: DataGridComputedColumnReadContext<T>,
  ): unknown => {
    if (typeof token !== "string") {
      return undefined
    }
    const tokenInput = token.trim()
    if (tokenInput.length === 0) {
      return undefined
    }
    let reader = state.computedTokenReaderCache.get(tokenInput)
    if (!reader) {
      reader = createTokenReader(tokenInput)
      state.computedTokenReaderCache.set(tokenInput, reader)
    }
    return reader(rowNode, rowIndex, columnReadContext)
  }

  return {
    createDependencyReader,
    resolveComputedDependency,
    resolveComputedTokenValue,
    resolveRowFieldReader,
  }
}

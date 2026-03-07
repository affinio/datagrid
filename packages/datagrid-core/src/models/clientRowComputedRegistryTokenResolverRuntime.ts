import type {
  DataGridComputedDependencyToken,
  DataGridFormulaMetaField,
  DataGridRowNode,
} from "./rowModel.js"
import {
  isDataGridFormulaMetaField,
} from "./rowModel.js"
import { normalizeDataGridDependencyToken } from "./dependencyModel.js"
import { parseFormulaReferenceSegments } from "./formulaEngine/core.js"
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

function createComputedFieldReader<T>(
  computedDependency: DataGridRegisteredComputedField<T> | undefined,
  resolveRowFieldReader: (fieldInput: string) => (rowNode: DataGridRowNode<T>) => unknown,
): DataGridComputedTokenReader<T> {
  if (!computedDependency) {
    return () => undefined
  }
  return createColumnAwareFieldReader(
    computedDependency.field,
    resolveRowFieldReader(computedDependency.field),
  )
}

function createDeferredComputedFieldReader<T>(options: {
  computedName: string
  state: ClientRowComputedRegistryRuntimeState<T>
  resolveRowFieldReader: (fieldInput: string) => (rowNode: DataGridRowNode<T>) => unknown,
}): DataGridComputedTokenReader<T> {
  const { computedName, state, resolveRowFieldReader } = options
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
    if (
      columnReadContext
      && typeof rowIndex === "number"
      && rowIndex >= 0
    ) {
      return columnReadContext.readFieldAtRow(field, rowIndex, rowNode)
    }
    return resolveRowFieldReader(field)(rowNode)
  }
}

export function createComputedRegistryTokenResolverRuntime<T>(options: {
  state: ClientRowComputedRegistryRuntimeState<T>
}) {
  const { state } = options

  const resolveComputedDependency = (
    value: DataGridComputedDependencyToken,
  ): DataGridResolvedComputedDependency => {
    const normalizedToken = normalizeDataGridDependencyToken(String(value), "field")
    if (normalizedToken.startsWith("computed:")) {
      return {
        token: normalizedToken,
        domain: "computed",
        value: normalizedToken.slice("computed:".length),
      }
    }
    if (normalizedToken.startsWith("meta:")) {
      return {
        token: normalizedToken,
        domain: "meta",
        value: normalizedToken.slice("meta:".length),
      }
    }
    return {
      token: normalizedToken,
      domain: "field",
      value: normalizedToken.slice("field:".length),
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
      return readDataValue(rowNode.data as unknown)
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
      return (rowNode: DataGridRowNode<T>) => resolveDataGridFormulaMetaValue(rowNode, metaField)
    }
    if (dependency.domain === "computed") {
      const computedDependency = state.computedFieldsByName.get(dependency.value)
      return computedDependency
        ? createComputedFieldReader(computedDependency, resolveRowFieldReader)
        : createDeferredComputedFieldReader({
            computedName: dependency.value,
            state,
            resolveRowFieldReader,
          })
    }
    return createColumnAwareFieldReader(dependency.value, resolveRowFieldReader(dependency.value))
  }

  const createTokenReader = (tokenInput: string): DataGridComputedTokenReader<T> => {
    if (!tokenInput.includes(":")) {
      const computedDependency = state.computedFieldsByName.get(tokenInput)
      if (computedDependency) {
        return createComputedFieldReader(computedDependency, resolveRowFieldReader)
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

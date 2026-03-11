export type DataGridFillBehavior = "copy" | "series"

export interface DataGridFillBehaviorRange {
  startRow: number
  endRow: number
  startColumn: number
  endColumn: number
}

export interface ResolveDataGridFillBehaviorOptions<
  TRange extends DataGridFillBehaviorRange = DataGridFillBehaviorRange,
> {
  baseRange: TRange
  previewRange: TRange
  sourceMatrix: readonly (readonly string[])[]
}

type DataGridFillAxis = "vertical" | "horizontal" | "none"

function resolveFillAxis<TRange extends DataGridFillBehaviorRange>(
  baseRange: TRange,
  previewRange: TRange,
): DataGridFillAxis {
  const rowChanged = baseRange.startRow !== previewRange.startRow || baseRange.endRow !== previewRange.endRow
  const columnChanged = baseRange.startColumn !== previewRange.startColumn || baseRange.endColumn !== previewRange.endColumn
  if (rowChanged && !columnChanged) {
    return "vertical"
  }
  if (!rowChanged && columnChanged) {
    return "horizontal"
  }
  return "none"
}

function parseFiniteNumber(value: string | undefined): number | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatSeriesValue(value: number, template: string | undefined): string {
  if (!Number.isFinite(value)) {
    return template ?? ""
  }
  const normalizedTemplate = typeof template === "string" ? template.trim() : ""
  const fractionLength = normalizedTemplate.includes(".")
    ? normalizedTemplate.split(".")[1]?.length ?? 0
    : 0
  if (fractionLength > 0) {
    return value.toFixed(fractionLength)
  }
  if (Number.isInteger(value)) {
    return String(value)
  }
  return String(value)
}

function createCopyMatrix<TRange extends DataGridFillBehaviorRange>(
  baseRange: TRange,
  previewRange: TRange,
  sourceMatrix: readonly (readonly string[])[],
): string[][] {
  const rowCount = previewRange.endRow - previewRange.startRow + 1
  const columnCount = previewRange.endColumn - previewRange.startColumn + 1
  const sourceRowCount = Math.max(1, sourceMatrix.length)
  const sourceColumnCount = Math.max(1, sourceMatrix[0]?.length ?? 1)
  const matrix: string[][] = []

  for (let rowOffset = 0; rowOffset < rowCount; rowOffset += 1) {
    const rowValues: string[] = []
    for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
      rowValues.push(sourceMatrix[rowOffset % sourceRowCount]?.[columnOffset % sourceColumnCount] ?? "")
    }
    matrix.push(rowValues)
  }

  void baseRange
  return matrix
}

function buildSeriesMatrix<TRange extends DataGridFillBehaviorRange>(
  baseRange: TRange,
  previewRange: TRange,
  sourceMatrix: readonly (readonly string[])[],
): string[][] {
  const axis = resolveFillAxis(baseRange, previewRange)
  const matrix = createCopyMatrix(baseRange, previewRange, sourceMatrix)
  if (axis === "none") {
    return matrix
  }

  if (axis === "vertical") {
    const sourceHeight = Math.max(1, sourceMatrix.length)
    for (let columnOffset = 0; columnOffset < (matrix[0]?.length ?? 0); columnOffset += 1) {
      const sequence = Array.from({ length: sourceHeight }, (_unused, rowOffset) => sourceMatrix[rowOffset]?.[columnOffset] ?? "")
      const numericSequence = sequence.map(parseFiniteNumber)
      if (numericSequence.some(value => value == null)) {
        continue
      }
      const firstValue = numericSequence[0] ?? 0
      const lastValue = numericSequence[numericSequence.length - 1] ?? 0
      const step = numericSequence.length >= 2
        ? lastValue - (numericSequence[numericSequence.length - 2] ?? lastValue)
        : 1
      const reverseStep = numericSequence.length >= 2
        ? (numericSequence[1] ?? firstValue) - firstValue
        : 1
      const template = sequence[sequence.length - 1] ?? sequence[0] ?? ""

      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
        const absoluteRow = previewRange.startRow + rowOffset
        if (absoluteRow >= baseRange.startRow && absoluteRow <= baseRange.endRow) {
          continue
        }
        if (absoluteRow > baseRange.endRow) {
          const distance = absoluteRow - baseRange.endRow
          matrix[rowOffset]![columnOffset] = formatSeriesValue(lastValue + step * distance, template)
          continue
        }
        const distance = baseRange.startRow - absoluteRow
        matrix[rowOffset]![columnOffset] = formatSeriesValue(firstValue - reverseStep * distance, sequence[0])
      }
    }
    return matrix
  }

  const sourceWidth = Math.max(1, sourceMatrix[0]?.length ?? 1)
  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
    const sequence = Array.from({ length: sourceWidth }, (_unused, columnOffset) => sourceMatrix[rowOffset % Math.max(1, sourceMatrix.length)]?.[columnOffset] ?? "")
    const numericSequence = sequence.map(parseFiniteNumber)
    if (numericSequence.some(value => value == null)) {
      continue
    }
    const firstValue = numericSequence[0] ?? 0
    const lastValue = numericSequence[numericSequence.length - 1] ?? 0
    const step = numericSequence.length >= 2
      ? lastValue - (numericSequence[numericSequence.length - 2] ?? lastValue)
      : 1
    const reverseStep = numericSequence.length >= 2
      ? (numericSequence[1] ?? firstValue) - firstValue
      : 1
    const template = sequence[sequence.length - 1] ?? sequence[0] ?? ""

    for (let columnOffset = 0; columnOffset < matrix[rowOffset]!.length; columnOffset += 1) {
      const absoluteColumn = previewRange.startColumn + columnOffset
      if (absoluteColumn >= baseRange.startColumn && absoluteColumn <= baseRange.endColumn) {
        continue
      }
      if (absoluteColumn > baseRange.endColumn) {
        const distance = absoluteColumn - baseRange.endColumn
        matrix[rowOffset]![columnOffset] = formatSeriesValue(lastValue + step * distance, template)
        continue
      }
      const distance = baseRange.startColumn - absoluteColumn
      matrix[rowOffset]![columnOffset] = formatSeriesValue(firstValue - reverseStep * distance, sequence[0])
    }
  }

  return matrix
}

export function resolveDataGridDefaultFillBehavior<
  TRange extends DataGridFillBehaviorRange = DataGridFillBehaviorRange,
>(
  options: ResolveDataGridFillBehaviorOptions<TRange>,
): DataGridFillBehavior {
  const axis = resolveFillAxis(options.baseRange, options.previewRange)
  if (axis === "none" || options.sourceMatrix.length === 0) {
    return "copy"
  }

  if (axis === "vertical") {
    const sourceHeight = Math.max(1, options.sourceMatrix.length)
    const sourceWidth = Math.max(1, options.sourceMatrix[0]?.length ?? 1)
    for (let columnOffset = 0; columnOffset < sourceWidth; columnOffset += 1) {
      for (let rowOffset = 0; rowOffset < sourceHeight; rowOffset += 1) {
        if (parseFiniteNumber(options.sourceMatrix[rowOffset]?.[columnOffset]) == null) {
          return "copy"
        }
      }
    }
    return "series"
  }

  const sourceWidth = Math.max(1, options.sourceMatrix[0]?.length ?? 1)
  for (const rowValues of options.sourceMatrix) {
    for (let columnOffset = 0; columnOffset < sourceWidth; columnOffset += 1) {
      if (parseFiniteNumber(rowValues?.[columnOffset]) == null) {
        return "copy"
      }
    }
  }
  return "series"
}

export function buildDataGridFillMatrix<
  TRange extends DataGridFillBehaviorRange = DataGridFillBehaviorRange,
>(
  options: ResolveDataGridFillBehaviorOptions<TRange> & {
    behavior: DataGridFillBehavior
  },
): string[][] {
  if (options.behavior === "series") {
    return buildSeriesMatrix(options.baseRange, options.previewRange, options.sourceMatrix)
  }
  return createCopyMatrix(options.baseRange, options.previewRange, options.sourceMatrix)
}
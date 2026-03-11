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

interface ParsedSeriesSeed {
  prefix: string
  numericValue: number
  fractionLength: number
  integerPadWidth: number
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

function parseSeriesSeed(value: string | undefined): ParsedSeriesSeed | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim()
  if (normalized.length === 0) {
    return null
  }
  const match = normalized.match(/^(.*?)(-?\d+(?:\.\d+)?)$/)
  if (!match) {
    return null
  }
  const prefix = match[1] ?? ""
  const numericText = match[2] ?? ""
  const numericValue = Number(numericText)
  if (!Number.isFinite(numericValue)) {
    return null
  }
  const fractionLength = numericText.includes(".")
    ? numericText.split(".")[1]?.length ?? 0
    : 0
  const integerText = fractionLength > 0
    ? (numericText.split(".")[0] ?? "")
    : numericText
  const signlessIntegerText = integerText.startsWith("-")
    ? integerText.slice(1)
    : integerText
  const integerPadWidth = fractionLength === 0
    && signlessIntegerText.length > 1
    && signlessIntegerText.startsWith("0")
    ? signlessIntegerText.length
    : 0
  return {
    prefix,
    numericValue,
    fractionLength,
    integerPadWidth,
  }
}

function resolveSeriesSeeds(sequence: readonly (string | undefined)[]): readonly ParsedSeriesSeed[] | null {
  if (sequence.length === 0) {
    return null
  }
  const parsedSeeds = sequence.map(parseSeriesSeed)
  if (parsedSeeds.some(seed => seed == null)) {
    return null
  }
  const firstSeed = parsedSeeds[0]
  if (!firstSeed) {
    return null
  }
  for (const seed of parsedSeeds) {
    if (!seed) {
      return null
    }
    if (seed.prefix !== firstSeed.prefix) {
      return null
    }
    if (seed.fractionLength !== firstSeed.fractionLength) {
      return null
    }
    if (seed.integerPadWidth !== firstSeed.integerPadWidth) {
      return null
    }
  }
  return parsedSeeds as readonly ParsedSeriesSeed[]
}

function formatSeriesValue(value: number, template: ParsedSeriesSeed | null, fallback: string | undefined): string {
  if (!Number.isFinite(value) || !template) {
    return fallback ?? ""
  }
  if (template.fractionLength > 0) {
    return `${template.prefix}${value.toFixed(template.fractionLength)}`
  }
  if (Number.isInteger(value)) {
    const sign = value < 0 ? "-" : ""
    const absoluteValue = Math.abs(value)
    const integerText = template.integerPadWidth > 0
      ? String(absoluteValue).padStart(template.integerPadWidth, "0")
      : String(absoluteValue)
    return `${template.prefix}${sign}${integerText}`
  }
  return `${template.prefix}${String(value)}`
}

function supportsSeriesFill<TRange extends DataGridFillBehaviorRange>(
  baseRange: TRange,
  previewRange: TRange,
  sourceMatrix: readonly (readonly string[])[],
): boolean {
  const axis = resolveFillAxis(baseRange, previewRange)
  if (axis === "none" || sourceMatrix.length === 0) {
    return false
  }

  if (axis === "vertical") {
    const sourceHeight = Math.max(1, sourceMatrix.length)
    const sourceWidth = Math.max(1, sourceMatrix[0]?.length ?? 1)
    for (let columnOffset = 0; columnOffset < sourceWidth; columnOffset += 1) {
      const sequence = Array.from(
        { length: sourceHeight },
        (_unused, rowOffset) => sourceMatrix[rowOffset]?.[columnOffset],
      )
      if (!resolveSeriesSeeds(sequence)) {
        return false
      }
    }
    return true
  }

  const sourceWidth = Math.max(1, sourceMatrix[0]?.length ?? 1)
  for (let rowOffset = 0; rowOffset < sourceMatrix.length; rowOffset += 1) {
    const sequence = Array.from(
      { length: sourceWidth },
      (_unused, columnOffset) => sourceMatrix[rowOffset]?.[columnOffset],
    )
    if (!resolveSeriesSeeds(sequence)) {
      return false
    }
  }
  return true
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
      const seriesSeeds = resolveSeriesSeeds(sequence)
      if (!seriesSeeds) {
        continue
      }
      const firstValue = seriesSeeds[0]?.numericValue ?? 0
      const lastValue = seriesSeeds[seriesSeeds.length - 1]?.numericValue ?? 0
      const step = seriesSeeds.length >= 2
        ? lastValue - (seriesSeeds[seriesSeeds.length - 2]?.numericValue ?? lastValue)
        : 1
      const reverseStep = seriesSeeds.length >= 2
        ? (seriesSeeds[1]?.numericValue ?? firstValue) - firstValue
        : 1
      const lastTemplate = seriesSeeds[seriesSeeds.length - 1] ?? seriesSeeds[0] ?? null
      const firstTemplate = seriesSeeds[0] ?? null

      for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
        const absoluteRow = previewRange.startRow + rowOffset
        if (absoluteRow >= baseRange.startRow && absoluteRow <= baseRange.endRow) {
          continue
        }
        if (absoluteRow > baseRange.endRow) {
          const distance = absoluteRow - baseRange.endRow
          matrix[rowOffset]![columnOffset] = formatSeriesValue(
            lastValue + step * distance,
            lastTemplate,
            sequence[sequence.length - 1] ?? sequence[0] ?? "",
          )
          continue
        }
        const distance = baseRange.startRow - absoluteRow
        matrix[rowOffset]![columnOffset] = formatSeriesValue(
          firstValue - reverseStep * distance,
          firstTemplate,
          sequence[0],
        )
      }
    }
    return matrix
  }

  const sourceWidth = Math.max(1, sourceMatrix[0]?.length ?? 1)
  for (let rowOffset = 0; rowOffset < matrix.length; rowOffset += 1) {
    const sequence = Array.from({ length: sourceWidth }, (_unused, columnOffset) => sourceMatrix[rowOffset % Math.max(1, sourceMatrix.length)]?.[columnOffset] ?? "")
    const seriesSeeds = resolveSeriesSeeds(sequence)
    if (!seriesSeeds) {
      continue
    }
    const firstValue = seriesSeeds[0]?.numericValue ?? 0
    const lastValue = seriesSeeds[seriesSeeds.length - 1]?.numericValue ?? 0
    const step = seriesSeeds.length >= 2
      ? lastValue - (seriesSeeds[seriesSeeds.length - 2]?.numericValue ?? lastValue)
      : 1
    const reverseStep = seriesSeeds.length >= 2
      ? (seriesSeeds[1]?.numericValue ?? firstValue) - firstValue
      : 1
    const lastTemplate = seriesSeeds[seriesSeeds.length - 1] ?? seriesSeeds[0] ?? null
    const firstTemplate = seriesSeeds[0] ?? null

    for (let columnOffset = 0; columnOffset < matrix[rowOffset]!.length; columnOffset += 1) {
      const absoluteColumn = previewRange.startColumn + columnOffset
      if (absoluteColumn >= baseRange.startColumn && absoluteColumn <= baseRange.endColumn) {
        continue
      }
      if (absoluteColumn > baseRange.endColumn) {
        const distance = absoluteColumn - baseRange.endColumn
        matrix[rowOffset]![columnOffset] = formatSeriesValue(
          lastValue + step * distance,
          lastTemplate,
          sequence[sequence.length - 1] ?? sequence[0] ?? "",
        )
        continue
      }
      const distance = baseRange.startColumn - absoluteColumn
      matrix[rowOffset]![columnOffset] = formatSeriesValue(
        firstValue - reverseStep * distance,
        firstTemplate,
        sequence[0],
      )
    }
  }

  return matrix
}

export function resolveDataGridDefaultFillBehavior<
  TRange extends DataGridFillBehaviorRange = DataGridFillBehaviorRange,
>(
  options: ResolveDataGridFillBehaviorOptions<TRange>,
): DataGridFillBehavior {
  return supportsSeriesFill(options.baseRange, options.previewRange, options.sourceMatrix)
    ? "series"
    : "copy"
}

export function canToggleDataGridFillBehavior<
  TRange extends DataGridFillBehaviorRange = DataGridFillBehaviorRange,
>(
  options: ResolveDataGridFillBehaviorOptions<TRange>,
): boolean {
  return supportsSeriesFill(options.baseRange, options.previewRange, options.sourceMatrix)
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
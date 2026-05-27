export interface ResolveDataGridGanttWheelIntentInput {
  deltaX: number
  deltaY: number
  shiftKey: boolean
}

export interface DataGridGanttWheelIntent {
  horizontalDelta: number
  verticalDelta: number
}

export interface ResolveDataGridGanttWheelHandlingInput extends ResolveDataGridGanttWheelIntentInput {
  nativeHorizontalScrollTarget: boolean
}

export interface DataGridGanttWheelHandling extends DataGridGanttWheelIntent {
  shouldPreventDefault: boolean
}

const WHEEL_NOISE_THRESHOLD = 0.5
const HORIZONTAL_DOMINANCE_RATIO = 1.25

export function resolveDataGridGanttWheelIntent(
  input: ResolveDataGridGanttWheelIntentInput,
): DataGridGanttWheelIntent {
  const absX = Math.abs(input.deltaX)
  const absY = Math.abs(input.deltaY)

  if (input.shiftKey) {
    const horizontalDelta = absX > WHEEL_NOISE_THRESHOLD
      ? input.deltaX
      : input.deltaY
    return Math.abs(horizontalDelta) > WHEEL_NOISE_THRESHOLD
      ? { horizontalDelta, verticalDelta: 0 }
      : { horizontalDelta: 0, verticalDelta: 0 }
  }

  if (absX <= WHEEL_NOISE_THRESHOLD && absY <= WHEEL_NOISE_THRESHOLD) {
    return {
      horizontalDelta: 0,
      verticalDelta: 0,
    }
  }

  if (absX > WHEEL_NOISE_THRESHOLD && absX > absY * HORIZONTAL_DOMINANCE_RATIO) {
    return {
      horizontalDelta: input.deltaX,
      verticalDelta: 0,
    }
  }

  return {
    horizontalDelta: 0,
    verticalDelta: input.deltaY,
  }
}

export function resolveDataGridGanttWheelHandling(
  input: ResolveDataGridGanttWheelHandlingInput,
): DataGridGanttWheelHandling {
  const intent = resolveDataGridGanttWheelIntent(input)
  if (input.nativeHorizontalScrollTarget && intent.horizontalDelta !== 0) {
    return {
      horizontalDelta: 0,
      verticalDelta: 0,
      shouldPreventDefault: false,
    }
  }
  return {
    ...intent,
    shouldPreventDefault: intent.horizontalDelta !== 0 || intent.verticalDelta !== 0,
  }
}

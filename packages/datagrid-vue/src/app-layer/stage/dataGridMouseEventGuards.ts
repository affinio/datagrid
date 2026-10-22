export type DataGridInteractionMode = "desktop" | "touch" | "auto"

export interface DataGridInteractionModeInput {
  interactionMode?: DataGridInteractionMode
  isCoarsePointer?: boolean
}

export interface DataGridMouseEventPolicy {
  interactionMode: Exclude<DataGridInteractionMode, "auto">
  touchGenerated: boolean
  nativeScrollPriority: boolean
  preventDefaultAllowed: boolean
}

export function isTouchGeneratedMouseEvent(event: MouseEvent): boolean {
  const pointerType = (event as MouseEvent & { pointerType?: string }).pointerType
  if (pointerType === "touch") {
    return true
  }
  const sourceCapabilities = (event as MouseEvent & {
    sourceCapabilities?: { firesTouchEvents?: boolean }
  }).sourceCapabilities
  return sourceCapabilities?.firesTouchEvents === true
}

export function resolveDataGridInteractionMode(input: DataGridInteractionModeInput = {}): Exclude<DataGridInteractionMode, "auto"> {
  const interactionMode = input.interactionMode ?? "auto"
  if (interactionMode !== "auto") {
    return interactionMode
  }
  return input.isCoarsePointer === true ? "touch" : "desktop"
}

export function shouldPrioritizeNativeScrollForMouseDown(
  event: MouseEvent,
  input: DataGridInteractionModeInput = {},
): boolean {
  return resolveDataGridMouseEventPolicy(event, input).nativeScrollPriority
}

export function shouldPrioritizeNativeScrollForMouseEvent(
  event: MouseEvent,
  input: DataGridInteractionModeInput = {},
): boolean {
  return resolveDataGridMouseEventPolicy(event, input).nativeScrollPriority
}

export function resolveDataGridMouseEventPolicy(
  event: MouseEvent,
  input: DataGridInteractionModeInput = {},
): DataGridMouseEventPolicy {
  const touchGenerated = isTouchGeneratedMouseEvent(event)
  const interactionMode = resolveDataGridInteractionMode(input)
  const autoMode = (input.interactionMode ?? "auto") === "auto"
  const nativeScrollPriority = touchGenerated && (autoMode || interactionMode === "touch")
  return {
    interactionMode,
    touchGenerated,
    nativeScrollPriority,
    preventDefaultAllowed: !nativeScrollPriority,
  }
}

export function shouldAllowGridPreventDefaultForMouseEvent(
  event: MouseEvent,
  input: DataGridInteractionModeInput = {},
): boolean {
  if (!isTouchGeneratedMouseEvent(event)) {
    return true
  }
  return resolveDataGridMouseEventPolicy(event, input).preventDefaultAllowed
}

export type DataGridInteractionMode = "desktop" | "touch" | "auto"

export interface DataGridInteractionModeInput {
  interactionMode?: DataGridInteractionMode
  isCoarsePointer?: boolean
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
  if (!isTouchGeneratedMouseEvent(event)) {
    return false
  }
  return resolveDataGridInteractionMode(input) === "touch"
}

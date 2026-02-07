export type ColumnPinPosition = "left" | "right" | "none"

export interface ColumnPinNormalizationInput {
  isSystem?: boolean
  pin?: unknown
  sticky?: unknown
  stickyLeft?: unknown
  stickyRight?: unknown
  [key: string]: unknown
}

function hasLegacyLeftPin(input: ColumnPinNormalizationInput): boolean {
  const rawPinned = input.pinned
  const rawLock = input.lock
  const rawLocked = input.locked

  if (rawPinned === true || rawPinned === "left") return true
  if (rawLock === "left" || rawLocked === true) return true
  if (input.sticky === "left") return true
  if (input.stickyLeft === true || typeof input.stickyLeft === "number") return true
  return false
}

function hasLegacyRightPin(input: ColumnPinNormalizationInput): boolean {
  const rawPinned = input.pinned
  const rawLock = input.lock

  if (rawPinned === "right") return true
  if (rawLock === "right") return true
  if (input.sticky === "right") return true
  if (input.stickyRight === true || typeof input.stickyRight === "number") return true
  return false
}

export function resolveColumnPinPosition(input: ColumnPinNormalizationInput): ColumnPinPosition {
  if (input.isSystem === true) {
    return "left"
  }

  if (input.pin === "left" || input.pin === "right") {
    return input.pin
  }
  if (input.pin === "none") {
    return "none"
  }

  if (hasLegacyLeftPin(input)) {
    return "left"
  }
  if (hasLegacyRightPin(input)) {
    return "right"
  }
  return "none"
}

export function normalizeColumnPinInput<TColumn extends ColumnPinNormalizationInput>(
  column: TColumn,
): TColumn & { pin: ColumnPinPosition } {
  const normalized = { ...column, pin: resolveColumnPinPosition(column) } as TColumn & {
    pin: ColumnPinPosition
    pinned?: unknown
    lock?: unknown
    locked?: unknown
    sticky?: unknown
    stickyLeft?: unknown
    stickyRight?: unknown
  }

  delete normalized.pinned
  delete normalized.lock
  delete normalized.locked
  delete normalized.sticky
  delete normalized.stickyLeft
  delete normalized.stickyRight

  return normalized
}

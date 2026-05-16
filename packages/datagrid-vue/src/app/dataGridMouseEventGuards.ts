export function isTouchGeneratedMouseEvent(event: MouseEvent): boolean {
  const sourceCapabilities = (event as MouseEvent & {
    sourceCapabilities?: { firesTouchEvents?: boolean }
  }).sourceCapabilities
  return sourceCapabilities?.firesTouchEvents === true
}

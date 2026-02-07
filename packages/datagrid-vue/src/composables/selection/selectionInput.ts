export interface SelectionPointerCoordinates {
  clientX: number
  clientY: number
}

export function toSelectionPointerCoordinates(event: Pick<MouseEvent, "clientX" | "clientY">): SelectionPointerCoordinates {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
  }
}

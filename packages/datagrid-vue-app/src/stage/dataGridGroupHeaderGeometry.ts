export interface DataGridGroupHeaderGeometryInput {
  groupStart: number
  groupWidth: number
  scrollLeft: number
  viewportWidth: number
  labelWidth: number
}

export interface DataGridGroupHeaderGeometry {
  visible: boolean
  left: number
  width: number
  alignment: "left" | "center" | "right"
}

export function resolveDataGridGroupHeaderGeometry(
  input: DataGridGroupHeaderGeometryInput,
): DataGridGroupHeaderGeometry {
  const scrollLeft = Math.max(0, input.scrollLeft)
  const viewportWidth = Math.max(0, input.viewportWidth)
  const groupStart = input.groupStart
  const groupEnd = groupStart + Math.max(0, input.groupWidth)
  const visibleStart = Math.max(groupStart, scrollLeft)
  const visibleEnd = Math.min(groupEnd, scrollLeft + viewportWidth)
  const width = Math.max(0, visibleEnd - visibleStart)
  if (width === 0) return { visible: false, left: 0, width: 0, alignment: "center" }

  const labelWidth = Math.min(Math.max(0, input.labelWidth), width)
  const visibleStartScreen = visibleStart - scrollLeft
  const visibleEndScreen = visibleEnd - scrollLeft
  const naturalLeft = groupStart - scrollLeft
  const maxLeft = visibleEndScreen - labelWidth
  const screenLeft = Math.min(maxLeft, Math.max(visibleStartScreen, naturalLeft))
  return {
    visible: width > 0,
    left: screenLeft - naturalLeft,
    width: labelWidth,
    alignment: "left",
  }
}

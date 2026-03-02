import type { DataGridVirtualWindowSnapshot } from "./dataGridViewportTypes"

export function buildImperativeScrollSyncSignature(
  scrollTop: number,
  scrollLeft: number,
): string {
  return `${Math.round(scrollTop * 1000)}|${Math.round(scrollLeft * 1000)}`
}

export function buildImperativeWindowSignature(
  snapshot: DataGridVirtualWindowSnapshot,
  scrollTop: number,
  scrollLeft: number,
  viewportHeight: number,
  viewportWidth: number,
): string {
  return [
    snapshot.rowStart,
    snapshot.rowEnd,
    snapshot.rowTotal,
    snapshot.colStart,
    snapshot.colEnd,
    snapshot.colTotal,
    snapshot.overscan.top,
    snapshot.overscan.bottom,
    snapshot.overscan.left,
    snapshot.overscan.right,
    Math.round(scrollTop * 1000),
    Math.round(scrollLeft * 1000),
    Math.round(viewportHeight * 1000),
    Math.round(viewportWidth * 1000),
  ].join("|")
}

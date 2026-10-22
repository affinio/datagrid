export interface DataGridAuthoredRendererPolicy {
  /** Keep authored renderers synchronous (default) or defer them during active scroll. */
  mode?: "sync" | "defer"
  /** Maximum number of cell renderer invocations waiting for scroll idle. */
  maxPending?: number
  /** Number of deferred cells released per animation frame after scroll idle. */
  cellsPerFrame?: number
}

/** Describes an active filtering condition owned by the host application. */
export interface DataGridExternalFilterIndicator {
  /** Stable identifier unique across the grid. */
  id: string
  /** Column header that should display the indicator. */
  columnKey: string
  /** Whether this condition currently affects the displayed rows. */
  active: boolean
  /** Plain-text explanation exposed to users and assistive technology. */
  description: string
}

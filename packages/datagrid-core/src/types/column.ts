import type { ColumnMetric as CoreColumnMetric } from "../virtualization/columnSnapshot"
import type { DataGridCellTypeId } from "../cells/runtime.js"
import type {
  DataGridColumnCapabilities,
  DataGridColumnConstraints,
  DataGridColumnDataType,
  DataGridColumnPresentation,
  DataGridColumnValueAccessors,
} from "../models/columnModel.js"

export type {
  DataGridColumnCapabilities,
  DataGridColumnConstraints,
  DataGridColumnDataType,
  DataGridColumnDateTimeFormatOptions,
  DataGridColumnFormat,
  DataGridColumnOption,
  DataGridColumnNumberFormatOptions,
  DataGridColumnPresentation,
  DataGridColumnValueAccessors,
} from "../models/columnModel.js"

export type {
  DataGridColumnConstraintValue,
  DataGridColumnInitialState,
  DataGridColumnInput,
  DataGridColumnState,
} from "../models/columnModel.js"

/**
 * Column related structural types live in this dedicated module so that runtime utilities
 * like `core/columns/columnGroup.ts` can consume them without re-importing the full table types.
 */
export type DataGridColumnAlignment = "left" | "center" | "right"

export type DataGridColumnPin = "left" | "right" | "none"

export interface DataGridColumn extends DataGridColumnValueAccessors<any> {
  key: string
  field?: string
  label: string
  dataType?: DataGridColumnDataType | string
  cellType?: DataGridCellTypeId | string
  width?: number
  minWidth?: number
  maxWidth?: number
  autoWidth?: boolean
  resizable?: boolean
  sortable?: boolean
  visible?: boolean
  accessor?: (row: any) => unknown
  placeholder?: string
  editable?: boolean
  validator?: (value: unknown, row: any) => boolean | string
  filterType?: "set" | "text" | "number" | "date"
  presentation?: DataGridColumnPresentation<any>
  capabilities?: DataGridColumnCapabilities
  constraints?: DataGridColumnConstraints
  min?: number | Date | string
  max?: number | Date | string
  /**
   * Canonical pin state contract used by runtime and adapters.
   */
  pin?: DataGridColumnPin
  /**
   * Marks a column as a system column (row index, selection checkbox, etc).
   * System columns never participate in filtering or sorting.
   */
  isSystem?: boolean
  userResized?: boolean
}

export interface DataGridColumnGroupDef {
  groupId: string
  headerName: string
  children: (DataGridColumn | DataGridColumnGroupDef)[]
  expandable?: boolean
  expanded?: boolean
  paddingLevel?: number
}

export type DataGridColumnMetric = CoreColumnMetric<DataGridColumn>

export interface HeaderRenderableEntry<TColumn = DataGridColumn> {
  metric: CoreColumnMetric<TColumn>
  showLeftFiller: boolean
  showRightFiller: boolean
}

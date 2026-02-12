import type { DataGridAppearanceConfig as CoreAppearanceConfig } from "@affino/datagrid-core"
import type { DataGridStyleConfig } from "@affino/datagrid-theme"

export interface DataGridOverlayTransformInput {
  viewportWidth: number
  viewportHeight: number
  scrollLeft: number
  scrollTop: number
  pinnedOffsetLeft?: number
  pinnedOffsetRight?: number
}

export interface DataGridOverlayTransform {
  transform: string
  clipPath: string
  willChange: "transform"
}

export interface DataGridAppearanceConfig extends CoreAppearanceConfig {
  styleConfig?: DataGridStyleConfig | null
}

export type { DataGridStyleConfig }

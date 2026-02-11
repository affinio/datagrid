import { computed, ref, watch, type ComputedRef, type Ref } from "vue"
import type { UseDataGridRuntimeResult } from "../../useDataGridRuntime"

export type AffinoRowHeightMode = "fixed" | "auto"

export interface AffinoRowHeightFeatureInput {
  enabled?: boolean
  mode?: AffinoRowHeightMode
  base?: number
}

export interface NormalizedAffinoRowHeightFeature {
  enabled: boolean
  mode: AffinoRowHeightMode
  base: number
}

export interface UseAffinoDataGridRowHeightFeatureOptions<TRow> {
  runtime: UseDataGridRuntimeResult<TRow>
  feature: NormalizedAffinoRowHeightFeature
}

export interface UseAffinoDataGridRowHeightFeatureResult {
  rowHeightEnabled: Ref<boolean>
  rowHeightMode: Ref<AffinoRowHeightMode>
  baseRowHeight: Ref<number>
  rowHeightSupported: ComputedRef<boolean>
  setRowHeightMode: (mode: AffinoRowHeightMode) => void
  setBaseRowHeight: (height: number) => void
  measureVisibleRowHeights: () => boolean
  applyRowHeightSettings: () => boolean
}

interface RowHeightViewportCapability {
  setRowHeightMode?: (mode: AffinoRowHeightMode) => void
  setBaseRowHeight?: (height: number) => void
  measureRowHeight?: () => void
}

const DEFAULT_BASE_ROW_HEIGHT = 40

function normalizeMode(mode: unknown): AffinoRowHeightMode {
  return mode === "auto" ? "auto" : "fixed"
}

function normalizeBase(height: unknown): number {
  if (!Number.isFinite(height)) {
    return DEFAULT_BASE_ROW_HEIGHT
  }
  return Math.max(24, Math.trunc(height as number))
}

export function normalizeRowHeightFeature(
  input: boolean | AffinoRowHeightFeatureInput | undefined,
): NormalizedAffinoRowHeightFeature {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      mode: "fixed",
      base: DEFAULT_BASE_ROW_HEIGHT,
    }
  }
  if (!input) {
    return {
      enabled: false,
      mode: "fixed",
      base: DEFAULT_BASE_ROW_HEIGHT,
    }
  }
  return {
    enabled: input.enabled ?? true,
    mode: normalizeMode(input.mode),
    base: normalizeBase(input.base),
  }
}

export function useAffinoDataGridRowHeightFeature<TRow>(
  options: UseAffinoDataGridRowHeightFeatureOptions<TRow>,
): UseAffinoDataGridRowHeightFeatureResult {
  const rowHeightEnabled = ref(options.feature.enabled)
  const rowHeightMode = ref<AffinoRowHeightMode>(options.feature.mode)
  const baseRowHeight = ref<number>(options.feature.base)

  const resolveViewportService = (): RowHeightViewportCapability => (
    options.runtime.core.getService("viewport") as unknown as RowHeightViewportCapability
  )

  const rowHeightSupported = computed<boolean>(() => {
    const service = resolveViewportService()
    return (
      typeof service.setRowHeightMode === "function" &&
      typeof service.setBaseRowHeight === "function"
    )
  })

  const applyRowHeightSettings = (): boolean => {
    if (!rowHeightEnabled.value || !rowHeightSupported.value) {
      return false
    }
    const service = resolveViewportService()
    service.setRowHeightMode?.(rowHeightMode.value)
    service.setBaseRowHeight?.(baseRowHeight.value)
    return true
  }

  const setRowHeightMode = (mode: AffinoRowHeightMode): void => {
    rowHeightMode.value = normalizeMode(mode)
  }

  const setBaseRowHeight = (height: number): void => {
    baseRowHeight.value = normalizeBase(height)
  }

  const measureVisibleRowHeights = (): boolean => {
    if (!rowHeightEnabled.value || !rowHeightSupported.value) {
      return false
    }
    const service = resolveViewportService()
    if (typeof service.measureRowHeight !== "function") {
      return false
    }
    service.measureRowHeight()
    return true
  }

  watch([rowHeightEnabled, rowHeightMode, baseRowHeight], () => {
    applyRowHeightSettings()
  }, { immediate: true })

  return {
    rowHeightEnabled,
    rowHeightMode,
    baseRowHeight,
    rowHeightSupported,
    setRowHeightMode,
    setBaseRowHeight,
    measureVisibleRowHeights,
    applyRowHeightSettings,
  }
}

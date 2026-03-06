import { watch, type Ref } from "vue"
import type { DataGridFeature } from "../grid/types"

export interface UseDataGridFeatureInstallerOptions<TRow = unknown> {
  grid: {
    has(name: string): boolean
    use(feature: DataGridFeature<TRow, string, unknown>): unknown
  }
  features: Ref<readonly string[]>
  registry: Partial<Record<string, () => DataGridFeature<TRow, string, unknown>>>
  onUnknownFeature?: (name: string) => void
}

export function useDataGridFeatureInstaller<TRow = unknown>(options: UseDataGridFeatureInstallerOptions<TRow>): void {
  watch(
    () => options.features.value,
    nextFeatures => {
      for (const featureName of nextFeatures) {
        const createFeature = options.registry[featureName]
        if (!createFeature) {
          options.onUnknownFeature?.(featureName)
          continue
        }

        const feature = createFeature()
        if (options.grid.has(feature.name)) {
          continue
        }

        options.grid.use(feature)
      }
    },
    { immediate: true, deep: true },
  )
}

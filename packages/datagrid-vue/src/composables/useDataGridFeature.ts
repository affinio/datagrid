import { computed, type ComputedRef } from "vue"
import { useDataGridEngineContext } from "./useDataGridEngineContext"

export function useFeature<TFeature = unknown>(name: string): ComputedRef<TFeature | null> {
  const { grid } = useDataGridEngineContext()

  return computed<TFeature | null>(() => {
    const feature = (grid as { get: (featureName: string) => unknown }).get(name)
    return feature && typeof feature === "object" ? feature as TFeature : null
  })
}


import { onBeforeUnmount } from "vue"
import { useDataGridRuntime } from "../composables/useDataGridRuntime"
import { createGridEventBus } from "./eventBus"
import type {
  CreateGridOptions,
  DataGridFeature,
  GridContext,
  GridFeatureAccessor,
  GridFeatureCleanup,
  GridEventHandler,
  GridFeatureMap,
  GridInstance,
  ResolveFeatureValue,
} from "./types"

export function createGrid<TRow = unknown>(options: CreateGridOptions<TRow>): GridInstance<TRow, {}> {
  const runtime = useDataGridRuntime<TRow>(options)
  const api = runtime.api
  const featureMap = new Map<string, unknown>()
  const installedFeatures = {} as GridFeatureMap
  const featureCleanups = new Map<string, GridFeatureCleanup>()
  const eventBus = createGridEventBus()

  const runFeatureCleanups = (): unknown[] => {
    const errors: unknown[] = []
    for (const cleanup of featureCleanups.values()) {
      try { cleanup() } catch (error) { errors.push(error) }
    }
    featureCleanups.clear()
    return errors
  }

  const gridContext: GridContext<TRow> = {
    runtime,
    api,
    features: featureMap,
    on: eventBus.on,
    off: eventBus.off,
    emit: eventBus.emit,
  }

  const use = <
    TFeatures extends GridFeatureMap,
    TName extends string,
    TFeature,
  >(
    feature: DataGridFeature<TRow, TName, TFeature>,
  ): GridInstance<TRow, TFeatures & Record<TName, ResolveFeatureValue<TFeature>>> => {
    if (featureMap.has(feature.name)) {
      return grid as unknown as GridInstance<TRow, TFeatures & Record<TName, ResolveFeatureValue<TFeature>>>
    }

    for (const dependencyName of feature.requires ?? []) {
      if (!featureMap.has(dependencyName)) {
        throw new Error(`Feature \"${feature.name}\" requires \"${dependencyName}\".`)
      }
    }

    const result = feature.setup(gridContext)
    if (typeof result === "function") {
      featureCleanups.set(feature.name, result as GridFeatureCleanup)
    }

    const installed = (typeof result === "function" ? true : (result ?? true)) as ResolveFeatureValue<TFeature>
    featureMap.set(feature.name, installed)
    installedFeatures[feature.name] = installed

    return grid as unknown as GridInstance<TRow, TFeatures & Record<TName, ResolveFeatureValue<TFeature>>>
  }

  const has = (name: string): boolean => {
    return featureMap.has(name)
  }

  const get = <
    TFeatures extends GridFeatureMap,
    TName extends keyof TFeatures,
  >(
    name: TName,
  ): TFeatures[TName] | undefined => {
    return installedFeatures[name as string] as TFeatures[TName] | undefined
  }

  const on = (event: string, handler: GridEventHandler): (() => void) => {
    return eventBus.on(event, handler)
  }

  const off = (event: string, handler: GridEventHandler): void => {
    eventBus.off(event, handler)
  }

  const emit = (event: string, payload?: unknown): void => {
    eventBus.emit(event, payload)
  }

  const featureAccessorFn = (<
    TFeatures extends GridFeatureMap,
    TName extends keyof TFeatures,
  >(
    name: TName,
  ): TFeatures[TName] | undefined => {
    return get<TFeatures, TName>(name)
  }) as GridFeatureAccessor<GridFeatureMap>

  const feature = new Proxy(featureAccessorFn, {
    get(target, property, receiver) {
      if (typeof property === "string" && property in installedFeatures) {
        return installedFeatures[property]
      }
      return Reflect.get(target, property, receiver)
    },
  }) as GridFeatureAccessor<GridFeatureMap>

  const runtimeStop = runtime.stop.bind(runtime)
  runtime.stop = async () => {
    const errors = runFeatureCleanups()
    eventBus.clear()
    try { await runtimeStop() } catch (error) { errors.push(error) }
    if (errors.length > 0) {
      throw Object.assign(new Error("[DataGridVue] grid cleanup completed with failures."), { errors })
    }
  }

  onBeforeUnmount(() => {
    const errors = runFeatureCleanups()
    eventBus.clear()
    if (errors.length > 0) console.error("[DataGridVue] feature cleanup failed during unmount.", errors)
  })

  const grid: GridInstance<TRow, GridFeatureMap> = {
    runtime,
    api,
    features: installedFeatures,
    use,
    has,
    get,
    feature,
    on,
    off,
    emit,
  }

  return grid as GridInstance<TRow, {}>
}

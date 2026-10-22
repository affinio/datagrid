import { computed, nextTick, onBeforeUnmount, ref, watch, type ComputedRef } from "vue"
import type { DataGridSetStateOptions, DataGridUnifiedState } from "@affino/datagrid-vue/headless"
import {
  resolveDataGridStatePersistenceStorage,
  type DataGridPersistenceChangeEvent,
  type DataGridResolvedStatePersistenceOptions,
} from "./config/dataGridStatePersistence"

type State = DataGridUnifiedState<Record<string, unknown>>

export function useDataGridStatePersistence(options: {
  config: ComputedRef<DataGridResolvedStatePersistenceOptions | null>
  columnKeys: () => readonly string[]
  getState: (includeViewportPosition: boolean) => State | null
  migrate: (value: unknown) => State | null
  apply: (state: State, options: DataGridSetStateOptions) => void
  emit: (event: DataGridPersistenceChangeEvent) => void
  ready: () => void
}) {
  const runtimeReady = ref(false)
  const loading = ref(Boolean(options.config.value))
  let generation = 0
  let restored = false
  let disposed = false
  let defaults: State | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let resizeActive = false
  let lastSavedSignature: string | null = null
  let writes: Promise<void> = Promise.resolve()

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function prepare(state: State, config: DataGridResolvedStatePersistenceOptions): State {
    return {
      ...state,
      transaction: null,
      selection: config.includeSelection ? state.selection : null,
      rowSelection: config.includeSelection ? state.rowSelection : null,
      view: config.includeViewportPosition ? state.view : undefined,
      rows: {
        ...state.rows,
        snapshot: {
          ...state.rows.snapshot,
          groupExpansion: config.includeGroupExpansion ? state.rows.snapshot.groupExpansion : { expandedByDefault: state.rows.snapshot.groupBy?.expandedByDefault ?? false, toggledGroupKeys: [] },
        },
      },
    }
  }

  // Runtime counters and loading flags are not user preferences. They must not
  // trigger writes on every datasource refresh or viewport movement.
  function signature(state: State): string {
    const row = state.rows.snapshot
    return JSON.stringify({
      columns: state.columns, sort: row.sortModel, filter: row.filterModel,
      groupBy: row.groupBy, expansion: row.groupExpansion, pivot: row.pivotModel,
      aggregation: state.rows.aggregationModel,
      page: row.pagination && { pageSize: row.pagination.pageSize, currentPage: row.pagination.currentPage },
      selection: state.selection, rowSelection: state.rowSelection, view: state.view,
    })
  }

  function reconcileColumns(state: State, baseline: State): State {
    const known = new Set(baseline.columns.order)
    const pick = <T>(record: Record<string, T>): Record<string, T> => Object.fromEntries(
      Object.entries(record ?? {}).filter(([key]) => known.has(key)),
    )
    const columns = state.columns
    const order = [...new Set([...columns.order.filter(key => known.has(key)), ...baseline.columns.order])]
    const zoneOrder = columns.zoneOrder
    return {
      ...state,
      columns: {
        order,
        visibility: { ...baseline.columns.visibility, ...pick(columns.visibility) },
        widths: { ...baseline.columns.widths, ...pick(columns.widths) },
        pins: { ...baseline.columns.pins, ...pick(columns.pins) },
        ...(zoneOrder ? { zoneOrder: {
          pinnedLeft: (zoneOrder.pinnedLeft ?? []).filter(key => known.has(key)),
          center: (zoneOrder.center ?? []).filter(key => known.has(key)),
          pinnedRight: (zoneOrder.pinnedRight ?? []).filter(key => known.has(key)),
        } } : {}),
      },
    }
  }

  function report(config: DataGridResolvedStatePersistenceOptions, epoch: number, event: Omit<DataGridPersistenceChangeEvent, "key">) {
    if (!disposed && epoch === generation) options.emit({ key: config.key, ...event })
  }

  function save(config = options.config.value): Promise<boolean> {
    clearTimer()
    if (!config || !restored || loading.value || resizeActive) return Promise.resolve(false)
    const current = options.getState(config.includeViewportPosition)
    if (!current) return Promise.resolve(false)
    const state = JSON.parse(JSON.stringify(prepare(current, config))) as State
    const nextSignature = signature(state)
    if (nextSignature === lastSavedSignature) return Promise.resolve(true)
    const epoch = generation
    const write = async (): Promise<boolean> => {
      // Serialize writes, including reset, so an older request cannot finish last.
      if (epoch === generation && nextSignature === lastSavedSignature) return true
      report(config, epoch, { status: "saving", operation: "save" })
      try {
        if (Boolean(config.load) !== Boolean(config.save)) {
          throw new Error("Async persistence requires both load and save callbacks")
        }
        if (config.save) {
          await config.save({ key: config.key, state })
        } else {
          const storage = resolveDataGridStatePersistenceStorage(config.storage)
          if (!storage) throw new Error("Persistence storage is unavailable")
          storage.setItem(config.key, JSON.stringify(state))
        }
        if (epoch === generation) lastSavedSignature = nextSignature
        report(config, epoch, { status: "ready" })
        return true
      } catch (error) {
        report(config, epoch, { status: "error", operation: "save", error })
        return false
      }
    }
    // localStorage must flush synchronously on pagehide/unmount.
    if (!config.save) return write()
    const result = writes.then(write)
    writes = result.then(() => undefined)
    return result
  }

  function scheduleSave(): void {
    clearTimer()
    const config = options.config.value
    if (!config || !restored || loading.value || resizeActive || disposed) return
    timer = setTimeout(() => { void save() }, config.debounceMs)
  }

  async function restore(): Promise<void> {
    const epoch = ++generation
    clearTimer()
    restored = false
    lastSavedSignature = null
    const config = options.config.value
    loading.value = Boolean(config)
    if (!runtimeReady.value || (config && options.columnKeys().length === 0)) return
    await nextTick()
    if (epoch !== generation || disposed) return
    const baseline = defaults ?? options.getState(true)
    if (!baseline) return
    defaults = baseline
    if (!config) {
      loading.value = false
      options.ready()
      return
    }
    report(config, epoch, { status: "loading", operation: "load" })
    try {
      if (Boolean(config.load) !== Boolean(config.save)) {
        throw new Error("Async persistence requires both load and save callbacks")
      }
      // A failed load for a new key must never reveal another user's preferences.
      options.apply(prepare(baseline, config), config.setOptions)
      // Wait for earlier writes when a key is revisited on the same instance.
      await writes
      if (epoch !== generation || disposed) return
      let payload: unknown = null
      if (config.restoreOnReady) {
        if (config.load) payload = await config.load({ key: config.key })
        else {
          const storage = resolveDataGridStatePersistenceStorage(config.storage)
          if (!storage) throw new Error("Persistence storage is unavailable")
          const raw = storage.getItem(config.key)
          payload = raw == null ? null : JSON.parse(raw)
        }
      }
      if (epoch !== generation || disposed) return
      const migrated = payload == null ? baseline : options.migrate(payload)
      if (!migrated?.rows?.snapshot || !Array.isArray(migrated.columns?.order)) {
        throw new Error("Unsupported persisted grid state")
      }
      options.apply(prepare(reconcileColumns(migrated, baseline), config), config.setOptions)
      await nextTick()
      if (epoch !== generation || disposed) return
      restored = true
      const current = options.getState(config.includeViewportPosition)
      if (payload != null && current) lastSavedSignature = signature(prepare(current, config))
      loading.value = false
      report(config, epoch, { status: "ready" })
      options.ready()
      if (payload == null) scheduleSave()
    } catch (error) {
      if (epoch !== generation || disposed) return
      loading.value = false
      // Do not overwrite unreadable preferences with defaults on mount/unmount.
      report(config, epoch, { status: "error", operation: "load", error })
      options.ready()
    }
  }

  async function resetPersistedState(): Promise<boolean> {
    const config = options.config.value
    if (!config || !defaults || !runtimeReady.value || options.columnKeys().length === 0) return false
    const wasLoading = loading.value
    const epoch = ++generation // Ignore any pending load for this key.
    clearTimer()
    options.apply(prepare(defaults, config), config.setOptions)
    await nextTick()
    if (epoch !== generation || disposed) return false
    loading.value = false
    restored = true
    lastSavedSignature = null
    if (wasLoading) options.ready()
    return save()
  }

  function startResize(event: Event): void {
    const target = event.target
    if (!(target instanceof Element) || !target.closest(".col-resize, .row-resize-handle")) return
    resizeActive = true
    clearTimer()
  }
  function endResize(): void {
    if (!resizeActive) return
    resizeActive = false
    scheduleSave()
  }

  watch(() => options.columnKeys().join("\u0000"), async () => {
    await nextTick()
    if (disposed) return
    const current = options.getState(true)
    if (defaults && current) defaults = reconcileColumns(defaults, current)
    if (!restored) void restore()
  })

  const sameSession = (
    left: DataGridResolvedStatePersistenceOptions | null,
    right: DataGridResolvedStatePersistenceOptions | null,
  ): boolean => {
    if (left === right) return true
    if (!left || !right) return false
    return left.key === right.key
      && left.storage === right.storage
      && left.includeViewportPosition === right.includeViewportPosition
      && left.includeSelection === right.includeSelection
      && left.includeGroupExpansion === right.includeGroupExpansion
      && left.restoreOnReady === right.restoreOnReady
      && left.debounceMs === right.debounceMs
      && JSON.stringify(left.setOptions) === JSON.stringify(right.setOptions)
  }

  watch([options.config, runtimeReady], (current, previous) => {
    const sessionChanged = !previous || !sameSession(previous[0], current[0])
    if (sessionChanged && previous?.[0]) {
      // Flush a pending edit under the old key before beginning the new session.
      void save(previous[0])
    }
    if (sessionChanged || !previous || previous[1] !== current[1]) void restore()
  })
  if (typeof window !== "undefined") {
    window.addEventListener("mouseup", endResize)
    window.addEventListener("pointerup", endResize)
    window.addEventListener("pointercancel", endResize)
    window.addEventListener("touchend", endResize)
    window.addEventListener("touchcancel", endResize)
    window.addEventListener("blur", endResize)
  }
  onBeforeUnmount(() => {
    resizeActive = false
    void save()
    disposed = true
    ++generation
    clearTimer()
    if (typeof window !== "undefined") {
      window.removeEventListener("mouseup", endResize)
      window.removeEventListener("pointerup", endResize)
      window.removeEventListener("pointercancel", endResize)
      window.removeEventListener("touchend", endResize)
      window.removeEventListener("touchcancel", endResize)
      window.removeEventListener("blur", endResize)
    }
  })

  return {
    loading: computed(() => loading.value), scheduleSave, save, startResize, resetPersistedState,
    runtimeReady: () => {
      if (runtimeReady.value) void restore()
      else runtimeReady.value = true
    },
  }
}

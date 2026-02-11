import type { DataGridEventMap } from "@affino/datagrid-plugins"
import type { DataGridEventHandlers } from "../types"
import type {
  DataGridRuntimeInternalEventMap,
  DataGridRuntimePluginEventMap,
} from "../runtime/dataGridRuntime"

export const DATAGRID_EVENT_TIERS = ["stable", "advanced", "internal"] as const

export type DataGridEventTier = (typeof DATAGRID_EVENT_TIERS)[number]

export const DATAGRID_EVENT_TIER_ENTRYPOINTS: Readonly<Record<DataGridEventTier, string>> = {
  stable: "@affino/datagrid-core",
  advanced: "@affino/datagrid-core/advanced",
  internal: "@affino/datagrid-core/internal",
} as const

export type DataGridEventSource =
  | "api"
  | "ui"
  | "keyboard"
  | "pointer"
  | "context-menu"
  | "programmatic"
  | "adapter"
  | "plugin"
  | "system"

export type DataGridEventPhase =
  | "start"
  | "change"
  | "end"
  | "commit"
  | "cancel"
  | "snapshot"
  | "system"

type ExtractEventArgs<THandler> = THandler extends (...args: infer TArgs) => any
  ? Readonly<TArgs>
  : readonly []

export type DataGridStableEventMap<TData = any> = {
  [K in keyof DataGridEventHandlers<TData>]-?: ExtractEventArgs<
    NonNullable<DataGridEventHandlers<TData>[K]>
  >
}

export type DataGridStableEventName<TData = any> = keyof DataGridStableEventMap<TData>

export type DataGridAdvancedEventMap<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
> = DataGridRuntimePluginEventMap<TPluginEvents>

export type DataGridAdvancedEventName<
  TPluginEvents extends DataGridEventMap = Record<never, never>,
> = keyof DataGridAdvancedEventMap<TPluginEvents>

export type DataGridInternalEventMap = DataGridRuntimeInternalEventMap
export type DataGridInternalEventName = keyof DataGridInternalEventMap

export interface DataGridEventAffectedRange {
  rowStart?: number
  rowEnd?: number
  columnStart?: number
  columnEnd?: number
}

export interface DataGridEventEnvelope<
  TTier extends DataGridEventTier = DataGridEventTier,
  TName extends string = string,
  TArgs extends readonly unknown[] = readonly unknown[],
> {
  tier: TTier
  name: TName
  args: TArgs
  source: DataGridEventSource
  phase: DataGridEventPhase
  reason?: string
  affected?: DataGridEventAffectedRange
  timestampMs: number
}

export function isDataGridEventTier(value: string): value is DataGridEventTier {
  return (DATAGRID_EVENT_TIERS as readonly string[]).includes(value)
}

export function createDataGridEventEnvelope<
  TTier extends DataGridEventTier,
  TName extends string,
  TArgs extends readonly unknown[],
>(
  input: Omit<DataGridEventEnvelope<TTier, TName, TArgs>, "timestampMs"> & {
    timestampMs?: number
  },
): DataGridEventEnvelope<TTier, TName, TArgs> {
  return {
    ...input,
    timestampMs: input.timestampMs ?? 0,
  }
}

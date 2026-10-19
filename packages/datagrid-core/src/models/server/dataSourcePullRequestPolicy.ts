import type { DataGridViewportRange } from "../rowModel.js"
import type {
  DataGridDataSourcePullPriority,
  DataGridDataSourcePullReason,
} from "./dataSourceProtocol.js"
import type {
  DataGridDataSourceInFlightPull,
  DataGridDataSourcePendingPull,
} from "./dataSourceTransportCoordinator.js"
import { rangeContains, rangesOverlap, resolvePriorityRank } from "./dataSourceTransportCoordinator.js"

export interface DataSourcePullRequestPolicyInput {
  readonly range: DataGridViewportRange
  readonly key: string
  readonly stateKey: string
  readonly reason: DataGridDataSourcePullReason
  readonly priority: DataGridDataSourcePullPriority
  readonly laneInFlight: DataGridDataSourceInFlightPull | null
  readonly backgroundInFlight: DataGridDataSourceInFlightPull | null
  readonly criticalInFlight: DataGridDataSourceInFlightPull | null
  readonly pendingBackgroundPull: DataGridDataSourcePendingPull | null
}

export type DataSourcePullRequestPolicy =
  | { readonly kind: "coalesce"; readonly promise: Promise<void>; readonly countPrefetch: boolean }
  | { readonly kind: "queue"; readonly priority: DataGridDataSourcePullPriority }
  | {
      readonly kind: "start"
      readonly abortBackground: "stale" | "preempted" | null
      readonly dropPendingBackground: boolean
      readonly abortLane: boolean
    }

/** Resolves in-flight reuse, backpressure queueing, and lane preemption without side effects. */
export function resolveDataSourcePullRequestPolicy(
  input: DataSourcePullRequestPolicyInput,
): DataSourcePullRequestPolicy {
  const { laneInFlight, backgroundInFlight, criticalInFlight } = input
  const activeLane = laneInFlight && !laneInFlight.controller.signal.aborted ? laneInFlight : null

  if (activeLane?.key === input.key) {
    return {
      kind: "coalesce",
      promise: activeLane.promise,
      countPrefetch: input.priority === "background",
    }
  }

  if (
    input.reason === "viewport-change"
    && activeLane
    && activeLane.stateKey === input.stateKey
    && resolvePriorityRank(activeLane.priority) >= resolvePriorityRank(input.priority)
    && rangeContains(activeLane.range, input.range)
  ) {
    return { kind: "coalesce", promise: activeLane.promise, countPrefetch: false }
  }

  if (input.priority === "background") {
    if (criticalInFlight && !criticalInFlight.controller.signal.aborted) {
      return { kind: "queue", priority: "background" }
    }
    if (
      backgroundInFlight
      && !backgroundInFlight.controller.signal.aborted
      && backgroundInFlight.stateKey === input.stateKey
      && rangeContains(backgroundInFlight.range, input.range)
    ) {
      return { kind: "coalesce", promise: backgroundInFlight.promise, countPrefetch: true }
    }
    return {
      kind: "start",
      abortBackground: null,
      dropPendingBackground: false,
      abortLane: activeLane !== null,
    }
  }

  const abortBackground = backgroundInFlight && !backgroundInFlight.controller.signal.aborted
    ? backgroundInFlight.stateKey === input.stateKey
      && rangesOverlap(backgroundInFlight.range, input.range)
      ? "preempted"
      : backgroundInFlight.stateKey !== input.stateKey
        ? "stale"
        : null
    : null
  const dropPendingBackground = Boolean(
    input.pendingBackgroundPull && input.pendingBackgroundPull.stateKey !== input.stateKey,
  )
  if (
    criticalInFlight
    && !criticalInFlight.controller.signal.aborted
    && resolvePriorityRank(input.priority) < resolvePriorityRank(criticalInFlight.priority)
  ) {
    return {
      kind: "queue",
      priority: input.priority,
    }
  }

  return {
    kind: "start",
    abortBackground,
    dropPendingBackground,
    abortLane: activeLane !== null,
  }
}

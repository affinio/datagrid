import {
  normalizeClipboardFeature,
  type AffinoClipboardFeatureInput,
  type NormalizedAffinoClipboardFeature,
} from "./useAffinoDataGridClipboardFeature"
import {
  normalizeEditingFeature,
  type AffinoEditingFeatureInput,
  type NormalizedAffinoEditingFeature,
} from "./useAffinoDataGridEditingFeature"
import {
  normalizeFilteringFeature,
  type AffinoFilteringFeatureInput,
  type NormalizedAffinoFilteringFeature,
} from "./useAffinoDataGridFilteringFeature"
import {
  normalizeSelectionFeature,
  type AffinoSelectionFeatureInput,
  type NormalizedAffinoSelectionFeature,
} from "./useAffinoDataGridSelectionFeature"
import {
  normalizeSummaryFeature,
  type AffinoSummaryFeatureInput,
  type NormalizedAffinoSummaryFeature,
} from "./useAffinoDataGridSummaryFeature"
import {
  normalizeVisibilityFeature,
  type AffinoVisibilityFeatureInput,
  type NormalizedAffinoVisibilityFeature,
} from "./useAffinoDataGridVisibilityFeature"
import {
  normalizeTreeFeature,
  type AffinoTreeFeatureInput,
  type NormalizedAffinoTreeFeature,
} from "./useAffinoDataGridTreeFeature"
import {
  normalizeRowHeightFeature,
  type AffinoRowHeightFeatureInput,
  type NormalizedAffinoRowHeightFeature,
} from "./useAffinoDataGridRowHeightFeature"

export interface AffinoDataGridFeatureInput<TRow> {
  selection?: boolean | AffinoSelectionFeatureInput<TRow>
  clipboard?: boolean | AffinoClipboardFeatureInput<TRow>
  editing?: boolean | AffinoEditingFeatureInput<TRow>
  filtering?: boolean | AffinoFilteringFeatureInput
  summary?: boolean | AffinoSummaryFeatureInput<TRow>
  visibility?: boolean | AffinoVisibilityFeatureInput
  tree?: boolean | AffinoTreeFeatureInput
  rowHeight?: boolean | AffinoRowHeightFeatureInput
  keyboardNavigation?: boolean | { enabled?: boolean }
  interactions?: boolean | {
    enabled?: boolean
    range?: boolean | {
      enabled?: boolean
      fill?: boolean
      move?: boolean
    }
  }
  headerFilters?: boolean | {
    enabled?: boolean
    maxUniqueValues?: number
  }
  feedback?: boolean | {
    enabled?: boolean
    maxEvents?: number
  }
  statusBar?: boolean | {
    enabled?: boolean
  }
}

export interface NormalizedAffinoDataGridFeatures<TRow> {
  selection: NormalizedAffinoSelectionFeature<TRow>
  clipboard: NormalizedAffinoClipboardFeature<TRow>
  editing: NormalizedAffinoEditingFeature<TRow>
  filtering: NormalizedAffinoFilteringFeature
  summary: NormalizedAffinoSummaryFeature<TRow>
  visibility: NormalizedAffinoVisibilityFeature
  tree: NormalizedAffinoTreeFeature
  rowHeight: NormalizedAffinoRowHeightFeature
  keyboardNavigation: { enabled: boolean }
  interactions: {
    enabled: boolean
    range: {
      enabled: boolean
      fill: boolean
      move: boolean
    }
  }
  headerFilters: {
    enabled: boolean
    maxUniqueValues: number
  }
  feedback: {
    enabled: boolean
    maxEvents: number
  }
  statusBar: {
    enabled: boolean
  }
}

function normalizeKeyboardNavigationFeature(
  input?: boolean | { enabled?: boolean },
): { enabled: boolean } {
  if (typeof input === "boolean") {
    return { enabled: input }
  }
  if (!input) {
    return { enabled: true }
  }
  return { enabled: input.enabled ?? true }
}

function normalizeInteractionsFeature(
  input?: boolean | {
    enabled?: boolean
    range?: boolean | {
      enabled?: boolean
      fill?: boolean
      move?: boolean
    }
  },
): NormalizedAffinoDataGridFeatures<never>["interactions"] {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      range: {
        enabled: input,
        fill: input,
        move: input,
      },
    }
  }
  if (!input) {
    return {
      enabled: false,
      range: {
        enabled: false,
        fill: false,
        move: false,
      },
    }
  }
  const rangeInput = input.range
  const rangeEnabled = typeof rangeInput === "boolean"
    ? rangeInput
    : (rangeInput?.enabled ?? (input.enabled ?? true))
  const fillEnabled = typeof rangeInput === "boolean"
    ? rangeInput
    : (rangeInput?.fill ?? rangeEnabled)
  const moveEnabled = typeof rangeInput === "boolean"
    ? rangeInput
    : (rangeInput?.move ?? rangeEnabled)

  return {
    enabled: input.enabled ?? true,
    range: {
      enabled: rangeEnabled,
      fill: fillEnabled,
      move: moveEnabled,
    },
  }
}

function normalizeHeaderFiltersFeature(
  input?: boolean | { enabled?: boolean; maxUniqueValues?: number },
): NormalizedAffinoDataGridFeatures<never>["headerFilters"] {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      maxUniqueValues: 250,
    }
  }
  if (!input) {
    return {
      enabled: false,
      maxUniqueValues: 250,
    }
  }
  return {
    enabled: input.enabled ?? true,
    maxUniqueValues: Number.isFinite(input.maxUniqueValues)
      ? Math.max(20, Math.trunc(input.maxUniqueValues as number))
      : 250,
  }
}

function normalizeFeedbackFeature(
  input?: boolean | { enabled?: boolean; maxEvents?: number },
): NormalizedAffinoDataGridFeatures<never>["feedback"] {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      maxEvents: 100,
    }
  }
  if (!input) {
    return {
      enabled: true,
      maxEvents: 100,
    }
  }
  return {
    enabled: input.enabled ?? true,
    maxEvents: Number.isFinite(input.maxEvents)
      ? Math.max(20, Math.trunc(input.maxEvents as number))
      : 100,
  }
}

function normalizeStatusBarFeature(
  input?: boolean | { enabled?: boolean },
): NormalizedAffinoDataGridFeatures<never>["statusBar"] {
  if (typeof input === "boolean") {
    return { enabled: input }
  }
  if (!input) {
    return { enabled: true }
  }
  return { enabled: input.enabled ?? true }
}

export function normalizeAffinoDataGridFeatures<TRow>(
  features?: AffinoDataGridFeatureInput<TRow>,
): NormalizedAffinoDataGridFeatures<TRow> {
  return {
    selection: normalizeSelectionFeature(features?.selection),
    clipboard: normalizeClipboardFeature(features?.clipboard),
    editing: normalizeEditingFeature(features?.editing),
    filtering: normalizeFilteringFeature(features?.filtering),
    summary: normalizeSummaryFeature(features?.summary),
    visibility: normalizeVisibilityFeature(features?.visibility),
    tree: normalizeTreeFeature(features?.tree),
    rowHeight: normalizeRowHeightFeature(features?.rowHeight),
    keyboardNavigation: normalizeKeyboardNavigationFeature(features?.keyboardNavigation),
    interactions: normalizeInteractionsFeature(features?.interactions),
    headerFilters: normalizeHeaderFiltersFeature(features?.headerFilters),
    feedback: normalizeFeedbackFeature(features?.feedback),
    statusBar: normalizeStatusBarFeature(features?.statusBar),
  }
}

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
  }
}

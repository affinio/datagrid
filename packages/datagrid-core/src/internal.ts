/**
 * Internal API for @affino/datagrid-core.
 * No semver guarantees: this surface may change without notice.
 */
export {
  normalizeRowNode,
  normalizeViewportRange,
  withResolvedRowIdentity,
} from "./models/rowModel.js"
export {
  createHorizontalOverscanController,
  createVerticalOverscanController,
  type HorizontalOverscanConfig,
  type HorizontalOverscanController,
  type HorizontalOverscanInput,
  type VerticalOverscanConfig,
  type VerticalOverscanController,
  type VerticalOverscanInput,
} from "./virtualization/dynamicOverscan.js"

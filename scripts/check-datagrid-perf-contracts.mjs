#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

const reportPath = resolve(
  process.env.DATAGRID_PERF_CONTRACTS_REPORT ?? "artifacts/quality/datagrid-perf-contracts-report.json",
)
const targetScore = Number.parseFloat(process.env.DATAGRID_PERF_CONTRACTS_TARGET_SCORE ?? "9.5")

const checks = []

function registerFileCheck(id, file, description) {
  const absolutePath = resolve(file)
  const ok = existsSync(absolutePath)
  checks.push({
    id,
    description,
    type: "file",
    file,
    ok,
    message: ok ? "present" : "missing",
  })
}

function registerTokenCheck(id, file, tokens, description) {
  const absolutePath = resolve(file)
  if (!existsSync(absolutePath)) {
    checks.push({
      id,
      description,
      type: "token",
      file,
      tokens,
      ok: false,
      message: "file-missing",
    })
    return
  }

  const source = readFileSync(absolutePath, "utf8")
  const missing = tokens.filter(token => !source.includes(token))
  checks.push({
    id,
    description,
    type: "token",
    file,
    tokens,
    ok: missing.length === 0,
    message: missing.length === 0 ? "all-tokens-present" : `missing: ${missing.join(", ")}`,
  })
}

function registerForbiddenTokenCheck(id, file, forbidden, description) {
  const absolutePath = resolve(file)
  if (!existsSync(absolutePath)) {
    checks.push({
      id,
      description,
      type: "forbidden-token",
      file,
      forbidden,
      ok: false,
      message: "file-missing",
    })
    return
  }

  const source = readFileSync(absolutePath, "utf8")
  const found = forbidden.filter(token => source.includes(token))
  checks.push({
    id,
    description,
    type: "forbidden-token",
    file,
    forbidden,
    ok: found.length === 0,
    message: found.length === 0 ? "none-found" : `found-forbidden: ${found.join(", ")}`,
  })
}

function registerConditionCheck(id, ok, description, message) {
  checks.push({
    id,
    description,
    type: "condition",
    ok: Boolean(ok),
    message: ok ? "ok" : message,
  })
}

function extractWorkflowJobBlock(workflow, jobId) {
  const start = workflow.indexOf(`  ${jobId}:`)
  if (start < 0) {
    return ""
  }
  const nextJob = workflow.slice(start + 1).search(/\n  [a-zA-Z0-9_-]+:/)
  return nextJob >= 0
    ? workflow.slice(start, start + 1 + nextJob)
    : workflow.slice(start)
}

function extractEnvNumberFromScript(script, key) {
  if (typeof script !== "string" || script.length === 0) {
    return null
  }
  const pattern = new RegExp(`${key}=([^\\s]+)`)
  const match = script.match(pattern)
  if (!match) {
    return null
  }
  const raw = String(match[1] ?? "").trim()
  if (raw.length === 0 || raw.toLowerCase() === "infinity") {
    return null
  }
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function extractFunctionBody(source, functionName) {
  if (typeof source !== "string" || source.length === 0) {
    return null
  }
  const marker = `function ${functionName}(`
  const start = source.indexOf(marker)
  if (start < 0) {
    return null
  }
  const bodyStart = source.indexOf("{", start)
  if (bodyStart < 0) {
    return null
  }
  const nextFunctionIndex = source.indexOf("\n\t\tfunction ", bodyStart + 1)
  const end = nextFunctionIndex > bodyStart ? nextFunctionIndex : source.length
  return source.slice(bodyStart + 1, end)
}

registerFileCheck(
  "viewport-virtualization-file",
  "packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts",
  "Viewport virtualization hot path implementation",
)
registerFileCheck(
  "perf-hot-path-contract-test",
  "packages/datagrid-core/src/viewport/__tests__/perfHotPath.contract.spec.ts",
  "Perf hot-path contract tests",
)
registerFileCheck(
  "viewport-integration-contract-test",
  "packages/datagrid-core/src/viewport/__tests__/integrationSnapshot.contract.spec.ts",
  "Viewport integration snapshot contract tests",
)
registerFileCheck(
  "viewport-model-bridge-contract-test",
  "packages/datagrid-core/src/viewport/__tests__/modelBridge.contract.spec.ts",
  "Viewport model bridge contract tests",
)
registerFileCheck(
  "perf-gates-doc",
  "docs/perf/datagrid-performance-gates.md",
  "Performance gates documentation",
)
registerFileCheck(
  "perf-runtime-doc",
  "docs/perf/datagrid-perf-by-design-runtime.md",
  "Perf-by-design runtime contracts documentation",
)
registerFileCheck(
  "benchmark-report-gate-script",
  "scripts/check-datagrid-benchmark-report.mjs",
  "Runtime benchmark report gate script",
)
registerFileCheck(
  "interaction-benchmark-script",
  "scripts/bench-datagrid-interactions.mjs",
  "Interaction benchmark for selection/fill virtualization pressure",
)
registerFileCheck(
  "enterprise-browser-frame-benchmark-script",
  "scripts/bench-datagrid-enterprise-browser-frames.mjs",
  "Enterprise browser frame benchmark for scroll and interaction frame budgets",
)
registerFileCheck(
  "enterprise-browser-frame-comparator-script",
  "scripts/compare-datagrid-enterprise-browser-frames.mjs",
  "Enterprise browser frame artifact comparator for before/after regression review",
)
registerFileCheck(
  "tree-workload-benchmark-script",
  "scripts/bench-datagrid-tree-workload.mjs",
  "Tree workload benchmark for deep hierarchy expand/filter/sort pressure",
)
registerFileCheck(
  "pivot-workload-benchmark-script",
  "scripts/bench-datagrid-pivot-workload.mjs",
  "Pivot workload benchmark for pivot-stage rebuild and patch/reapply pressure",
)
registerFileCheck(
  "tree-workload-matrix-benchmark-script",
  "scripts/bench-datagrid-tree-workload-matrix.mjs",
  "Tree workload benchmark matrix for row-scale envelopes (10k/25k/50k/100k)",
)
registerFileCheck(
  "benchmark-baseline-lock-file",
  "docs/perf/datagrid-benchmark-baseline.json",
  "Benchmark baseline lock file for CI drift guard",
)
registerFileCheck(
  "formula-benchmark-baseline-lock-file",
  "docs/perf/datagrid-formula-engine-baseline.json",
  "Formula benchmark baseline lock file for formula-engine drift guard",
)
registerFileCheck(
  "formula-benchmark-baseline-freeze-script",
  "scripts/freeze-datagrid-formula-baseline.mjs",
  "Formula benchmark baseline freeze/check script",
)

registerTokenCheck(
  "viewport-object-pool-contract",
  "packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts",
  [
    "const rowPool: RowPoolItem[] = []",
    "const visibleSnapshotBuffers: VisibleRow[][] = [[], [], []]",
    "function copyToSnapshot(",
    "function computeRowsCallbackSignature(",
  ],
  "Viewport hot path uses explicit object-pool contracts",
)

registerTokenCheck(
  "viewport-integration-contract-scenarios",
  "packages/datagrid-core/src/viewport/__tests__/integrationSnapshot.contract.spec.ts",
  [
    "keeps imperative non-force setters in async input->compute->apply phase",
    "uses refresh(true) only as scheduler flush and keeps async update phase",
    "schedules model invalidations asynchronously and keeps axis updates scoped",
    "keeps horizontal meta/sizing stable on pure vertical scroll motion",
    "skips heavy viewport apply for offscreen content-only row invalidation",
    "applies visible-range content-only row invalidation asynchronously",
  ],
  "Viewport integration contracts lock async-phase and axis/range invalidation scenarios",
)

registerTokenCheck(
  "viewport-axis-scope-horizontal-counter-contract",
  "packages/datagrid-core/src/viewport/__tests__/integrationSnapshot.contract.spec.ts",
  [
    "let buildHorizontalMetaCalls = 0",
    "expect(buildHorizontalMetaCalls).toBe(postColumnMetaCalls)",
    "expect(resolveHorizontalSizingCalls).toBe(postColumnSizingCalls)",
  ],
  "Axis-scoped row invalidation contract locks no horizontal meta/sizing recompute",
)

registerTokenCheck(
  "viewport-model-bridge-contract-scenarios",
  "packages/datagrid-core/src/viewport/__tests__/modelBridge.contract.spec.ts",
  [
    "does not emit bridge invalidation for viewport-only row model updates",
    "keeps row invalidation when row content changes with same rowCount",
    "emits normalized row-range payload for row-axis invalidation",
    "scope: \"content\"",
  ],
  "Model bridge contracts lock scoped invalidation semantics",
)

registerTokenCheck(
  "viewport-horizontal-sizing-decoupled-content-height",
  "packages/datagrid-core/src/viewport/dataGridViewportController.ts",
  [
    "const contentHeightEstimate = Math.max(rowCount * resolvedRowHeight, viewportHeightValue)",
    "resolveHorizontalSizingFn({",
    "viewportWidth: viewportWidthValue",
  ],
  "Controller keeps vertical content-height math outside horizontal sizing contract",
)

registerTokenCheck(
  "viewport-horizontal-meta-reuse-contract",
  "packages/datagrid-core/src/viewport/dataGridViewportController.ts",
  [
    "if (!lastHorizontalMeta || horizontalStructureDirty)",
    "columnMeta = lastHorizontalMeta",
    "const horizontalMotionDirty =",
    "const horizontalStructureDirty =",
  ],
  "Controller reuses horizontal meta across motion-only updates and rebuilds only on structural changes",
)

registerForbiddenTokenCheck(
  "viewport-no-legacy-horizontal-sizing-vertical-deps",
  "packages/datagrid-core/src/viewport/dataGridViewportController.ts",
  [
    "lastHorizontalSizingTotalRowCount",
    "lastHorizontalSizingResolvedRowHeight",
    "lastHorizontalSizingViewportHeight",
  ],
  "Controller does not keep legacy vertical dependency cache for horizontal sizing",
)

registerTokenCheck(
  "viewport-bridge-async-invalidation-contract",
  "packages/datagrid-core/src/viewport/dataGridViewportController.ts",
  [
    "onInvalidate: (invalidation: DataGridViewportModelBridgeInvalidation) => {",
    "scheduleUpdate(false)",
  ],
  "Bridge invalidations are scheduled through async non-force frame pipeline",
)

registerTokenCheck(
  "viewport-content-invalidation-offscreen-skip-contract",
  "packages/datagrid-core/src/viewport/dataGridViewportController.ts",
  [
    "pendingContentInvalidationRange",
    "invalidation.scope === \"content\"",
    "isRangeOutsideVisibleRows(",
  ],
  "Controller keeps explicit offscreen skip path for content-only row invalidations",
)

registerTokenCheck(
  "viewport-bridge-invalidation-scope-contract",
  "packages/datagrid-core/src/viewport/dataGridViewportModelBridgeService.ts",
  [
    "scope: \"structural\" | \"content\"",
    "const scope = isStableStructuralState ? \"content\" : \"structural\"",
  ],
  "Model bridge emits scoped row invalidations (structural/content)",
)

registerTokenCheck(
  "viewport-bridge-axis-rowrange-contract",
  "packages/datagrid-core/src/viewport/dataGridViewportModelBridgeService.ts",
  [
    "rows: reason !== \"columns\"",
    "columns: reason !== \"rows\"",
    "rowRange: reason === \"rows\" || reason === \"both\" ? normalizeViewportRange(rowRange) : null",
  ],
  "Model bridge invalidation payload keeps axis flags and rowRange scoped by reason",
)

{
  const controllerPath = resolve("packages/datagrid-core/src/viewport/dataGridViewportController.ts")
  const setterPhaseGuardId = "viewport-setter-no-sync-measure-layout"
  if (!existsSync(controllerPath)) {
    registerConditionCheck(
      setterPhaseGuardId,
      false,
      "setViewportMetricsValue keeps input phase async (no direct measureLayout)",
      "viewport controller file missing",
    )
  } else {
    const source = readFileSync(controllerPath, "utf8")
    const body = extractFunctionBody(source, "setViewportMetricsValue")
    const ok =
      body != null &&
      body.includes("scheduleUpdate(false)") &&
      !body.includes("measureLayout()")
    registerConditionCheck(
      setterPhaseGuardId,
      ok,
      "setViewportMetricsValue keeps input phase async (no direct measureLayout)",
      body == null
        ? "setViewportMetricsValue body not found"
        : "setViewportMetricsValue must schedule async update and avoid direct measureLayout()",
    )
  }
}

{
  const controllerPath = resolve("packages/datagrid-core/src/viewport/dataGridViewportController.ts")
  const refreshPhaseGuardId = "viewport-refresh-keeps-async-phase"
  if (!existsSync(controllerPath)) {
    registerConditionCheck(
      refreshPhaseGuardId,
      false,
      "refresh(force) keeps async input phase and only flushes scheduler",
      "viewport controller file missing",
    )
  } else {
    const source = readFileSync(controllerPath, "utf8")
    const body = extractFunctionBody(source, "refreshValue")
    const ok =
      body != null &&
      body.includes("scheduleUpdate(false)") &&
      !body.includes("scheduleUpdate(force === true)") &&
      body.includes("if (force === true)") &&
      body.includes("flushSchedulers()")
    registerConditionCheck(
      refreshPhaseGuardId,
      ok,
      "refresh(force) keeps async input phase and only flushes scheduler",
      body == null
        ? "refreshValue body not found"
        : "refreshValue must schedule non-force update and only use force to flush scheduler",
    )
  }
}

{
  const controllerPath = resolve("packages/datagrid-core/src/viewport/dataGridViewportController.ts")
  const forcePathGuardId = "viewport-force-path-limited-to-imperative-scroll"
  if (!existsSync(controllerPath)) {
    registerConditionCheck(
      forcePathGuardId,
      false,
      "force scheduleUpdate(true) is limited to imperative scroll APIs",
      "viewport controller file missing",
    )
  } else {
    const source = readFileSync(controllerPath, "utf8")
    const forceMatches = source.match(/scheduleUpdate\(true\)/g) ?? []
    const scrollToRowBody = extractFunctionBody(source, "scrollToRowValue")
    const scrollToColumnBody = extractFunctionBody(source, "scrollToColumnValue")
    const rowHasForce = Boolean(scrollToRowBody?.includes("scheduleUpdate(true)"))
    const colHasForce = Boolean(scrollToColumnBody?.includes("scheduleUpdate(true)"))
    const ok = forceMatches.length === 2 && rowHasForce && colHasForce
    registerConditionCheck(
      forcePathGuardId,
      ok,
      "force scheduleUpdate(true) is limited to imperative scroll APIs",
      `scheduleUpdate(true) count=${forceMatches.length}, scrollToRowHasForce=${rowHasForce}, scrollToColumnHasForce=${colHasForce}`,
    )
  }
}

registerForbiddenTokenCheck(
  "viewport-no-slice-allocation-hot-path",
  "packages/datagrid-core/src/viewport/dataGridViewportVirtualization.ts",
  ["buffer.slice(0, filled)", '.join("|")'],
  "Viewport hot path avoids per-frame slice/join allocations",
)

registerTokenCheck(
  "rowmodels-p99-budgets",
  "scripts/bench-datagrid-rowmodels.mjs",
  [
    "PERF_BUDGET_MAX_CLIENT_RANGE_P99_MS",
    "PERF_BUDGET_MAX_SERVER_RANGE_P99_MS",
    "PERF_BUDGET_MAX_WINDOW_SHIFT_P99_MS",
  ],
  "Row-model benchmark enforces p99 frame budgets",
)

registerTokenCheck(
  "harness-p99-budgets",
  "scripts/bench-datagrid-harness.mjs",
  [
    "PERF_BUDGET_MAX_CLIENT_RANGE_P99_MS",
    "PERF_BUDGET_MAX_SERVER_RANGE_P99_MS",
    "PERF_BUDGET_MAX_WINDOW_SHIFT_P99_MS",
    "PERF_BUDGET_MAX_SELECTION_DRAG_P99_MS",
    "PERF_BUDGET_MAX_FILL_APPLY_P99_MS",
    "PERF_BUDGET_MAX_MULTI_RANGE_LOOKUP_P99_MS",
    "PERF_BUDGET_MAX_SELECTION_OVERLAY_P99_MS",
  ],
  "Benchmark harness propagates p99 budgets into CI profile",
)

registerTokenCheck(
  "interaction-benchmark-p99-budgets",
  "scripts/bench-datagrid-interactions.mjs",
  [
    "PERF_BUDGET_MAX_SELECTION_DRAG_P95_MS",
    "PERF_BUDGET_MAX_SELECTION_DRAG_P99_MS",
    "PERF_BUDGET_MAX_FILL_APPLY_P95_MS",
    "PERF_BUDGET_MAX_FILL_APPLY_P99_MS",
    "PERF_BUDGET_MAX_MULTI_RANGE_LOOKUP_P95_MS",
    "PERF_BUDGET_MAX_MULTI_RANGE_LOOKUP_P99_MS",
    "PERF_BUDGET_MAX_SELECTION_OVERLAY_P95_MS",
    "PERF_BUDGET_MAX_SELECTION_OVERLAY_P99_MS",
  ],
  "Interaction benchmark enforces p95/p99 budgets for selection/fill/multi-range lookup/overlay flows",
)

registerTokenCheck(
  "enterprise-selection-operation-budgets",
  "scripts/bench-datagrid-enterprise-workloads.mjs",
  [
    "runSelectionEnterpriseScenario",
    "PERF_BUDGET_MAX_SELECTION_SUMMARY_P95_MS",
    "PERF_BUDGET_MAX_SELECTION_VIRTUAL_COVERAGE_P95_MS",
    "PERF_BUDGET_MAX_SELECTION_CLIPBOARD_PLANNING_P95_MS",
    "PERF_BUDGET_MAX_SELECTION_OVERLAY_PLANNING_P95_MS",
    "bench-datagrid-enterprise-selection-operations.json",
  ],
  "Enterprise workload benchmark gates selection summary, virtual coverage, clipboard planning, and overlay planning",
)

registerTokenCheck(
  "enterprise-browser-frame-device-profile-budgets",
  "scripts/bench-datagrid-enterprise-browser-frames.mjs",
  [
    "BENCH_INTERACTION_DEVICE_PROFILE",
    "BENCH_BROWSER_SCENARIOS",
    "BENCH_BROWSER_WIDE_ROW_SCENARIOS",
    "BENCH_BROWSER_WIDE_COLUMN_SCENARIOS",
    "desktop-ci",
    "touch-tablet-ci",
    "touch-phone-ci",
    "BENCH_INTERACTION_FAIL_ON_WARNINGS",
    "BENCH_VIRTUALIZATION_FAIL_ON_WARNINGS",
    "interaction-drag-selection-pinned",
    "PERF_BUDGET_MAX_INTERACTION_PREVIEW_P95_MS",
    "PERF_BUDGET_MAX_INTERACTION_AUTOSCROLL_P95_MS",
    "PERF_BUDGET_MAX_INTERACTION_FOCUS_RESTORE_MAX_MS",
    "PERF_BUDGET_MAX_INTERACTION_SCROLL_DRIFT_PX",
    "PERF_BUDGET_MAX_VIRTUALIZATION_VIEWPORT_UPDATE_P95_MS",
    "PERF_BUDGET_MAX_VIRTUALIZATION_RANGE_RESOLVE_P95_MS",
    "PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_ROWS_P95",
    "PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95",
    "PERF_BUDGET_MAX_VIRTUALIZATION_BLANK_VIEWPORTS",
    "PERF_BUDGET_MAX_VIRTUALIZATION_PLACEHOLDER_ROWS",
    "PERF_BUDGET_MAX_SERVER_PLACEHOLDER_EXPOSURE_MS",
    "PERF_BUDGET_MAX_SERVER_VIEWPORT_AVAILABILITY_MS",
    "PERF_BUDGET_MAX_SERVER_BLANK_VIEWPORT_EVENTS",
    "PERF_BUDGET_MIN_SERVER_CACHE_HIT_RATIO",
    "PERF_BUDGET_MAX_SERVER_CACHE_MISS_ROWS",
    "PERF_BUDGET_MAX_SERVER_PULL_DURATION_MS",
    "buildVirtualizationBudgetWarnings",
    "buildDatasourcePlaceholderBudgetWarnings",
    "waitForScrollStepFrame",
    "scrollFrameAttribution",
    "summarizeScrollWriteFrameAttribution",
    "grid-selection-overlay__segment--fill-preview",
  ],
  "Enterprise browser frame benchmark exposes calibrated interaction/virtualization budgets and paint-cadenced direct scroll sampling",
)

registerTokenCheck(
  "enterprise-browser-frame-scroll-origin-reset",
  "scripts/bench-datagrid-enterprise-browser-frames.mjs",
  [
    "const resetScenarioScrollOrigin = async () => {",
    "await resetScenarioScrollOrigin()",
    "resolveDataGridPerfStore()?.clear?.()",
  ],
  "Enterprise browser frame scenarios reset scroll origin before telemetry so smooth-scroll samples cannot inherit prior scenario scroll state",
)

registerTokenCheck(
  "enterprise-browser-frame-comparator-attribution-metrics",
  "scripts/compare-datagrid-enterprise-browser-frames.mjs",
  [
    "scrollFrameAttribution",
    "slowWritePct",
    "writeFrameMaxP95",
  ],
  "Enterprise browser frame comparator includes scroll-frame attribution metrics for before/after review",
)

registerTokenCheck(
  "tree-benchmark-p99-budgets",
  "scripts/bench-datagrid-tree-workload.mjs",
  [
    "PERF_BUDGET_MAX_EXPAND_BURST_P95_MS",
    "PERF_BUDGET_MAX_EXPAND_BURST_P99_MS",
    "PERF_BUDGET_MAX_FILTER_SORT_BURST_P95_MS",
    "PERF_BUDGET_MAX_FILTER_SORT_BURST_P99_MS",
  ],
  "Tree workload benchmark enforces p95/p99 budgets for deep tree expand/filter/sort flows",
)

registerTokenCheck(
  "dependency-graph-benchmark-budgets",
  "scripts/bench-datagrid-dependency-graph.mjs",
  [
    "PERF_BUDGET_MAX_REGISTER_MS",
    "PERF_BUDGET_MAX_STRUCTURAL_EXPAND_P95_MS",
    "PERF_BUDGET_MAX_COMPUTED_EXPAND_P95_MS",
    "PERF_BUDGET_MIN_STRUCTURAL_AFFECTED_MEAN",
    "PERF_BUDGET_MIN_COMPUTED_AFFECTED_MEAN",
  ],
  "Dependency-graph benchmark enforces dense-graph register/expand budgets",
)

registerTokenCheck(
  "spreadsheet-workbook-snapshot-budgets",
  "scripts/bench-datagrid-spreadsheet-workbook.mjs",
  [
    "PERF_BUDGET_MAX_SNAPSHOT_BYTES",
    "PERF_BUDGET_MAX_SHEET_STATE_BYTES",
    "exportRestore.snapshotBytes.p95 exceeded budget",
    "workbookSync.totalSheetStateBytes.p95 exceeded budget",
  ],
  "Spreadsheet workbook benchmark enforces exported snapshot and sheet-state byte budgets",
)

registerTokenCheck(
  "quick-filter-typing-scenario-budgets",
  "scripts/bench-datagrid-quick-filter.mjs",
  [
    "PERF_BUDGET_MAX_QUICK_FILTER_100K_1COL_QUERY_CHANGE_P95_MS",
    "PERF_BUDGET_MAX_QUICK_FILTER_100K_5COL_QUERY_CHANGE_P95_MS",
    "collectScenarioOperationP95",
    "100k/5col queryChange",
  ],
  "Quick-filter benchmark enforces 100k typing budgets by searchable column count",
)

registerTokenCheck(
  "enterprise-wide-renderer-browser-scenarios",
  "scripts/bench-datagrid-enterprise-browser-frames.mjs",
  [
    "wide-table-1k-pinned-horizontal",
    "wide-table-10k-pinned-horizontal",
    "PERF_BUDGET_MAX_CELL_RENDERER_P95_MS",
    "buildRendererDurationBudgetWarnings",
  ],
  "Enterprise browser benchmark exposes explicit 1k/10k wide-table scenarios and renderer duration budgets",
)

registerTokenCheck(
  "quality-script-perf-contracts",
  "package.json",
  ["quality:perf:datagrid", "check-datagrid-perf-contracts.mjs"],
  "Root scripts include perf contract gate command",
)

registerTokenCheck(
  "worker-canonical-assert-script",
  "package.json",
  [
    "bench:datagrid:worker:canonical:assert",
    "bench:datagrid:worker:protocol:assert",
    "bench:datagrid:worker:pressure:assert",
    "bench:datagrid:worker:frames:assert",
  ],
  "Package scripts expose one canonical worker performance assert entrypoint",
)

registerTokenCheck(
  "benchmark-regression-gate-script",
  "package.json",
  [
    "bench:datagrid:harness:ci:gate",
    "check-datagrid-benchmark-report.mjs",
    "bench:regression",
    "bench:datagrid:interactions",
    "bench:datagrid:interactions:assert",
    "bench:datagrid:datasource-churn",
    "bench:datagrid:datasource-churn:assert",
    "bench:datagrid:derived-cache",
    "bench:datagrid:derived-cache:assert",
    "bench:datagrid:pivot",
    "bench:datagrid:pivot:assert",
    "bench:datagrid:pivot:server-interop:assert",
    "bench:datagrid:dependency-graph",
    "bench:datagrid:dependency-graph:assert",
    "bench:datagrid:enterprise:selection:assert",
    "bench:datagrid:enterprise:browser-frames",
    "bench:datagrid:enterprise:browser-frames:compare",
    "bench:datagrid:enterprise:browser-frames:assert",
    "bench:datagrid:enterprise:browser-frames:touch:assert",
    "bench:datagrid:enterprise:scroll:assert",
    "bench:datagrid:enterprise:interaction-frame:assert",
    "bench:datagrid:enterprise:virtualization:assert",
    "enterprise-browser-frames",
    "bench:datagrid:tree",
    "bench:datagrid:tree:assert",
    "bench:datagrid:tree:matrix",
    "bench:datagrid:tree:matrix:assert",
    "bench:datagrid:tree:matrix:assert:ci",
    "bench:datagrid:tree:matrix:assert:nightly",
  ],
  "Runtime benchmark regression uses explicit report gate script",
)

registerTokenCheck(
  "tree-workload-matrix-assert-budgets",
  "package.json",
  [
    "PERF_MATRIX_BUDGET_MAX_EXPAND_BURST_P95_MS_BY_ROWS",
    "PERF_MATRIX_BUDGET_MAX_EXPAND_BURST_P99_MS_BY_ROWS",
    "PERF_MATRIX_BUDGET_MAX_FILTER_SORT_BURST_P95_MS_BY_ROWS",
    "PERF_MATRIX_BUDGET_MAX_FILTER_SORT_BURST_P99_MS_BY_ROWS",
    "PERF_MATRIX_BUDGET_MAX_VARIANCE_PCT_BY_ROWS",
    "PERF_MATRIX_BUDGET_MAX_HEAP_DELTA_MB_BY_ROWS",
  ],
  "Tree workload matrix assert script defines row-scale p95/p99/variance/heap budgets",
)

registerTokenCheck(
  "quality-tree-gate-script",
  "package.json",
  [
    "test:datagrid:tree:contracts",
    "test:e2e:datagrid:tree",
    "quality:gates:datagrid:tree",
    "quality:lock:datagrid",
    "bench:datagrid:tree:assert",
    "bench:datagrid:tree:matrix:assert:ci",
    "bench:datagrid:pivot:server-interop:assert",
  ],
  "Quality lock includes explicit tree contracts/e2e/perf gate and pivot server interop gate",
)

registerTokenCheck(
  "benchmark-harness-task-matrix-contract",
  "scripts/bench-datagrid-harness.mjs",
  [
    "id: \"vue-adapters\"",
    "id: \"laravel-morph\"",
    "id: \"interaction-models\"",
    "id: \"datasource-churn\"",
    "id: \"derived-cache\"",
    "id: \"pivot-workload\"",
    "id: \"tree-workload\"",
    "id: \"enterprise-browser-frames\"",
    "id: \"row-models\"",
    "mode === \"ci\" ? task.budgets.ci : task.budgets.local",
  ],
  "Harness task matrix keeps required suite IDs and mode-scoped budget selection",
)

{
  const packageJsonPath = resolve("package.json")
  const benchGateOrderId = "benchmark-gate-script-order"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      benchGateOrderId,
      false,
      "Benchmark gate script keeps order: harness ci -> benchmark report check",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const gateScript = String(pkg?.scripts?.["bench:datagrid:harness:ci:gate"] ?? "")
    const harnessIndex = gateScript.indexOf("bench:datagrid:harness:ci")
    const reportCheckIndex = gateScript.indexOf("check-datagrid-benchmark-report.mjs")
    const ordered = harnessIndex >= 0 && reportCheckIndex > harnessIndex
    registerConditionCheck(
      benchGateOrderId,
      ordered,
      "Benchmark gate script keeps order: harness ci -> benchmark report check",
      `unexpected bench gate script order: '${gateScript}'`,
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const regressionWiringId = "benchmark-regression-wiring"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      regressionWiringId,
      false,
      "bench:regression delegates to bench:datagrid:harness:ci:gate",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const regressionScript = String(pkg?.scripts?.["bench:regression"] ?? "")
    const wired = regressionScript.includes("bench:datagrid:harness:ci:gate")
    registerConditionCheck(
      regressionWiringId,
      wired,
      "bench:regression delegates to bench:datagrid:harness:ci:gate",
      `unexpected bench:regression script: '${regressionScript}'`,
    )
  }
}

{
  const workflowPath = resolve(".github/workflows/ci.yml")
  const benchmarkPlaywrightId = "benchmark-gates-install-playwright"
  if (!existsSync(workflowPath)) {
    registerConditionCheck(
      benchmarkPlaywrightId,
      false,
      "CI benchmark-gates job installs Playwright browsers before bench:regression",
      "ci workflow missing",
    )
  } else {
    const workflow = readFileSync(workflowPath, "utf8")
    const benchmarkGatesBlock = extractWorkflowJobBlock(workflow, "benchmark-gates")
    const installIndex = benchmarkGatesBlock.indexOf("pnpm exec playwright install --with-deps chromium")
    const regressionIndex = benchmarkGatesBlock.indexOf("pnpm run bench:regression")
    const ordered = installIndex >= 0 && regressionIndex > installIndex
    registerConditionCheck(
      benchmarkPlaywrightId,
      ordered,
      "CI benchmark-gates job installs Playwright browsers before bench:regression",
      ordered
        ? "ok"
        : "benchmark-gates block must include playwright install before bench:regression",
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const harnessCiModeId = "benchmark-harness-ci-mode"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      harnessCiModeId,
      false,
      "bench:datagrid:harness:ci runs harness in DATAGRID_BENCH_MODE=ci profile",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const harnessCiScript = String(pkg?.scripts?.["bench:datagrid:harness:ci"] ?? "")
    const hasCiMode = harnessCiScript.includes("DATAGRID_BENCH_MODE=ci")
    registerConditionCheck(
      harnessCiModeId,
      hasCiMode,
      "bench:datagrid:harness:ci runs harness in DATAGRID_BENCH_MODE=ci profile",
      `unexpected bench:datagrid:harness:ci script: '${harnessCiScript}'`,
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const assertBudgetId = "benchmark-assert-finite-budgets"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      assertBudgetId,
      false,
      "Rowmodel/interaction/datasource/derived/pivot/tree assert scripts keep finite variance + heap budgets, and enterprise selection assert keeps finite selection budgets",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const rowmodelsAssertScript = String(pkg?.scripts?.["bench:datagrid:rowmodels:assert"] ?? "")
    const interactionsAssertScript = String(pkg?.scripts?.["bench:datagrid:interactions:assert"] ?? "")
    const datasourceAssertScript = String(pkg?.scripts?.["bench:datagrid:datasource-churn:assert"] ?? "")
    const soakAssertScript = String(pkg?.scripts?.["bench:datagrid:soak:assert"] ?? "")
    const soakLongAssertScript = String(pkg?.scripts?.["bench:datagrid:soak:long:assert"] ?? "")
    const derivedCacheAssertScript = String(pkg?.scripts?.["bench:datagrid:derived-cache:assert"] ?? "")
    const pivotAssertScript = String(pkg?.scripts?.["bench:datagrid:pivot:assert"] ?? "")
    const pivotServerInteropAssertScript = String(pkg?.scripts?.["bench:datagrid:pivot:server-interop:assert"] ?? "")
    const spreadsheetWorkbookAssertScript = String(pkg?.scripts?.["bench:datagrid:spreadsheet-workbook:assert"] ?? "")
    const formulaEngineAssertScript = String(pkg?.scripts?.["bench:datagrid:formula-engine:assert"] ?? "")
    const formulaWorkerAssertScript = String(pkg?.scripts?.["bench:datagrid:formula-engine:worker:assert"] ?? "")
    const formulaBackendsAssertScript = String(pkg?.scripts?.["bench:datagrid:formula-backends:assert"] ?? "")
    const treeAssertScript = String(pkg?.scripts?.["bench:datagrid:tree:assert"] ?? "")
    const enterpriseSelectionAssertScript = String(pkg?.scripts?.["bench:datagrid:enterprise:selection:assert"] ?? "")
    const rowmodelsVariance = extractEnvNumberFromScript(rowmodelsAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const rowmodelsHeap = extractEnvNumberFromScript(rowmodelsAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const interactionsVariance = extractEnvNumberFromScript(interactionsAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const interactionsHeap = extractEnvNumberFromScript(interactionsAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const datasourceVariance = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const datasourceHeap = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const datasourceScrollPullRequested = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_SCROLL_PULL_REQUESTED")
    const datasourceScrollPullAborted = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_SCROLL_PULL_ABORTED")
    const datasourceScrollPullDropped = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_SCROLL_PULL_DROPPED")
    const datasourceScrollRowCacheEvicted = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_SCROLL_ROW_CACHE_EVICTED")
    const datasourceFilterPullRequested = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_FILTER_PULL_REQUESTED")
    const datasourceFilterPullAborted = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_FILTER_PULL_ABORTED")
    const datasourceFilterPullDropped = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_FILTER_PULL_DROPPED")
    const datasourceFilterRowCacheEvicted = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_FILTER_ROW_CACHE_EVICTED")
    const datasourcePlaceholderExposure = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_PLACEHOLDER_EXPOSURE_MAX_MS")
    const datasourceViewportAvailability = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_VIEWPORT_DATA_AVAILABILITY_MAX_MS")
    const datasourcePlaceholderEvents = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MIN_PLACEHOLDER_EXPOSURE_EVENTS")
    const datasourceBlankViewportEvents = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_PLACEHOLDER_BLANK_VIEWPORT_EVENTS")
    const datasourceCacheHitRatio = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MIN_VIEWPORT_CACHE_HIT_RATIO")
    const datasourceCacheMissRows = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_VIEWPORT_CACHE_MISS_ROWS")
    const datasourcePullDuration = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MAX_PULL_DURATION_MAX_MS")
    const datasourceRetrySuccesses = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MIN_PLACEHOLDER_RETRY_SUCCESSES")
    const datasourceStaleRetainedRows = extractEnvNumberFromScript(datasourceAssertScript, "PERF_BUDGET_MIN_STALE_RETAINED_ROWS")
    const soakRequiredBudgets = [
      "PERF_BUDGET_MAX_OPERATION_P95_MS",
      "PERF_BUDGET_MAX_SCROLL_P95_MS",
      "PERF_BUDGET_MAX_EDIT_P95_MS",
      "PERF_BUDGET_MAX_FILTER_P95_MS",
      "PERF_BUDGET_MAX_SERVER_REFRESH_P95_MS",
      "PERF_BUDGET_MAX_RENDERER_P95_MS",
      "PERF_BUDGET_MAX_HEAP_DELTA_MB",
      "PERF_BUDGET_MAX_HEAP_GROWTH_PER_1K_OPS_MB",
      "PERF_BUDGET_MAX_HEAP_PLATEAU_DRIFT_MB",
      "PERF_BUDGET_MAX_PEAK_HEAP_MB",
      "PERF_BUDGET_MAX_SERVER_ROW_CACHE_ENTRIES",
      "PERF_BUDGET_MAX_RENDERER_CACHE_ENTRIES",
      "PERF_BUDGET_MAX_LISTENER_COUNT",
      "PERF_BUDGET_MAX_DOM_NODE_COUNT",
      "PERF_BUDGET_MIN_SCENARIO_OPS",
      "PERF_BUDGET_MAX_VARIANCE_PCT",
    ]
    const missingSoakBudgets = soakRequiredBudgets.filter(
      budget => extractEnvNumberFromScript(soakAssertScript, budget) == null,
    )
    const missingLongSoakBudgets = soakRequiredBudgets.filter(
      budget => extractEnvNumberFromScript(soakLongAssertScript, budget) == null,
    )
    const soakProfileOk =
      soakAssertScript.includes("BENCH_SOAK_PROFILE=ci") &&
      soakAssertScript.includes("BENCH_OUTPUT_JSON=artifacts/performance/bench-datagrid-soak-session.assert.json")
    const longSoakProfileOk =
      soakLongAssertScript.includes("BENCH_SOAK_PROFILE=long") &&
      extractEnvNumberFromScript(soakLongAssertScript, "BENCH_SOAK_MIN_DURATION_MS") != null &&
      soakLongAssertScript.includes("BENCH_OUTPUT_JSON=artifacts/performance/bench-datagrid-soak-session.long.assert.json")
    const derivedVariance = extractEnvNumberFromScript(derivedCacheAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const derivedHeap = extractEnvNumberFromScript(derivedCacheAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const pivotVariance = extractEnvNumberFromScript(pivotAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const pivotHeap = extractEnvNumberFromScript(pivotAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const pivotServerInteropPull = extractEnvNumberFromScript(pivotServerInteropAssertScript, "PERF_BUDGET_MAX_SERVER_PIVOT_PULL_P95_MS")
    const pivotServerInteropExport = extractEnvNumberFromScript(pivotServerInteropAssertScript, "PERF_BUDGET_MAX_EXPORT_INTEROP_P95_MS")
    const pivotServerInteropImport = extractEnvNumberFromScript(pivotServerInteropAssertScript, "PERF_BUDGET_MAX_IMPORT_LAYOUT_P95_MS")
    const pivotServerInteropDrilldown = extractEnvNumberFromScript(pivotServerInteropAssertScript, "PERF_BUDGET_MAX_DRILLDOWN_P95_MS")
    const pivotServerInteropVariance = extractEnvNumberFromScript(pivotServerInteropAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const pivotServerInteropHeap = extractEnvNumberFromScript(pivotServerInteropAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const pivotServerInteropOutputOk = pivotServerInteropAssertScript.includes(
      "BENCH_OUTPUT_JSON=artifacts/performance/bench-datagrid-pivot-server-interop.assert.json",
    )
    const spreadsheetWorkbookSnapshotBytes = extractEnvNumberFromScript(spreadsheetWorkbookAssertScript, "PERF_BUDGET_MAX_SNAPSHOT_BYTES")
    const spreadsheetWorkbookSheetStateBytes = extractEnvNumberFromScript(spreadsheetWorkbookAssertScript, "PERF_BUDGET_MAX_SHEET_STATE_BYTES")
    const spreadsheetWorkbookRestore = extractEnvNumberFromScript(spreadsheetWorkbookAssertScript, "PERF_BUDGET_MAX_RESTORE_P95_MS")
    const spreadsheetWorkbookHeap = extractEnvNumberFromScript(spreadsheetWorkbookAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const formulaFullP95 = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MAX_FULL_RECOMPUTE_P95_MS")
    const formulaPatchP95 = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MAX_PATCH_P95_MS")
    const formulaLargePatchP95 = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MAX_PATCH_P95_MS_LARGE_PATCH_1000")
    const formulaFullEvalRate = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MIN_FULL_EVALS_PER_SEC")
    const formulaIncrementalEvalRate = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MIN_INCREMENTAL_EVALS_PER_SEC")
    const formulaVariance = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const formulaHeap = extractEnvNumberFromScript(formulaEngineAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const formulaWorkerHeap = extractEnvNumberFromScript(formulaWorkerAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const formulaBackendsHeap = extractEnvNumberFromScript(formulaBackendsAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const treeVariance = extractEnvNumberFromScript(treeAssertScript, "PERF_BUDGET_MAX_VARIANCE_PCT")
    const treeHeap = extractEnvNumberFromScript(treeAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const selectionSummary = extractEnvNumberFromScript(enterpriseSelectionAssertScript, "PERF_BUDGET_MAX_SELECTION_SUMMARY_P95_MS")
    const selectionVirtualCoverage = extractEnvNumberFromScript(enterpriseSelectionAssertScript, "PERF_BUDGET_MAX_SELECTION_VIRTUAL_COVERAGE_P95_MS")
    const selectionClipboardPlanning = extractEnvNumberFromScript(enterpriseSelectionAssertScript, "PERF_BUDGET_MAX_SELECTION_CLIPBOARD_PLANNING_P95_MS")
    const selectionOverlayPlanning = extractEnvNumberFromScript(enterpriseSelectionAssertScript, "PERF_BUDGET_MAX_SELECTION_OVERLAY_PLANNING_P95_MS")
    const ok =
      rowmodelsVariance != null &&
      rowmodelsHeap != null &&
      interactionsVariance != null &&
      interactionsHeap != null &&
      datasourceVariance != null &&
      datasourceHeap != null &&
      datasourceScrollPullRequested != null &&
      datasourceScrollPullAborted != null &&
      datasourceScrollPullDropped != null &&
      datasourceScrollRowCacheEvicted != null &&
      datasourceFilterPullRequested != null &&
      datasourceFilterPullAborted != null &&
      datasourceFilterPullDropped != null &&
      datasourceFilterRowCacheEvicted != null &&
      datasourcePlaceholderExposure != null &&
      datasourceViewportAvailability != null &&
      datasourcePlaceholderEvents != null &&
      datasourceBlankViewportEvents != null &&
      datasourceCacheHitRatio != null &&
      datasourceCacheMissRows != null &&
      datasourcePullDuration != null &&
      datasourceRetrySuccesses != null &&
      datasourceStaleRetainedRows != null &&
      datasourceAssertScript.includes("PERF_BUDGET_PLACEHOLDER_FAIL_ON_WARNINGS=true") &&
      missingSoakBudgets.length === 0 &&
      missingLongSoakBudgets.length === 0 &&
      soakProfileOk &&
      longSoakProfileOk &&
      derivedVariance != null &&
      derivedHeap != null &&
      pivotVariance != null &&
      pivotHeap != null &&
      pivotServerInteropPull != null &&
      pivotServerInteropExport != null &&
      pivotServerInteropImport != null &&
      pivotServerInteropDrilldown != null &&
      pivotServerInteropVariance != null &&
      pivotServerInteropHeap != null &&
      pivotServerInteropOutputOk &&
      spreadsheetWorkbookSnapshotBytes != null &&
      spreadsheetWorkbookSheetStateBytes != null &&
      spreadsheetWorkbookRestore != null &&
      spreadsheetWorkbookHeap != null &&
      formulaEngineAssertScript.includes("BENCH_FORMULA_SCENARIOS=small,medium,large") &&
      formulaEngineAssertScript.includes("BENCH_FORMULA_PATCH_SIZES=1,100,1000") &&
      formulaWorkerAssertScript.includes("BENCH_FORMULA_RUNTIME_MODES=main-thread,worker-owned") &&
      formulaBackendsAssertScript.includes("bench-datagrid-formula-backends.mjs") &&
      formulaFullP95 != null &&
      formulaPatchP95 != null &&
      formulaLargePatchP95 != null &&
      formulaFullEvalRate != null &&
      formulaIncrementalEvalRate != null &&
      formulaVariance != null &&
      formulaHeap != null &&
      formulaWorkerHeap != null &&
      formulaBackendsHeap != null &&
      treeVariance != null &&
      treeHeap != null &&
      selectionSummary != null &&
      selectionVirtualCoverage != null &&
      selectionClipboardPlanning != null &&
      selectionOverlayPlanning != null
    registerConditionCheck(
      assertBudgetId,
      ok,
      "Rowmodel/interaction/datasource/soak/derived/pivot/tree assert scripts keep finite variance + heap budgets, datasource assert keeps churn budgets, soak assert keeps leak budgets, and enterprise selection assert keeps finite selection budgets",
      ok
        ? "ok"
        : `missing finite budget(s): rowmodels variance=${rowmodelsVariance}, rowmodels heap=${rowmodelsHeap}, interactions variance=${interactionsVariance}, interactions heap=${interactionsHeap}, datasource variance=${datasourceVariance}, datasource heap=${datasourceHeap}, datasource scrollPullRequested=${datasourceScrollPullRequested}, datasource scrollPullAborted=${datasourceScrollPullAborted}, datasource scrollPullDropped=${datasourceScrollPullDropped}, datasource scrollRowCacheEvicted=${datasourceScrollRowCacheEvicted}, datasource filterPullRequested=${datasourceFilterPullRequested}, datasource filterPullAborted=${datasourceFilterPullAborted}, datasource filterPullDropped=${datasourceFilterPullDropped}, datasource filterRowCacheEvicted=${datasourceFilterRowCacheEvicted}, datasource placeholderExposure=${datasourcePlaceholderExposure}, datasource viewportAvailability=${datasourceViewportAvailability}, datasource placeholderEvents=${datasourcePlaceholderEvents}, datasource blankViewportEvents=${datasourceBlankViewportEvents}, datasource cacheHitRatio=${datasourceCacheHitRatio}, datasource cacheMissRows=${datasourceCacheMissRows}, datasource pullDuration=${datasourcePullDuration}, datasource retrySuccesses=${datasourceRetrySuccesses}, datasource staleRetainedRows=${datasourceStaleRetainedRows}, datasource placeholderFail=${datasourceAssertScript.includes("PERF_BUDGET_PLACEHOLDER_FAIL_ON_WARNINGS=true")}, soak missing=${missingSoakBudgets.join("|") || "none"}, longSoak missing=${missingLongSoakBudgets.join("|") || "none"}, soakProfile=${soakProfileOk}, longSoakProfile=${longSoakProfileOk}, derived variance=${derivedVariance}, derived heap=${derivedHeap}, pivot variance=${pivotVariance}, pivot heap=${pivotHeap}, pivotServer pull=${pivotServerInteropPull}, pivotServer export=${pivotServerInteropExport}, pivotServer import=${pivotServerInteropImport}, pivotServer drilldown=${pivotServerInteropDrilldown}, pivotServer variance=${pivotServerInteropVariance}, pivotServer heap=${pivotServerInteropHeap}, pivotServer output=${pivotServerInteropOutputOk}, spreadsheetWorkbook snapshot=${spreadsheetWorkbookSnapshotBytes}, spreadsheetWorkbook sheetState=${spreadsheetWorkbookSheetStateBytes}, spreadsheetWorkbook restore=${spreadsheetWorkbookRestore}, spreadsheetWorkbook heap=${spreadsheetWorkbookHeap}, formula fullP95=${formulaFullP95}, formula patchP95=${formulaPatchP95}, formula largePatch=${formulaLargePatchP95}, formula fullEvalRate=${formulaFullEvalRate}, formula incrementalEvalRate=${formulaIncrementalEvalRate}, formula variance=${formulaVariance}, formula heap=${formulaHeap}, formula workerHeap=${formulaWorkerHeap}, formula backendsHeap=${formulaBackendsHeap}, tree variance=${treeVariance}, tree heap=${treeHeap}, selection summary=${selectionSummary}, selection virtualCoverage=${selectionVirtualCoverage}, selection clipboardPlanning=${selectionClipboardPlanning}, selection overlayPlanning=${selectionOverlayPlanning}`,
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const enterpriseBrowserAssertBudgetId = "enterprise-browser-frame-assert-hard-budgets"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      enterpriseBrowserAssertBudgetId,
      false,
      "Enterprise browser frame assert scripts hard-fail interaction budget warnings",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const desktopAssertScript = String(pkg?.scripts?.["bench:datagrid:enterprise:browser-frames:assert"] ?? "")
    const touchAssertScript = String(pkg?.scripts?.["bench:datagrid:enterprise:browser-frames:touch:assert"] ?? "")
    const desktopFrameP95 = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_FRAME_P95_MS")
    const desktopFrameP99 = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_FRAME_P99_MS")
    const desktopDroppedFramePct = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_DROPPED_FRAME_PCT")
    const desktopLongTaskCount = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_LONG_TASK_COUNT")
    const desktopLongTaskTotal = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_LONG_TASK_TOTAL_MS")
    const desktopLongTaskMax = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_LONG_TASK_MAX_MS")
    const desktopHeap = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const desktopCellRenderer = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_CELL_RENDERER_P95_MS")
    const desktopGroupCellRenderer = extractEnvNumberFromScript(desktopAssertScript, "PERF_BUDGET_MAX_GROUP_CELL_RENDERER_P95_MS")
    const touchFrameP95 = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_FRAME_P95_MS")
    const touchFrameP99 = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_FRAME_P99_MS")
    const touchDroppedFramePct = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_DROPPED_FRAME_PCT")
    const touchLongTaskCount = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_LONG_TASK_COUNT")
    const touchLongTaskTotal = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_LONG_TASK_TOTAL_MS")
    const touchLongTaskMax = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_LONG_TASK_MAX_MS")
    const touchHeap = extractEnvNumberFromScript(touchAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const ok =
      desktopAssertScript.includes("BENCH_INTERACTION_DEVICE_PROFILE=desktop-ci") &&
      desktopAssertScript.includes("BENCH_INTERACTION_FAIL_ON_WARNINGS=true") &&
      desktopAssertScript.includes("BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true") &&
      desktopAssertScript.includes("BENCH_RENDERING_FAIL_ON_WARNINGS=true") &&
      desktopFrameP95 != null &&
      desktopFrameP99 != null &&
      desktopDroppedFramePct != null &&
      desktopLongTaskCount != null &&
      desktopLongTaskTotal != null &&
      desktopLongTaskMax != null &&
      desktopHeap != null &&
      desktopCellRenderer != null &&
      desktopGroupCellRenderer != null &&
      touchAssertScript.includes("BENCH_INTERACTION_DEVICE_PROFILE=touch-tablet-ci") &&
      touchAssertScript.includes("BENCH_INTERACTION_FAIL_ON_WARNINGS=true") &&
      touchAssertScript.includes("BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true") &&
      touchFrameP95 != null &&
      touchFrameP99 != null &&
      touchDroppedFramePct != null &&
      touchLongTaskCount != null &&
      touchLongTaskTotal != null &&
      touchLongTaskMax != null &&
      touchHeap != null
    registerConditionCheck(
      enterpriseBrowserAssertBudgetId,
      ok,
      "Enterprise browser frame assert scripts hard-fail interaction and resource budget warnings",
      ok
        ? "ok"
        : `unexpected enterprise browser assert scripts or finite budgets: desktop='${desktopAssertScript}', touch='${touchAssertScript}', desktop budgets frameP95=${desktopFrameP95}, frameP99=${desktopFrameP99}, dropped=${desktopDroppedFramePct}, longTaskCount=${desktopLongTaskCount}, longTaskTotal=${desktopLongTaskTotal}, longTaskMax=${desktopLongTaskMax}, heap=${desktopHeap}, cellRenderer=${desktopCellRenderer}, groupCellRenderer=${desktopGroupCellRenderer}, touch budgets frameP95=${touchFrameP95}, frameP99=${touchFrameP99}, dropped=${touchDroppedFramePct}, longTaskCount=${touchLongTaskCount}, longTaskTotal=${touchLongTaskTotal}, longTaskMax=${touchLongTaskMax}, heap=${touchHeap}`,
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const enterpriseWideVirtualizationId = "enterprise-wide-virtualization-scenarios"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      enterpriseWideVirtualizationId,
      false,
      "Enterprise virtualization assert covers explicit 1k and 10k pinned horizontal scenarios",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const script = String(pkg?.scripts?.["bench:datagrid:enterprise:virtualization:assert"] ?? "")
    const ok =
      script.includes("wide-table-1k-pinned-horizontal") &&
      script.includes("wide-table-10k-pinned-horizontal") &&
      script.includes("BENCH_BROWSER_WIDE_ROW_COUNT=10000") &&
      script.includes("PERF_BUDGET_MAX_VIRTUALIZATION_RENDERED_COLUMNS_P95=160")
    registerConditionCheck(
      enterpriseWideVirtualizationId,
      ok,
      "Enterprise virtualization assert covers explicit 1k and 10k pinned horizontal scenarios",
      ok ? "ok" : `unexpected enterprise virtualization assert script: '${script}'`,
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const enterpriseScrollAssertBudgetId = "enterprise-scroll-frame-assert-hard-budgets"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      enterpriseScrollAssertBudgetId,
      false,
      "Enterprise scroll assert script hard-fails resource budget warnings for scroll scenarios",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const scrollAssertScript = String(pkg?.scripts?.["bench:datagrid:enterprise:scroll:assert"] ?? "")
    const frameP95 = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_FRAME_P95_MS")
    const frameP99 = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_FRAME_P99_MS")
    const droppedFramePct = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_DROPPED_FRAME_PCT")
    const longTaskCount = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_LONG_TASK_COUNT")
    const longTaskTotal = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_LONG_TASK_TOTAL_MS")
    const longTaskMax = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_LONG_TASK_MAX_MS")
    const heap = extractEnvNumberFromScript(scrollAssertScript, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const ok =
      scrollAssertScript.includes("BENCH_BROWSER_SCENARIOS=vertical-scroll-only,vertical-smooth-scroll,horizontal-scroll-only,combined") &&
      scrollAssertScript.includes("BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true") &&
      frameP95 != null &&
      frameP99 != null &&
      droppedFramePct != null &&
      longTaskCount != null &&
      longTaskTotal != null &&
      longTaskMax != null &&
      heap != null
    registerConditionCheck(
      enterpriseScrollAssertBudgetId,
      ok,
      "Enterprise scroll assert script hard-fails resource budget warnings for scroll scenarios",
      ok
        ? "ok"
        : `unexpected enterprise scroll assert script or finite budgets: script='${scrollAssertScript}', frameP95=${frameP95}, frameP99=${frameP99}, dropped=${droppedFramePct}, longTaskCount=${longTaskCount}, longTaskTotal=${longTaskTotal}, longTaskMax=${longTaskMax}, heap=${heap}`,
    )
  }
}

{
  const packageJsonPath = resolve("package.json")
  const enterpriseInteractionFrameAssertBudgetId = "enterprise-interaction-frame-assert-hard-budgets"
  if (!existsSync(packageJsonPath)) {
    registerConditionCheck(
      enterpriseInteractionFrameAssertBudgetId,
      false,
      "Enterprise interaction-frame assert script hard-fails resource, interaction, sort, and edit budget warnings",
      "package.json missing",
    )
  } else {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    const script = String(pkg?.scripts?.["bench:datagrid:enterprise:interaction-frame:assert"] ?? "")
    const frameP95 = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_FRAME_P95_MS")
    const frameP99 = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_FRAME_P99_MS")
    const droppedFramePct = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_DROPPED_FRAME_PCT")
    const longTaskCount = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_LONG_TASK_COUNT")
    const longTaskTotal = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_LONG_TASK_TOTAL_MS")
    const longTaskMax = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_LONG_TASK_MAX_MS")
    const heap = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_HEAP_DELTA_MB")
    const sortMenuOpenToPaint = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_SORT_MENU_OPEN_TO_PAINT_MS")
    const sortClickToPaint = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_SORT_CLICK_TO_PAINT_MS")
    const sortWindowFrame = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_SORT_WINDOW_FRAME_P95_MS")
    const sortWindowLongTaskTotal = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_SORT_WINDOW_LONG_TASK_TOTAL_MS")
    const editBurstUpdate = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_EDIT_BURST_UPDATE_P95_MS")
    const editBurstOpenToPaint = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_EDIT_BURST_OPEN_TO_PAINT_P95_MS")
    const editBurstCommitToPaint = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_EDIT_BURST_COMMIT_TO_PAINT_P95_MS")
    const editBurstLongTaskTotal = extractEnvNumberFromScript(script, "PERF_BUDGET_MAX_EDIT_BURST_LONG_TASK_TOTAL_MS")
    const ok =
      script.includes("BENCH_BROWSER_SCENARIOS=sort-only,inline-edit-burst-only,interaction-context-menu") &&
      script.includes("BENCH_INTERACTION_FAIL_ON_WARNINGS=true") &&
      script.includes("BENCH_BROWSER_RESOURCE_FAIL_ON_WARNINGS=true") &&
      script.includes("BENCH_INTERACTION_FRAME_FAIL_ON_WARNINGS=true") &&
      frameP95 != null &&
      frameP99 != null &&
      droppedFramePct != null &&
      longTaskCount != null &&
      longTaskTotal != null &&
      longTaskMax != null &&
      heap != null &&
      sortMenuOpenToPaint != null &&
      sortClickToPaint != null &&
      sortWindowFrame != null &&
      sortWindowLongTaskTotal != null &&
      editBurstUpdate != null &&
      editBurstOpenToPaint != null &&
      editBurstCommitToPaint != null &&
      editBurstLongTaskTotal != null
    registerConditionCheck(
      enterpriseInteractionFrameAssertBudgetId,
      ok,
      "Enterprise interaction-frame assert script hard-fails resource, interaction, sort, and edit budget warnings",
      ok
        ? "ok"
        : `unexpected enterprise interaction-frame assert script or finite budgets: script='${script}', frameP95=${frameP95}, frameP99=${frameP99}, dropped=${droppedFramePct}, longTaskCount=${longTaskCount}, longTaskTotal=${longTaskTotal}, longTaskMax=${longTaskMax}, heap=${heap}, sortMenuOpenToPaint=${sortMenuOpenToPaint}, sortClickToPaint=${sortClickToPaint}, sortWindowFrame=${sortWindowFrame}, sortWindowLongTaskTotal=${sortWindowLongTaskTotal}, editBurstUpdate=${editBurstUpdate}, editBurstOpenToPaint=${editBurstOpenToPaint}, editBurstCommitToPaint=${editBurstCommitToPaint}, editBurstLongTaskTotal=${editBurstLongTaskTotal}`,
    )
  }
}

registerTokenCheck(
  "benchmark-gate-finite-ci-guards",
  "scripts/check-datagrid-benchmark-report.mjs",
  [
    "shared-ci-variance-budget-finite",
    "shared-ci-heap-budget-finite",
    "shared-ci-no-infinity-budgets",
    "results-no-duplicate-task-ids",
    "task-${taskId}-ci-budgets-finite",
    "task-${taskId}-status-consistency",
    "task-${taskId}-artifact-freshness",
    "task-${taskId}-variance-budget-finite",
    "task-${taskId}-heap-budget-finite",
    "task-${taskId}-elapsed-variance",
    "task-${taskId}-heap-growth",
    "task-tree-workload-present",
    "task-tree-workload-ok",
    "baseline-file",
    "task-${taskId}-baseline-entry",
    "task-${taskId}-baseline-duration-drift",
    "task-${taskId}-baseline-elapsed-drift",
    "task-${taskId}-baseline-heap-drift",
  ],
  "Benchmark gate enforces finite CI variance/heap budgets, aggregate variance+memory thresholds, and baseline drift lock",
)

registerTokenCheck(
  "benchmark-gate-ci-wiring",
  ".github/workflows/ci.yml",
  [
    "quality-gates:",
    "pnpm run quality:lock:datagrid:parity",
    "name: datagrid-quality-gates",
  ],
  "CI quality-gates job executes parity lock and publishes benchmark/quality artifacts",
)

const totalChecks = checks.length
const passedChecks = checks.filter(check => check.ok).length
const failedChecks = checks.filter(check => !check.ok)
const score = Number(((passedChecks / totalChecks) * 10).toFixed(2))
const ok = failedChecks.length === 0 && score >= targetScore

const report = {
  generatedAt: new Date().toISOString(),
  targetScore,
  score,
  ok,
  totals: {
    checks: totalChecks,
    passed: passedChecks,
    failed: failedChecks.length,
  },
  failedChecks,
  checks,
}

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, JSON.stringify(report, null, 2))

console.log("\nDataGrid Perf Contracts")
console.log(`report: ${reportPath}`)
console.log(`score: ${score.toFixed(2)} / 10`)
console.log(`target: ${targetScore.toFixed(2)}`)
console.log(`checks: ${passedChecks}/${totalChecks}`)

if (failedChecks.length > 0) {
  console.error("\nFailed checks:")
  for (const check of failedChecks) {
    console.error(`- [${check.id}] ${check.description} (${check.message})`)
  }
}

if (!ok) {
  process.exit(1)
}

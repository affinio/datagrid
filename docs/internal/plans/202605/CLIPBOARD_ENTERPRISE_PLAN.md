# DataGrid Clipboard Enterprise Implementation Plan

This plan converts `docs/audits/CLIPBOARD_ENTERPRISE_AUDIT.md` into small, separable implementation slices. The current public API remains the baseline: keyboard/context-menu copy, cut, paste, paste-special values, app clipboard bridge, `readClipboardCell`, `applyClipboardEdits`, row-model `applyEdits`, selection snapshots, server datasource revisions, and app intent history. Do not introduce a parallel clipboard runtime unless a slice explicitly proposes and approves a public contract change.

Current execution state:

- Slice 1 is implemented as of 2026-05-20.
- The canonical app-stage clipboard path is `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts` plus `packages/datagrid-orchestration/src/clipboard/useDataGridClipboardBridge.ts`.
- `datagrid-vue-app` owns rendered keyboard/context-menu wiring, pending clipboard visuals, row-index clipboard actions, placeholder materialization, and stage status surfaces.
- Current code already blocks stale, unloaded, placeholder, and grouped local clipboard operations before unsafe materialized mutation.
- Current code validates typed clipboard paste drafts through the shared cell draft validation boundary and reports local target/applied/blocked/skipped/invalid paste counts; custom/server structured result contracts remain planned work.
- Server-delegated clipboard operations are contract-level only; unloaded virtual ranges remain blocked unless a future server delegate is added.

## Slice 1: Enterprise Clipboard Contract

- Status: Completed on 2026-05-20.
- Objective: document the supported clipboard modes, package ownership, copy/paste/cut state machine, format policy, validation parity, server/virtual boundary, history behavior, a11y expectations, and unsupported enterprise behaviors before runtime changes.
- Affected packages/files:
  - `docs/datagrid-clipboard.md`
  - `docs/README.md`
  - `docs/datagrid-sheets-user-interactions-and-integrator-api.md`
  - `docs/audits/CLIPBOARD_ENTERPRISE_AUDIT.md`
  - `docs/plans/CLIPBOARD_ENTERPRISE_PLAN.md`
- Expected behavior change: no runtime behavior change; `docs/datagrid-clipboard.md` is now the current contract for app-stage clipboard behavior and the baseline for remaining slices.
- Tests to add/update:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Low
- Suggested commit message: `docs(datagrid): define enterprise clipboard contract`

## Slice 2: Clipboard Format Parser And Writer

- Status: Completed on 2026-05-20.
- Objective: replace basic tab/newline split and raw tab/newline join with a shared TSV parser/writer that preserves quoted tabs, newlines, quotes, blank cells, ragged rows, and the chosen trailing-blank policy.
- Affected packages/files:
  - `packages/datagrid-orchestration/src/clipboard/useDataGridClipboardBridge.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridClipboardBridge.contract.spec.ts`
  - `docs/datagrid-clipboard.md`
  - `docs/audits/CLIPBOARD_ENTERPRISE_AUDIT.md`
- Expected behavior change: copied values containing tabs, newlines, or quotes round-trip through spreadsheet-compatible TSV instead of corrupting cell shape. A single terminal row separator is treated as a payload terminator; additional blank rows are preserved.
- Tests to add/update:
  - Writer escapes tabs, newlines, quotes, and blank values.
  - Parser accepts Excel/Google Sheets quoted TSV fixtures.
  - Ragged rows and trailing blank rows follow the documented policy.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/composables/__tests__/useDataGridClipboardBridge.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue): parse spreadsheet clipboard tsv`

## Slice 3: Clipboard Read/Write Feedback

- Status: Completed on 2026-05-20.
- Objective: make browser clipboard permission failures and in-memory fallback usage observable without breaking same-session fallback behavior.
- Affected packages/files:
  - `packages/datagrid-orchestration/src/internal/browserClipboard.ts`
  - `packages/datagrid-orchestration/src/clipboard/useDataGridClipboardBridge.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/composables/__tests__/useDataGridClipboardBridge.contract.spec.ts`
  - `docs/datagrid-clipboard.md`
- Expected behavior change: copy/paste reports whether system clipboard access succeeded, failed, or used the in-memory fallback.
- Tests to add/update:
  - Write denial still buffers payload and reports fallback status.
  - Read denial uses memory only when available and reports stale/fallback status.
  - Empty fallback does not look like a successful paste.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/composables/__tests__/useDataGridClipboardBridge.contract.spec.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: Medium
- Suggested commit message: `fix(datagrid-vue): report clipboard fallback usage`

## Slice 4: Structured Paste Result

- Status: Completed on 2026-05-20.
- Objective: replace row-count-only paste reporting with structured applied, blocked, skipped, invalid, materialized, and failed cell counts while preserving existing mutation boundaries.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-orchestration/src/clipboard/useDataGridClipboardMutations.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
  - `docs/datagrid-clipboard.md`
- Expected behavior change: partial paste outcomes are deterministic and user-facing for the canonical local app path; successful history records only committed patches. The public `applyClipboardEdits` return value remains the existing updated-row count for API stability.
- Tests to add/update:
  - Mixed editable/non-editable/invalid paste reports applied and blocked cells.
  - Group, missing, and unloaded targets report blocked state before mutation.
  - Multi-range scalar paste merges counts across ranges.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue): report structured paste results`

## Slice 5: Clipboard Validation Completeness

- Status: Completed on 2026-05-20.
- Objective: extend the existing shared draft validation path into complete clipboard validation coverage for number, currency, percent, date, datetime, select, formula text, clear values, and custom host paste policies.
- Affected packages/files:
  - `packages/datagrid-core/src/cells/runtime.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
  - `packages/datagrid-core/src/cells/__tests__/runtime.spec.ts`
  - `docs/datagrid-clipboard.md`
- Expected behavior change: typed paste acceptance and rejection match inline edit semantics for supported built-in cell types covered by the shared validation runtime.
- Tests to add/update:
  - Invalid number/date/datetime/select drafts do not mutate rows.
  - Empty clear values follow the same policy as inline editing.
  - Formula cells remain basic text paste unless a host provides a richer formula policy.
- Validation command: `pnpm exec vitest run packages/datagrid-core/src/cells/__tests__/runtime.spec.ts packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: High
- Suggested commit message: `test(datagrid): complete clipboard validation coverage`

## Slice 6: Server Clipboard Operation Contract

- Status: Completed on 2026-05-20.
- Objective: define the server-backed copy/export, cut, clear/delete, paste/import, operation id, revision, projection identity, partial result, and history semantics before adding public runtime hooks.
- Affected packages/files:
  - `docs/server-datasource/selection-operations.md`
  - `docs/server-datasource/protocol.md`
  - `docs/server-datasource/integration-docs-map.md`
  - `docs/datagrid-clipboard.md`
  - `docs/audits/CLIPBOARD_ENTERPRISE_AUDIT.md`
- Expected behavior change: no runtime behavior change; server clipboard delegation has a documented planned contract aligned with datasource revisions and server history.
- Tests to add/update:
  - Docs validation only.
- Validation command: `node ./scripts/check-datagrid-docs-framework-track.mjs`
- Risk level: Medium
- Suggested commit message: `docs(datagrid): define server clipboard operations`

## Slice 7: Server Virtual Clipboard Delegation

- Status: Completed on 2026-05-20.
- Objective: route unloaded virtual copy/export, cut, clear/delete, and paste/import through the approved server operation contract when a delegate exists, while preserving current blocking behavior when it does not.
- Affected packages/files:
  - `packages/datagrid-core/src/selection/virtualSelection.ts`
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-server-adapters/src/index.ts`
  - `packages/datagrid-sandbox/src/components/VueServerDataSourceGridCard.vue`
  - Relevant backend/server-demo files after API approval
- Expected behavior change: app clipboard can delegate unloaded virtual copy/cut/paste through explicit opt-in handlers; local grids and server-backed grids without handlers continue to block unsafe virtual operations.
- Tests to add/update:
  - Delegated copy/export over unloaded ranges returns operation id and payload/status.
  - Delegated paste/import handles accepted, rejected, and partial responses.
  - Stale projection or revision blocks with deterministic status.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts && pnpm --filter @affino/datagrid-server-adapters type-check`
- Risk level: High
- Suggested commit message: `feat(datagrid): delegate virtual clipboard operations`

## Slice 8: Async Paste Pending And Recovery

- Status: Completed on 2026-05-20.
- Objective: expose pending, failure, retry, cancellation, and rollback semantics for async `applyClipboardEdits` and datasource-backed paste operations.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
  - `packages/datagrid-vue-app/src/stage/*`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
  - `docs/datagrid-clipboard.md`
- Expected behavior change: async paste failures no longer look like silent no-ops; app state exposes pending and rejected paste status, duplicate paste while pending is blocked, and successful history is recorded only after commit.
- Tests to add/update:
  - Pending state blocks duplicate paste of the same operation.
  - Rejected async paste reports failure and does not record success history.
  - Retry/cancel follows the documented contract.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue): surface rejected clipboard paste`

## Slice 9: Cut-Paste Atomicity

- Status: Completed on 2026-05-20.
- Objective: make cut source clear and target write behave as one recoverable operation with rollback or explicit rejected-state reporting if either side fails.
- Affected packages/files:
  - `packages/datagrid-vue/src/app/useDataGridAppClipboard.ts`
  - `packages/datagrid-vue/src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
  - `docs/datagrid-clipboard.md`
- Expected behavior change: local cut-paste applies source clear and target write as one row-model commit, so a failed target write does not clear source cells. Async failure is surfaced through rejected paste state.
- Tests to add/update:
  - Target write failure leaves source values intact or reports a recoverable rejected transaction.
  - Source clear failure blocks target write.
  - Successful cut-paste still records one undoable transaction.
- Validation command: `pnpm --filter @affino/datagrid-vue exec vitest run --config vitest.config.ts src/app/__tests__/useDataGridAppClipboard.contract.spec.ts`
- Risk level: High
- Suggested commit message: `fix(datagrid-vue): make cut paste recoverable`

## Slice 10: Clipboard Remount, A11y, Mobile, And Performance Gates

- Status: Partially completed on 2026-05-20. App-level contract coverage now verifies pending clipboard ranges remain stable across viewport remount offsets and clipboard fallback status reaches a polite grid live region. Playwright coverage now verifies copied and cut clipboard outlines after vertical/horizontal remounts and right-pinned remounts, plus coarse-pointer long-press selection with keyboard copy/paste while body touch pan remains scroll-first. Materialized and browser clipboard benchmark asserts gate copy creation, TSV parser cost, paste payload creation, paste patch application, total paste latency, and Chromium clipboard read/write round-trip latency; real-device mobile gates remain planned.
- Objective: add focused validation for pending clipboard outlines across virtualization remounts, live-region/status feedback, touch/mobile clipboard affordances, and large materialized copy/paste budgets.
- Affected packages/files:
  - `packages/datagrid-vue-app/src/stage/*`
  - `packages/datagrid-vue-app/src/host/DataGridDefaultRenderer.ts`
  - `e2e/sandbox-interactions.spec.ts`
  - `scripts/bench-datagrid-enterprise-workloads.mjs`
  - `scripts/bench-datagrid-interactions.mjs`
  - `docs/perf/datagrid-performance-gates.md`
  - `docs/datagrid-clipboard.md`
- Expected behavior change: pending clipboard range logic is covered across viewport remount offsets in app contracts and browser copy/cut remount flows, clipboard/fill status messages now have a mounted live-region surface in the app renderer, coarse-pointer long-press selection can drive keyboard copy/paste without claiming body touch scroll, and materialized copy/paste, TSV parser, and Chromium clipboard read/write regressions can hard-fail through the clipboard benchmark asserts. Partial-result announcements and real-device mobile execution remain planned.
- Tests to add/update:
  - Pending copied and cut outlines reappear after vertical, horizontal, and right-pinned remounts.
  - Clipboard denied, copied, pasted, partial, and blocked states are announced where status UI exists.
  - Touch/coarse-pointer copy/paste follows the documented affordance.
  - Copy payload build, parse, and paste patch creation stay within documented local budgets.
- Validation command: `pnpm --filter @affino/datagrid-vue-app exec vitest run --config vitest.config.ts src/__tests__/DataGrid.contract.spec.ts && pnpm exec playwright test e2e/sandbox-grid.spec.ts --grep "coarse pointer clipboard shortcuts" && pnpm run bench:datagrid:enterprise:clipboard:assert && pnpm run bench:datagrid:enterprise:clipboard:browser:assert`
- Risk level: Medium
- Suggested commit message: `test(datagrid): gate enterprise clipboard behavior`

## Recommended Execution Order

1. Slice 1: Enterprise Clipboard Contract (completed 2026-05-20)
2. Slice 2: Clipboard Format Parser And Writer (completed 2026-05-20)
3. Slice 3: Clipboard Read/Write Feedback (completed 2026-05-20)
4. Slice 4: Structured Paste Result (completed 2026-05-20)
5. Slice 5: Clipboard Validation Completeness (completed 2026-05-20)
6. Slice 6: Server Clipboard Operation Contract (completed 2026-05-20)
7. Slice 7: Server Virtual Clipboard Delegation (completed 2026-05-20)
8. Slice 8: Async Paste Pending And Recovery (completed 2026-05-20)
9. Slice 9: Cut-Paste Atomicity (completed 2026-05-20)
10. Slice 10: Clipboard Remount, A11y, Mobile, And Performance Gates (partially completed 2026-05-20)

## Execution Notes

- Preserve the current public `DataGrid` props, row model APIs, and keyboard/context-menu commands unless a slice explicitly proposes a public API change and gets approval.
- Keep clipboard ownership in the current app-stage path; do not move mounted table behavior into legacy/reference mutation helpers.
- Treat parser/writer changes as compatibility improvements that can affect copied payloads containing tabs, newlines, quotes, and blank rows.
- Keep server-backed clipboard work aligned with datasource revision, projection identity, invalidation, and server history contracts.
- Do not make large local clipboard operations silently enumerate unloaded server rows; block or delegate explicitly.

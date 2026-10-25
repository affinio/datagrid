# Overload audit and regression harness

Deterministic consumer harness for the October 2026 overload audit and its follow-up fixes. It imports current product sources; it does not instrument or patch them. The historical measurements and original defect reproductions are recorded in the [audit report](../../../docs/internal/audits/datagrid-overload-audit-2026-10.md); closure status is in the [fix follow-up](../../../docs/internal/audits/datagrid-overload-fixes-2026-10.md). The remaining hung-transport case is conditional on a source that ignores abort and is not a product correctness assertion.

Run from repository root:

```sh
pnpm exec vitest run --config scripts/audits/datagrid-overload/vitest.config.ts
pnpm exec vite build --config scripts/audits/datagrid-overload/vite.browser.config.mts
pnpm exec vite preview --config scripts/audits/datagrid-overload/vite.browser.config.mts
```

With preview running, in another terminal:

```sh
node scripts/audits/datagrid-overload/browser.mjs
node scripts/audits/datagrid-overload/summarize.mjs
```

Artifacts default to `/tmp/affino-overload-audit`. `OVERLOAD_OUTPUT` changes headless/browser JSON output; the Vite build directory remains fixed. `OVERLOAD_BASE_URL` changes the browser target and `OVERLOAD_REPORT_JSON` chooses the combined artifact destination.

- Headless: deferred Promise, explicit microtask settling, fake timers and injected frame/message drivers. No random sleeps or random callbacks.
- Browser: actual production Vue component; one warm-up and five measured samples per workload/scale. Native key input is injected through CDP. `longtask` entries and input event timestamps are collected independently of headless checks.
- Counted model/platform runs are separate from uninstrumented timing samples. Five samples do not justify p95/p99 estimates; the report uses median and range.
- Queue-memory measurements force GC through CDP for diagnostics. Tasks capture a fixed 128-number payload. This measures admission/backlog retention, not a general leak test or a memory-per-row guarantee.
- The worker mailbox test uses actual worker facade/host code with a controlled in-memory delivery queue. It proves posted-message growth and ordering behavior, not browser-worker heap or hardware throughput.

The fixture reuses the existing cost-audit consumer for its client model. Its local workloads use `excel-like` projection with auto reapply enabled, two dependent formulas, an active sort, 12 displayed columns and row/column virtualization. Streaming uses a real datasource-backed model and its subscribed push listener, without client formulas or client-side sorting; its timings are not an equivalent compute workload.

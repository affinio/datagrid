# DataGrid identity and scope audit

Regression tests and observations for the October 2026 identity audit. The corrected cases exercise the current product source directly.

The suite keeps the audit's minimal datasets and operation sequences as regression coverage. Ambiguous dataset/history lifetime policies remain observations, not asserted product behavior. Legacy tree expansion keys are retained only when their old string identity maps to exactly one typed row ID.

Run from the repository root:

```sh
mkdir -p /tmp/affino-identity-audit
git diff --binary -- packages | sha256sum > /tmp/affino-identity-audit/product-diff-before.sha
pnpm exec vitest run --config scripts/audits/datagrid-identity/vitest.config.ts
node scripts/audits/datagrid-identity/summarize.mjs
```

`IDENTITY_OUTPUT` changes the temporary result directory. `IDENTITY_REPORT_JSON` chooses the combined artifact destination. The committed report uses `docs/internal/audits/202610/datagrid-identity-results.json`.

- `headless.spec.ts`: actual Core/orchestration public operations; independent expected literal IDs/values, simple arithmetic, and deferred Promises. The selection capability is a minimal local storage stub; it does not infer selection policy from the production resolver.
- `vue.spec.ts`: mounted real Vue `DataGrid`, row menu and exposed structural action, schema/editor replacement, and history replay. Uses jsdom and existing package canvas stubs. This is not real-browser, layout, focus, accessibility, or visual validation.
- The passing stale-response test uses an abort-ignoring deferred source to verify the local request identity guard. The optimistic rollback test uses a different, normal same-dataset query order and an explicit commit rejection.
- All fixtures are deterministic. There are no random seeds or wall-clock sleeps. Vue settling uses Vue ticks and test-utils promise flushing; correctness of datasource ordering uses explicit deferred gates.

See the [audit report](../../../docs/internal/audits/datagrid-identity-scope-audit-2026-10.md) for ownership, ambiguity, limitations, and minimal fix directions.

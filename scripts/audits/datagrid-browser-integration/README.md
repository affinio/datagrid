# Vue browser integration audit

Production Chromium diagnostics for geometry, hit testing and interrupted interactions. `run.mjs` and `fixture-run.mjs` collect observations; exit code 0 means the harness completed, **not** that the product has no defects. The original findings remain in the audit record; local fixes have focused regressions in `e2e/browser-integration-regressions.spec.ts`.

## Run

Build and serve the normal sandbox in one terminal:

```sh
pnpm --filter @affino/datagrid-sandbox run build
pnpm --filter @affino/datagrid-sandbox run preview --host 127.0.0.1 --port 4173
```

Build and serve the separate public-API fixture in another terminal:

```sh
pnpm exec vite build --config scripts/audits/datagrid-browser-integration/fixture.vite.config.ts
pnpm exec vite preview --config scripts/audits/datagrid-browser-integration/fixture.vite.config.ts
```

Capture the existing tracked product diff and run diagnostics:

```sh
git diff --binary -- packages | sha256sum > /tmp/affino-browser-product-before.sha
node scripts/audits/datagrid-browser-integration/run.mjs
node scripts/audits/datagrid-browser-integration/fixture-run.mjs
node scripts/audits/datagrid-browser-integration/reorder-trace.mjs
```

The bounded existing Playwright matrix used for this audit:

```sh
pnpm exec playwright test e2e/sandbox-grid.spec.ts e2e/sandbox-interactions.spec.ts e2e/sandbox-tree-pivot.spec.ts --workers=2 --grep 'row resize keeps|pinned bottom rows stay|grouped headers retain|high-DPI viewport resize|variable-height viewport|drag selection remains|horizontal virtualization keeps arrow|keeps pinned checkbox|range move with auto-scroll|fill drag with auto-scroll|column resize handle changes|reorders the focused header|inline editor exposes|tree group anchor|@a11y vue base|touch fill drag starts' --reporter=json > /tmp/affino-browser-existing.json
pnpm exec playwright test e2e/sandbox-interactions.spec.ts e2e/sandbox-grid.spec.ts --workers=2 --grep 'returns keyboard focus to a selected body cell|restores body-cell focus after a column menu|reorders the focused header|column and row resize near adjacent|context menu cancels an active range move|selection anchor remounts with overlay fill handle|active cell focus returns|keyboard navigation past the rendered range' --reporter=json > /tmp/affino-browser-extra.json
node scripts/audits/datagrid-browser-integration/summarize.mjs
```

The original second Playwright command recorded the selected-row resize failure. To validate the fixes, run `pnpm exec playwright test e2e/browser-integration-regressions.spec.ts --workers=1`. Its coarse-pointer case uses CDP `Input.dispatchTouchEvent`; its assertions check actual browser hit testing, touch cancellation, row resize, settled header/body geometry, and simultaneous diagonal X/Y wheel routing. The separate reorder trace is retained as historical evidence for the removed header-only animation.

`BROWSER_AUDIT_URL`, `BROWSER_FIXTURE_URL`, `BROWSER_AUDIT_OUTPUT` and `BROWSER_AUDIT_REPORT` override endpoints/artifact paths. Full samples and all screenshots default to `/tmp/affino-browser-integration`; compact evidence and two finding screenshots go to `docs/internal/audits/202610/browser-integration`.

## Measurement boundaries

- Sample settled animation frames and intersect ancestor overflow clips before comparing `elementFromPoint` with cell identity.
- Keep intentional sticky occlusion visible in raw observations; a covered source cell is not the visual event target.
- Compare public activation requests with the actual anchor, focused element and center-point hit. The fixture uses documented `initialState` column widths/pins. Fractional input widths normalize to integers in Core; CSS zoom creates fractional rendered widths separately.
- CDP composition input is not a hardware OS IME certification. A headless tab switch did not emit native window blur; injected blur is explicitly labelled synthetic.
- The fixture calls explicit `view.refresh()` after a row-height override before comparing settled geometry.

See the [report](../../../docs/internal/audits/datagrid-browser-integration-audit-2026-10.md) for findings, tolerances and untested combinations.

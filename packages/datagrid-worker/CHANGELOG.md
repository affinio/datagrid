# @affino/datagrid-worker

## Unreleased

## 0.6.0

### Minor Changes

- Added explicit transfer-list support and opt-in columnar numeric row updates.
- Added bounded compute backpressure, terminal error handling, stale update protection, and DOM-compatible postMessage target typing.

### Validation

- Worker tests: 34 passed.
- Worker and dependent package builds passed.
- Browser pressure measurements remain CI Chromium dependent.


## 0.5.0

### Minor Changes

- ## Summary

  Released the worker package with the DataGrid 0.5.0 performance track, keeping worker transport/protocol support aligned with the core and Vue package versions.

  ## User impact

  Worker-backed DataGrid integrations can consume the same 0.5.0 package line as core, orchestration, Vue, and app packages.

  ## Migration
  - No migration required.

  ## Validation
  - datasource churn, tree workload, benchmark report, and perf-contract gates passed

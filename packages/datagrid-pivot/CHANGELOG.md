# @affino/datagrid-pivot

## Unreleased

## 0.2.0

### Minor Changes

- Added opt-in sparse pivot storage through `sparseStorage` with typed missing/null/value reads.
- Added bounded dense compatibility materialization through `maxCells`.
- Preserved dense output as the default for existing consumers.

### Validation

- Pivot contracts passed.
- Package type-check/build passed.
- Browser export and pinned-pane evidence remain CI workload dependent.

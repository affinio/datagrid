# Changelog

## 0.1.0

- Initial release of `@affino/projection-engine`.
- Deterministic dirty/requested/computed stage tracking with blocked-stage stale retention.
- Declarative graph API (`nodes` + `dependsOn`) with automatic topological sort and graph validation.
- Added `prepareProjectionStageGraph(...)` and precomputed downstream closure for low-overhead repeated stage expansion.

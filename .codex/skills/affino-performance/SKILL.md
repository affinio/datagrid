---
name: affino-performance
description: Use for Affino DataGrid performance work involving virtualization, viewport/cache windows, overscan, scroll latency, render latency, invalidation, broad refresh avoidance, benchmarks, performance traces, and CI regression gates.
---

# Affino Performance

## Scope

Use this skill for performance-sensitive DataGrid slices: scrolling, virtualization, overscan, cache windows, server-backed loading, render batching, invalidation, memory churn, and benchmark coverage.

## Performance Rules

- Measure or reason from concrete code paths; do not invent bottlenecks.
- Keep scroll handlers light and batch reactive work through `requestAnimationFrame` where practical.
- Avoid layout reads after writes in the same hot path.
- Prefer retaining cached ranges/models over broad refreshes.
- Make overscan and prefetch behavior explicit and testable.
- Keep user-facing smoothness and blank-viewport prevention as primary scroll goals.

## Audit Checklist

- Scroll event frequency and reactive writes.
- Visible range calculation and overscan policy.
- Header/body/pinned synchronization.
- Server-backed cache loading and stale/blank viewport behavior.
- Forced reflow risks: `getBoundingClientRect`, `clientWidth`, `scrollTop`, style writes.
- Render churn during momentum scroll.
- Hover/focus/overlay work while scrolling.

## Slice Workflow

1. Identify the hot path and its callers.
2. Determine whether the issue is CPU, layout, rendering, network/cache, or synchronization.
3. Make a small change that reduces work or avoids blanking without changing public API.
4. Add focused tests or a benchmark/perf trace expectation.
5. Update performance docs or audit status for non-trivial changes.

## Validation

- Run targeted unit/contract tests first.
- Run existing benchmark files when the changed path has one.
- For scroll UX, include manual verification notes for desktop and touch/coarse devices when needed.

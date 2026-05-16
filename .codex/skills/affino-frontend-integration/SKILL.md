---
name: affino-frontend-integration
description: Use for Affino Vue/DataGrid integration work involving DataGrid app wrappers, HTTP datasource adapters, selection, fill, editing, history UX, interaction flows, keyboard/touch behavior, overlays, pinned panes, and user-facing grid workflows.
---

# Affino Frontend Integration

## Scope

Use this skill for Vue/DataGrid integration slices that affect user workflows, app-layer composition, datasource adapters, editing, selection, fill, history, overlays, pinned panes, and interaction behavior.

## Working Rules

- Preserve separation between core DataGrid logic, Vue wrapper, app layer, sandbox, and backend.
- Prefer existing composables, stage runtime helpers, and local interaction patterns.
- Keep one-finger touch scroll native unless the user explicitly starts an editing/selection/drag affordance.
- Do not introduce hover-only requirements for touch workflows.
- Avoid public prop/API changes unless proposed and approved first.
- Treat pinned/header/body layer synchronization as a first-class UX contract.

## Interaction Checklist

- Mouse, keyboard, touch, and coarse-pointer behavior are considered separately.
- Selection and drag gestures do not steal native scroll.
- Fill/range move/resize start only from explicit affordances on touch.
- Focus changes use `preventScroll` when preserving viewport position matters.
- Pinned panes and header remain synchronized with the body viewport.
- Overlay and hover work is suppressed or light during scroll.

## Slice Workflow

1. Trace the event from template to composable to runtime state.
2. Identify whether the behavior belongs in core, Vue app, or stage layer.
3. Add a narrow guard/helper when repeated interaction rules emerge.
4. Add or update contract tests for the interaction edge.
5. Update docs/audit notes for UX behavior changes.

## Validation

- Prefer targeted Vitest contract tests for changed composables/components.
- Run package-level type-check for `@affino/datagrid-vue-app` or `@affino/datagrid-vue` as appropriate.
- For visual/touch behavior, note any required manual browser/device verification.

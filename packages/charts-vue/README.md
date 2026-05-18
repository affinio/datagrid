# @affino/charts-vue

Reusable Vue rendering package for Affino chart experiences.

## Purpose

`@affino/charts-vue` owns Vue components, SVG rendering, styling, interaction, accessibility, and theme tokens for chart UI.

`@affino/charts-core` remains the headless calculation and geometry package. Vue rendering should consume core chart types, data access helpers, layout helpers, scale helpers, and chart geometry rather than duplicating those calculations.

## Current State

This package is scaffold-only. It exposes a minimal package entrypoint and initial public chart-adjacent types so later slices can add concrete chart components without changing the package shape.

## Public API

```ts
import { createChartsVue } from "@affino/charts-vue"

const chartsVue = createChartsVue()
```

## Non-Goals

- No D3, Chart.js, Recharts, ECharts, or external chart rendering libraries.
- No `datagrid-sandbox` dependency.
- No `analytics-core` dependency.
- No chart components yet.

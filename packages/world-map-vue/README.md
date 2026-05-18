# @affino/world-map-vue

Reusable Vue SVG world map components for Affino.

`@affino/world-map-vue` is the Vue rendering layer for world map path data. It does not load map data or project geographic coordinates by itself. Use `@affino/world-map-core` to convert `WorldMapCountryFeature[]` into `WorldMapPathFeature[]`, then pass those paths to `WorldMapSvg`.

## Public API

```ts
import { WorldMapSvg } from "@affino/world-map-vue"
```

`WorldMapSvg` renders `WorldMapPathFeature[]` as SVG country paths and provides local hover, selection, keyboard, zoom, and pan interactions.

## Basic Usage

```vue
<script setup lang="ts">
import { computed, ref } from "vue"
import { createWorldMapPaths } from "@affino/world-map-core"
import type { WorldMapCountryFeature, WorldMapCountryId } from "@affino/world-map-core"
import { WorldMapSvg } from "@affino/world-map-vue"

const countries = ref<WorldMapCountryFeature[]>([])
const selectedCountryId = ref<WorldMapCountryId | null>(null)

const pathFeatures = computed(() => createWorldMapPaths(countries.value, {
  viewport: { width: 960, height: 480 },
  projection: "equirectangular",
  precision: 2,
}))
</script>

<template>
  <WorldMapSvg
    v-model:selected-country-id="selectedCountryId"
    :paths="pathFeatures"
    :width="960"
    :height="480"
    @country-click="feature => console.log(feature.name)"
  />
</template>
```

## Input Data

`paths` must be an array of `WorldMapPathFeature` objects from `@affino/world-map-core`:

```ts
interface WorldMapPathFeature {
  id: string
  name: string
  iso2?: string
  iso3?: string
  path: string
  properties?: Record<string, unknown>
}
```

The `path` field is SVG path data. The component renders one `<path>` per feature and uses `id` for selection and event identity.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `paths` | `WorldMapPathFeature[]` | required | SVG path features to render. |
| `width` | `number` | `960` | SVG viewBox width. |
| `height` | `number` | `480` | SVG viewBox height. |
| `selectedCountryId` | `string \| null \| undefined` | `undefined` | Semi-controlled selection. Use `v-model:selected-country-id` to control it in Vue templates. |
| `enableZoom` | `boolean` | `true` | Shows zoom controls and enables wheel zoom. |
| `enablePan` | `boolean` | `true` | Enables drag-to-pan and grab cursor state. |
| `minZoom` | `number` | `1` | Minimum zoom level. Values below `0.1` are clamped. |
| `maxZoom` | `number` | `8` | Maximum zoom level. Clamped to at least `minZoom`. |

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `update:selectedCountryId` | `string \| null` | Emitted when country selection changes or clears. |
| `country-click` | `WorldMapPathFeature` | Emitted after country click or keyboard activation. |
| `country-hover` | `WorldMapPathFeature` | Emitted on country mouse enter. |
| `country-leave` | `WorldMapPathFeature` | Emitted on country mouse leave. |
| `view-change` | `{ zoom: number; panX: number; panY: number }` | Emitted when zoom or pan state changes. |

## Interaction Behavior

- Clicking a country selects it.
- Clicking the selected country clears selection.
- Clicking the map background clears selection.
- Pressing `Escape` clears selection.
- Focused countries can be activated with `Enter` or `Space`.
- Zoom controls and wheel zoom update the SVG transform.
- Dragging pans the map when `enablePan` is `true`.

## Theming

`WorldMapSvg` exposes visual styling through CSS custom properties on the component root. Override them from an application stylesheet or wrapper class:

```css
.my-map-theme {
  --affino-world-map-ocean-fill: #dbeafe;
  --affino-world-map-country-fill: #d1d5db;
  --affino-world-map-country-selected-fill: #2563eb;
  --affino-world-map-country-selected-stroke: #1e3a8a;
}
```

Available variables:

- `--affino-world-map-ocean-fill`
- `--affino-world-map-stage-background`
- `--affino-world-map-stage-border`
- `--affino-world-map-control-background`
- `--affino-world-map-control-border`
- `--affino-world-map-control-color`
- `--affino-world-map-control-hover-background`
- `--affino-world-map-control-disabled-opacity`
- `--affino-world-map-control-disabled-cursor`
- `--affino-world-map-country-fill`
- `--affino-world-map-country-stroke`
- `--affino-world-map-country-hover-fill`
- `--affino-world-map-country-selected-fill`
- `--affino-world-map-country-selected-stroke`
- `--affino-world-map-country-selected-hover-fill`
- `--affino-world-map-country-selected-hover-stroke`
- `--affino-world-map-country-focus-fill`
- `--affino-world-map-country-focus-stroke`

## Non-Goals

This package intentionally does not include:

- built-in map data
- TopoJSON conversion
- markers
- choropleth rendering
- MapLibre, D3, Canvas, or WebGL dependencies

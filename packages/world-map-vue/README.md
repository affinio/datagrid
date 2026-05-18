# @affino/world-map-vue

Reusable Vue SVG world map components for Affino.

`@affino/world-map-vue` is the Vue rendering layer for world map path data and simple lon/lat marker overlays. It does not load map data or convert country geometry by itself. Use `@affino/world-map-core` to convert `WorldMapCountryFeature[]` into `WorldMapPathFeature[]`, then pass those paths to `WorldMapSvg`.

## Public API

```ts
import { WorldMapSvg } from "@affino/world-map-vue"
import type { WorldMapMarker } from "@affino/world-map-vue"
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
const markers: WorldMapMarker[] = [
  { id: "london", lon: -0.1276, lat: 51.5072, label: "London" },
  { id: "paris", lon: 2.3522, lat: 48.8566, label: "Paris" },
  { id: "new-york", lon: -74.006, lat: 40.7128, label: "New York" },
]

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
    :markers="markers"
    :width="960"
    :height="480"
    @country-click="feature => console.log(feature.name)"
    @marker-click="marker => console.log(marker.label)"
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

Markers are optional lon/lat point overlays:

```ts
interface WorldMapMarker {
  id: string
  lon: number
  lat: number
  label?: string
  value?: number
  properties?: Record<string, unknown>
}
```

Markers are projected with the same fixed equirectangular viewport as the country paths and render above countries inside the zoom/pan layer.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `paths` | `WorldMapPathFeature[]` | required | SVG path features to render. |
| `markers` | `WorldMapMarker[]` | `[]` | Optional lon/lat point markers to render above countries. |
| `width` | `number` | `960` | SVG viewBox width. |
| `height` | `number` | `480` | SVG viewBox height. |
| `selectedCountryId` | `string \| null \| undefined` | `undefined` | Semi-controlled selection. Use `v-model:selected-country-id` to control it in Vue templates. |
| `enableZoom` | `boolean` | `true` | Shows zoom controls and enables wheel zoom. |
| `enableMarkers` | `boolean` | `true` | Enables marker rendering. |
| `enablePan` | `boolean` | `true` | Enables drag-to-pan and grab cursor state. |
| `markerRadius` | `number` | `4` | Marker circle radius in SVG units. |
| `minZoom` | `number` | `1` | Minimum zoom level. Values below `0.1` are clamped. |
| `maxZoom` | `number` | `8` | Maximum zoom level. Clamped to at least `minZoom`. |

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `update:selectedCountryId` | `string \| null` | Emitted when country selection changes or clears. |
| `country-click` | `WorldMapPathFeature` | Emitted after country click or keyboard activation. |
| `country-hover` | `WorldMapPathFeature` | Emitted on country mouse enter. |
| `country-leave` | `WorldMapPathFeature` | Emitted on country mouse leave. |
| `marker-click` | `WorldMapMarker` | Emitted after marker click or keyboard activation. |
| `marker-hover` | `WorldMapMarker` | Emitted on marker mouse enter. |
| `marker-leave` | `WorldMapMarker` | Emitted on marker mouse leave. |
| `view-change` | `{ zoom: number; panX: number; panY: number }` | Emitted when zoom or pan state changes. |

## Interaction Behavior

- Clicking a country selects it.
- Clicking the selected country clears selection.
- Clicking the map background clears selection.
- Pressing `Escape` clears selection.
- Focused countries can be activated with `Enter` or `Space`.
- Clicking a marker emits `marker-click` without changing country selection or clearing the map.
- Focused markers can be activated with `Enter` or `Space`.
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
  --affino-world-map-marker-fill: #dc2626;
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
- `--affino-world-map-marker-fill`
- `--affino-world-map-marker-stroke`
- `--affino-world-map-marker-hover-fill`
- `--affino-world-map-marker-focus-stroke`

## Non-Goals

This package intentionally does not include:

- built-in map data
- TopoJSON conversion
- marker labels, clustering, or heatmaps
- choropleth rendering
- MapLibre, D3, Canvas, or WebGL dependencies

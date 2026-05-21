# @affino/world-map-vue

Reusable Vue SVG world map components for Affino.

`@affino/world-map-vue` is the Vue rendering layer for world map path data and simple lon/lat marker overlays. It does not load map data or convert country geometry by itself. Use `@affino/world-map-core` to convert `WorldMapCountryFeature[]` into `WorldMapPathFeature[]`, then pass those paths to `WorldMapSvg`.

## Public API

```ts
import { WorldMapSvg } from "@affino/world-map-vue"
import type {
  WorldMapMarker,
  WorldMapMarkerInteraction,
  WorldMapMarkerRenderContext,
} from "@affino/world-map-vue"
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
const selectedMarkerId = ref<string | null>(null)
const countryValues = {
  "250": 63,
  "826": 72,
  "840": 95,
}
const markers: WorldMapMarker[] = [
  { id: "london", lon: -0.1276, lat: 51.5072, label: "London", variant: "success" },
  { id: "paris", lon: 2.3522, lat: 48.8566, label: "Paris", variant: "warning" },
  { id: "new-york", lon: -74.006, lat: 40.7128, label: "New York", variant: "muted" },
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
    v-model:selected-marker-id="selectedMarkerId"
    :paths="pathFeatures"
    :markers="markers"
    :country-values="countryValues"
    enable-choropleth
    :width="960"
    :height="480"
    @country-click="feature => console.log(feature.name)"
    @marker-click="interaction => console.log(interaction.marker.label, interaction.anchorRect)"
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
  variant?: "default" | "success" | "warning" | "danger" | "muted"
  class?: string | string[] | Record<string, boolean | undefined> | null | undefined
  style?: string | Record<string, string | number | undefined> | null | undefined
  properties?: Record<string, unknown>
}
```

Marker click, hover, and leave events emit an interaction payload:

```ts
interface WorldMapMarkerInteraction {
  marker: WorldMapMarker
  svgPoint: { x: number; y: number }
  clientPoint: { x: number; y: number }
  anchorRect: { x: number; y: number; width: number; height: number }
}
```

`svgPoint` is the rendered SVG coordinate after the current zoom/pan transform. `clientPoint` is the center of the marker element in viewport coordinates. `anchorRect` is a plain object copied from the marker element bounding rect and can be used as a virtual anchor for application-owned popovers.

Markers are projected with the same fixed equirectangular viewport as the country paths and render above countries inside the zoom/pan layer. The optional `variant` field provides generic visual states for dashboards, GPS tracking, analytics, auctions, and similar overlays without imposing a domain-specific schema.


## Marker Slots And Custom Styling

Markers accept per-item `class` and `style` overrides. Those values are applied to the default marker shape, and the component also exposes a typed `marker` slot so consumers can render custom SVG content for each point without DOM geometry workarounds.

```vue
<WorldMapSvg :paths="pathFeatures" :markers="markers">
  <template #marker="{ radius, selected, hovered, variant, markerClass, markerStyle }">
    <g>
      <circle
        :r="radius"
        :class="[markerClass, `marker-${variant}`, { 'marker--selected': selected, 'marker--hovered': hovered }]"
        :style="markerStyle"
      />
      <circle v-if="selected" :r="radius + 8" class="marker-pulse" />
    </g>
  </template>
</WorldMapSvg>
```

The slot context is typed as `WorldMapMarkerRenderContext` and includes the current marker, projected `x`/`y`, rendered `radius`, `selected` and `hovered` state, current `variant`, and the marker's base `class`/`style` values. When no slot is provided, `WorldMapSvg` falls back to the default `<circle>` rendering.

## SVG Render Layers

`WorldMapSvg` renders a stable internal SVG layer structure:

- `world-map-svg__ocean-layer` for the ocean/background rectangle.
- `world-map-svg__viewport-layer` for the transformed zoom/pan viewport. The legacy `world-map-svg__map-layer` class remains on this group for compatibility.
- `world-map-svg__country-layer` / `world-map-svg__country-fill-layer` for country paths and country interactions.
- `world-map-svg__country-border-layer` as an empty non-interactive placeholder for future separate border rendering.
- `world-map-svg__track-layer` as an empty non-interactive placeholder for future route/GPS track rendering.
- `world-map-svg__marker-layer` for lon/lat markers, above countries.
- `world-map-svg__overlay-layer` and `world-map-svg__label-layer` as empty non-interactive placeholders for future overlays and labels.

Tracks, labels, custom overlay slots, and alternate map datasets are not implemented yet. The current layer structure is intentionally internal and preserves the existing props, events, and marker/country behavior.

## Marker Selection And Scale

Markers support semi-controlled selection through `v-model:selected-marker-id`:

```vue
<WorldMapSvg
  v-model:selected-marker-id="selectedMarkerId"
  :paths="pathFeatures"
  :markers="markers"
/>
```

Clicking a marker selects it, clicking the selected marker clears it, and map background clicks or `Escape` clear marker selection together with country selection. Marker clicks do not clear country selection.

Use `markerScaleMode` to choose how marker size behaves during zoom:

- `"screen"` keeps marker visual radius stable while zooming by reducing SVG radius as zoom increases.
- `"map"` keeps marker radius in map coordinates, so markers scale with the map.

## State Persistence

`WorldMapSvg` exposes a small imperative state API on the component instance so applications can persist and restore map view state symmetrically with `datagrid`.

```ts
const state = worldMapRef.value?.getState()
const migrated = worldMapRef.value?.migrateState(rawState)
const restored = worldMapRef.value?.applyState(migrated)
```

The exported state currently includes:

- selected country id
- selected marker id
- zoom level
- pan offsets

The state shape is versioned and validated before restore. Invalid payloads return `null` from `migrateState` unless `strict: true` is passed.

Generic GPS tracking overlays can keep their domain data in `properties`:

```ts
const markers: WorldMapMarker[] = [
  {
    id: "vehicle-17",
    lon: -122.4194,
    lat: 37.7749,
    label: "Vehicle 17",
    variant: "success",
    properties: {
      speedKph: 48,
      lastSeenAt: "2026-05-18T20:00:00Z",
    },
  },
]
```

## External Popovers

`WorldMapSvg` does not render popovers and does not own popover positioning. Use the marker interaction payload to connect to an application-level popover:

```ts
const activeMarker = ref<WorldMapMarkerInteraction | null>(null)

function handleMarkerClick(interaction: WorldMapMarkerInteraction): void {
  activeMarker.value = interaction
}
```

```vue
<WorldMapSvg
  :paths="pathFeatures"
  :markers="markers"
  @marker-click="handleMarkerClick"
/>

<AppPopover
  v-if="activeMarker"
  :virtual-anchor="activeMarker.anchorRect"
>
  {{ activeMarker.marker.label }}
</AppPopover>
```

The popover component is intentionally external. `@affino/world-map-vue` only reports the marker, rendered SVG point, viewport client point, and anchor rectangle.

## Choropleth Values

Countries can be colored by numeric value using `countryValues` and `enableChoropleth`:

```vue
<WorldMapSvg
  :paths="pathFeatures"
  :country-values="{ '250': 63, '826': 72, '840': 95 }"
  enable-choropleth
/>
```

The keys are `WorldMapPathFeature.id` values. Countries without a finite value use normal country styling. `NaN`, `Infinity`, and `-Infinity` values are ignored.

By default the component computes the value domain from finite values in `countryValues`. Pass `countryValueMin` and `countryValueMax` to pin the scale. When the domain minimum and maximum are equal, the component uses a stable middle intensity.

The v0.1 choropleth scale is a small dependency-free `color-mix()` interpolation between `--affino-world-map-country-value-low-fill` and `--affino-world-map-country-value-high-fill`. Selected country styling takes precedence over value coloring.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `paths` | `WorldMapPathFeature[]` | required | SVG path features to render. |
| `markers` | `WorldMapMarker[]` | `[]` | Optional lon/lat point markers to render above countries. |
| `countryValues` | `Record<string, number>` | `{}` | Numeric values keyed by `WorldMapPathFeature.id`. |
| `width` | `number` | `960` | SVG viewBox width. |
| `height` | `number` | `480` | SVG viewBox height. |
| `selectedCountryId` | `string \| null \| undefined` | `undefined` | Semi-controlled selection. Use `v-model:selected-country-id` to control it in Vue templates. |
| `selectedMarkerId` | `string \| null \| undefined` | `undefined` | Semi-controlled marker selection. Use `v-model:selected-marker-id` to control it in Vue templates. |
| `enableChoropleth` | `boolean` | `false` | Enables value-based country coloring. |
| `enableZoom` | `boolean` | `true` | Shows zoom controls and enables wheel zoom. |
| `enableMarkers` | `boolean` | `true` | Enables marker rendering. |
| `enablePan` | `boolean` | `true` | Enables drag-to-pan and grab cursor state. |
| `countryValueMin` | `number \| undefined` | `undefined` | Optional lower bound for choropleth value normalization. |
| `countryValueMax` | `number \| undefined` | `undefined` | Optional upper bound for choropleth value normalization. |
| `markerRadius` | `number` | `4` | Marker circle radius in SVG units. |
| `markerScaleMode` | `"screen" \| "map"` | `"screen"` | Marker radius behavior during zoom. |
| `minZoom` | `number` | `1` | Minimum zoom level. Values below `0.1` are clamped. |
| `maxZoom` | `number` | `8` | Maximum zoom level. Clamped to at least `minZoom`. |

## Events

| Event | Payload | Description |
| --- | --- | --- |
| `update:selectedCountryId` | `string \| null` | Emitted when country selection changes or clears. |
| `update:selectedMarkerId` | `string \| null` | Emitted when marker selection changes or clears. |
| `country-click` | `WorldMapPathFeature` | Emitted after country click or keyboard activation. |
| `country-hover` | `WorldMapPathFeature` | Emitted on country mouse enter. |
| `country-leave` | `WorldMapPathFeature` | Emitted on country mouse leave. |
| `marker-click` | `WorldMapMarkerInteraction` | Emitted after marker click or keyboard activation. |
| `marker-hover` | `WorldMapMarkerInteraction` | Emitted on marker mouse enter. |
| `marker-leave` | `WorldMapMarkerInteraction` | Emitted on marker mouse leave. |
| `view-change` | `{ zoom: number; panX: number; panY: number }` | Emitted when zoom or pan state changes. |

## Interaction Behavior

- Clicking a country selects it.
- Clicking the selected country clears selection.
- Clicking the map background clears selection.
- Pressing `Escape` clears selection.
- Focused countries can be activated with `Enter` or `Space`.
- Clicking a marker selects or toggles that marker and emits `marker-click` without changing country selection.
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
  --affino-world-map-marker-selected-fill: #2563eb;
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
- `--affino-world-map-country-value-empty-fill`
- `--affino-world-map-country-value-low-fill`
- `--affino-world-map-country-value-high-fill`
- `--affino-world-map-country-selected-fill`
- `--affino-world-map-country-selected-stroke`
- `--affino-world-map-country-selected-hover-fill`
- `--affino-world-map-country-selected-hover-stroke`
- `--affino-world-map-country-focus-fill`
- `--affino-world-map-country-focus-stroke`
- `--affino-world-map-marker-fill`
- `--affino-world-map-marker-stroke`
- `--affino-world-map-marker-hover-fill`
- `--affino-world-map-marker-selected-fill`
- `--affino-world-map-marker-selected-stroke`
- `--affino-world-map-marker-success-fill`
- `--affino-world-map-marker-warning-fill`
- `--affino-world-map-marker-danger-fill`
- `--affino-world-map-marker-muted-fill`
- `--affino-world-map-marker-focus-stroke`

## Non-Goals

This package intentionally does not include:

- built-in map data
- TopoJSON conversion
- marker labels, popover rendering/positioning, clustering, heatmaps, or live transport protocols
- choropleth legends, tooltips, or advanced color scales
- MapLibre, D3, Canvas, or WebGL dependencies

# @affino/world-map-core

Headless world map core types and utilities for reusable Affino world map features.

This package has no UI, renderer, Vue, React, DOM, SVG, Canvas, WebGL, MapLibre, D3, topojson, or chart dependencies.

## Core

```ts
import { createWorldMapCore } from "@affino/world-map-core"

const core = createWorldMapCore()
// { version: "0.1.0" }
```

## Country Features

```ts
import type { WorldMapCountryFeature } from "@affino/world-map-core"

const feature: WorldMapCountryFeature = {
  id: "US",
  name: "United States",
  iso2: "US",
  iso3: "USA",
  geometry: {
    type: "Polygon",
    coordinates: [[
      { lon: -124.7844, lat: 24.7433 },
      { lon: -66.9514, lat: 24.7433 },
      { lon: -66.9514, lat: 49.3458 },
    ]],
  },
}
```

## Projection

```ts
import { projectWorldMapPosition } from "@affino/world-map-core"

const point = projectWorldMapPosition(
  { lon: 0, lat: 0 },
  { viewport: { width: 360, height: 180 } },
)

// { x: 180, y: 90 }
```

The default projection is `equirectangular`.

## Path Data

```ts
import { createWorldMapPath } from "@affino/world-map-core"

const pathFeature = createWorldMapPath(feature, {
  viewport: { width: 360, height: 180 },
  precision: 2,
})

// { id, name, iso2, iso3, path, properties }
```

`Polygon` and `MultiPolygon` rings are projected with the selected projection and emitted as SVG path data. Empty rings are skipped.

## Non-Goals For v0.1

- No renderer components.
- No DOM, SVG, Canvas, or WebGL integration.
- No MapLibre, D3, topojson, or chart dependencies.
- No Mercator projection yet.
- No path generation, fit-to-bounds, zoom, pan, or topology processing yet.

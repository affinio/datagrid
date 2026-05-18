# @affino/world-map-vue

Reusable Vue SVG world map components for Affino.

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

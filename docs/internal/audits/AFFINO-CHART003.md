# AFFINO-CHART003 — Declarative Crosshair & Floating Tooltip Interaction

Date: 2026-08-31
Scope: `@affino/charts-core` and `@affino/charts-vue`. FxLab was not modified.

## status

Classification: `AFFINO_CHART_INTERACTION_READY_WITH_LIMITATIONS`.

The corrected interaction is package-owned and declarative: the consumer does not handle pointer movement, hit testing, coordinate conversion, or tooltip collision. Core provides indexed nearest-X resolution; Vue owns the pointer/keyboard state and HTML overlay. Packed consumer validation passed. Browser visual verification is pending because the local Playwright Chromium binary is unavailable.

## current_interaction_audit

Before this slice, time-series hover used `mousemove`, converted the raw pointer directly to a timestamp, rebuilt the union domain on every update, and positioned the HTML tooltip with a clamped percentage/top value. The crosshair followed the tooltip timestamp, but tooltip placement did not measure its rendered size or flip around chart edges. Keyboard navigation existed but did not share an explicit pointer state. ResizeObserver ownership and the shared SVG plot were retained.

## interaction_architecture

Current ownership is:

- `@affino/charts-core`: validation, shared visible domain, binary nearest-X lookup, reusable tooltip resolver.
- `@affino/charts-vue`: one interaction capture surface, shared pointer/keyboard active state, SVG plot crosshair, measured HTML tooltip overlay, ResizeObserver updates.
- `AffinoTimeSeriesChart`: declarative props and public typed slot/event model.

The overlay remains pointer-transparent, preventing tooltip-induced pointerleave flicker.

## pointer_coordinate_model

Pointer client coordinates are converted through the interaction SVG rect into SVG plot coordinates. Chart-root coordinates are calculated from the owning root `getBoundingClientRect`; no page-origin assumption is used. `tooltip.pointer` exposes client, chart-root, and plot coordinates. `tooltip.anchor` is the resolved SVG/plot point. Scroll changes are handled on the next pointer conversion, and resize invalidates/recomputes layout.

## nearest_x_algorithm

`createTimeSeriesTooltipResolver` builds the sorted union of visible series timestamps once per series/configuration change. Resolution uses binary search, then compares the immediate neighbors by actual timestamp distance. The result is a domain timestamp, not a rendered-line proximity result and not a row-index approximation.

## tie_breaking_semantics

Exact matches win. Before/after bounds clamp to the first/last timestamp. An equal-distance tie chooses the earlier timestamp consistently.

## crosshair_behavior

The vertical crosshair uses the resolved timestamp's scaled X coordinate and spans only the plot area. It is independent of pointer Y and is hidden with transient interaction state. Keyboard navigation uses the same resolved state.

## floating_tooltip_behavior

The tooltip follows the raw pointer by default while displaying values at the resolved X. `followPointer: false` places it at the resolved anchor. The default offset is 12px in both axes. The built-in content renders UTC/domain time followed by one formatted row per exact visible series value.

## boundary_collision_strategy

`resolveChartTooltipPlacement` measures actual tooltip dimensions after render. It prefers right/below, flips horizontally when left space is available, flips vertically when top space is available, and clamps as final protection with an 8px padding. It handles corners and tooltips larger than the available quadrant. The owning chart root is the collision container.

## multi_series_behavior

The active domain is the union of visible series timestamps. At that X, each visible series contributes only an exact observation. Different X sets are supported; missing rows are omitted. No interpolation or data mutation occurs.

## missing_value_semantics

Missing values at the active X are omitted from the generic tooltip and custom slot entries. They are never silently interpolated.

## hidden_series_semantics

Legend-hidden series are excluded from the active domain and tooltip. Toggling visibility recomputes geometry and resolver state without mutating caller-owned data.

## custom_tooltip_api

The typed slot receives `AffinoTimeSeriesTooltip`: `timestamp`, `domainValue`, `formattedTimestamp`, `entries`, `anchor`, `pointer`, and `placement`. Consumers own presentation only. `tooltip-change` emits the same public model or `null`.

## declarative_vue_api

Existing `tooltip` and `showCrosshair` props remain supported. The additive `interaction` prop accepts `enabled`, `snap: "nearest"`, nested `tooltip`, and nested `crosshair` options. Tooltip options accept enablement, formatters, pointer following, boundary constraint, and minimal X/Y offsets.

## keyboard_behavior

The focus surface is a public `role="slider"`. Initial focus selects the middle shared timestamp. Left/Right move to adjacent domain positions; Home/End select bounds; Escape clears. `aria-valuenow` and `aria-valuetext` follow the active timestamp.

## pointer_keyboard_handoff

Pointer and keyboard update one `activeTimestamp`/tooltip state. Pointer movement marks the source as pointer; focus and key commands mark it as keyboard and anchor placement to the resolved X when no raw pointer exists. Blur or pointerleave clears transient state unless the surface remains keyboard-focused.

## theme_integration

Crosshair and tooltip use public CSS variables. Added theme fields include tooltip secondary text/border/shadow and crosshair width/dash/opacity. Light/dark reactive theme objects update variables without rebuilding series data.

## resize_scroll_behavior

ResizeObserver updates responsive width, root bounds, tooltip measurement, and layout revision. The semantic timestamp is retained while its crosshair pixel coordinate is recalculated. Client-coordinate conversion uses fresh bounds after scrolling or nested-container movement.

## irregular_series_behavior

Nearest-X compares timestamp/domain distances, so irregular intervals such as 10:00, 10:01, 10:17, and 11:40 do not snap by index spacing.

## duplicate_series_behavior

Duplicate or unsorted timestamps are rejected by the existing validator before interaction resolution. This makes active-X semantics deterministic rather than array-order dependent.

## performance_measurements

Node v22.23.2, 20,000 lookups per size, sorted single-series domains:

| Points | Nearest lookup | Tooltip-state derivation |
|---:|---:|---:|
| 1,000 | 0.00012 ms/lookup | 0.00034 ms/lookup |
| 10,000 | 0.00031 ms/lookup | 0.00062 ms/lookup |
| 50,000 | 0.00019 ms/lookup | 0.00050 ms/lookup |
| 100,000 | 0.00035 ms/lookup | 0.00041 ms/lookup |

These are headless lookup/state measurements, not browser frame-rate or paint measurements. The component avoids rebuilding the shared domain on each pointer event.

## browser_visual_verification

MANUAL_BROWSER_VERIFICATION_REQUIRED. A Playwright launch was attempted, but Chromium is not installed in the environment. Geometry and component tests cover placement and state; they do not claim visual polish, frame-rate, or screen-reader behavior.

## packed_consumer_result

Packed `@affino/charts-core@0.1.2` and `@affino/charts-vue@0.1.2` were installed in an isolated Vue 3/Vite/TypeScript consumer using the repository-pinned pnpm. Public runtime imports, strict `vue-tsc`, CSS import, and Vite production build passed. The fixture used a local override only to make the unpublished matching core tarball satisfy the Vue tarball dependency; production consumers should install the published aligned versions.

## public_documentation

Updated `packages/charts-vue/README.md` with declarative interaction, nearest-X, missing/hidden semantics, custom slot payload, keyboard behavior, collision rules, and theme tokens. Updated `FinancialTimeSeriesExamples.vue` to exercise the interaction configuration. The deterministic interaction fixtures are `packages/charts-core/src/__tests__/timeSeriesInteraction.test.ts` and `packages/charts-vue/src/__tests__/interaction.spec.ts`.

## backwards_compatibility

The change is additive at the Vue surface. Existing `tooltip`, `showCrosshair`, formatter callbacks, `tooltip-change`, and package-root imports remain available. Hover now intentionally snaps to actual domain X and tooltip placement changes from fixed percentage positioning to boundary-aware pixel positioning.

## recommended_version

Release `0.1.2` for both chart packages as a backwards-compatible patch release. Do not publish automatically.

## remaining_limitations

- Browser visual, keyboard/focus, and screen-reader verification requires the approved Chromium binary.
- No browser frame benchmark is claimed; headless lookup/state measurements are recorded above.
- Touch uses Pointer Events but has no pinned tooltip or gesture-specific mode.
- OHLC, annotations, and financial calculations remain outside this slice.

## suggested_commit

`fix(charts): add declarative snapped crosshair and floating tooltip`

## conclusions

The public API now owns nearest-X resolution, shared multi-series inspection, crosshair anchoring, floating tooltip following, collision handling, keyboard navigation, theme mapping, and responsive coordinate recalculation. No FxLab workaround or private renderer API is required.

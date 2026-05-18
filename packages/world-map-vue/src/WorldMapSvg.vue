<template>
  <section
    class="world-map-svg"
    :class="{
      'world-map-svg--pan-enabled': enablePan,
      'world-map-svg--panning': isPanning,
    }"
  >
    <div v-if="enableZoom" class="world-map-svg__controls" aria-label="World map view controls">
      <button type="button" :disabled="isZoomOutDisabled" @click="zoomOut">Zoom out</button>
      <button type="button" :disabled="isZoomInDisabled" @click="zoomIn">Zoom in</button>
      <button type="button" :disabled="isResetDisabled" @click="resetView">Reset view</button>
    </div>

    <div class="world-map-svg__stage">
      <svg
        class="world-map-svg__svg"
        :viewBox="`0 0 ${resolvedWidth} ${resolvedHeight}`"
        role="img"
        aria-label="World map"
        @click="handleSvgClick"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerCancel"
        @wheel="handleWheel"
      >
        <rect
          class="world-map-svg__ocean"
          x="0"
          y="0"
          :width="resolvedWidth"
          :height="resolvedHeight"
        />
        <g class="world-map-svg__map-layer" :transform="mapTransform">
          <path
            v-for="feature in paths"
            :key="feature.id"
            class="world-map-svg__country"
            :data-country-id="feature.id"
            :data-country-name="feature.name"
            :class="{
              'world-map-svg__country--hovered': feature.id === hoveredCountryId,
              'world-map-svg__country--selected': feature.id === resolvedSelectedCountryId,
              'world-map-svg__country--valued': countryValueFills.has(feature.id),
            }"
            :style="getCountryStyle(feature)"
            :d="feature.path"
            tabindex="0"
            @mouseenter="handleCountryMouseEnter(feature)"
            @mouseleave="handleCountryMouseLeave(feature)"
            @click.stop="handleCountryClick($event, feature)"
            @keydown.enter.prevent="selectCountry(feature)"
            @keydown.space.prevent="selectCountry(feature)"
          />
          <circle
            v-for="marker in projectedMarkers"
            :key="marker.marker.id"
            class="world-map-svg__marker"
            :data-marker-id="marker.marker.id"
            :data-marker-label="marker.marker.label"
            :cx="marker.x"
            :cy="marker.y"
            :r="markerRadius"
            tabindex="0"
            @mouseenter="handleMarkerMouseEnter(marker.marker)"
            @mouseleave="handleMarkerMouseLeave(marker.marker)"
            @click.stop="handleMarkerClick($event, marker.marker)"
            @keydown.enter.prevent="selectMarker(marker.marker)"
            @keydown.space.prevent="selectMarker(marker.marker)"
          />
        </g>
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import type { CSSProperties } from "vue"
import { projectWorldMapPosition } from "@affino/world-map-core"
import type { WorldMapCountryId, WorldMapPathFeature, WorldMapScreenPoint } from "@affino/world-map-core"
import type { WorldMapMarker } from "./types"

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 480
const DEFAULT_MIN_ZOOM = 1
const DEFAULT_MAX_ZOOM = 8
const ZOOM_STEP = 1.25
const DRAG_THRESHOLD_PX = 3

interface WorldMapViewState {
  zoom: number
  panX: number
  panY: number
}

interface ProjectedWorldMapMarker extends WorldMapScreenPoint {
  marker: WorldMapMarker
}

interface WorldMapValueDomain {
  min: number
  max: number
}

const props = withDefaults(defineProps<{
  paths: WorldMapPathFeature[]
  markers?: WorldMapMarker[]
  countryValues?: Record<string, number>
  width?: number
  height?: number
  selectedCountryId?: WorldMapCountryId | null
  enableChoropleth?: boolean
  enableZoom?: boolean
  enableMarkers?: boolean
  enablePan?: boolean
  countryValueMin?: number
  countryValueMax?: number
  markerRadius?: number
  minZoom?: number
  maxZoom?: number
}>(), {
  markers: () => [],
  countryValues: () => ({}),
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  selectedCountryId: undefined,
  enableChoropleth: false,
  enableZoom: true,
  enableMarkers: true,
  enablePan: true,
  markerRadius: 4,
  minZoom: DEFAULT_MIN_ZOOM,
  maxZoom: DEFAULT_MAX_ZOOM,
})

const emit = defineEmits<{
  "update:selectedCountryId": [countryId: WorldMapCountryId | null]
  "country-click": [feature: WorldMapPathFeature]
  "country-hover": [feature: WorldMapPathFeature]
  "country-leave": [feature: WorldMapPathFeature]
  "marker-click": [marker: WorldMapMarker]
  "marker-hover": [marker: WorldMapMarker]
  "marker-leave": [marker: WorldMapMarker]
  "view-change": [state: WorldMapViewState]
}>()

const hoveredCountryId = ref<WorldMapCountryId | null>(null)
const internalSelectedCountryId = ref<WorldMapCountryId | null>(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const hasDragged = ref(false)
const suppressNextClick = ref(false)
const panStart = ref({
  pointerId: -1,
  clientX: 0,
  clientY: 0,
  panX: 0,
  panY: 0,
  countryId: null as WorldMapCountryId | null,
})

const resolvedWidth = computed(() => props.width)
const resolvedHeight = computed(() => props.height)
const resolvedMinZoom = computed(() => Math.max(0.1, props.minZoom))
const resolvedMaxZoom = computed(() => Math.max(resolvedMinZoom.value, props.maxZoom))
const resolvedSelectedCountryId = computed(() => (
  props.selectedCountryId === undefined ? internalSelectedCountryId.value : props.selectedCountryId
))
const mapTransform = computed(() => `translate(${panX.value} ${panY.value}) scale(${zoom.value})`)
const isZoomOutDisabled = computed(() => zoom.value <= resolvedMinZoom.value)
const isZoomInDisabled = computed(() => zoom.value >= resolvedMaxZoom.value)
const isResetDisabled = computed(() => zoom.value === 1 && panX.value === 0 && panY.value === 0)
const countryValueDomain = computed<WorldMapValueDomain | null>(() => {
  if (!props.enableChoropleth) {
    return null
  }

  const finiteValues = Object.values(props.countryValues).filter(isFiniteNumber)
  const hasProvidedMin = isFiniteNumber(props.countryValueMin)
  const hasProvidedMax = isFiniteNumber(props.countryValueMax)
  if (finiteValues.length === 0 && (!hasProvidedMin || !hasProvidedMax)) {
    return null
  }

  const fallbackMin = finiteValues.length > 0 ? Math.min(...finiteValues) : props.countryValueMin
  const fallbackMax = finiteValues.length > 0 ? Math.max(...finiteValues) : props.countryValueMax
  const rawMin = hasProvidedMin ? props.countryValueMin : fallbackMin
  const rawMax = hasProvidedMax ? props.countryValueMax : fallbackMax
  if (!isFiniteNumber(rawMin) || !isFiniteNumber(rawMax)) {
    return null
  }

  return {
    min: Math.min(rawMin, rawMax),
    max: Math.max(rawMin, rawMax),
  }
})
const countryValueFills = computed(() => {
  const domain = countryValueDomain.value
  const fills = new Map<WorldMapCountryId, string>()
  if (domain === null) {
    return fills
  }

  for (const feature of props.paths) {
    if (!Object.prototype.hasOwnProperty.call(props.countryValues, feature.id)) {
      continue
    }

    const value = props.countryValues[feature.id]
    if (!isFiniteNumber(value)) {
      continue
    }

    fills.set(feature.id, resolveCountryValueFill(value, domain))
  }

  return fills
})
const projectedMarkers = computed<ProjectedWorldMapMarker[]>(() => {
  if (!props.enableMarkers) {
    return []
  }

  return props.markers.map((marker) => ({
    ...projectWorldMapPosition({
      lon: marker.lon,
      lat: marker.lat,
    }, {
      viewport: {
        width: resolvedWidth.value,
        height: resolvedHeight.value,
      },
      projection: "equirectangular",
    }),
    marker,
  }))
})

onMounted(() => {
  window.addEventListener("keydown", handleWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleWindowKeydown)
})

function handleCountryMouseEnter(feature: WorldMapPathFeature): void {
  hoveredCountryId.value = feature.id
  emit("country-hover", feature)
}

function handleCountryMouseLeave(feature: WorldMapPathFeature): void {
  hoveredCountryId.value = null
  emit("country-leave", feature)
}

function handleCountryClick(event: MouseEvent, feature: WorldMapPathFeature): void {
  if (consumeSuppressedClick()) {
    event.stopPropagation()
    return
  }

  selectCountry(feature)
}

function selectCountry(feature: WorldMapPathFeature): void {
  setSelectedCountryId(resolvedSelectedCountryId.value === feature.id ? null : feature.id)
  emit("country-click", feature)
}

function getCountryStyle(feature: WorldMapPathFeature): CSSProperties | undefined {
  const fill = countryValueFills.value.get(feature.id)
  if (fill === undefined) {
    return undefined
  }

  return {
    "--affino-world-map-country-value-fill": fill,
  } as CSSProperties
}

function handleMarkerMouseEnter(marker: WorldMapMarker): void {
  emit("marker-hover", marker)
}

function handleMarkerMouseLeave(marker: WorldMapMarker): void {
  emit("marker-leave", marker)
}

function handleMarkerClick(event: MouseEvent, marker: WorldMapMarker): void {
  if (consumeSuppressedClick()) {
    event.stopPropagation()
    return
  }

  selectMarker(marker)
}

function selectMarker(marker: WorldMapMarker): void {
  emit("marker-click", marker)
}

function handleSvgClick(): void {
  if (consumeSuppressedClick()) {
    return
  }

  clearSelectedCountry()
}

function clearSelectedCountry(): void {
  setSelectedCountryId(null)
}

function setSelectedCountryId(countryId: WorldMapCountryId | null): void {
  if (props.selectedCountryId === undefined) {
    internalSelectedCountryId.value = countryId
  }
  emit("update:selectedCountryId", countryId)
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    clearSelectedCountry()
  }
}

function zoomIn(): void {
  if (!props.enableZoom) {
    return
  }

  setZoom(zoom.value * ZOOM_STEP, {
    x: resolvedWidth.value / 2,
    y: resolvedHeight.value / 2,
  })
}

function zoomOut(): void {
  if (!props.enableZoom) {
    return
  }

  setZoom(zoom.value / ZOOM_STEP, {
    x: resolvedWidth.value / 2,
    y: resolvedHeight.value / 2,
  })
}

function resetView(): void {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  emitViewChange()
}

function handleWheel(event: WheelEvent): void {
  if (!props.enableZoom) {
    return
  }

  event.preventDefault()
  const center = svgPointFromClient(event.currentTarget as SVGSVGElement, event.clientX, event.clientY)
  const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
  setZoom(zoom.value * factor, center)
}

function handlePointerDown(event: PointerEvent): void {
  if (!props.enablePan || event.button !== 0) {
    return
  }

  isPanning.value = true
  hasDragged.value = false
  panStart.value = {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    panX: panX.value,
    panY: panY.value,
    countryId: findEventCountryId(event),
  }
  ;(event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId)
}

function handlePointerMove(event: PointerEvent): void {
  if (!props.enablePan || !isPanning.value || event.pointerId !== panStart.value.pointerId) {
    return
  }

  const clientDeltaX = event.clientX - panStart.value.clientX
  const clientDeltaY = event.clientY - panStart.value.clientY
  if (!hasDragged.value && Math.hypot(clientDeltaX, clientDeltaY) < DRAG_THRESHOLD_PX) {
    return
  }

  const svgDelta = svgDeltaFromClient(event.currentTarget as SVGSVGElement, clientDeltaX, clientDeltaY)
  hasDragged.value = true
  panX.value = panStart.value.panX + svgDelta.x
  panY.value = panStart.value.panY + svgDelta.y
  emitViewChange()
}

function handlePointerUp(event: PointerEvent): void {
  finishPan(event)
}

function handlePointerCancel(event: PointerEvent): void {
  finishPan(event)
}

function finishPan(event: PointerEvent): void {
  if (!isPanning.value || event.pointerId !== panStart.value.pointerId) {
    return
  }

  if (hasDragged.value) {
    suppressBrowserClick()
  } else if (panStart.value.countryId !== null) {
    const feature = props.paths.find((pathFeature) => pathFeature.id === panStart.value.countryId)
    if (feature !== undefined) {
      selectCountry(feature)
    }
    suppressBrowserClick()
  }

  isPanning.value = false
  ;(event.currentTarget as SVGSVGElement).releasePointerCapture?.(event.pointerId)
}

function setZoom(nextZoom: number, center: { x: number; y: number }): void {
  const clampedZoom = clamp(nextZoom, resolvedMinZoom.value, resolvedMaxZoom.value)
  if (clampedZoom === zoom.value) {
    return
  }

  const worldX = (center.x - panX.value) / zoom.value
  const worldY = (center.y - panY.value) / zoom.value
  panX.value = center.x - worldX * clampedZoom
  panY.value = center.y - worldY * clampedZoom
  zoom.value = clampedZoom
  emitViewChange()
}

function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return {
      x: resolvedWidth.value / 2,
      y: resolvedHeight.value / 2,
    }
  }

  return {
    x: ((clientX - rect.left) / rect.width) * resolvedWidth.value,
    y: ((clientY - rect.top) / rect.height) * resolvedHeight.value,
  }
}

function svgDeltaFromClient(svg: SVGSVGElement, deltaX: number, deltaY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return { x: deltaX, y: deltaY }
  }

  return {
    x: (deltaX / rect.width) * resolvedWidth.value,
    y: (deltaY / rect.height) * resolvedHeight.value,
  }
}

function suppressBrowserClick(): void {
  suppressNextClick.value = true
  window.setTimeout(() => {
    suppressNextClick.value = false
  }, 0)
}

function consumeSuppressedClick(): boolean {
  if (!suppressNextClick.value) {
    return false
  }

  suppressNextClick.value = false
  return true
}

function findEventCountryId(event: PointerEvent): WorldMapCountryId | null {
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest<SVGPathElement>(".world-map-svg__country")?.dataset.countryId ?? null
}

function emitViewChange(): void {
  emit("view-change", {
    zoom: zoom.value,
    panX: panX.value,
    panY: panY.value,
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveCountryValueFill(value: number, domain: WorldMapValueDomain): string {
  const intensity = domain.min === domain.max
    ? 0.5
    : clamp((value - domain.min) / (domain.max - domain.min), 0, 1)
  const highPercent = formatPercent(intensity * 100)
  const lowPercent = formatPercent(100 - intensity * 100)
  return `color-mix(in srgb, var(--affino-world-map-country-value-low-fill) ${lowPercent}%, var(--affino-world-map-country-value-high-fill) ${highPercent}%)`
}

function formatPercent(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
</script>

<style scoped>
:where(.world-map-svg) {
  --affino-world-map-ocean-fill: #e6f0f4;
  --affino-world-map-stage-background: #eef5f8;
  --affino-world-map-stage-border: #d1d5db;
  --affino-world-map-control-background: #ffffff;
  --affino-world-map-control-border: #d1d5db;
  --affino-world-map-control-color: #1f2937;
  --affino-world-map-control-hover-background: #f8fafc;
  --affino-world-map-control-disabled-opacity: 0.45;
  --affino-world-map-control-disabled-cursor: default;
  --affino-world-map-country-fill: #d6d3c8;
  --affino-world-map-country-stroke: #ffffff;
  --affino-world-map-country-hover-fill: #b8c7d4;
  --affino-world-map-country-value-empty-fill: #d6d3c8;
  --affino-world-map-country-value-low-fill: #dbeafe;
  --affino-world-map-country-value-high-fill: #1d4ed8;
  --affino-world-map-country-selected-fill: #6f8ea7;
  --affino-world-map-country-selected-stroke: #334155;
  --affino-world-map-country-selected-hover-fill: #587a96;
  --affino-world-map-country-selected-hover-stroke: #1f2937;
  --affino-world-map-country-focus-fill: #c4d0da;
  --affino-world-map-country-focus-stroke: #1f2937;
  --affino-world-map-marker-fill: #ef4444;
  --affino-world-map-marker-stroke: #ffffff;
  --affino-world-map-marker-hover-fill: #dc2626;
  --affino-world-map-marker-focus-stroke: #111827;
}

.world-map-svg {
  min-height: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.world-map-svg__controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.world-map-svg__controls button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--affino-world-map-control-border);
  border-radius: 6px;
  background: var(--affino-world-map-control-background);
  color: var(--affino-world-map-control-color);
  font-size: 12px;
  cursor: pointer;
}

.world-map-svg__controls button:hover {
  background: var(--affino-world-map-control-hover-background);
}

.world-map-svg__controls button:disabled {
  cursor: var(--affino-world-map-control-disabled-cursor);
  opacity: var(--affino-world-map-control-disabled-opacity);
}

.world-map-svg__controls button:disabled:hover {
  background: var(--affino-world-map-control-background);
}

.world-map-svg__stage {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: auto;
  border: 1px solid var(--affino-world-map-stage-border);
  border-radius: 8px;
  background: var(--affino-world-map-stage-background);
}

.world-map-svg__svg {
  display: block;
  width: min(100%, 960px);
  min-width: 720px;
  height: auto;
  margin: 0 auto;
  cursor: default;
  outline: none;
  touch-action: none;
  user-select: none;
}

.world-map-svg--pan-enabled .world-map-svg__svg {
  cursor: grab;
}

.world-map-svg--panning .world-map-svg__svg {
  cursor: grabbing;
}

.world-map-svg__ocean {
  fill: var(--affino-world-map-ocean-fill);
  pointer-events: none;
}

.world-map-svg__country {
  fill: var(--affino-world-map-country-fill);
  stroke: var(--affino-world-map-country-stroke);
  stroke-width: 0.7;
  outline: none;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
  transition: fill 120ms ease, stroke 120ms ease;
}

.world-map-svg__country:hover,
.world-map-svg__country--hovered {
  fill: var(--affino-world-map-country-hover-fill);
}

.world-map-svg__country--valued {
  fill: var(
    --affino-world-map-country-value-fill,
    var(--affino-world-map-country-value-empty-fill)
  );
}

.world-map-svg__country--selected {
  fill: var(--affino-world-map-country-selected-fill);
  stroke: var(--affino-world-map-country-selected-stroke);
}

.world-map-svg__country--selected:hover,
.world-map-svg__country--selected.world-map-svg__country--hovered {
  fill: var(--affino-world-map-country-selected-hover-fill);
  stroke: var(--affino-world-map-country-selected-hover-stroke);
}

.world-map-svg__country:focus,
.world-map-svg__country:focus-visible {
  outline: none;
}

.world-map-svg__country:focus-visible {
  fill: var(--affino-world-map-country-focus-fill);
  stroke: var(--affino-world-map-country-focus-stroke);
  stroke-width: 1.2;
}

.world-map-svg__marker {
  fill: var(--affino-world-map-marker-fill);
  stroke: var(--affino-world-map-marker-stroke);
  stroke-width: 1.5;
  outline: none;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
  transition: fill 120ms ease, stroke 120ms ease;
}

.world-map-svg__marker:hover {
  fill: var(--affino-world-map-marker-hover-fill);
}

.world-map-svg__marker:focus,
.world-map-svg__marker:focus-visible {
  outline: none;
}

.world-map-svg__marker:focus-visible {
  fill: var(--affino-world-map-marker-hover-fill);
  stroke: var(--affino-world-map-marker-focus-stroke);
  stroke-width: 2;
}

@media (max-width: 760px) {
  .world-map-svg__controls {
    justify-content: flex-start;
  }
}
</style>

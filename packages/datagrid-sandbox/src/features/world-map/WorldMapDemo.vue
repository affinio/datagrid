<template>
  <article class="card world-map-demo" :class="{ 'world-map-demo--panning': isPanning }">
    <header class="card__header world-map-demo__header">
      <h2>World Map</h2>
      <div class="world-map-demo__header-actions">
        <div class="world-map-demo__meta">
          <span>Countries: {{ pathFeatures.length }}</span>
          <span>Projection: equirectangular</span>
        </div>
        <div class="world-map-demo__controls" aria-label="World map view controls">
          <button type="button" @click="zoomOut">Zoom out</button>
          <button type="button" @click="zoomIn">Zoom in</button>
          <button type="button" @click="resetView">Reset view</button>
        </div>
      </div>
    </header>

    <section class="world-map-demo__stage">
      <div v-if="isLoading" class="world-map-demo__state">Loading map...</div>
      <div v-else-if="errorMessage !== null" class="world-map-demo__state world-map-demo__state--error">
        {{ errorMessage }}
      </div>
      <svg
        v-else
        class="world-map-demo__svg"
        :viewBox="`0 0 ${VIEWPORT.width} ${VIEWPORT.height}`"
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
          class="world-map-demo__ocean"
          x="0"
          y="0"
          :width="VIEWPORT.width"
          :height="VIEWPORT.height"
        />
        <g class="world-map-demo__map-layer" :transform="mapTransform">
          <path
            v-for="feature in pathFeatures"
            :key="feature.id"
            class="world-map-demo__country"
            :data-country-id="feature.id"
            :data-country-name="feature.name"
            :class="{
              'world-map-demo__country--hovered': feature.id === hoveredCountryId,
              'world-map-demo__country--selected': feature.id === selectedCountryId,
            }"
            :d="feature.path"
            tabindex="0"
            @mouseenter="hoveredCountryId = feature.id"
            @mouseleave="hoveredCountryId = null"
            @click.stop="handleCountryClick($event, feature.id)"
            @keydown.enter.prevent="toggleSelectedCountry(feature.id)"
            @keydown.space.prevent="toggleSelectedCountry(feature.id)"
          />
        </g>
      </svg>
    </section>

    <aside class="world-map-demo__debug" aria-label="World map debug state">
      <div>
        <span>Hovered</span>
        <strong>{{ hoveredLabel }}</strong>
      </div>
      <div>
        <span>Selected</span>
        <strong>{{ selectedLabel }}</strong>
      </div>
      <div>
        <span>Zoom</span>
        <strong>{{ zoomLabel }}</strong>
      </div>
      <div>
        <span>Pan</span>
        <strong>{{ panLabel }}</strong>
      </div>
    </aside>
  </article>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { createWorldMapPaths } from "@affino/world-map-core"
import type {
  WorldMapCountryFeature,
  WorldMapPathFeature,
  WorldMapViewport,
} from "@affino/world-map-core"
import { loadNormalizedWorldCountries110m } from "./loadWorldCountries"

const VIEWPORT: WorldMapViewport = {
  width: 960,
  height: 480,
}
const MIN_ZOOM = 1
const MAX_ZOOM = 8
const ZOOM_STEP = 1.25
const DRAG_THRESHOLD_PX = 3

const countries = ref<WorldMapCountryFeature[]>([])
const pathFeatures = ref<WorldMapPathFeature[]>([])
const hoveredCountryId = ref<string | null>(null)
const selectedCountryId = ref<string | null>(null)
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
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
  countryId: null as string | null,
})

const countryById = computed(() => {
  return new Map(pathFeatures.value.map((feature) => [feature.id, feature]))
})

const hoveredLabel = computed(() => formatCountryLabel(countryById.value.get(hoveredCountryId.value ?? "")))
const selectedLabel = computed(() => formatCountryLabel(countryById.value.get(selectedCountryId.value ?? "")))
const zoomLabel = computed(() => zoom.value.toFixed(2))
const panLabel = computed(() => `${Math.round(panX.value)}, ${Math.round(panY.value)}`)
const mapTransform = computed(() => `translate(${panX.value} ${panY.value}) scale(${zoom.value})`)

onMounted(() => {
  window.addEventListener("keydown", handleWindowKeydown)
  void loadMap()
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleWindowKeydown)
})

async function loadMap(): Promise<void> {
  try {
    countries.value = (await loadNormalizedWorldCountries110m()).filter(shouldRenderCountry)
    pathFeatures.value = createWorldMapPaths(countries.value, {
      viewport: VIEWPORT,
      projection: "equirectangular",
      precision: 2,
    })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Failed to load world map"
  } finally {
    isLoading.value = false
  }
}

function formatCountryLabel(feature: WorldMapPathFeature | undefined): string {
  return feature === undefined ? "none" : `${feature.name} (${feature.id})`
}

function toggleSelectedCountry(countryId: string): void {
  selectedCountryId.value = selectedCountryId.value === countryId ? null : countryId
}

function clearSelectedCountry(): void {
  selectedCountryId.value = null
}

function handleCountryClick(event: MouseEvent, countryId: string): void {
  if (consumeSuppressedClick()) {
    event.stopPropagation()
    return
  }

  toggleSelectedCountry(countryId)
}

function handleSvgClick(): void {
  if (consumeSuppressedClick()) {
    return
  }

  clearSelectedCountry()
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    clearSelectedCountry()
  }
}

function zoomIn(): void {
  setZoom(zoom.value * ZOOM_STEP, {
    x: VIEWPORT.width / 2,
    y: VIEWPORT.height / 2,
  })
}

function zoomOut(): void {
  setZoom(zoom.value / ZOOM_STEP, {
    x: VIEWPORT.width / 2,
    y: VIEWPORT.height / 2,
  })
}

function resetView(): void {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function handleWheel(event: WheelEvent): void {
  event.preventDefault()
  const center = svgPointFromClient(event.currentTarget as SVGSVGElement, event.clientX, event.clientY)
  const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
  setZoom(zoom.value * factor, center)
}

function handlePointerDown(event: PointerEvent): void {
  if (event.button !== 0) {
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
  if (!isPanning.value || event.pointerId !== panStart.value.pointerId) {
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
    suppressNextClick.value = true
    window.setTimeout(() => {
      suppressNextClick.value = false
    }, 0)
  } else if (panStart.value.countryId !== null) {
    toggleSelectedCountry(panStart.value.countryId)
    suppressNextClick.value = true
    window.setTimeout(() => {
      suppressNextClick.value = false
    }, 0)
  }

  isPanning.value = false
  ;(event.currentTarget as SVGSVGElement).releasePointerCapture?.(event.pointerId)
}

function setZoom(nextZoom: number, center: { x: number; y: number }): void {
  const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  if (clampedZoom === zoom.value) {
    return
  }

  const worldX = (center.x - panX.value) / zoom.value
  const worldY = (center.y - panY.value) / zoom.value
  panX.value = center.x - worldX * clampedZoom
  panY.value = center.y - worldY * clampedZoom
  zoom.value = clampedZoom
}

function svgPointFromClient(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return {
      x: VIEWPORT.width / 2,
      y: VIEWPORT.height / 2,
    }
  }

  return {
    x: ((clientX - rect.left) / rect.width) * VIEWPORT.width,
    y: ((clientY - rect.top) / rect.height) * VIEWPORT.height,
  }
}

function svgDeltaFromClient(svg: SVGSVGElement, deltaX: number, deltaY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return { x: deltaX, y: deltaY }
  }

  return {
    x: (deltaX / rect.width) * VIEWPORT.width,
    y: (deltaY / rect.height) * VIEWPORT.height,
  }
}

function consumeSuppressedClick(): boolean {
  if (!suppressNextClick.value) {
    return false
  }

  suppressNextClick.value = false
  return true
}

function findEventCountryId(event: PointerEvent): string | null {
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }

  return target.closest<SVGPathElement>(".world-map-demo__country")?.dataset.countryId ?? null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function shouldRenderCountry(feature: WorldMapCountryFeature): boolean {
  return feature.name !== "Antarctica" &&
    feature.iso3 !== "ATA" &&
    feature.id !== "010" &&
    feature.id !== "ATA"
}
</script>

<style scoped>
.world-map-demo {
  gap: 10px;
}

.world-map-demo__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.world-map-demo__header h2 {
  margin: 0;
}

.world-map-demo__header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.world-map-demo__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  color: #475569;
  font-size: 12px;
}

.world-map-demo__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.world-map-demo__controls button {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #1f2937;
  font-size: 12px;
  cursor: pointer;
}

.world-map-demo__controls button:hover {
  background: #f8fafc;
}

.world-map-demo__stage {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: auto;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #eef5f8;
}

.world-map-demo__state {
  min-height: 240px;
  display: grid;
  place-items: center;
  color: #475569;
  font-size: 14px;
}

.world-map-demo__state--error {
  color: #991b1b;
}

.world-map-demo__svg {
  display: block;
  width: min(100%, 960px);
  min-width: 720px;
  height: auto;
  margin: 0 auto;
  cursor: grab;
  outline: none;
  touch-action: none;
  user-select: none;
}

.world-map-demo--panning .world-map-demo__svg {
  cursor: grabbing;
}

.world-map-demo__ocean {
  fill: #e6f0f4;
  pointer-events: none;
}

.world-map-demo__country {
  fill: #d6d3c8;
  stroke: #ffffff;
  stroke-width: 0.7;
  outline: none;
  vector-effect: non-scaling-stroke;
  cursor: pointer;
  transition: fill 120ms ease, stroke 120ms ease;
}

.world-map-demo__country:hover,
.world-map-demo__country--hovered {
  fill: #b8c7d4;
}

.world-map-demo__country--selected {
  fill: #6f8ea7;
  stroke: #334155;
}

.world-map-demo__country--selected:hover,
.world-map-demo__country--selected.world-map-demo__country--hovered {
  fill: #587a96;
  stroke: #1f2937;
}

.world-map-demo__country:focus {
  outline: none;
}

.world-map-demo__country:focus-visible {
  outline: none;
}

.world-map-demo__debug {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.world-map-demo__debug div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
}

.world-map-demo__debug strong {
  min-width: 0;
  overflow: hidden;
  color: #111827;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .world-map-demo__debug {
    grid-template-columns: 1fr;
  }

  .world-map-demo__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .world-map-demo__header-actions {
    align-items: flex-start;
    justify-content: flex-start;
  }

  .world-map-demo__meta {
    justify-content: flex-start;
  }
}
</style>

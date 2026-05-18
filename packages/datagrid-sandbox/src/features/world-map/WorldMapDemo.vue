<template>
  <article class="card world-map-demo">
    <header class="card__header world-map-demo__header">
      <h2>World Map</h2>
      <div class="world-map-demo__meta">
        <span>Countries: {{ pathFeatures.length }}</span>
        <span>Projection: equirectangular</span>
      </div>
    </header>

    <section v-if="isLoading" class="world-map-demo__state">Loading map...</section>
    <section v-else-if="errorMessage !== null" class="world-map-demo__state world-map-demo__state--error">
      {{ errorMessage }}
    </section>
    <WorldMapSvg
      v-else
      v-model:selected-country-id="selectedCountryId"
      :paths="pathFeatures"
      :width="VIEWPORT.width"
      :height="VIEWPORT.height"
      :min-zoom="1"
      :max-zoom="8"
      @country-hover="handleCountryHover"
      @country-leave="handleCountryLeave"
      @view-change="viewState = $event"
    />

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
import { computed, onMounted, ref } from "vue"
import { createWorldMapPaths } from "@affino/world-map-core"
import type {
  WorldMapCountryFeature,
  WorldMapCountryId,
  WorldMapPathFeature,
  WorldMapViewport,
} from "@affino/world-map-core"
import { loadNormalizedWorldCountries110m } from "./loadWorldCountries"
import WorldMapSvg from "./WorldMapSvg.vue"

const VIEWPORT: WorldMapViewport = {
  width: 960,
  height: 480,
}

const countries = ref<WorldMapCountryFeature[]>([])
const pathFeatures = ref<WorldMapPathFeature[]>([])
const hoveredCountryId = ref<WorldMapCountryId | null>(null)
const selectedCountryId = ref<WorldMapCountryId | null>(null)
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const viewState = ref({
  zoom: 1,
  panX: 0,
  panY: 0,
})

const countryById = computed(() => {
  return new Map(pathFeatures.value.map((feature) => [feature.id, feature]))
})

const hoveredLabel = computed(() => formatCountryLabel(countryById.value.get(hoveredCountryId.value ?? "")))
const selectedLabel = computed(() => formatCountryLabel(countryById.value.get(selectedCountryId.value ?? "")))
const zoomLabel = computed(() => viewState.value.zoom.toFixed(2))
const panLabel = computed(() => `${Math.round(viewState.value.panX)}, ${Math.round(viewState.value.panY)}`)

onMounted(() => {
  void loadMap()
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

function handleCountryHover(feature: WorldMapPathFeature): void {
  hoveredCountryId.value = feature.id
}

function handleCountryLeave(feature: WorldMapPathFeature): void {
  if (hoveredCountryId.value === feature.id) {
    hoveredCountryId.value = null
  }
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

.world-map-demo__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  color: #475569;
  font-size: 12px;
}

.world-map-demo__state {
  min-height: 240px;
  display: grid;
  flex: 1;
  place-items: center;
  color: #475569;
  font-size: 14px;
}

.world-map-demo__state--error {
  color: #991b1b;
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

  .world-map-demo__meta {
    justify-content: flex-start;
  }
}
</style>

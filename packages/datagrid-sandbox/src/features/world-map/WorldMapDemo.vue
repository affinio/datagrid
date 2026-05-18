<template>
  <article class="card world-map-demo">
    <header class="card__header world-map-demo__header">
      <h2>World Map</h2>
      <div class="world-map-demo__meta">
        <span>Countries: {{ pathFeatures.length }}</span>
        <span>Projection: equirectangular</span>
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
        @click="clearSelectedCountry"
      >
        <rect
          class="world-map-demo__ocean"
          x="0"
          y="0"
          :width="VIEWPORT.width"
          :height="VIEWPORT.height"
        />
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
          @click.stop="toggleSelectedCountry(feature.id)"
          @keydown.enter.prevent="toggleSelectedCountry(feature.id)"
          @keydown.space.prevent="toggleSelectedCountry(feature.id)"
        />
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

const countries = ref<WorldMapCountryFeature[]>([])
const pathFeatures = ref<WorldMapPathFeature[]>([])
const hoveredCountryId = ref<string | null>(null)
const selectedCountryId = ref<string | null>(null)
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)

const countryById = computed(() => {
  return new Map(pathFeatures.value.map((feature) => [feature.id, feature]))
})

const hoveredLabel = computed(() => formatCountryLabel(countryById.value.get(hoveredCountryId.value ?? "")))
const selectedLabel = computed(() => formatCountryLabel(countryById.value.get(selectedCountryId.value ?? "")))

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

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    clearSelectedCountry()
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
  outline: none;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

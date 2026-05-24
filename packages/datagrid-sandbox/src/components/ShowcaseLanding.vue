<script setup lang="ts">
type ShowcaseGroup = {
  title: string
  description: string
  demos: ShowcaseDemo[]
}

type ShowcaseDemo = {
  title: string
  to: string
  description: string
  meta: string
}

const heroDemos: ShowcaseDemo[] = [
  {
    title: "Data Workbench Grid",
    to: "/vue/shell/base-grid",
    description: "Start with the ready app-layer grid for dense product workflows.",
    meta: "App grid",
  },
  {
    title: "Server Datasource at Scale",
    to: "/vue/server-data-source-grid",
    description: "Explore backend-owned rows, lazy loading, grouping, edits, and live data.",
    meta: "Backend data",
  },
  {
    title: "Spreadsheet Workflow",
    to: "/vue/spreadsheet-workbook",
    description: "Work through sheets, formulas, fills, and spreadsheet-like editing.",
    meta: "Spreadsheet UX",
  },
  {
    title: "Gantt Planning",
    to: "/vue/shell/gantt-grid",
    description: "Review planning timelines, dependencies, summaries, and critical path output.",
    meta: "Planning",
  },
  {
    title: "Performance Stress Grid",
    to: "/vue/base-grid?rows=50000&cols=128",
    description: "Stress the virtualized grid with a large row and column shape.",
    meta: "Scale",
  },
]

const groups: ShowcaseGroup[] = [
  {
    title: "Showcase",
    description: "Feature demos for data modeling, analytics, formulas, and planning.",
    demos: [
      {
        title: "Grouped Operations",
        to: "/vue/shell/grouped-grid",
        description: "Group rows and inspect aggregate-backed parent rows.",
        meta: "Grouping",
      },
      {
        title: "Tree Data",
        to: "/vue/shell/tree-grid",
        description: "Navigate hierarchical records in the app-layer grid.",
        meta: "Hierarchy",
      },
      {
        title: "Pivot Analytics",
        to: "/vue/shell/pivot-grid",
        description: "Explore pivoted summaries and analytical projections.",
        meta: "Analytics",
      },
      {
        title: "Timesheet Planning",
        to: "/vue/shell/timesheet-grid",
        description: "Review resource planning and date-shaped operational data.",
        meta: "Planning",
      },
      {
        title: "Formula Grid",
        to: "/vue/formula-grid",
        description: "Evaluate formula-driven grid behavior.",
        meta: "Formulas",
      },
    ],
  },
  {
    title: "Advanced",
    description: "Developer-facing examples for ownership, customization, and typed integration.",
    demos: [
      {
        title: "Vue Runtime Grid",
        to: "/vue/base-grid",
        description: "Use the lower-level Vue runtime route used by contract tests.",
        meta: "Adapter",
      },
      {
        title: "Background Data Processing",
        to: "/vue/worker-grid",
        description: "Inspect the off-main-thread row-model integration path.",
        meta: "Worker",
      },
      {
        title: "Custom Cell Presentation",
        to: "/vue/cell-renderer-grid",
        description: "Customize cell presentation while preserving grid behavior.",
        meta: "Rendering",
      },
      {
        title: "Typed Integration",
        to: "/vue/typed-facade-grid",
        description: "Review typed helpers for TypeScript-heavy teams.",
        meta: "TypeScript",
      },
    ],
  },
  {
    title: "Debug",
    description: "Stable validation routes for maintainers and automated checks.",
    demos: [
      {
        title: "Core API Validation",
        to: "/core/base-grid",
        description: "Exercise the core grid API directly.",
        meta: "Core",
      },
      {
        title: "Row Selection Contracts",
        to: "/vue/row-selection-grid",
        description: "Validate row and cell selection interaction behavior.",
        meta: "Selection",
      },
      {
        title: "Legacy App Route",
        to: "/vue/base-grid-factory",
        description: "Keep the legacy app-grid route available.",
        meta: "Alias",
      },
    ],
  },
  {
    title: "Extensions",
    description: "Adjacent visual and analytics packages that can compose with grid workflows.",
    demos: [
      {
        title: "World Map",
        to: "/vue/world-map",
        description: "Inspect the world-map package integration.",
        meta: "Map",
      },
      {
        title: "Charts",
        to: "/vue/charts",
        description: "Review chart package primitives.",
        meta: "Charts",
      },
      {
        title: "Analytics Charts",
        to: "/vue/analytics-charts",
        description: "Explore analytics-oriented chart examples.",
        meta: "Analytics",
      },
    ],
  },
]
</script>

<template>
  <article class="showcase-landing" aria-labelledby="showcase-title">
    <header class="showcase-landing__header">
      <p class="showcase-landing__eyebrow">Affino DataGrid demos</p>
      <h2 id="showcase-title">Build data-heavy product screens with a ready Vue grid and deterministic runtime.</h2>
      <p>
        Start with the app-layer grid, then explore backend-owned data, spreadsheet workflows,
        planning views, and scale scenarios.
      </p>
    </header>

    <section class="showcase-landing__section" aria-labelledby="hero-demos-title">
      <div class="showcase-landing__section-heading">
        <h3 id="hero-demos-title">Hero Demos</h3>
        <p>Five routes that communicate the product story before internal validation details.</p>
      </div>
      <div class="showcase-landing__grid showcase-landing__grid--hero">
        <RouterLink v-for="demo in heroDemos" :key="demo.to" class="showcase-card showcase-card--hero" :to="demo.to">
          <span class="showcase-card__meta">{{ demo.meta }}</span>
          <strong>{{ demo.title }}</strong>
          <span>{{ demo.description }}</span>
        </RouterLink>
      </div>
    </section>

    <section
      v-for="group in groups"
      :key="group.title"
      class="showcase-landing__section"
      :aria-labelledby="`showcase-${group.title.toLowerCase()}`"
    >
      <div class="showcase-landing__section-heading">
        <h3 :id="`showcase-${group.title.toLowerCase()}`">{{ group.title }}</h3>
        <p>{{ group.description }}</p>
      </div>
      <div class="showcase-landing__grid">
        <RouterLink v-for="demo in group.demos" :key="demo.to" class="showcase-card" :to="demo.to">
          <span class="showcase-card__meta">{{ demo.meta }}</span>
          <strong>{{ demo.title }}</strong>
          <span>{{ demo.description }}</span>
        </RouterLink>
      </div>
    </section>
  </article>
</template>

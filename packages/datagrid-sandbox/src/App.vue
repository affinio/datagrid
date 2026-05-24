<script setup lang="ts">
const navGroups = [
  {
    title: "Hero",
    links: [
      { to: "/showcase", label: "Showcase Home" },
      { to: "/vue/shell/base-grid", label: "Data Workbench" },
      { to: "/vue/server-data-source-grid", label: "Server Datasource" },
      { to: "/vue/spreadsheet-workbook", label: "Spreadsheet Workflow" },
      { to: "/vue/shell/gantt-grid", label: "Gantt Planning" },
      { to: "/vue/base-grid?rows=50000&cols=128", label: "Performance Stress" },
    ],
  },
  {
    title: "Showcase",
    links: [
      { to: "/vue/shell/grouped-grid", label: "Grouped Operations" },
      { to: "/vue/shell/tree-grid", label: "Tree Data" },
      { to: "/vue/shell/pivot-grid", label: "Pivot Analytics" },
      { to: "/vue/shell/timesheet-grid", label: "Timesheet Planning" },
      { to: "/vue/formula-grid", label: "Formula Grid" },
    ],
  },
  {
    title: "Advanced",
    links: [
      { to: "/vue/base-grid", label: "Vue Runtime Grid" },
      { to: "/vue/worker-grid", label: "Background Data Processing" },
      { to: "/vue/cell-renderer-grid", label: "Custom Cell Presentation" },
      { to: "/vue/typed-facade-grid", label: "Typed Integration" },
    ],
  },
  {
    title: "Debug",
    links: [
      { to: "/core/base-grid", label: "Core API Validation" },
      { to: "/vue/tree-grid", label: "Tree Validation" },
      { to: "/vue/pivot-grid", label: "Pivot Validation" },
      { to: "/vue/row-selection-grid", label: "Selection Contracts" },
      { to: "/vue/base-grid-factory", label: "Legacy App Route" },
    ],
  },
  {
    title: "Extensions",
    links: [
      { to: "/vue/world-map", label: "World Map" },
      { to: "/vue/charts", label: "Charts" },
      { to: "/vue/analytics-charts", label: "Analytics Charts" },
    ],
  },
]
</script>

<template>
  <main class="sandbox">
    <header class="sandbox__header">
      <h1>DataGrid Sandbox</h1>
      <p>External showcase and stable validation routes for Affino DataGrid.</p>
    </header>

    <nav class="sandbox__nav" aria-label="Sandbox demos">
      <section v-for="group in navGroups" :key="group.title" class="sandbox__nav-group">
        <h2>{{ group.title }}</h2>
        <div class="sandbox__nav-links">
          <RouterLink v-for="link in group.links" :key="link.to" class="sandbox__link" :to="link.to">
            {{ link.label }}
          </RouterLink>
        </div>
      </section>
    </nav>

    <section class="sandbox__route">
      <RouterView :key="$route.fullPath" />
    </section>
  </main>
</template>

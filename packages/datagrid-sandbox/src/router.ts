import { createRouter, createWebHistory } from "vue-router"
import CoreGridCard from "./components/CoreGridCard.vue"
import VueCellRendererGridCard from "./components/VueCellRendererGridCard.vue"
import VueFormulaGridCard from "./components/VueFormulaGridCard.vue"
import VueGridCard from "./components/VueGridCard.vue"
import VueRowSelectionInteractionGridCard from "./components/VueRowSelectionInteractionGridCard.vue"
import VueShellGridCard from "./components/VueShellGridCard.vue"
import VueSpreadsheetWorkbookCard from "./components/VueSpreadsheetWorkbookCard.vue"
import VueTypedFacadeGridCard from "./components/VueTypedFacadeGridCard.vue"

const routes = [
  {
    path: "/",
    redirect: "/vue/base-grid",
  },
  {
    path: "/vue/base-grid",
    component: VueGridCard,
    props: { title: "Vue: Base Grid (Adapter)", mode: "base" },
  },
  {
    path: "/vue/tree-grid",
    component: VueGridCard,
    props: { title: "Vue: Tree Grid", mode: "tree" },
  },
  {
    path: "/vue/pivot-grid",
    component: VueGridCard,
    props: { title: "Vue: Pivot Grid", mode: "pivot" },
  },
  {
    path: "/vue/worker-grid",
    component: VueGridCard,
    props: { title: "Vue: Worker Grid", mode: "worker" },
  },
  {
    path: "/vue/formula-grid",
    component: VueFormulaGridCard,
  },
  {
    path: "/vue/cell-renderer-grid",
    component: VueCellRendererGridCard,
  },
  {
    path: "/vue/row-selection-grid",
    component: VueRowSelectionInteractionGridCard,
  },
  {
    path: "/vue/typed-facade-grid",
    component: VueTypedFacadeGridCard,
  },
  {
    path: "/vue/spreadsheet-workbook",
    component: VueSpreadsheetWorkbookCard,
  },
  {
    path: "/vue/base-grid-factory",
    redirect: "/vue/shell/base-grid",
  },
  {
    path: "/vue/shell/base-grid",
    component: VueShellGridCard,
    props: { title: "Vue: Base Grid (Sugar)", mode: "base" },
  },
  {
    path: "/vue/shell/grouped-grid",
    component: VueShellGridCard,
    props: {
      title: "Vue: Grouped Grid (Sugar)",
      mode: "base",
      groupedShowcase: true,
    },
  },
  {
    path: "/vue/shell/gantt-grid",
    component: VueShellGridCard,
    props: {
      title: "Vue: Enterprise Gantt Showcase",
      mode: "base",
      initialViewMode: "gantt",
      ganttShowcase: true,
    },
  },
  {
    path: "/vue/shell/timesheet-grid",
    component: VueShellGridCard,
    props: {
      title: "Vue: Timesheet Grid (Sugar)",
      mode: "base",
      timesheetShowcase: true,
    },
  },
  {
    path: "/vue/shell/tree-grid",
    component: VueShellGridCard,
    props: { title: "Vue: Tree Grid (Sugar)", mode: "tree" },
  },
  {
    path: "/vue/shell/pivot-grid",
    component: VueShellGridCard,
    props: { title: "Vue: Pivot Grid (Sugar)", mode: "pivot" },
  },
  {
    path: "/core/base-grid",
    component: CoreGridCard,
    props: { title: "Core: Base Grid (Direct API)" },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

import { createRouter, createWebHistory } from "vue-router"
import CoreGridCard from "./components/CoreGridCard.vue"
import VueFactoryBaseGridCard from "./components/VueFactoryBaseGridCard.vue"
import VueFormulaGridCard from "./components/VueFormulaGridCard.vue"
import VueGridCard from "./components/VueGridCard.vue"
import VueShellGridCard from "./components/VueShellGridCard.vue"

const routes = [
  {
    path: "/",
    redirect: "/vue/base-grid",
  },
  {
    path: "/vue/base-grid",
    component: VueGridCard,
    props: { title: "Vue: Base Grid", mode: "base" },
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
    path: "/vue/base-grid-factory",
    component: VueFactoryBaseGridCard,
  },
  {
    path: "/vue/shell/base-grid",
    component: VueShellGridCard,
    props: { title: "Vue: Base Grid (Shell)", mode: "base" },
  },
  {
    path: "/vue/shell/tree-grid",
    component: VueShellGridCard,
    props: { title: "Vue: Tree Grid (Shell)", mode: "tree" },
  },
  {
    path: "/vue/shell/pivot-grid",
    component: VueShellGridCard,
    props: { title: "Vue: Pivot Grid (Shell)", mode: "pivot" },
  },
  {
    path: "/core/base-grid",
    component: CoreGridCard,
    props: { title: "Core: Base Grid" },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

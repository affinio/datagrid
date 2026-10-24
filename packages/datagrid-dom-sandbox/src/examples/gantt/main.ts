import { mountDataGrid, type DataGridDomHandle } from "@affino/datagrid-dom"
import "@affino/datagrid-dom/style.css"
import "../../style.css"
import { failDemoLoading, finishDemoLoading } from "../../pageLoading"

interface TaskRow {
  id: string
  task: string
  team: string
  start: Date
  end: Date
  baselineStart: Date
  baselineEnd: Date
  progress: number
  dependencies: string[]
  critical: boolean
}

const day = (offset: number): Date => new Date(Date.UTC(2026, 0, 5 + offset))
const rows: readonly TaskRow[] = [
  { id: "plan", task: "Project planning", team: "Platform", start: day(0), end: day(4), baselineStart: day(0), baselineEnd: day(3), progress: 1, dependencies: [], critical: true },
  { id: "design", task: "Interaction design", team: "Platform", start: day(4), end: day(10), baselineStart: day(3), baselineEnd: day(9), progress: 0.75, dependencies: ["plan:FS"], critical: true },
  { id: "api", task: "Public API", team: "Platform", start: day(5), end: day(13), baselineStart: day(4), baselineEnd: day(11), progress: 0.55, dependencies: ["plan:FS"], critical: false },
  { id: "engine", task: "Core implementation", team: "Engineering", start: day(10), end: day(23), baselineStart: day(9), baselineEnd: day(20), progress: 0.42, dependencies: ["design:FS", "api:SS"], critical: true },
  { id: "adapter", task: "DOM adapter", team: "Engineering", start: day(16), end: day(27), baselineStart: day(14), baselineEnd: day(25), progress: 0.2, dependencies: ["engine:SS"], critical: false },
  { id: "tests", task: "Contract coverage", team: "Quality", start: day(22), end: day(31), baselineStart: day(20), baselineEnd: day(28), progress: 0.15, dependencies: ["engine:FS"], critical: true },
  { id: "docs", task: "Documentation", team: "Quality", start: day(25), end: day(32), baselineStart: day(24), baselineEnd: day(30), progress: 0, dependencies: ["adapter:SS"], critical: false },
  { id: "release", task: "Release", team: "Platform", start: day(33), end: day(33), baselineStart: day(31), baselineEnd: day(31), progress: 0, dependencies: ["tests:FS", "docs:FS"], critical: true },
]

export interface GanttDemoHandle {
  readonly grid: DataGridDomHandle<TaskRow>
  destroy(): Promise<void>
}

export function mountGanttDemo(root: HTMLElement): GanttDemoHandle {
  const document = root.ownerDocument
  const header = document.createElement("div")
  header.className = "demo-panel__header"
  const title = document.createElement("div")
  const heading = document.createElement("h2")
  heading.textContent = "Project schedule"
  const description = document.createElement("p")
  description.textContent = "The table and timeline use the same Core row projection. Scroll vertically in either pane; the timeline shows baselines, progress, critical tasks, milestones, dependencies, and group summaries."
  title.append(heading, description)
  header.append(title)
  const host = document.createElement("div")
  host.className = "gantt-demo__host"
  root.replaceChildren(header, host)

  const grid = mountDataGrid(host, {
    label: "Project schedule",
    rows,
    viewMode: "gantt",
    gantt: {
      idKey: "id",
      labelKey: "task",
      startKey: "start",
      endKey: "end",
      baselineStartKey: "baselineStart",
      baselineEndKey: "baselineEnd",
      progressKey: "progress",
      dependencyKey: "dependencies",
      criticalKey: "critical",
      zoomLevel: "day",
      rangePaddingDays: 3,
    },
    rowVirtualization: { rowHeight: 38, overscan: 4 },
    columns: [
      { key: "task", field: "task", label: "Task", initialState: { width: 220 } },
      { key: "team", field: "team", label: "Team", initialState: { width: 120 } },
      { key: "start", field: "start", label: "Start", dataType: "date", initialState: { width: 120 } },
      { key: "end", field: "end", label: "Finish", dataType: "date", initialState: { width: 120 } },
      { key: "progress", field: "progress", label: "Progress", dataType: "percent", initialState: { width: 100 } },
    ],
  })
  void grid.ready.then(() => {
    grid.api.rows.setGroupBy({ fields: ["team"], expandedByDefault: true })
    finishDemoLoading(document)
  }).catch(() => failDemoLoading(document))
  return {
    grid,
    async destroy() {
      await grid.destroy()
      root.replaceChildren()
    },
  }
}

if (typeof document !== "undefined") {
  const root = document.querySelector<HTMLElement>("#gantt-demo")
  if (root) {
    const demo = mountGanttDemo(root)
    window.addEventListener("pagehide", () => void demo.destroy(), { once: true })
  }
}

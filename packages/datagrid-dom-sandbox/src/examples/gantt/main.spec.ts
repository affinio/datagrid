import { afterEach, describe, expect, it } from "vitest"
import { mountGanttDemo, type GanttDemoHandle } from "./main"

describe("Gantt sandbox example", () => {
  let demo: GanttDemoHandle | undefined
  let root: HTMLDivElement
  let canvasContextDescriptor: PropertyDescriptor | undefined

  afterEach(async () => {
    await demo?.destroy()
    demo = undefined
    if (canvasContextDescriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", canvasContextDescriptor)
      canvasContextDescriptor = undefined
    }
    root?.remove()
  })

  it("renders the Core table beside a timeline and retains grouped source rows", async () => {
    root = document.createElement("div")
    document.body.append(root)
    demo = mountGanttDemo(root)
    await demo.grid.ready
    await Promise.resolve()

    expect(root.querySelector(".affino-grid-dom-gantt")).not.toBeNull()
    expect(root.querySelector(".affino-grid-dom-gantt__canvas--header")).not.toBeNull()
    expect(root.querySelector(".affino-grid-dom-gantt__canvas--body")).not.toBeNull()
    expect(root.querySelectorAll(".affino-grid-dom__row[data-row-index]").length).toBeGreaterThan(0)
    expect(demo.grid.api.rows.getSnapshot().groupBy?.fields).toEqual(["team"])
  })

  it("previews task moves, cancels with Escape, commits through Core, and supports Undo", async () => {
    canvasContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "getContext")
    const fills: Array<{ x: number; y: number; width: number; height: number; alpha: number; color: string }> = []
    const state = { fillStyle: "", globalAlpha: 1 }
    const savedStates: typeof state[] = []
    const context = new Proxy(state, {
      get: (target, key) => {
        if (key === "fillRect") return (x: number, y: number, width: number, height: number) => fills.push({
          x, y, width, height, alpha: target.globalAlpha, color: target.fillStyle,
        })
        if (key === "save") return () => savedStates.push({ ...target })
        if (key === "restore") return () => Object.assign(target, savedStates.pop() ?? {})
        return typeof key === "string" ? () => undefined : undefined
      },
      set: (target, key, value) => Reflect.set(target, key, value),
    })
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => context,
    })

    root = document.createElement("div")
    document.body.append(root)
    demo = mountGanttDemo(root)
    await demo.grid.ready
    await new Promise(resolve => setTimeout(resolve, 0))

    const timelineBody = root.querySelector<HTMLElement>(".affino-grid-dom-gantt__body")!
    const canvas = root.querySelector<HTMLCanvasElement>(".affino-grid-dom-gantt__canvas--body")!
    const tableBody = root.querySelector<HTMLElement>(".affino-grid-dom__body")!
    Object.defineProperties(timelineBody, {
      clientWidth: { configurable: true, value: 420 },
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 600 },
    })
    Object.defineProperties(tableBody, {
      clientWidth: { configurable: true, value: 520 },
      clientHeight: { configurable: true, value: 300 },
      scrollHeight: { configurable: true, value: 600 },
      getBoundingClientRect: { configurable: true, value: () => ({ top: 0, left: 0, right: 520, bottom: 300, width: 520, height: 300, x: 0, y: 0, toJSON: () => ({}) }) },
    })
    Object.defineProperties(timelineBody, {
      getBoundingClientRect: { configurable: true, value: () => ({ top: 0, left: 0, right: 420, bottom: 300, width: 420, height: 300, x: 0, y: 0, toJSON: () => ({}) }) },
    })
    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 420 },
      clientHeight: { configurable: true, value: 300 },
      getBoundingClientRect: { configurable: true, value: () => ({ top: 0, left: 0, right: 420, bottom: 300, width: 420, height: 300, x: 0, y: 0, toJSON: () => ({}) }) },
    })

    const taskIndex = Array.from({ length: demo.grid.api.rows.getCount() }, (_, index) => index)
      .find(index => demo!.grid.api.rows.get(index)?.rowId === "plan")!
    for (const row of root.querySelectorAll<HTMLElement>(".affino-grid-dom__body > .affino-grid-dom__row[data-row-index]")) {
      const index = Number(row.dataset.rowIndex)
      Object.defineProperty(row, "getBoundingClientRect", {
        configurable: true,
        value: () => ({ top: index * 38, left: 0, right: 520, bottom: (index + 1) * 38, width: 520, height: 38, x: 0, y: index * 38, toJSON: () => ({}) }),
      })
    }
    timelineBody.dispatchEvent(new Event("scroll"))
    await new Promise(resolve => setTimeout(resolve, 40))
    const originalStart = demo.grid.api.rows.getById("plan")!.data.start.getTime()
    const originalEnd = demo.grid.api.rows.getById("plan")!.data.end.getTime()
    const x = 120
    const y = taskIndex * 38 + 19
    expect(demo.grid.api.rows.hasPatchSupport()).toBe(true)

    fills.length = 0
    root.querySelector<HTMLElement>(`.affino-grid-dom__body [data-row-index="${taskIndex}"] [data-column-index="0"]`)!.click()
    expect(demo.grid.api.selection.getSnapshot()?.activeCell?.rowIndex).toBe(taskIndex)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(fills).toContainEqual({ x: 0, y: taskIndex * 38, width: 420, height: 38, alpha: 1, color: "#eaf2fc" })

    const pointerDown = pointerEvent("pointerdown", x, y)
    canvas.dispatchEvent(pointerDown)
    expect(pointerDown.defaultPrevented).toBe(true)
    expect(canvas.style.cursor).toBe("grabbing")
    expect(demo.grid.api.selection.getSnapshot()?.activeCell?.rowIndex).toBe(taskIndex)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(fills).toContainEqual({ x: 0, y: taskIndex * 38, width: 420, height: 38, alpha: 1, color: "#eaf2fc" })
    canvas.dispatchEvent(pointerEvent("pointermove", x + 24, y))
    timelineBody.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(demo.grid.api.rows.getById("plan")!.data.start.getTime()).toBe(originalStart)

    canvas.dispatchEvent(pointerEvent("pointerdown", x, y))
    canvas.dispatchEvent(pointerEvent("pointermove", x + 24, y))
    canvas.dispatchEvent(pointerEvent("pointerup", x + 24, y))
    await waitFor(() => demo?.grid.api.rows.getById("plan")?.data.start.getTime() === originalStart + 86_400_000)
    // The default Mon–Fri working calendar moves the Friday endpoint to Monday.
    expect(demo.grid.api.rows.getById("plan")!.data.end.getTime()).toBe(originalEnd + 3 * 86_400_000)
    await new Promise(resolve => setTimeout(resolve, 0))
    timelineBody.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }))
    await waitFor(() => demo?.grid.api.rows.getById("plan")?.data.start.getTime() === originalStart)
    expect(demo.grid.api.rows.getById("plan")!.data.end.getTime()).toBe(originalEnd)
  })
})

function pointerEvent(type: string, clientX: number, clientY: number): MouseEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
  })
  return event
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  expect(predicate()).toBe(true)
}

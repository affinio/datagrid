// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineComponent, h, nextTick } from "vue"
import type { DataGridGroupBySpec } from "@affino/datagrid-vue"

vi.mock("@affino/popover-vue", async () => {
  const { ref } = await import("vue")
  return {
    usePopoverController: (
      _config?: unknown,
      handlers?: { onOpen?: () => void; onClose?: () => void },
    ) => {
      const state = ref({ open: false })

      const open = (): void => {
        if (state.value.open) {
          return
        }
        state.value = { open: true }
        handlers?.onOpen?.()
      }

      const close = (): void => {
        if (!state.value.open) {
          return
        }
        state.value = { open: false }
        handlers?.onClose?.()
      }

      return {
        state,
        getTriggerProps: (value: Record<string, unknown> = {}) => ({
          ...value,
          onClick: (event: MouseEvent) => {
            const handler = value.onClick
            if (typeof handler === "function") {
              handler(event)
            }
            open()
          },
        }),
        getContentProps: (value: Record<string, unknown> = {}) => value,
        open,
        close,
      }
    },
    useFloatingPopover: () => ({
      contentStyle: ref({}),
      teleportTarget: ref(document.body),
      contentRef: ref<HTMLElement | null>(null),
      updatePosition: async () => {},
    }),
  }
})

vi.mock("@affino/menu-vue", () => {
  const passthrough = (name: string) => defineComponent({
    name,
    setup(_props, { slots, attrs }) {
      return () => h("div", attrs, slots.default?.())
    },
  })

  const trigger = defineComponent({
    name: "UiMenuTrigger",
    setup(_props, { slots }) {
      return () => slots.default?.({ open: false }) ?? null
    },
  })

  return {
    UiMenu: passthrough("UiMenu"),
    UiMenuContent: passthrough("UiMenuContent"),
    UiMenuItem: passthrough("UiMenuItem"),
    UiMenuLabel: passthrough("UiMenuLabel"),
    UiMenuSeparator: passthrough("UiMenuSeparator"),
    UiMenuTrigger: trigger,
    UiSubMenu: passthrough("UiSubMenu"),
    UiSubMenuContent: passthrough("UiSubMenuContent"),
    UiSubMenuTrigger: passthrough("UiSubMenuTrigger"),
  }
})

vi.mock("@affino/menu-core", () => ({}))

async function flushUi(): Promise<void> {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

async function preloadAdvancedFilterPopover(): Promise<void> {
  await import("../../../datagrid-vue-app/src/overlays/DataGridAdvancedFilterPopover.vue")
}

async function preloadFindReplacePopover(): Promise<void> {
  await import("../../../datagrid-vue-app/src/overlays/DataGridFindReplacePopover.vue")
}

function queryAdvancedFilterRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-advanced-filter")
}

function queryFindReplaceRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(".datagrid-find-replace")
}

async function findAdvancedFilterTrigger(wrapper: ReturnType<typeof mount>) {
  await flushUi()
  await flushUi()
  return wrapper.find('[data-datagrid-toolbar-action="advanced-filter"]')
}

function findButtonByText(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll("button").find(candidate => candidate.text() === label)
}

describe("VueShellGridCard", () => {
  beforeAll(() => {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: ResizeObserverStub,
    })

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: () => {},
    })

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: () => {},
    })

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => null,
    })
  })

  afterEach(() => {
    document.body.innerHTML = ""
    globalThis.localStorage?.clear()
    vi.restoreAllMocks()
  })

  it("keeps timesheet source row ids unique after grouped cell-change sync", async () => {
    const { default: VueShellGridCard } = await import("./VueShellGridCard.vue")
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const wrapper = mount(VueShellGridCard, {
      props: {
        title: "Vue: Timesheet Grid (Sugar)",
        mode: "base",
        timesheetShowcase: true,
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()
    await flushUi()

    const grid = wrapper.findComponent({ name: "DataGrid" })
    expect(grid.exists()).toBe(true)

    const groupedByMonday: DataGridGroupBySpec = {
      fields: ["monday"],
      expandedByDefault: true,
    }

    await grid.vm.$emit("update:group-by", groupedByMonday)
    await flushUi()
    await flushUi()

    grid.vm.$emit("cell-change", {
      rowId: "proj-product-foundation",
      columnKey: "monday",
      value: 7,
    })
    await flushUi()
    await flushUi()

    expect(wrapper.exists()).toBe(true)
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("Duplicate rowId detected"))
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("Unhandled error during execution of watcher callback"))
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("Unhandled error during execution of component update"))

    expect(grid.props("fillHandle")).toBe(true)
    expect(grid.props("rangeMove")).toBe(true)

    wrapper.unmount()
  })

  it("exposes editable select columns in the tree shell demo", async () => {
    const { default: VueShellGridCard } = await import("./VueShellGridCard.vue")

    const wrapper = mount(VueShellGridCard, {
      props: {
        title: "Vue: Tree Grid (Sugar)",
        mode: "tree",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()
    await flushUi()

    const grid = wrapper.findComponent({ name: "DataGrid" })
    expect(grid.exists()).toBe(true)

    const columns = ((grid.vm as { $attrs?: Record<string, unknown> }).$attrs?.columns ?? []) as Array<Record<string, unknown>>
    const assignee = columns.find(column => column.key === "assignee")
    const severity = columns.find(column => column.key === "severity")
    const status = columns.find(column => column.key === "status")

    expect(assignee).toMatchObject({
      cellType: "select",
      capabilities: expect.objectContaining({ editable: true }),
      presentation: expect.objectContaining({ options: expect.any(Array) }),
    })
    expect(severity).toMatchObject({
      cellType: "select",
      capabilities: expect.objectContaining({ editable: true }),
      presentation: expect.objectContaining({ options: expect.any(Array) }),
    })
    expect(status).toMatchObject({
      cellType: "select",
      capabilities: expect.objectContaining({ editable: true }),
      presentation: expect.objectContaining({ options: expect.any(Array) }),
    })

    wrapper.unmount()
  })

  it("renders the sandbox toolbarModules demo action and updates the footer status on click", async () => {
    const { default: VueShellGridCard } = await import("./VueShellGridCard.vue")

    const wrapper = mount(VueShellGridCard, {
      props: {
        title: "Vue: Base Grid (Sugar)",
        mode: "base",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()
    await flushUi()

    const toolbarButton = wrapper.find('[data-datagrid-toolbar-action="sandbox-summary"]')
    expect(toolbarButton.exists()).toBe(true)
    expect(toolbarButton.text()).toBe("Capture summary")

    await toolbarButton.trigger("click")
    await flushUi()

    expect(wrapper.text()).toContain("Toolbar action:")
    expect(wrapper.text()).toContain("table view")

    wrapper.unmount()
  })

  it("restores advanced filter draft clauses from sandbox saved view storage", async () => {
    await preloadAdvancedFilterPopover()

    const { default: VueShellGridCard } = await import("./VueShellGridCard.vue")

    const wrapper = mount(VueShellGridCard, {
      props: {
        title: "Vue: Base Grid (Sugar)",
        mode: "base",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()
    await flushUi()

    const trigger = await findAdvancedFilterTrigger(wrapper)
    expect(trigger.exists()).toBe(true)
    await trigger.trigger("click")
    await flushUi()

    let popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()

    let rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(1)

    const firstValueInput = rows[0]?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(firstValueInput).toBeTruthy()
    firstValueInput!.value = "NOC"
    firstValueInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushUi()

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__secondary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushUi()

    popover = queryAdvancedFilterRoot()
    rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(2)

    const secondValueInput = rows[1]?.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')
    expect(secondValueInput).toBeTruthy()
    secondValueInput!.value = "Alice"
    secondValueInput!.dispatchEvent(new Event("input", { bubbles: true }))
    await flushUi()

    popover?.querySelector<HTMLElement>(".datagrid-advanced-filter__primary")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushUi()

    const saveLocalButton = findButtonByText(wrapper, "Save local")
    expect(saveLocalButton?.exists()).toBe(true)
    await saveLocalButton!.trigger("click")
    await flushUi()

    const reopenedTrigger = await findAdvancedFilterTrigger(wrapper)
    await reopenedTrigger.trigger("click")
    await flushUi()

    popover = queryAdvancedFilterRoot()
    expect(popover).toBeTruthy()
    popover?.querySelector<HTMLElement>('[data-datagrid-advanced-filter-action="reset-all"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    )
    await flushUi()

    expect((await findAdvancedFilterTrigger(wrapper)).attributes("data-datagrid-advanced-filter-active")).toBe("false")

    const loadLocalButton = findButtonByText(wrapper, "Load local")
    expect(loadLocalButton?.exists()).toBe(true)
    await loadLocalButton!.trigger("click")
    await flushUi()
    await flushUi()

    expect((await findAdvancedFilterTrigger(wrapper)).attributes("data-datagrid-advanced-filter-active")).toBe("true")

    await (await findAdvancedFilterTrigger(wrapper)).trigger("click")
    await flushUi()

    popover = queryAdvancedFilterRoot()
    rows = Array.from(popover?.querySelectorAll<HTMLElement>(".datagrid-advanced-filter__row") ?? [])
    expect(rows).toHaveLength(2)

    const hydratedValues = rows.map(row => (
      row.querySelector<HTMLInputElement>('.datagrid-advanced-filter__field--value input[type="text"]')?.value ?? null
    ))
    expect(hydratedValues).toEqual(["NOC", "Alice"])

    wrapper.unmount()
  })

  it("exposes declarative findReplace on the base sugar sandbox card", async () => {
    await preloadFindReplacePopover()

    const { default: VueShellGridCard } = await import("./VueShellGridCard.vue")

    const wrapper = mount(VueShellGridCard, {
      props: {
        title: "Vue: Base Grid (Sugar)",
        mode: "base",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()
    await flushUi()

    const trigger = wrapper.find('[data-datagrid-toolbar-action="find-replace"]')
    expect(trigger.exists()).toBe(true)

    await trigger.trigger("click")
    await flushUi()

    expect(queryFindReplaceRoot()).toBeTruthy()

    wrapper.unmount()
  })

  it("exposes declarative gridLines controls on the base sugar sandbox card", async () => {
    const { default: VueShellGridCard } = await import("./VueShellGridCard.vue")

    const wrapper = mount(VueShellGridCard, {
      props: {
        title: "Vue: Base Grid (Sugar)",
        mode: "base",
      },
      attachTo: document.body,
      global: {
        stubs: {
          teleport: true,
        },
      },
    })

    await flushUi()
    await flushUi()

    const grid = wrapper.findComponent({ name: "DataGrid" })
    expect(grid.exists()).toBe(true)
    expect(grid.props("gridLines")).toMatchObject({
      body: "all",
      header: "columns",
      pinnedSeparators: true,
    })

    const columnLinesToggle = wrapper.find('[data-sandbox-grid-lines-toggle="columns"]')
    const pinnedSeparatorsToggle = wrapper.find('[data-sandbox-grid-lines-toggle="pinned-separators"]')

    expect(columnLinesToggle.exists()).toBe(true)
    expect(pinnedSeparatorsToggle.exists()).toBe(true)

    await columnLinesToggle.setValue(false)
    await pinnedSeparatorsToggle.setValue(false)
    await flushUi()

    expect(grid.props("gridLines")).toMatchObject({
      body: "rows",
      header: "columns",
      pinnedSeparators: false,
    })

    wrapper.unmount()
  })
})

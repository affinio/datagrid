// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineComponent, h, nextTick } from "vue"
import type { DataGridGroupBySpec } from "@affino/datagrid-vue"

vi.mock("@affino/popover-vue", async () => {
  const { ref } = await import("vue")
  return {
    usePopoverController: () => ({
      state: ref({ open: false }),
      getTriggerProps: (value: Record<string, unknown> = {}) => value,
      getContentProps: (value: Record<string, unknown> = {}) => value,
      open: () => {},
      close: () => {},
    }),
    useFloatingPopover: () => ({
      contentStyle: ref({}),
      teleportTarget: ref(null),
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
})

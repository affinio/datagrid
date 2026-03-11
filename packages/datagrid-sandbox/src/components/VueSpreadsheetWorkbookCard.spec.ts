import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineComponent, h, nextTick } from "vue"

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

describe("VueSpreadsheetWorkbookCard", () => {
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
  })

  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("renders workbook formula values on initial mount", async () => {
    const { default: VueSpreadsheetWorkbookCard } = await import("./VueSpreadsheetWorkbookCard.vue")

    const wrapper = mount(VueSpreadsheetWorkbookCard, {
      attachTo: document.body,
    })

    await flushUi()
    await flushUi()

    const text = wrapper.text()

    expect(text).toContain("Atlas Labs")
    expect(text).toContain("Northwind")
    expect(text).toContain("1680")
    expect(text).toContain("1560")

    wrapper.unmount()
  })
})
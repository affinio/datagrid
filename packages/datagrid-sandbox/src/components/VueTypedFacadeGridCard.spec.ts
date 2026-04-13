// @vitest-environment jsdom

import { mount } from "@vue/test-utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defineComponent, h, nextTick } from "vue"

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

describe("VueTypedFacadeGridCard", () => {
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

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => null,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("keeps the typed facade demo stable while mirroring unified state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { default: VueTypedFacadeGridCard } = await import("./VueTypedFacadeGridCard.vue")

    const wrapper = mount(VueTypedFacadeGridCard, {
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
    const initialClientRowModelOptions = grid.props("clientRowModelOptions")
  expect(grid.props("showRowIndex")).toBe(false)

  const statusChips = wrapper.findAll(".typed-facade-status-chip")
  expect(statusChips.map(chip => chip.text())).toEqual(["Active", "Blocked", "Active"])

    const buttons = wrapper.findAll("button")
    const captureFilterModelButton = buttons.find(button => button.text() === "Capture typed filter model")
    const promoteBlockedInvoiceButton = buttons.find(button => button.text() === "Promote blocked invoice via typed API")

    expect(captureFilterModelButton).toBeDefined()
    expect(promoteBlockedInvoiceButton).toBeDefined()

    await captureFilterModelButton!.trigger("click")
    await flushUi()
    await promoteBlockedInvoiceButton!.trigger("click")
    await flushUi()
    await flushUi()

    expect(wrapper.findComponent({ name: "DataGrid" }).props("clientRowModelOptions")).toBe(initialClientRowModelOptions)
    expect(wrapper.text()).toContain("First row from typed api.rows.get(): North Ops")

    const loggedRecursiveUpdateError = consoleError.mock.calls.some(call => {
      return call.some(argument => String(argument).includes("Maximum recursive updates exceeded"))
    })

    expect(loggedRecursiveUpdateError).toBe(false)

    wrapper.unmount()
  })
})
import { Fragment, h, onBeforeUnmount, render, watch } from "vue"
import type { ComputedRef, VNode, VNodeArrayChildren } from "vue"
import type { UiTableBodyBindings } from "../context.js"
import type { UiTableBodyBindings as CoreBodyBindings, ImperativeContainerMap } from "@affino/datagrid-core/imperative/bindings.js"
import type { ImperativeColumnUpdatePayload, ImperativeRowUpdatePayload } from "../composables/useTableViewport.js"
import { ImperativeTableEngine } from "@affino/datagrid-core/imperative/engine.js"
import type {
  ImperativeBodyController,
  ImperativeBodyViewConfig,
  ImperativeRendererAdapter,
  HeaderSnapshot,
} from "@affino/datagrid-core/imperative/engine.js"
import { createDomControllerSuite } from "./createDomControllerSuite"

function createVueRenderer(body: UiTableBodyBindings): ImperativeRendererAdapter {
  return {
    mountCustomCell({ slotName, props, host }) {
      const slot = body.tableSlots?.[slotName]
      if (!slot) {
        render(null, host)
        return
      }
      const rendered = slot(props)
      if (!rendered || (Array.isArray(rendered) && rendered.length === 0)) {
        render(null, host)
        return
      }
      const vnode: VNode = Array.isArray(rendered)
        ? h(Fragment, null, rendered as VNodeArrayChildren)
        : (rendered as VNode)
      render(vnode, host)
    },
    unmountCustomCell(host) {
      render(null, host)
    },
  }
}

export interface UseImperativeTableBodyOptions {
  body: UiTableBodyBindings
  mode: ComputedRef<boolean>
  headerSnapshot: () => HeaderSnapshot
  viewConfig?: ImperativeBodyViewConfig
}

export function useImperativeTableAdapter(options: UseImperativeTableBodyOptions): ImperativeBodyController {
  const renderer = createVueRenderer(options.body)
  const engine = new ImperativeTableEngine({
    body: options.body as unknown as CoreBodyBindings,
    mode: options.mode,
    headerSnapshot: options.headerSnapshot,
    renderer,
    view: options.viewConfig,
    createControllers: createDomControllerSuite,
  })

  let containers: ImperativeContainerMap | null = null

  watch(
    () => options.mode.value,
    value => {
      if (!value) {
        engine.detach()
        return
      }
      if (containers) {
        engine.attach(containers)
      }
    },
    { immediate: true },
  )

  watch(
    () => options.body.editCommand.value?.token,
    token => {
      if (!token) return
      if (!options.mode.value) return
      const command = options.body.editCommand.value
      if (!command) return
      engine.handleEditCommand(command)
    },
  )

  onBeforeUnmount(() => engine.dispose())

  return {
    registerContainer(map) {
      containers = map
      if (!options.mode.value) return
      if (containers) {
        engine.attach(containers)
      } else {
        engine.detach()
      }
    },
    handleRows(payload: ImperativeRowUpdatePayload) {
      engine.handleRows(payload)
    },
    handleColumns(payload: ImperativeColumnUpdatePayload) {
      engine.handleColumns(payload)
    },
    handleEditCommand(command) {
      engine.handleEditCommand(command)
    },
  }
}

export type { ImperativeBodyController, ImperativeBodyViewConfig } from "@affino/datagrid-core/imperative/engine.js"

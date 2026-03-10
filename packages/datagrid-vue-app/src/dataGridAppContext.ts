import type { InjectionKey, Ref } from "vue"

export const dataGridAppRootElementKey: InjectionKey<Ref<HTMLElement | null>> = Symbol("affino-datagrid-app-root-element")

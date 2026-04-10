<template>
  <UiSubMenu v-if="item.kind === 'submenu' && visibleChildren.length > 0" :options="submenuOptions">
    <UiSubMenuTrigger
      class="datagrid-column-menu__item datagrid-column-menu__item--submenu"
      :data-datagrid-column-menu-action="actionAttribute"
      :data-datagrid-column-menu-custom-key="item.key"
      data-datagrid-column-menu-custom-kind="submenu"
      :data-disabled-reason="disabledTitle"
      :aria-disabled="item.disabled === true ? 'true' : undefined"
      :disabled="item.disabled === true"
      :title="disabledTitle"
    >
      <span>{{ item.label }}</span>
    </UiSubMenuTrigger>

    <UiSubMenuContent
      class-name="ui-submenu-content datagrid-column-menu__submenu-panel"
      :style="menuThemeVars"
    >
      <DataGridColumnMenuCustomEntry
        v-for="child in visibleChildren"
        :key="child.key"
        :item="child"
        :path-prefix="actionPath"
        :menu-theme-vars="menuThemeVars"
        :submenu-options="submenuOptions"
        @select="$emit('select', $event)"
      />
    </UiSubMenuContent>
  </UiSubMenu>

  <UiMenuItem
    v-else
    class="datagrid-column-menu__item"
    :data-datagrid-column-menu-action="actionAttribute"
    :data-datagrid-column-menu-custom-key="item.key"
    data-datagrid-column-menu-custom-kind="item"
    :data-disabled-reason="disabledTitle"
    :disabled="item.disabled === true"
    :title="disabledTitle"
    @select="handleLeafSelect"
  >
    <span :title="disabledTitle">{{ item.label }}</span>
  </UiMenuItem>
</template>

<script setup lang="ts">
import { computed } from "vue"
import {
  UiMenuItem,
  UiSubMenu,
  UiSubMenuContent,
  UiSubMenuTrigger,
  type MenuOptions,
} from "@affino/menu-vue"
import type {
  DataGridColumnMenuCustomItem,
  DataGridColumnMenuCustomLeafItem,
} from "./dataGridColumnMenu"

const props = withDefaults(defineProps<{
  item: DataGridColumnMenuCustomItem
  pathPrefix?: string
  menuThemeVars: Record<string, string>
  submenuOptions: MenuOptions
}>(), {
  pathPrefix: "",
})

const emit = defineEmits<{
  select: [item: DataGridColumnMenuCustomLeafItem]
}>()

const actionPath = computed(() => {
  return props.pathPrefix.length > 0
    ? `${props.pathPrefix}/${props.item.key}`
    : props.item.key
})

const actionAttribute = computed(() => `custom:${actionPath.value}`)
const disabledTitle = computed(() => {
  const reason = props.item.disabledReason?.trim() ?? ""
  return reason.length > 0 ? reason : undefined
})
const leafItem = computed<DataGridColumnMenuCustomLeafItem | null>(() => {
  return props.item.kind === "submenu" ? null : props.item
})
const visibleChildren = computed(() => {
  return props.item.kind === "submenu"
    ? props.item.items.filter(child => child.hidden !== true)
    : []
})

function handleLeafSelect(): void {
  if (leafItem.value) {
    emit("select", leafItem.value)
  }
}
</script>

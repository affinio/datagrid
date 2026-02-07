<template>
  <component :is="wrapperTag" class="draggable-list">
    <component
      :is="itemTag"
      v-for="(item, index) in items"
      :key="resolveKey(item, index)"
      class="draggable-list__item"
      :style="resolveItemStyle(item, index)"
      :draggable="resolveDraggable(item, index)"
    >
      <slot :item="item" :index="index" />
    </component>
  </component>
</template>

<script setup lang="ts">
type ItemKeyResolver<T> = keyof T | ((item: T) => string | number)
type ItemStyleResolver<T> = Record<string, string> | ((item: T, index: number) => Record<string, string> | undefined)
type ItemDraggableResolver<T> = boolean | ((item: T, index: number) => boolean)

const props = withDefaults(defineProps<{
  items: any[]
  axis?: "vertical" | "horizontal"
  wrapperTag?: string
  itemTag?: string
  itemKey?: ItemKeyResolver<any>
  itemStyle?: ItemStyleResolver<any>
  itemDraggable?: ItemDraggableResolver<any>
}>(), {
  axis: "vertical",
  wrapperTag: "div",
  itemTag: "div",
  itemKey: "id",
  itemStyle: undefined,
  itemDraggable: false,
})

function resolveKey(item: any, index: number): string | number {
  if (typeof props.itemKey === "function") {
    return props.itemKey(item)
  }
  const key = props.itemKey
  if (item && typeof item === "object" && key in item) {
    const value = item[key]
    if (typeof value === "string" || typeof value === "number") {
      return value
    }
  }
  return index
}

function resolveItemStyle(item: any, index: number): Record<string, string> | undefined {
  if (!props.itemStyle) {
    return undefined
  }
  if (typeof props.itemStyle === "function") {
    return props.itemStyle(item, index)
  }
  return props.itemStyle
}

function resolveDraggable(item: any, index: number): boolean {
  if (typeof props.itemDraggable === "function") {
    return props.itemDraggable(item, index)
  }
  return Boolean(props.itemDraggable)
}

</script>

<template>
  <div
    ref="containerRef"
    class="datagrid-virtual-list"
    :style="containerStyle"
  >
    <div
      v-for="(item, index) in items"
      :key="resolveItemKey(item, index)"
      class="datagrid-virtual-list__item"
      :style="itemStyle"
    >
      <slot :item="item" :index="index" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import type { VirtualListExposedMethods } from "./VirtualList.types"

const props = withDefaults(defineProps<{
  items: unknown[]
  itemHeight: number
  height: number
  overscan?: number
}>(), {
  overscan: 0,
})

const containerRef = ref<HTMLElement | null>(null)

const containerStyle = computed(() => ({
  height: `${Math.max(0, props.height)}px`,
  overflowY: "auto",
  overflowX: "hidden",
}))

const itemStyle = computed(() => ({
  minHeight: `${Math.max(0, props.itemHeight)}px`,
}))

function resolveItemKey(item: unknown, index: number): string | number {
  if (item && typeof item === "object" && "key" in (item as Record<string, unknown>)) {
    const value = (item as Record<string, unknown>).key
    if (typeof value === "string" || typeof value === "number") {
      return value
    }
  }
  return index
}

function scrollTo(index: number) {
  if (!containerRef.value) return
  const targetIndex = Math.max(0, index)
  containerRef.value.scrollTop = targetIndex * Math.max(0, props.itemHeight)
}

function scrollToTop() {
  if (!containerRef.value) return
  containerRef.value.scrollTop = 0
}

defineExpose<VirtualListExposedMethods>({
  scrollTo,
  scrollToTop,
})
</script>

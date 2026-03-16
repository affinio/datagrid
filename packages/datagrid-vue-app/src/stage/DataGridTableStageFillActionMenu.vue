<template>
  <div
    v-if="style"
    class="grid-fill-action grid-fill-action--floating"
    :style="style"
  >
    <button
      type="button"
      class="grid-fill-action__trigger"
      aria-label="Fill options"
      aria-haspopup="menu"
      :aria-expanded="isOpen ? 'true' : 'false'"
      tabindex="-1"
      @mousedown.stop
      @click.stop="emit('toggle', $event)"
    >
      v
    </button>
    <div
      v-if="isOpen"
      class="grid-fill-action__menu"
      role="menu"
    >
      <button
        type="button"
        class="grid-fill-action__item"
        :class="{ 'grid-fill-action__item--active': fillActionBehavior === 'series' }"
        role="menuitemradio"
        :aria-checked="fillActionBehavior === 'series' ? 'true' : 'false'"
        @click.stop="selectBehavior('series')"
      >
        Series
      </button>
      <button
        type="button"
        class="grid-fill-action__item"
        :class="{ 'grid-fill-action__item--active': fillActionBehavior === 'copy' }"
        role="menuitemradio"
        :aria-checked="fillActionBehavior === 'copy' ? 'true' : 'false'"
        @click.stop="selectBehavior('copy')"
      >
        Copy
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties, type PropType } from "vue"
import type { DataGridFillBehavior } from "@affino/datagrid-vue/advanced"
import { useDataGridTableStageSelectionSection } from "./dataGridTableStageContext"

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  style: {
    type: Object as PropType<CSSProperties | null>,
    default: null,
  },
})

const emit = defineEmits<{
  toggle: [event: MouseEvent]
  selected: []
}>()

const selection = useDataGridTableStageSelectionSection<Record<string, unknown>>()
const fillActionBehavior = computed(() => selection.value.fillActionBehavior)

function selectBehavior(behavior: DataGridFillBehavior): void {
  selection.value.applyFillActionBehavior(behavior)
  emit("selected")
}
</script>

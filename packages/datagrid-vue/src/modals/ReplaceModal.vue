<template>
  <UiModal :open="open" title="Replace" @close="handleClose">
    <form class="space-y-4" @submit.prevent>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Find what
          <input
            ref="queryInput"
            v-model="localQuery"
            type="text"
            class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Search value"
            @keydown.enter.prevent="onReplace"
            @keydown.shift.enter.prevent="onReplacePrev"
            @keydown.stop="handleKeydown"
          />
        </label>
        <label class="block text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          Replace with
          <input
            v-model="localReplace"
            type="text"
            class="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Replacement"
            @keydown.stop="handleKeydown"
          />
        </label>
      </div>

      <div class="flex flex-col gap-2 text-xs text-neutral-600 dark:text-neutral-300">
        <label class="inline-flex items-center gap-2">
          <input type="checkbox" v-model="findReplace.matchCase" class="h-3 w-3" />
          <span>Match case</span>
        </label>
        <label class="inline-flex items-center gap-2">
          <input type="checkbox" v-model="findReplace.searchAllColumns" class="h-3 w-3" />
          <span>Search all columns</span>
        </label>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
        <span v-if="findReplace.searching">Searching…</span>
        <span v-else>{{ matchLabel }}</span>
        <div class="flex items-center gap-2">
          <button type="button" class="btn btn-secondary btn-xs" :disabled="!hasMatches" @click="findReplace.focusPrev()">
            Previous
          </button>
          <button type="button" class="btn btn-secondary btn-xs" :disabled="!hasMatches" @click="findReplace.focusNext()">
            Next
          </button>
        </div>
      </div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-secondary btn-xs" @click="handleClose">Cancel</button>
      <button type="button" class="btn btn-secondary btn-xs" :disabled="!hasMatches" @click="onReplace">Replace</button>
      <button type="button" class="btn btn-primary btn-xs" :disabled="!hasMatches" @click="onReplaceAll">Replace All</button>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { useFindReplaceStore } from "../stores/useFindReplaceStore"
import UiModal from "../components/UiModal.vue"

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: "close"): void }>()
const findReplace = useFindReplaceStore()
const queryInput = ref<HTMLInputElement | null>(null)
const localQuery = ref(findReplace.query)
const localReplace = ref(findReplace.replaceText)
let debounceHandle: number | null = null

const hasMatches = computed(() => findReplace.matches.length > 0)
const matchLabel = computed(() => {
  const total = findReplace.matches.length
  if (!total) return "0 of 0 matches"
  return `${findReplace.currentIndex + 1} of ${total} matches`
})

function clearTimer() {
  if (debounceHandle !== null) {
    window.clearTimeout(debounceHandle)
    debounceHandle = null
  }
}

function scheduleSearch(value: string) {
  clearTimer()
  debounceHandle = window.setTimeout(() => {
    void findReplace.findAll(value)
  }, 280)
}

function handleClose() {
  emit("close")
}

function handleKeydown(event: KeyboardEvent) {
  const isMeta = event.metaKey || event.ctrlKey
  if (isMeta && event.key.toLowerCase() === "z") {
    event.preventDefault()
    findReplace.undo()
  }
  if (isMeta && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"))) {
    event.preventDefault()
    findReplace.redo()
  }
}

async function onReplace() {
  if (!hasMatches.value) {
    await findReplace.findAll(localQuery.value)
    return
  }
  await findReplace.replaceCurrent()
}

async function onReplacePrev() {
  if (!hasMatches.value) {
    await findReplace.findAll(localQuery.value)
    return
  }
  await findReplace.focusPrev()
}

async function onReplaceAll() {
  if (!hasMatches.value) return
  await findReplace.replaceAll()
  handleClose()
}

watch(
  () => props.open,
  open => {
    if (open) {
      localQuery.value = findReplace.query
      localReplace.value = findReplace.replaceText
      scheduleSearch(localQuery.value)
      nextTick(() => queryInput.value?.focus())
      return
    }
    clearTimer()
  },
  { immediate: true },
)

watch(localQuery, value => {
  findReplace.query = value
  scheduleSearch(value)
})

watch(localReplace, value => {
  findReplace.replaceText = value
})

watch(
  () => [findReplace.matchCase, findReplace.searchAllColumns],
  () => {
    scheduleSearch(localQuery.value)
  },
)

onBeforeUnmount(() => {
  clearTimer()
})
</script>

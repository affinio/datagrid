<template>
  <VueGridCard :title="title" :mode="mode" />
</template>

<script setup lang="ts">
import VueGridCard from "./VueGridCard.vue"

defineProps<{
  title: string
  mode: "base" | "tree" | "pivot"
}>()
</script>

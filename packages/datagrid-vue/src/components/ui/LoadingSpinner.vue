<template>
  <span
    class="datagrid-loading-spinner"
    :class="`datagrid-loading-spinner--${size}`"
    role="status"
    aria-label="Loading"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: "sm" | "md" | "lg"
}>(), {
  size: "md",
})
</script>

<style scoped>
.datagrid-loading-spinner {
  display: inline-block;
  border-radius: 9999px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  animation: datagrid-spinner-rotate 0.7s linear infinite;
  opacity: 0.8;
}

.datagrid-loading-spinner--sm {
  width: 0.75rem;
  height: 0.75rem;
}

.datagrid-loading-spinner--md {
  width: 1rem;
  height: 1rem;
}

.datagrid-loading-spinner--lg {
  width: 1.25rem;
  height: 1.25rem;
}

@keyframes datagrid-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>

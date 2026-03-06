<template>
  <main class="sandbox">
    <header class="sandbox__header">
      <h1>DataGrid Sandbox</h1>
      <p>Functional sandbox for manual validation and future E2E scenarios.</p>
    </header>

    <nav class="sandbox__nav">
      <RouterLink class="sandbox__link" to="/vue/base-grid">Vue Base</RouterLink>
      <RouterLink class="sandbox__link" to="/vue/base-grid-factory">Vue Base (Factory)</RouterLink>
      <RouterLink class="sandbox__link" to="/vue/tree-grid">Vue Tree</RouterLink>
      <RouterLink class="sandbox__link" to="/vue/pivot-grid">Vue Pivot</RouterLink>
      <RouterLink class="sandbox__link" to="/vue/worker-grid">Vue Worker</RouterLink>
      <RouterLink class="sandbox__link" to="/vue/formula-grid">Vue Formula</RouterLink>
      <RouterLink class="sandbox__link" to="/core/base-grid">Core Base</RouterLink>
    </nav>

    <section class="sandbox__route">
      <RouterView :key="$route.fullPath" />
    </section>
  </main>
</template>

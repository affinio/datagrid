<template>
  <main class="financial-chart-examples">
    <button type="button" @click="mode = mode === 'light' ? 'dark' : 'light'">Use {{ mode === "light" ? "dark" : "light" }} theme</button>

    <AffinoTimeSeriesChart
      :series="balanceEquitySeries"
      :theme="mode"
      title="Balance and equity"
      :height="320"
      :y-axis="currencyAxis"
      :tooltip="currencyTooltip"
    />

    <AffinoTimeSeriesChart
      :series="drawdownSeries"
      :theme="mode"
      title="Drawdown"
      :height="280"
      :y-axis="percentAxis"
      :tooltip="percentTooltip"
    />

    <section class="affino-chart-theme" :class="`affino-chart-theme--${mode}`">
      <AffinoBarChart
        :rows="periodicReturns"
        category-field="month"
        value-field="value"
        title="Periodic returns"
        :value-formatter="formatPercent"
      />
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { AffinoBarChart, AffinoTimeSeriesChart } from "@affino/charts-vue"
import "@affino/charts-vue/styles.css"
import { balanceEquitySeries, drawdownSeries, periodicReturns } from "./financialData"

const mode = ref<"light" | "dark">("light")
const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
const formatPercent = (value: number) => new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value)
const currencyAxis = { format: formatCurrency }
const percentAxis = { includeZero: true, format: formatPercent }
const currencyTooltip = { formatValue: formatCurrency }
const percentTooltip = { formatValue: formatPercent }
</script>

<style scoped>
.financial-chart-examples {
  display: grid;
  gap: 24px;
  width: min(100%, 960px);
}
</style>

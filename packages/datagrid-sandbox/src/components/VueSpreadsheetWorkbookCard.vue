<template>
  <DataGridSpreadsheetWorkbookApp
    :workbook-model="workbookModel"
    title="Vue: Spreadsheet Workbook"
    subtitle="Sandbox demo using the public spreadsheet workbook shell."
    footer-text="Spreadsheet shell on top of datagrid-vue-app stage + datagrid-core workbook/sheet/editor models."
  >
    <template #sidebar-top>
      <section class="spreadsheet-demo-panel">
        <h3>Workbook demo</h3>
        <p>
          <strong>Summary</strong> now leads with direct cross-sheet refs like
          <code>=orders![total]1 + orders![total]2</code>.
        </p>
        <p>
          <strong>Orders</strong> still uses Smartsheet-style row refs like
          <code>=[qty]@row * [price]@row</code>.
        </p>
        <p>
          <strong>Customers</strong> still needs
          <code>ROLLUP('orders', ...)</code>.
        </p>
        <p>
          Workbook-wide aggregates stay on
          <code>TABLE('orders', 'total')</code>, because direct refs do not replace dynamic table scans.
        </p>
        <p>
          Click any column header to open the standard menu, then test sort, value filters, and the
          shared <strong>Advanced filter</strong> toolbar on the active sheet.
        </p>
      </section>
    </template>

    <template #gridActions="{ runWorkbookIntent }">
      <div class="spreadsheet-demo-actions">
        <div class="spreadsheet-demo-actions__copy">
          Open <strong>Summary</strong>, then use these actions to watch direct refs rewrite across rename,
          row insert/remove, and sheet removal.
        </div>
        <div class="spreadsheet-demo-actions__buttons">
          <button
            type="button"
            class="spreadsheet-demo-action"
            :disabled="workbookModel.getSheet('orders') == null"
            @click="void toggleOrdersSheetName(runWorkbookIntent)"
          >
            Rename Orders
          </button>
          <button
            type="button"
            class="spreadsheet-demo-action"
            :disabled="workbookModel.getSheet('orders') == null"
            @click="void insertOrderRowAtTop(runWorkbookIntent)"
          >
            Insert order row
          </button>
          <button
            type="button"
            class="spreadsheet-demo-action"
            :disabled="(workbookModel.getSheet('orders')?.sheetModel.getSnapshot().rowCount ?? 0) < 1"
            @click="void removeFirstOrderRow(runWorkbookIntent)"
          >
            Remove first order
          </button>
          <button
            type="button"
            class="spreadsheet-demo-action"
            :disabled="workbookModel.getSheet('orders') == null"
            @click="void removeOrdersSheet(runWorkbookIntent)"
          >
            Remove Orders sheet
          </button>
          <button
            type="button"
            class="spreadsheet-demo-action"
            @click="resetDemoWorkbook"
          >
            Reset demo
          </button>
        </div>
      </div>
    </template>
  </DataGridSpreadsheetWorkbookApp>
</template>

<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from "vue"
import { DataGridSpreadsheetWorkbookApp } from "@affino/datagrid-spreadsheet-vue-app"
import type { DataGridSpreadsheetWorkbookModel } from "@affino/datagrid-core"
import {
  INITIAL_ORDER_SEED,
  buildSpreadsheetDemoOrderRow,
  createSpreadsheetDemoWorkbookModel,
} from "./spreadsheetDemoWorkbook"

type RunWorkbookIntent = (
  descriptor: { intent: string; label: string },
  run: () => boolean,
) => Promise<boolean>

const workbookModel = shallowRef<DataGridSpreadsheetWorkbookModel>(createSpreadsheetDemoWorkbookModel())
let nextOrderSeed = INITIAL_ORDER_SEED

function resetDemoWorkbook(): void {
  const previousWorkbook = workbookModel.value
  workbookModel.value = createSpreadsheetDemoWorkbookModel()
  nextOrderSeed = INITIAL_ORDER_SEED
  previousWorkbook.dispose()
}

async function toggleOrdersSheetName(runWorkbookIntent: RunWorkbookIntent): Promise<void> {
  const ordersSheet = workbookModel.value.getSheet("orders")
  if (!ordersSheet) {
    return
  }
  await runWorkbookIntent({
    intent: "rename-sheet",
    label: "Rename sheet",
  }, () => workbookModel.value.renameSheet(
    "orders",
    ordersSheet.name === "Orders" ? "Revenue Plan" : "Orders",
  ))
}

async function insertOrderRowAtTop(runWorkbookIntent: RunWorkbookIntent): Promise<void> {
  const ordersSheet = workbookModel.value.getSheet("orders")
  if (!ordersSheet) {
    return
  }
  const nextOrderNumber = nextOrderSeed
  nextOrderSeed += 1
  await runWorkbookIntent({
    intent: "insert-row",
    label: "Insert row",
  }, () => ordersSheet.sheetModel.insertRowsAt(0, [buildSpreadsheetDemoOrderRow(nextOrderNumber)]))
}

async function removeFirstOrderRow(runWorkbookIntent: RunWorkbookIntent): Promise<void> {
  const ordersSheet = workbookModel.value.getSheet("orders")
  if (!ordersSheet) {
    return
  }
  await runWorkbookIntent({
    intent: "remove-row",
    label: "Remove row",
  }, () => ordersSheet.sheetModel.removeRowsAt(0, 1))
}

async function removeOrdersSheet(runWorkbookIntent: RunWorkbookIntent): Promise<void> {
  await runWorkbookIntent({
    intent: "remove-sheet",
    label: "Remove sheet",
  }, () => workbookModel.value.removeSheet("orders"))
}

onBeforeUnmount(() => {
  workbookModel.value.dispose()
})
</script>

<style scoped>
.spreadsheet-demo-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.92), rgba(241, 245, 249, 0.88));
}

.spreadsheet-demo-panel h3 {
  margin: 0;
  font-size: 13px;
}

.spreadsheet-demo-panel p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(71, 85, 105, 0.92);
}

.spreadsheet-demo-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  flex-wrap: wrap;
}

.spreadsheet-demo-actions__copy {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(71, 85, 105, 0.92);
}

.spreadsheet-demo-actions__buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.spreadsheet-demo-action {
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.76);
  color: #0f172a;
  cursor: pointer;
}

.spreadsheet-demo-action:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>

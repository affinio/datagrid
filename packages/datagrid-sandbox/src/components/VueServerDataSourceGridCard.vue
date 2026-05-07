<template>
  <article class="card affino-datagrid-app-root sandbox-server-data-source-grid">
    <header class="card__header">
      <div class="card__title-row">
        <div>
          <h2>{{ title }}</h2>
          <p class="server-grid__subtitle">
            100k deterministic rows pulled through a server-style data source with async range loading.
          </p>
        </div>
        <div class="mode-badge">Data Source</div>
      </div>
      <div class="server-grid__toolbar">
        <button type="button" class="server-grid__button" @click="refreshVisibleRange">Refresh visible range</button>
        <button type="button" class="server-grid__button" :disabled="aggregationActive" @click="applyRegionAggregation">Aggregate value by region</button>
        <button type="button" class="server-grid__button" :disabled="!aggregationActive" @click="clearRegionAggregation">Clear aggregation</button>
        <button type="button" class="server-grid__button" :disabled="!canUndoHistory" @click="runHistoryAction('undo')">Undo</button>
        <button type="button" class="server-grid__button" :disabled="!canRedoHistory" @click="runHistoryAction('redo')">Redo</button>
        <button type="button" class="server-grid__button" @click="simulateErrorOnce">Simulate one error</button>
        <button type="button" class="server-grid__button" @click="simulateCommitFailure">Simulate commit failure</button>
      </div>
    </header>

    <section class="server-grid__body">
      <div class="server-grid__surface">
        <DataGrid
          ref="gridRef"
          :key="gridKey"
          :columns="columns"
          :row-model="rowModel"
          :is-cell-editable="isCellEditable"
          theme="industrial-neutral"
          virtualization
          :show-row-index="true"
          :row-selection="false"
          :column-menu="columnMenu"
          advanced-filter
          fill-handle
          range-move
          :history="gridHistory"
          layout-mode="auto-height"
          :min-rows="8"
          :max-rows="16"
          :report-fill-warning="handleFillWarning"
          :report-center-pane-diagnostics="reportCenterPaneDiagnostics"
          :report-fill-plumbing-state="reportFillPlumbingState"
          :report-fill-plumbing-detail="reportFillPlumbingDetail"
          @update:state="handleStateUpdate"
          @cell-edit="handleCellEdit"
        />
      </div>

      <aside class="server-grid__diagnostics">
        <h3>Diagnostics</h3>
        <div class="server-grid__diagnostics-section">
          <h4>Server State</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>Status</dt>
              <dd>{{ loadingLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Error</dt>
              <dd>{{ errorLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Rows</dt>
              <dd>{{ totalRowsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Requested viewport</dt>
              <dd>{{ viewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Rendered viewport</dt>
              <dd>{{ renderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Loaded</dt>
              <dd>{{ loadedRowsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Pending</dt>
              <dd>{{ pendingRequestsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Dataset version</dt>
              <dd>{{ datasetVersionLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Last seen</dt>
              <dd>{{ lastSeenVersionLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Change feed</dt>
              <dd>{{ changeFeedPollingLabel }} / {{ changeFeedPendingLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Applied changes</dt>
              <dd>{{ appliedChangeCountLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Last batch rows</dt>
              <dd>{{ lastBatchRowsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Skipped rows</dt>
              <dd>{{ lastSkippedRowsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Edited rows</dt>
              <dd>{{ editedRowsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Cache</dt>
              <dd>{{ rowCacheLabel }}</dd>
            </div>
          </dl>
        </div>

        <div class="server-grid__diagnostics-section">
          <h4>Selection</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>Selected range</dt>
              <dd>{{ selectionRangeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Virtual</dt>
              <dd>{{ selectionVirtualLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Fully loaded</dt>
              <dd>{{ selectionFullyLoadedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Missing rows</dt>
              <dd>{{ selectionMissingIntervalsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Projection stale</dt>
              <dd>{{ selectionProjectionStaleLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Blocked op</dt>
              <dd>{{ selectionBlockedReasonLabel }}</dd>
            </div>
          </dl>
        </div>

        <div class="server-grid__diagnostics-section">
          <h4>Aggregation Debug</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>Active</dt>
              <dd>{{ aggregationActiveLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Last request</dt>
              <dd>{{ lastAggregationRequestLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Response rows</dt>
              <dd>{{ aggregateResponseRowsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>First rows</dt>
              <dd>{{ aggregatePreviewRowsLabel }}</dd>
            </div>
          </dl>
        </div>

        <div class="server-grid__diagnostics-section">
          <h4>Fill Status</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>Fill warning</dt>
              <dd>{{ fillWarningLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Fill boundary</dt>
              <dd>{{ fillBoundaryLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Boundary L</dt>
              <dd>{{ fillBoundaryLeftLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Boundary R</dt>
              <dd>{{ fillBoundaryRightLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Fill blocked</dt>
              <dd>{{ fillBlockedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Fill applied</dt>
              <dd>{{ fillAppliedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Branch</dt>
              <dd>{{ branchLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Commit mode</dt>
              <dd>{{ commitModeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Commit msg</dt>
              <dd>{{ commitMessageLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Commit detail</dt>
              <dd>{{ commitDetailsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Batch applied</dt>
              <dd>{{ clientBatchAppliedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Batch warn</dt>
              <dd>{{ clientBatchWarningLabel }}</dd>
            </div>
          </dl>
        </div>

        <div class="server-grid__diagnostics-section">
          <h4>Server Fill Operation</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>commitFillOperation</dt>
              <dd>{{ commitFillOperationAvailableLabel }} / {{ commitFillOperationCalledLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>operationId</dt>
              <dd>{{ serverFillOperationIdLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Affected</dt>
              <dd>{{ serverFillAffectedRowsLabel }} rows, {{ serverFillAffectedRangeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Visible overlap</dt>
              <dd>{{ serverFillVisibleOverlapLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Request</dt>
              <dd>{{ serverFillRequestLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Mode</dt>
              <dd>{{ serverFillRequestModeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Fill cols</dt>
              <dd>{{ serverFillRequestFillColumnsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Refs</dt>
              <dd>{{ serverFillRequestReferenceColumnsLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Dispatch</dt>
              <dd>{{ serverFillDispatchAttemptedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Refresh viewport</dt>
              <dd>{{ serverFillRenderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Invalidated range</dt>
              <dd>{{ serverFillInvalidationRangeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Invalidated raw</dt>
              <dd>{{ serverFillRawInvalidationLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Invalidated norm</dt>
              <dd>{{ serverFillNormalizedInvalidationLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Invalidation applied</dt>
              <dd>{{ serverFillInvalidationAppliedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>typeof runtime.rowModel.invalidateRange</dt>
              <dd>{{ serverFillRuntimeRowModelInvalidateTypeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>invalidateRange called</dt>
              <dd>{{ serverFillInvalidateCalledLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>cache entry for row1 existed before invalidation</dt>
              <dd>{{ serverFillCacheRow1BeforeInvalidationLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>cache entry for row1 exists after invalidation</dt>
              <dd>{{ serverFillCacheRow1AfterInvalidationLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Sync input</dt>
              <dd>{{ serverFillSyncInputRangeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Latest rendered</dt>
              <dd>{{ serverFillLatestRenderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Runtime rendered</dt>
              <dd>{{ serverFillRuntimeRenderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>DisplayRows viewport</dt>
              <dd>{{ serverFillDisplayRowsRenderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Selected viewport</dt>
              <dd>{{ serverFillSelectedRenderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Used stored</dt>
              <dd>{{ serverFillRefreshUsedStoredRenderedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Stored rendered</dt>
              <dd>{{ centerPaneStoredRenderedViewportLabel }}</dd>
            </div>
          </dl>
        </div>

        <div class="server-grid__diagnostics-section">
          <h4>Sample / Render</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>Sample column</dt>
              <dd>{{ serverFillSampleColumnLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Sample state</dt>
              <dd>{{ serverFillSampleStateLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Rendered sample row</dt>
              <dd>{{ serverFillSampleRowLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Center pane debug</dt>
              <dd>
                <pre class="server-grid__diagnostics-json">{{ centerPaneDebugJsonLabel }}</pre>
              </dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>displayRowsRecomputeCount</dt>
              <dd>{{ displayRowsRecomputeCountLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>centerPaneRuntimeRevision</dt>
              <dd>{{ centerPaneRuntimeRevisionLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>centerPaneBodyRowsRevision</dt>
              <dd>{{ centerPaneBodyRowsRevisionLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>source bodyRows[1]</dt>
              <dd>{{ sourceBodyRow1Label }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>source bodyRows[1] identity</dt>
              <dd>{{ sourceBodyRow1IdentityLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>syncRows 0..23 row1</dt>
              <dd>{{ sourceSyncRow1Label }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>row1 cache status</dt>
              <dd>{{ serverFillRow1CacheStatusLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>row1 sync value</dt>
              <dd>{{ serverFillRow1SyncValueLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Before</dt>
              <dd>{{ serverFillSampleBeforeLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>After store</dt>
              <dd>{{ serverFillSampleAfterLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Cache</dt>
              <dd>{{ serverFillSamplePullAfterLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Cell reader</dt>
              <dd>{{ serverFillSampleCachedAfterLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Cell reader 2</dt>
              <dd>{{ serverFillSampleCellReaderLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Rendered</dt>
              <dd>{{ serverFillSampleRenderedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Row index</dt>
              <dd>{{ serverFillSampleRowIndexLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Visible index</dt>
              <dd>{{ serverFillSampleVisibleIndexLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Lookup idx/id</dt>
              <dd>{{ serverFillSampleLookupByIndexLabel }} / {{ serverFillSampleLookupByIdLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Row cache</dt>
              <dd>{{ serverFillSampleRowCacheLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Visible rows</dt>
              <dd>{{ serverFillVisibleRowsPreviewLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>RowModel snapshot</dt>
              <dd>{{ serverFillRowModelSnapshotLabel }}</dd>
            </div>
          </dl>
        </div>

        <div class="server-grid__diagnostics-section">
          <h4>Plumbing / Debug</h4>
          <dl class="server-grid__diagnostics-list">
            <div class="server-grid__diagnostics-card">
              <dt>Datasource keys</dt>
              <dd>{{ datasourceKeysLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Datasource detail</dt>
              <dd>{{ datasourceDetailLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Datasource fill</dt>
              <dd>{{ datasourceCommitFillOperationLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>RowModel keys</dt>
              <dd>{{ rowModelKeysLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>RowModel fill</dt>
              <dd>{{ rowModelCommitFillOperationLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Runtime snapshot</dt>
              <dd>{{ runtimeRowModelSnapshotLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Requested / rendered</dt>
              <dd>{{ runtimeViewportRangeLabel }} / {{ renderedViewportLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Runtime first 5</dt>
              <dd>{{ runtimeVisibleFirst5Label }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Runtime sample</dt>
              <dd>{{ runtimeSampleRow25VisibleIndexLabel }} / {{ runtimeSampleRow25RegionLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Runtime redraw</dt>
              <dd>{{ runtimeRedrawHappenedLabel }} / {{ runtimeRedrawReasonLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>RowModel keys</dt>
              <dd>{{ rowModelKeysLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Can undo/redo</dt>
              <dd>{{ canUndoLabel }} / {{ canRedoLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>History action</dt>
              <dd>{{ lastHistoryActionLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Edit history</dt>
              <dd>{{ lastEditRecordedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Last edit</dt>
              <dd>{{ lastEditLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Runtime redraw</dt>
              <dd>{{ runtimeRedrawHappenedLabel }} / {{ runtimeRedrawReasonLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Alive</dt>
              <dd>{{ runtimeDiagnosticsAliveLabel }} / {{ centerPaneAliveLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Mounted</dt>
              <dd>{{ centerPaneMountedLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Plumbing</dt>
              <dd>{{ plumbingLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Sort / Filter</dt>
              <dd>{{ sortModelLabel }} / {{ filterModelLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>In flight</dt>
              <dd>{{ diagnostics.inFlight ? "yes" : "no" }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Prefetch</dt>
              <dd>{{ diagnostics.prefetchStarted }} started / {{ diagnostics.prefetchCompleted }} completed</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Visible col[4]</dt>
              <dd>{{ serverFillVisibleColumnLabel }}</dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Datasource detail</dt>
              <dd>{{ datasourceDetailLabel }}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"
import {
  buildDataGridAdvancedFilterExpressionFromLegacyFilters,
  createDataSourceBackedRowModel,
  evaluateColumnPredicateFilter,
  evaluateDataGridAdvancedFilterExpression,
  serializeColumnValueToToken,
  type DataGridColumnHistogram,
  type DataGridColumnHistogramEntry,
  type DataGridDataSourceColumnHistogramRequest,
  type DataGridDataSource,
  type DataGridDataSourceRowEntry,
  type DataGridDataSourceInvalidation,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridDataSourcePushListener,
  type DataGridFilterSnapshot,
  type DataGridGroupExpansionSnapshot,
  type DataGridViewportRange,
  type DataGridSortState,
} from "@affino/datagrid-vue"
import { type DataGridAppColumnInput } from "@affino/datagrid-vue-app"
import { DataGrid } from "@affino/datagrid-vue-app"
import {
  createFakeServerDatasource,
} from "../serverDatasourceDemo/fakeServerDatasource"
import {
  applyServerDemoMutationInvalidation,
} from "../serverDatasourceDemo/serverDemoDatasourceHttpAdapter"
import {
  createServerDemoDatasourceHttpFillDataSource,
} from "../serverDatasourceDemo/serverDemoDatasourceHttpFillDataSource"
import {
  createAffinoDatasource,
} from "@affino/datagrid-server-adapters"
import {
  resolveServerDemoChangeFeedPollingIntervalMs,
} from "../serverDatasourceDemo/serverDemoChangeFeedPolling"
import {
  normalizeServerDemoHistoryState,
} from "../serverDatasourceDemo/serverDemoHistoryState"
import {
  type ServerDemoDatasourceHooks,
  type ServerDemoCommitEditsResult,
  type ServerDemoChangeFeedDiagnostics,
  normalizeServerDemoValueCellInput,
  type ServerDemoRow,
  SERVER_DEMO_ROW_COUNT as ROW_COUNT,
  SERVER_DEMO_PAGE_SIZE as PAGE_SIZE,
  SERVER_DEMO_LATENCY_MS as LATENCY_MS,
} from "../serverDatasourceDemo/types"
import type { DataGridTableStageHistoryAdapter } from "@affino/datagrid-vue-app"

const props = defineProps<{
  title: string
}>()

const gridKey = ref(0)
const gridRef = ref<{
  history: {
    canUndo: () => boolean
    canRedo: () => boolean
    runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  }
  restoreFocus?: () => void
} | null>(null)
const failureMode = ref(false)
const commitFailureMode = ref(false)
const lastViewportRange = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const committedOverrides = ref(new Map<string, Partial<ServerDemoRow>>())
const pendingOverrides = ref(new Map<string, Partial<ServerDemoRow>>())
const totalRows = ref(0)
const loadedRows = ref(0)
const pendingRequests = ref(0)
const loading = ref(true)
const error = ref<Error | null>(null)
const changeFeedDiagnostics = ref<ServerDemoChangeFeedDiagnostics>({
  currentDatasetVersion: null,
  lastSeenVersion: null,
  polling: false,
  pending: false,
  appliedChanges: 0,
  intervalMs: null,
})
const serverDatasourceUnavailableMessage = "Server datasource is unavailable. Check backend and retry."
const serverDatasourceUnavailable = ref(false)
const sortModelText = ref("none")
const filterModelText = ref("none")
const commitModeText = ref("ok")
const commitMessageText = ref("none")
const commitDetailsText = ref("none")
const serverHistoryCanUndo = ref(false)
const serverHistoryCanRedo = ref(false)
const serverHistoryLastOperationIdText = ref("none")
const serverHistoryLatestUndoOperationId = ref<string | null>(null)
const serverHistoryLatestRedoOperationId = ref<string | null>(null)
const serverHistoryAffectedRowsText = ref("0")
const serverHistoryAffectedCellsText = ref("0")
const clientBatchAppliedText = ref("no")
const clientBatchWarningText = ref("none")
const datasourceKeysText = ref("none")
const datasourceDetailText = ref("none")
const datasourceCommitFillOperationText = ref("unknown")
const rowModelCommitFillOperationText = ref("unknown")
const rowModelKeysText = ref("none")
const commitFillOperationAvailableText = ref("unknown")
const serverFillDispatchAttemptedText = ref("unknown")
const commitFillOperationCalledText = ref("unknown")
const serverFillOperationIdText = ref("none")
const serverFillAffectedRowsText = ref("0")
const serverFillAffectedRangeText = ref("none")
const serverFillVisibleOverlapText = ref("unknown")
const serverFillRequestText = ref("none")
const serverFillRequestModeText = ref("none")
const serverFillRequestFillColumnsText = ref("none")
const serverFillRequestReferenceColumnsText = ref("none")
const serverFillRenderedViewportText = ref("none")
const serverFillRawInvalidationText = ref("none")
const serverFillInvalidationRangeText = ref("none")
const serverFillNormalizedInvalidationText = ref("none")
const serverFillInvalidationAppliedText = ref("unknown")
const serverFillRuntimeRowModelInvalidateTypeText = ref("none")
const serverFillInvalidateCalledText = ref("unknown")
const serverFillCacheRow1BeforeInvalidationText = ref("unknown")
const serverFillCacheRow1AfterInvalidationText = ref("unknown")
const serverFillSyncInputRangeText = ref("none")
const serverFillLatestRenderedViewportText = ref("none")
const serverFillRuntimeRenderedViewportText = ref("none")
const serverFillDisplayRowsRenderedViewportText = ref("none")
const serverFillSelectedRenderedViewportText = ref("none")
const serverFillRefreshUsedStoredRenderedText = ref("unknown")
const centerPaneStoredRenderedViewportText = ref("none")
const serverFillSampleColumnText = ref("none")
const serverFillSampleStateText = ref("none")
const serverFillSampleRowText = ref("none")
const serverFillSampleBeforeText = ref("none")
const serverFillSampleAfterText = ref("none")
const serverFillSamplePullAfterText = ref("none")
const serverFillSampleCachedAfterText = ref("none")
const serverFillSampleRowIndexText = ref("none")
const serverFillSampleVisibleIndexText = ref("none")
const serverFillSampleLookupByIndexText = ref("none")
const serverFillSampleLookupByIdText = ref("none")
const serverFillSampleRowCacheText = ref("none")
const serverFillSampleCellReaderText = ref("none")
const serverFillSampleRenderedText = ref("none")
const serverFillRowModelSnapshotText = ref("none")
const serverFillVisibleRowsPreviewText = ref("none")
const runtimeViewportRangeText = ref("none")
const runtimeRowModelSnapshotText = ref("none")
const runtimeVisibleFirst5Text = ref("none")
const runtimeSampleRow25VisibleIndexText = ref("none")
const runtimeSampleRow25RegionText = ref("none")
const runtimeRedrawReasonText = ref("none")
const runtimeRedrawHappenedText = ref("unknown")
const runtimeDiagnosticsAliveText = ref("unknown")
const centerPaneAliveText = ref("unknown")
const centerPaneMountedText = ref("unknown")
const centerPaneDebugJsonText = ref("none")
const displayRowsRecomputeCountText = ref("none")
const centerPaneRuntimeRevisionText = ref("none")
const centerPaneBodyRowsRevisionText = ref("none")
const sourceBodyRow1Text = ref("none")
const sourceBodyRow1IdentityText = ref("none")
const sourceSyncRow1Text = ref("none")
const serverFillRow1CacheStatusText = ref("unknown")
const serverFillRow1SyncValueText = ref("none")
const serverFillVisibleColumnText = ref("unknown")
const lastEditText = ref("none")
const lastHistoryActionText = ref("none")
const lastEditRecordedText = ref("unknown")
const lastBatchRowsText = ref("0")
const lastSkippedRowsText = ref("0")
const fillWarningText = ref("none")
const fillBoundaryText = ref("none")
const fillBoundaryLeftText = ref("none")
const fillBoundaryRightText = ref("none")
const fillBlockedText = ref("no")
const fillAppliedText = ref("no")
const plumbingState = ref<Record<string, boolean>>({})
const branchState = ref("none")
const lastSelectionRange = ref<{ startRow: number; endRow: number } | null>(null)
const selectionRangeText = ref("none")
const selectionVirtualText = ref("no")
const selectionFullyLoadedText = ref("unknown")
const selectionMissingIntervalsText = ref("none")
const selectionProjectionStaleText = ref("no")
const selectionBlockedReasonText = ref("none")
const aggregationActive = ref(false)
const lastAggregationRequestText = ref("none")
const aggregateResponseRowsText = ref("0")
const aggregatePreviewRowsText = ref("none")
let rowModel: any = null

const segments = ["Core", "Growth", "Enterprise", "SMB"] as const
const statuses = ["Active", "Paused", "Closed"] as const
const regions = ["AMER", "EMEA", "APAC", "LATAM"] as const
const columnMenu = {
  enabled: true,
  valueFilterEnabled: true,
  valueFilterRowLimit: ROW_COUNT,
  maxFilterValues: 250,
} as const

type ServerDemoPullDiagnosticsState = {
  pendingRequests: number
  loading: boolean
  error: Error | null
  lastViewportRange: { start: number; end: number }
  totalRows: number
  loadedRows: number
}

function applyPullDiagnostics(state: ServerDemoPullDiagnosticsState): void {
  pendingRequests.value = state.pendingRequests
  loading.value = state.loading
  error.value = state.error
  lastViewportRange.value = state.lastViewportRange
  totalRows.value = state.totalRows
  loadedRows.value = state.loadedRows
}

function supportsHttpReadPath(request: Pick<DataGridDataSourcePullRequest, "groupBy" | "pivot" | "treeData">): boolean {
  return (
    request.groupBy === null
    && request.treeData === null
    && request.pivot?.pivotModel === null
    && request.pivot?.aggregationModel === null
  )
}

function hasComplexValueRangeFilter(filterModel: DataGridFilterSnapshot | null): boolean {
  if (!filterModel) {
    return false
  }

  const valueFilter = filterModel.advancedFilters?.value
  if (!valueFilter || !Array.isArray(valueFilter.clauses)) {
    return false
  }

  return valueFilter.clauses.filter(clause => clause != null).length > 1
}

function supportsHttpHistogramPath(
  request: Pick<DataGridDataSourceColumnHistogramRequest, "groupBy" | "pivot" | "treeData">,
): boolean {
  return (
    request.groupBy === null
    && request.treeData === null
    && request.pivot?.pivotModel === null
    && request.pivot?.aggregationModel === null
  )
}

function isHttpUnavailableError(caught: unknown): boolean {
  if (caught instanceof DOMException && caught.name === "AbortError") {
    return false
  }
  if (caught instanceof TypeError) {
    return true
  }
  if (!caught || typeof caught !== "object") {
    return false
  }
  const candidate = caught as { name?: unknown; message?: unknown }
  if (candidate.name === "TypeError") {
    return true
  }
  if (typeof candidate.message === "string") {
    const message = candidate.message.toLowerCase()
    return message.includes("failed to fetch") || message.includes("networkerror")
  }
  return false
}

function markHttpDatasourceUnavailable(): void {
  serverDatasourceUnavailable.value = true
  error.value = new Error(serverDatasourceUnavailableMessage)
}

function resetHttpDatasourceAvailability(): void {
  serverDatasourceUnavailable.value = false
  if (error.value?.message === serverDatasourceUnavailableMessage) {
    error.value = null
  }
}

const serverDatasource = createFakeServerDatasource({
  shouldSimulatePullFailure: () => failureMode.value,
  shouldRejectCommittedRow: rowId => {
    if (!commitFailureMode.value) {
      return false
    }
    const numeric = Number(String(rowId).replace(/^srv-/, ""))
    return Number.isFinite(numeric) && numeric % 2 === 0
  },
  onPullDiagnostics: applyPullDiagnostics,
  onAggregationDiagnostics(state): void {
    lastAggregationRequestText.value = state.lastAggregationRequest
    aggregateResponseRowsText.value = state.aggregateResponseRows
    aggregatePreviewRowsText.value = state.aggregatePreviewRows
  },
  onSampleDiagnostics(state): void {
    serverFillSampleColumnText.value = state.sampleColumn
    serverFillSampleStateText.value = state.sampleState
    serverFillSampleRowText.value = state.sampleRow
    serverFillSampleBeforeText.value = state.sampleBefore
    serverFillSampleAfterText.value = state.sampleAfter
    serverFillSamplePullAfterText.value = state.samplePullAfter
    serverFillSampleCachedAfterText.value = state.sampleCachedAfter
    serverFillSampleRowIndexText.value = state.sampleRowIndex
    serverFillSampleVisibleIndexText.value = state.sampleVisibleIndex
    serverFillSampleLookupByIndexText.value = state.sampleLookupByIndex
    serverFillSampleLookupByIdText.value = state.sampleLookupById
    serverFillSampleRowCacheText.value = state.sampleRowCache
    serverFillSampleCellReaderText.value = state.sampleCellReader
    serverFillSampleRenderedText.value = state.sampleRendered
    serverFillVisibleRowsPreviewText.value = state.visibleRowsPreview
    serverFillRowModelSnapshotText.value = state.rowModelSnapshot
    if (state.samplePullAfter !== "none") {
      scheduleRenderedSampleDiagnostics()
    }
  },
  onFillDiagnostics(state): void {
    fillWarningText.value = state.fillWarning
    fillBlockedText.value = state.fillBlocked
    fillAppliedText.value = state.fillApplied
    commitFillOperationCalledText.value = state.commitFillOperationCalled
    serverFillOperationIdText.value = state.operationId
    serverFillAffectedRowsText.value = state.affectedRows
    serverFillAffectedRangeText.value = state.affectedRange
    serverFillVisibleOverlapText.value = state.visibleOverlap
    serverFillRequestText.value = state.request
    serverFillRequestModeText.value = state.mode
    serverFillRequestFillColumnsText.value = state.fillColumns
    serverFillRequestReferenceColumnsText.value = state.referenceColumns
    serverFillDispatchAttemptedText.value = state.dispatchAttempted
    serverFillRenderedViewportText.value = state.renderedViewport
    serverFillRawInvalidationText.value = state.rawInvalidation
    serverFillInvalidationRangeText.value = state.invalidationRange
    serverFillNormalizedInvalidationText.value = state.normalizedInvalidation
    serverFillInvalidationAppliedText.value = state.invalidationApplied
    serverFillRuntimeRowModelInvalidateTypeText.value = state.runtimeRowModelInvalidateType
    serverFillInvalidateCalledText.value = state.invalidateCalled
    serverFillCacheRow1BeforeInvalidationText.value = state.cacheRow1BeforeInvalidation
    serverFillCacheRow1AfterInvalidationText.value = state.cacheRow1AfterInvalidation
    serverFillSyncInputRangeText.value = state.syncInputRange
    serverFillLatestRenderedViewportText.value = state.latestRenderedViewport
    serverFillRuntimeRenderedViewportText.value = state.runtimeRenderedViewport
    serverFillDisplayRowsRenderedViewportText.value = state.displayRowsRenderedViewport
    serverFillSelectedRenderedViewportText.value = state.selectedRenderedViewport
    serverFillRefreshUsedStoredRenderedText.value = state.refreshUsedStoredRendered
  },
  onCommitDiagnostics(state): void {
    commitModeText.value = state.commitMode
    commitMessageText.value = state.commitMessage
    commitDetailsText.value = state.commitDetails
    clientBatchAppliedText.value = state.clientBatchApplied
    clientBatchWarningText.value = state.clientBatchWarning
    lastBatchRowsText.value = state.lastBatchRows
    lastSkippedRowsText.value = state.lastSkippedRows
    updateFillDiagnostics(Number(state.lastBatchRows) || 0, state.clientBatchWarning !== "none" ? state.clientBatchWarning.split("; ") : [])
    if (state.commitMode === "failed" || state.clientBatchWarning !== "none") {
      void rowModel?.refresh("manual")
    }
  },
  onHistoryAction(value): void {
    lastHistoryActionText.value = value
  },
  reportFillPlumbingState(layer, present): void {
    reportFillPlumbingState(layer, present)
  },
  reportFillPlumbingDetail(layer, value): void {
    reportFillPlumbingDetail(layer, value)
  },
  captureFillBoundary(result): void {
    captureFillBoundary(result)
  },
  captureFillBoundarySide(side, result): void {
    captureFillBoundarySide(side, result)
  },
  scheduleRenderedSampleDiagnostics(): void {
    scheduleRenderedSampleDiagnostics()
  },
} satisfies ServerDemoDatasourceHooks)

type ServerDemoHistogramRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["getColumnHistogram"]>>[0]
type ServerDemoCommitEditsRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>[0]
type ServerDemoCommitFillRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitFillOperation"]>>[0]
type ServerDemoUndoFillRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["undoFillOperation"]>>[0]
type ServerDemoHttpDatasource = DataGridDataSource<ServerDemoRow> & {
  subscribeChangeFeedDiagnostics(listener: (diagnostics: ServerDemoChangeFeedDiagnostics) => void): () => void
  startChangeFeedPolling(options?: { intervalMs?: number }): void
  stopChangeFeedPolling(): void
  getChangeFeedDiagnostics(): ServerDemoChangeFeedDiagnostics
  applyRowSnapshots(rows: readonly ServerDemoRow[]): boolean
  getChangesSinceVersion(request: { sinceVersion: number; signal?: AbortSignal }): Promise<unknown>
}

function resolveRowId(index: number): string {
  return `srv-${index.toString().padStart(6, "0")}`
}

function normalizeViewportRange(range: unknown): DataGridViewportRange | null {
  if (!range || typeof range !== "object") {
    return null
  }
  const candidate = range as {
    startRow?: unknown
    endRow?: unknown
    start?: unknown
    end?: unknown
  }
  const start = Number.isFinite(candidate.startRow)
    ? Number(candidate.startRow)
    : Number.isFinite(candidate.start)
      ? Number(candidate.start)
      : NaN
  const end = Number.isFinite(candidate.endRow)
    ? Number(candidate.endRow)
    : Number.isFinite(candidate.end)
      ? Number(candidate.end)
      : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null
  }
  return {
    start: Math.max(0, Math.trunc(Math.min(start, end))),
    end: Math.max(0, Math.trunc(Math.max(start, end))),
  }
}

function formatViewportRange(range: DataGridViewportRange | null | undefined): string {
  if (!range) {
    return "none"
  }
  return `${range.start}..${range.end}`
}

function formatRowModelSnapshot(snapshot: {
  rowCount?: number
  loading?: boolean
  initialLoading?: boolean
  refreshing?: boolean
  viewportRange?: DataGridViewportRange
} | null | undefined): string {
  if (!snapshot) {
    return "none"
  }
  const viewport = snapshot.viewportRange
  return `rowCount=${snapshot.rowCount ?? 0} loading=${snapshot.loading ? "yes" : "no"} initialLoading=${snapshot.initialLoading ? "yes" : "no"} refreshing=${snapshot.refreshing ? "yes" : "no"} viewport=${viewport ? `${viewport.start}..${viewport.end}` : "none"}`
}

function parseSampleRowIndex(): number | null {
  const match = /^srv-(\d+)$/.exec(serverFillSampleRowText.value)
  if (!match) {
    return null
  }
  const parsed = Number.parseInt(match[1] ?? "", 10)
  return Number.isFinite(parsed) ? parsed : null
}

function readSampleColumnKey(): string | null {
  return serverFillSampleColumnText.value !== "none" && serverFillSampleColumnText.value.length > 0
    ? serverFillSampleColumnText.value
    : null
}

function resolveVisibleColumnIndex(columnKey: string): number {
  return columns.findIndex(column => String(column.key) === columnKey)
}

function updateRenderedSampleDiagnostics(): void {
  const debug = centerPaneDebugPayload.value
  const rowId = typeof debug?.row1?.id === "string" && debug.row1.id.length > 0 ? debug.row1.id : null
  const rowIndex = typeof debug?.row1?.summary?.index === "number" ? debug.row1.summary.index : null
  const columnKey = readSampleColumnKey()
  if (rowIndex == null || !Number.isFinite(rowIndex) || !columnKey || !rowId) {
    return
  }
  const renderedViewportStart = typeof debug?.renderedViewport?.start === "number"
    ? debug.renderedViewport.start
    : lastViewportRange.value.start
  const renderedViewportEnd = typeof debug?.renderedViewport?.end === "number"
    ? debug.renderedViewport.end
    : lastViewportRange.value.end
  const visibleIndex = Number.isFinite(renderedViewportStart)
    ? Math.max(0, rowIndex - renderedViewportStart)
    : rowIndex
  const visibleRowRange = Number.isFinite(renderedViewportStart) && Number.isFinite(renderedViewportEnd)
    ? { start: Math.max(0, renderedViewportStart), end: Math.max(Math.max(0, renderedViewportStart), renderedViewportEnd) }
    : { start: 0, end: 0 }
  serverFillSampleRowIndexText.value = String(rowIndex)
  serverFillSampleVisibleIndexText.value = String(visibleIndex)
  const snapshot = rowModel.getSnapshot()
  serverFillRowModelSnapshotText.value = formatRowModelSnapshot(snapshot)
  const visibleRows = rowModel.getRowsInRange(visibleRowRange)
  serverFillVisibleRowsPreviewText.value = visibleRows
    .slice(0, 5)
    .map((row: { rowId?: string | number; row: ServerDemoRow }) => `${String(row.rowId)}:${String(resolveColumnValue(row.row, columnKey))}`)
    .join(", ") || "none"
  const rowByIndex = Number.isFinite(visibleIndex) ? rowModel.getRow(visibleIndex) : null
  serverFillSampleLookupByIndexText.value = rowByIndex
    ? `${String(rowByIndex.rowId)}:${rowByIndex.kind !== "group" ? String(resolveColumnValue(rowByIndex.row as ServerDemoRow, columnKey)) : "group"}`
    : "missing"
  const rowById = visibleRows.find((row: { rowId?: string | number; row: ServerDemoRow }) => String(row.rowId) === rowId)
  serverFillSampleLookupByIdText.value = rowById
    ? `${String(rowById.rowId)}:${rowById.kind !== "group" ? String(resolveColumnValue(rowById.row as ServerDemoRow, columnKey)) : "group"}`
    : "missing"
  const cachedRow = rowByIndex ?? rowById
  const rowCacheValue = cachedRow && cachedRow.kind !== "group"
    ? resolveColumnValue(cachedRow.row as ServerDemoRow, columnKey)
    : undefined
  serverFillSampleRowCacheText.value = String(rowCacheValue ?? "missing")
  serverFillSampleCellReaderText.value = String(rowCacheValue ?? "missing")
  const columnIndex = resolveVisibleColumnIndex(columnKey)
  const cell = document.querySelector<HTMLElement>(
    columnIndex >= 0
      ? `.sandbox-server-data-source-grid .grid-cell[data-row-id="${rowId}"][data-column-index="${columnIndex}"]`
      : `.sandbox-server-data-source-grid .grid-cell[data-row-id="${rowId}"]`,
  )
  serverFillSampleRenderedText.value = cell?.textContent?.trim() || "not-rendered"
}

function scheduleRenderedSampleDiagnostics(): void {
  void nextTick(() => {
    for (const delay of [0, 50, 200, 500]) {
      window.setTimeout(() => {
        updateRenderedSampleDiagnostics()
      }, delay)
    }
  })
}

interface ServerDemoFillChange {
  rowId: string
  columnKey: string
  before: unknown
  after: unknown
}

interface ServerDemoFillOperationRecord {
  operationId: string
  revision: number
  sourceRange: DataGridViewportRange
  targetRange: DataGridViewportRange
  mode: "copy" | "series"
  changes: ServerDemoFillChange[]
  applied: boolean
}

function captureFillBoundary(result: {
  endRowIndex: number | null
  boundaryKind: string
  scannedRowCount?: number
  truncated?: boolean
} | null): void {
  fillBoundaryText.value = result
    ? `${result.boundaryKind} @ ${result.endRowIndex ?? "null"} (${result.scannedRowCount ?? 0} scanned${result.truncated ? ", truncated" : ""})`
    : "none"
}

function captureFillBoundarySide(side: "left" | "right", result: {
  endRowIndex: number | null
  endRowId?: string | number | null
  boundaryKind: string
  scannedRowCount?: number
  truncated?: boolean
} | null): void {
  const text = result
    ? `end=${result.endRowIndex ?? "null"} id=${result.endRowId ?? "null"} kind=${result.boundaryKind} scanned=${result.scannedRowCount ?? 0}${result.truncated ? " truncated" : ""}`
    : "null"
  if (side === "left") {
    fillBoundaryLeftText.value = text
  } else {
    fillBoundaryRightText.value = text
  }
}

function resolveBaseRow(index: number): ServerDemoRow {
  const segment = segments[index % segments.length]!
  const status = statuses[(index * 5) % statuses.length]!
  const region = regions[(index * 7) % regions.length]!
  const value = (index * 97) % 100_000
  const minute = String(index % 60).padStart(2, "0")
  return {
    id: resolveRowId(index),
    index,
    name: `Account ${index.toString().padStart(5, "0")}`,
    segment,
    status,
    region,
    value,
    updatedAt: `2026-04-30T12:${minute}:00.000Z`,
  }
}

function createRow(index: number): ServerDemoRow {
  const baseRow = resolveBaseRow(index)
  const committed = committedOverrides.value.get(baseRow.id)
  const pending = pendingOverrides.value.get(baseRow.id)
  return committed || pending ? { ...baseRow, ...committed, ...pending } : baseRow
}

const fillOperations = new Map<string, ServerDemoFillOperationRecord>()
let fillRevision = 0

function resolveColumnValue(row: ServerDemoRow, columnKey: string): unknown {
  return row[columnKey as keyof ServerDemoRow]
}

function applyOverride(rowId: string, columnKey: string, value: unknown): void {
  const next = { ...(committedOverrides.value.get(rowId) ?? {}) }
  next[columnKey as keyof ServerDemoRow] = value as never
  committedOverrides.value.set(rowId, next)
}

function clearOverride(rowId: string, columnKey: string): void {
  const existing = committedOverrides.value.get(rowId)
  if (!existing) {
    return
  }
  const next = { ...existing }
  delete next[columnKey as keyof ServerDemoRow]
  if (Object.keys(next).length === 0) {
    committedOverrides.value.delete(rowId)
    return
  }
  committedOverrides.value.set(rowId, next)
}

function buildSeriesValue(seed: unknown, offset: number): unknown {
  if (typeof seed === "number") {
    return seed + offset
  }
  const text = String(seed ?? "")
  const match = text.match(/^(.*?)(-?\d+)$/)
  if (!match) {
    return text
  }
  const prefix = match[1] ?? ""
  const value = Number(match[2] ?? "0")
  return `${prefix}${value + offset}`
}

function applyFillOperation(
  request: {
    operationId?: string | null
    sourceRange: DataGridViewportRange | { startRow?: number; endRow?: number; start?: number; end?: number }
    targetRange: DataGridViewportRange | { startRow?: number; endRow?: number; start?: number; end?: number }
    fillColumns: readonly string[]
    mode: "copy" | "series"
  },
): ServerDemoFillOperationRecord {
  const normalizedSourceRange = normalizeViewportRange(request.sourceRange)
  const normalizedTargetRange = normalizeViewportRange(request.targetRange)
  serverFillRequestText.value = `source=${JSON.stringify(request.sourceRange)} target=${JSON.stringify(request.targetRange)}`
  serverFillRequestModeText.value = request.mode
  serverFillRequestFillColumnsText.value = request.fillColumns.join(", ")
  serverFillRequestReferenceColumnsText.value = "n/a"
  serverFillAffectedRangeText.value = `raw=${JSON.stringify({ sourceRange: request.sourceRange, targetRange: request.targetRange })}`
  if (!normalizedSourceRange || !normalizedTargetRange || request.fillColumns.length === 0) {
    serverFillVisibleOverlapText.value = "unknown"
    serverFillSampleRowText.value = "invalid-range"
    serverFillSampleBeforeText.value = "none"
    serverFillSampleAfterText.value = "none"
    serverFillSamplePullAfterText.value = "none"
    serverFillSampleCachedAfterText.value = "none"
    serverFillSampleRowIndexText.value = "none"
    serverFillSampleLookupByIndexText.value = "none"
    serverFillSampleLookupByIdText.value = "none"
    serverFillSampleRowCacheText.value = "none"
    serverFillSampleCellReaderText.value = "none"
    serverFillSampleRenderedText.value = "none"
    throw new Error("invalid server fill range")
  }
  const operationId = request.operationId && request.operationId.trim().length > 0
    ? request.operationId
    : `fill-${++fillRevision}`
  const changes: ServerDemoFillChange[] = []
  const sourceHeight = Math.max(1, normalizedSourceRange.end - normalizedSourceRange.start + 1)
  const renderedViewportStart = typeof centerPaneDebugPayload.value?.renderedViewport?.start === "number"
    ? centerPaneDebugPayload.value.renderedViewport.start
    : lastViewportRange.value.start
  const renderedViewportEnd = typeof centerPaneDebugPayload.value?.renderedViewport?.end === "number"
    ? centerPaneDebugPayload.value.renderedViewport.end
    : lastViewportRange.value.end
  const sampleColumnKey = request.fillColumns[0] ?? "value"
  const targetVisibleRows = Array.from({ length: normalizedTargetRange.end - normalizedTargetRange.start + 1 }, (_unused, offset) => normalizedTargetRange.start + offset)
    .filter(rowIndex => rowIndex >= renderedViewportStart && rowIndex <= renderedViewportEnd && (rowIndex < normalizedSourceRange.start || rowIndex > normalizedSourceRange.end))
  const sampleRowIndex = targetVisibleRows.find(rowIndex => {
    const row = createRow(rowIndex)
    const before = resolveColumnValue(row, sampleColumnKey)
    const sourceRowIndex = normalizedSourceRange.start + ((rowIndex - normalizedTargetRange.start) % sourceHeight)
    const sourceValue = resolveColumnValue(createRow(sourceRowIndex), sampleColumnKey)
    return before !== sourceValue
  }) ?? targetVisibleRows[0] ?? null
  serverFillSampleColumnText.value = sampleColumnKey
  if (sampleRowIndex == null) {
    serverFillSampleStateText.value = "visible rows already match source value"
    serverFillSampleRowText.value = "none"
    serverFillSampleBeforeText.value = "none"
    serverFillSampleAfterText.value = "none"
    serverFillSamplePullAfterText.value = "none"
    serverFillSampleCachedAfterText.value = "none"
    serverFillSampleRowIndexText.value = "none"
    serverFillSampleLookupByIndexText.value = "none"
    serverFillSampleLookupByIdText.value = "none"
    serverFillSampleRowCacheText.value = "none"
    serverFillSampleCellReaderText.value = "none"
    serverFillSampleRenderedText.value = "none"
  } else {
    serverFillSampleStateText.value = "selected"
    serverFillSampleRowText.value = resolveRowId(sampleRowIndex)
    serverFillSampleRowIndexText.value = String(sampleRowIndex)
    serverFillSampleBeforeText.value = String(resolveColumnValue(createRow(sampleRowIndex), sampleColumnKey))
  }
  for (let rowIndex = normalizedTargetRange.start; rowIndex <= normalizedTargetRange.end; rowIndex += 1) {
    const sourceRowIndex = normalizedSourceRange.start + ((rowIndex - normalizedTargetRange.start) % sourceHeight)
    const sourceRow = createRow(sourceRowIndex)
    const targetRow = createRow(rowIndex)
    for (const columnKey of request.fillColumns) {
      const before = resolveColumnValue(targetRow, columnKey)
      const sourceValue = resolveColumnValue(sourceRow, columnKey)
      const after = request.mode === "series"
        ? buildSeriesValue(sourceValue, rowIndex - normalizedTargetRange.start)
        : sourceValue
      if (sampleRowIndex != null && rowIndex === sampleRowIndex && columnKey === sampleColumnKey) {
        serverFillSampleAfterText.value = String(after)
      }
      changes.push({
        rowId: targetRow.id,
        columnKey,
        before,
        after,
      })
      applyOverride(targetRow.id, columnKey, after)
    }
  }
  return {
    operationId,
    revision: ++fillRevision,
    sourceRange: normalizedSourceRange,
    targetRange: normalizedTargetRange,
    mode: request.mode,
    changes,
    applied: true,
  }
}

function toggleFillOperation(operationId: string, apply: boolean): ServerDemoFillOperationRecord | null {
  const record = fillOperations.get(operationId)
  if (!record) {
    return null
  }
  for (const change of record.changes) {
    if (apply) {
      applyOverride(change.rowId, change.columnKey, change.after)
    } else if (typeof change.before === "undefined") {
      clearOverride(change.rowId, change.columnKey)
    } else {
      applyOverride(change.rowId, change.columnKey, change.before)
    }
  }
  record.applied = apply
  record.revision = ++fillRevision
  return record
}

function compareSortValue(left: unknown, right: unknown, direction: "asc" | "desc"): number {
  const multiplier = direction === "desc" ? -1 : 1
  if (left === right) {
    return 0
  }
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 * multiplier : 1 * multiplier
  }
  return String(left).localeCompare(String(right)) * multiplier
}

function compareBySortModel(
  left: ServerDemoRow,
  right: ServerDemoRow,
  sortModel: readonly DataGridSortState[],
): number {
  for (const descriptor of sortModel) {
    const leftValue = left[descriptor.key as keyof ServerDemoRow]
    const rightValue = right[descriptor.key as keyof ServerDemoRow]
    const comparison = compareSortValue(leftValue, rightValue, descriptor.direction)
    if (comparison !== 0) {
      return comparison
    }
  }
  return left.index - right.index
}

function matchesColumnFilter(
  row: ServerDemoRow,
  columnKey: string,
  filterEntry: DataGridFilterSnapshot["columnFilters"][string],
): boolean {
  if (!filterEntry) {
    return true
  }
  const candidate = row[columnKey as keyof ServerDemoRow]
  if (Array.isArray(filterEntry)) {
    const normalizedCandidate = serializeColumnValueToToken(candidate).toLowerCase()
    return filterEntry.some(token => String(token ?? "").toLowerCase() === normalizedCandidate)
  }
  if (filterEntry.kind === "valueSet") {
    const normalizedCandidate = serializeColumnValueToToken(candidate).toLowerCase()
    return (filterEntry.tokens ?? []).some(token => String(token ?? "").toLowerCase() === normalizedCandidate)
  }
  if (filterEntry.kind === "predicate") {
    return evaluateColumnPredicateFilter(filterEntry, candidate)
  }
  return true
}

function matchesFilterModel(row: ServerDemoRow, filterModel: DataGridFilterSnapshot | null): boolean {
  if (!filterModel) {
    return true
  }
  for (const [columnKey, filterEntry] of Object.entries(filterModel.columnFilters ?? {})) {
    if (!matchesColumnFilter(row, columnKey, filterEntry)) {
      return false
    }
  }
  const expression = filterModel.advancedExpression
    ?? buildDataGridAdvancedFilterExpressionFromLegacyFilters(filterModel.advancedFilters)
  if (!expression) {
    return true
  }
  if (expression.kind === "condition") {
    const key = String(expression.key ?? expression.field ?? "")
    if (!key) {
      return false
    }
    const candidate = row[key as keyof ServerDemoRow]
    const candidateText = String(candidate ?? "").toLowerCase()
    const expectedText = String(expression.value ?? "").toLowerCase()
    const operator = String(expression.operator ?? "contains").toLowerCase()
    if (operator === "contains") {
      return candidateText.includes(expectedText)
    }
    if (operator === "notcontains" || operator === "not-contains") {
      return !candidateText.includes(expectedText)
    }
    if (operator === "equals") {
      return candidateText === expectedText
    }
    if (operator === "startswith" || operator === "starts-with") {
      return candidateText.startsWith(expectedText)
    }
    if (operator === "endswith" || operator === "ends-with") {
      return candidateText.endsWith(expectedText)
    }
    return evaluateColumnPredicateFilter({
      kind: "predicate",
      operator: expression.operator as never,
      value: expression.value,
      value2: expression.value2,
    }, candidate)
  }
  return evaluateDataGridAdvancedFilterExpression(expression, condition => {
    const key = String(condition.key ?? condition.field ?? "")
    if (!key) {
      return false
    }
    const value = row[key as keyof ServerDemoRow]
    return evaluateColumnPredicateFilter({
      kind: "predicate",
      operator: String(condition.operator ?? "contains") as never,
      value: condition.value,
      value2: condition.value2,
    }, value)
  })
}

function buildFilteredRows(filterModel: DataGridFilterSnapshot | null): readonly ServerDemoRow[] {
  const rows = Array.from({ length: ROW_COUNT }, (_unused, index) => createRow(index))
  if (!filterModel) {
    return rows
  }
  return rows.filter(row => matchesFilterModel(row, filterModel))
}

function buildProjectedRows(
  sortModel: readonly DataGridSortState[],
  filterModel: DataGridFilterSnapshot | null,
): readonly ServerDemoRow[] {
  const filteredRows = buildFilteredRows(filterModel)
  if (sortModel.length === 0) {
    return filteredRows
  }
  return [...filteredRows].sort((left, right) => compareBySortModel(left, right, sortModel))
}

function createRegionGroupKey(region: string): string {
  return `group:region:${region}`
}

function isGroupExpandedLocal(expansion: DataGridGroupExpansionSnapshot, groupKey: string): boolean {
  const toggled = new Set(expansion.toggledGroupKeys)
  return expansion.expandedByDefault ? !toggled.has(groupKey) : toggled.has(groupKey)
}

function createRegionGroupRow(
  region: string,
  childCount: number,
  index: number,
  expanded: boolean,
): DataGridDataSourceRowEntry<ServerDemoRow> {
  const groupKey = createRegionGroupKey(region)
  return {
    index,
    rowId: groupKey,
    kind: "group",
    state: {
      expanded,
    },
    groupMeta: {
      groupKey,
      groupField: "region",
      groupValue: region,
      level: 0,
      childrenCount: childCount,
    },
    row: {
      id: groupKey,
      index,
      name: `Region: ${region}`,
      segment: "Group",
      status: "Grouped",
      region,
      value: childCount,
      updatedAt: "grouped",
    },
  }
}

function buildRegionGroupedRows(
  rows: readonly ServerDemoRow[],
  expansion: DataGridGroupExpansionSnapshot,
): readonly DataGridDataSourceRowEntry<ServerDemoRow>[] {
  const buckets = new Map<string, ServerDemoRow[]>()
  for (const region of regions) {
    buckets.set(region, [])
  }
  for (const row of rows) {
    const bucket = buckets.get(row.region) ?? []
    bucket.push(row)
    buckets.set(row.region, bucket)
  }

  const groupedRows: DataGridDataSourceRowEntry<ServerDemoRow>[] = []
  for (const region of regions) {
    const children = buckets.get(region) ?? []
    if (children.length === 0) {
      continue
    }
    const groupKey = createRegionGroupKey(region)
    const expanded = isGroupExpandedLocal(expansion, groupKey)
    groupedRows.push(createRegionGroupRow(region, children.length, groupedRows.length, expanded))
    if (!expanded) {
      continue
    }
    for (const row of children) {
      groupedRows.push({
        index: groupedRows.length,
        row,
        rowId: row.id,
        kind: "leaf",
      })
    }
  }
  return groupedRows
}

function createRegionAggregateRow(
  region: string,
  childCount: number,
  valueSum: number,
  index: number,
): DataGridDataSourceRowEntry<ServerDemoRow> {
  const rowId = `aggregate:region:${region}`
  return {
    index,
    rowId,
    kind: "leaf",
    row: {
      id: rowId,
      index,
      name: `Aggregate: ${region}`,
      segment: "Aggregate",
      status: `Count ${childCount}`,
      region,
      value: valueSum,
      updatedAt: "aggregated",
    },
  }
}

function buildRegionAggregateRows(rows: readonly ServerDemoRow[]): readonly DataGridDataSourceRowEntry<ServerDemoRow>[] {
  const buckets = new Map<string, { count: number; valueSum: number }>()
  for (const region of regions) {
    buckets.set(region, { count: 0, valueSum: 0 })
  }
  for (const row of rows) {
    const bucket = buckets.get(row.region) ?? { count: 0, valueSum: 0 }
    bucket.count += 1
    bucket.valueSum += row.value ?? 0
    buckets.set(row.region, bucket)
  }
  const aggregateRows: DataGridDataSourceRowEntry<ServerDemoRow>[] = []
  for (const region of regions) {
    const bucket = buckets.get(region)
    if (!bucket || bucket.count === 0) {
      continue
    }
    aggregateRows.push(createRegionAggregateRow(region, bucket.count, bucket.valueSum, aggregateRows.length))
  }
  return aggregateRows
}

function isNonEmptyFillBoundaryValue(value: unknown): boolean {
  if (value == null) {
    return false
  }
  if (typeof value === "string") {
    return value.trim().length > 0
  }
  return true
}

function cloneFilterModelExcludingColumn(
  filterModel: DataGridFilterSnapshot | null,
  columnKey: string,
): DataGridFilterSnapshot | null {
  if (!filterModel) {
    return null
  }
  const normalizedKey = columnKey.trim()
  const columnFilters: NonNullable<DataGridFilterSnapshot["columnFilters"]> = {}
  for (const [key, entry] of Object.entries(filterModel.columnFilters ?? {})) {
    if (key.trim() !== normalizedKey) {
      columnFilters[key] = entry
    }
  }
  return {
    ...filterModel,
    columnFilters,
  }
}

function normalizeHistogramSearch(search: string | undefined): string {
  return String(search ?? "").trim().toLowerCase()
}

function resolveHistogramValue(row: ServerDemoRow, columnId: string): unknown {
  switch (columnId) {
    case "region":
      return row.region
    case "segment":
      return row.segment
    case "status":
      return row.status
    case "value":
      return row.value
    default:
      return row[columnId as keyof ServerDemoRow]
  }
}

function compareHistogramEntries(left: DataGridColumnHistogramEntry, right: DataGridColumnHistogramEntry): number {
  if (left.count !== right.count) {
    return right.count - left.count
  }
  return String(left.text ?? left.value ?? left.token).localeCompare(String(right.text ?? right.value ?? right.token), undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

function buildColumnHistogram(
  request: ServerDemoHistogramRequest,
): DataGridColumnHistogram {
  const rows = buildFilteredRows(
    request.options.ignoreSelfFilter === true
      ? cloneFilterModelExcludingColumn(request.filterModel, request.columnId)
      : request.filterModel,
  )
  const search = normalizeHistogramSearch(request.options.search)
  const histogram = new Map<string, DataGridColumnHistogramEntry>()
  for (const row of rows) {
    const value = resolveHistogramValue(row, request.columnId)
    if (value == null) {
      continue
    }
    const token = serializeColumnValueToToken(value)
    const existing = histogram.get(token)
    if (existing) {
      existing.count += 1
      continue
    }
    histogram.set(token, {
      token,
      value,
      text: String(value),
      count: 1,
    })
  }
  let entries = Array.from(histogram.values())
  if (search.length > 0) {
    entries = entries.filter(entry => {
      const text = String(entry.text ?? entry.value ?? entry.token).toLowerCase()
      return text.includes(search) || String(entry.token).toLowerCase().includes(search)
    })
  }
  if (request.options.orderBy === "valueAsc") {
    entries.sort((left, right) => String(left.text ?? left.value ?? left.token).localeCompare(String(right.text ?? right.value ?? right.token), undefined, {
      numeric: true,
      sensitivity: "base",
    }))
  } else {
    entries.sort(compareHistogramEntries)
  }
  const limit = Number.isFinite(request.options.limit)
    ? Math.max(0, Math.trunc(request.options.limit as number))
    : entries.length
  return entries.slice(0, limit)
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      window.clearTimeout(timeout)
      reject(new DOMException("Aborted", "AbortError"))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

const listeners = new Set<DataGridDataSourcePushListener<ServerDemoRow>>()

const legacyDataSource: DataGridDataSource<ServerDemoRow> = {
  async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<ServerDemoRow>> {
    pendingRequests.value += 1
    loading.value = true
    error.value = null
    lastViewportRange.value = request.range
    try {
      await wait(LATENCY_MS, request.signal)
      if (failureMode.value) {
        failureMode.value = false
        throw new Error("Simulated backend failure")
      }
      const filteredRows = buildFilteredRows(request.filterModel)
      const sortedRows = request.sortModel.length > 0
        ? [...filteredRows].sort((left, right) => compareBySortModel(left, right, request.sortModel))
        : filteredRows
      const start = Math.max(0, Math.trunc(request.range.start))
      const end = Math.max(start, Math.trunc(request.range.end))
      const limit = Math.max(1, Math.min(PAGE_SIZE, end - start + 1))
      const aggregationModel = request.pivot?.aggregationModel ?? null
      const aggregationColumns = aggregationModel?.columns ?? []
      const aggregatedByRegion = aggregationColumns.length > 0
      lastAggregationRequestText.value = aggregatedByRegion
        ? `${aggregationModel?.basis ?? "filtered"}:${aggregationColumns.map(column => `${column.key}:${column.op}`).join(",")}`
        : "none"
      const groupedByRegion = request.groupBy?.fields.includes("region") === true
      const projectedRows = aggregatedByRegion
        ? buildRegionAggregateRows(sortedRows)
        : groupedByRegion
          ? buildRegionGroupedRows(sortedRows, request.groupExpansion)
          : sortedRows.map((row, index): DataGridDataSourceRowEntry<ServerDemoRow> => ({
              index,
              row,
              rowId: row.id,
              kind: "leaf",
            }))
      if (aggregatedByRegion) {
        aggregateResponseRowsText.value = String(projectedRows.length)
        aggregatePreviewRowsText.value = projectedRows
          .slice(0, 4)
          .map(entry => {
            const row = entry.row
            return `${String(entry.rowId)} count=${row.status.replace(/^Count /, "")} sum=${row.value}`
          })
          .join("; ") || "none"
      } else {
        aggregateResponseRowsText.value = "0"
        aggregatePreviewRowsText.value = "none"
      }
      const rows = projectedRows.slice(start, start + limit)
      const sampleRowIndex = Number(String(serverFillSampleRowText.value).replace(/^srv-0*/, ""))
      const sampleRow = Number.isFinite(sampleRowIndex)
        ? rows.find(entry => entry.index === sampleRowIndex)
        : null
      if (sampleRow) {
        const sampleColumnKey = (serverFillSampleColumnText.value !== "none" ? serverFillSampleColumnText.value : serverFillRequestFillColumnsText.value.split(", ")[0] ?? "value") as string
        serverFillSamplePullAfterText.value = String(resolveColumnValue(sampleRow.row, sampleColumnKey))
        scheduleRenderedSampleDiagnostics()
      }
      totalRows.value = projectedRows.length
      loadedRows.value = Math.min(projectedRows.length, Math.max(loadedRows.value, end + 1))
      return {
        rows,
        total: projectedRows.length,
      }
    } catch (caught) {
      const candidate = caught as Error
      if (candidate?.name === "AbortError") {
        throw caught
      }
      error.value = candidate instanceof Error ? candidate : new Error(String(caught))
      throw error.value
    } finally {
      pendingRequests.value = Math.max(0, pendingRequests.value - 1)
      loading.value = pendingRequests.value > 0
    }
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  invalidate(invalidation: DataGridDataSourceInvalidation) {
    if (invalidation.reason === "model-range" || invalidation.reason === "model-all") {
      return
    }
    for (const listener of listeners) {
      listener({ type: "invalidate", invalidation })
    }
  },
  async getColumnHistogram(request: ServerDemoHistogramRequest): Promise<DataGridColumnHistogram> {
    return buildColumnHistogram(request)
  },
  async resolveFillBoundary(request) {
    const projectedRows = buildProjectedRows(request.projection.sortModel, request.projection.filterModel)
    fillBlockedText.value = "no"
    const baseRange = request.baseRange as unknown as { start?: number; end?: number; startRow?: number; endRow?: number }
    const rawEndRow = baseRange.endRow ?? baseRange.end ?? 0
    const baseEndRow = Math.max(0, Math.trunc(rawEndRow))
    const startIndex = Math.max(0, Math.trunc(baseEndRow + 1))
    const limit = Number.isFinite(request.limit)
      ? Math.max(0, Math.trunc(request.limit ?? 0))
      : projectedRows.length
    if (startIndex >= projectedRows.length) {
      const result: {
        endRowIndex: number | null
        endRowId: string | null
        boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
        scannedRowCount: number
        truncated: boolean
      } = {
        endRowIndex: projectedRows.length > 0 ? projectedRows.length - 1 : null,
        endRowId: projectedRows[projectedRows.length - 1]?.id ?? null,
        boundaryKind: "data-end",
        scannedRowCount: 0,
        truncated: false,
      }
      captureFillBoundary(result)
      captureFillBoundarySide(request.direction === "left" ? "left" : "right", result)
      return result
    }
    let endRowIndex = baseEndRow
    let boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved" = "data-end"
    let scanned = 0
    for (let projectedIndex = startIndex; projectedIndex < projectedRows.length; projectedIndex += 1) {
      if (scanned >= limit) {
        boundaryKind = "cache-boundary"
        break
      }
      const row = projectedRows[projectedIndex]
      if (!row) {
        boundaryKind = "unresolved"
        break
      }
      scanned += 1
      const hasAdjacentData = request.referenceColumns.some(columnKey => {
        const candidate = row[columnKey as keyof ServerDemoRow]
        return isNonEmptyFillBoundaryValue(candidate)
      })
      if (!hasAdjacentData) {
        boundaryKind = projectedIndex >= projectedRows.length - 1 ? "data-end" : "gap"
        break
      }
      endRowIndex = projectedIndex
    }
    const endRowId = endRowIndex >= 0 ? projectedRows[endRowIndex]?.id ?? null : null
    const result: {
      endRowIndex: number | null
      endRowId: string | null
      boundaryKind: "data-end" | "gap" | "cache-boundary" | "projection-end" | "unresolved"
      scannedRowCount: number
      truncated: boolean
    } = {
      endRowIndex: endRowIndex >= 0 ? endRowIndex : null,
      endRowId,
      boundaryKind,
      scannedRowCount: scanned,
      truncated: boundaryKind === "cache-boundary",
    }
    captureFillBoundary(result)
    captureFillBoundarySide(request.direction === "left" ? "left" : "right", result)
    return result
  },
  async commitEdits(request: ServerDemoCommitEditsRequest) {
    return applyCommitEdits(request)
  },
  async commitFillOperation(request: ServerDemoCommitFillRequest) {
    let record: ServerDemoFillOperationRecord
    try {
      record = applyFillOperation({
        operationId: request.operationId,
        sourceRange: request.sourceRange as unknown as DataGridViewportRange,
        targetRange: request.targetRange as unknown as DataGridViewportRange,
        fillColumns: request.fillColumns,
        mode: request.mode,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      fillWarningText.value = `server fill rejected: ${message}`
      fillBlockedText.value = "yes"
      fillAppliedText.value = "no"
      commitFillOperationCalledText.value = "yes"
      serverFillOperationIdText.value = request.operationId ?? "none"
      serverFillAffectedRowsText.value = "0"
      serverFillSampleAfterText.value = "none"
      serverFillSamplePullAfterText.value = "none"
      serverFillSampleCachedAfterText.value = "none"
      return {
        operationId: request.operationId ?? `fill-${++fillRevision}`,
        revision: fillRevision,
        affectedRowCount: 0,
        affectedCellCount: 0,
        invalidation: null,
        warnings: [message],
      }
    }
    const mutatedCount = record.changes.filter(change => change.before !== change.after).length
    if (mutatedCount === 0) {
      fillWarningText.value = "server fill no-op"
      fillBlockedText.value = "no"
      fillAppliedText.value = "server"
      commitFillOperationCalledText.value = "yes"
      serverFillOperationIdText.value = record.operationId
      serverFillAffectedRowsText.value = "0"
      serverFillAffectedRangeText.value = `normalized=${formatViewportRange(record.targetRange)}`
      return {
        operationId: record.operationId,
        revision: record.revision,
        affectedRowCount: 0,
        affectedCellCount: 0,
        invalidation: null,
        warnings: ["server fill no-op"],
      }
    }
    fillOperations.set(record.operationId, record)
    fillWarningText.value = "none"
    fillBlockedText.value = "no"
    fillAppliedText.value = "yes"
    commitFillOperationCalledText.value = "yes"
    serverFillOperationIdText.value = record.operationId
    serverFillAffectedRowsText.value = String(mutatedCount)
    const sampleRowId = serverFillSampleRowText.value
    const sampleColumnKey = readSampleColumnKey()
    const sampleChange = record.changes.find(change => (
      change.rowId === sampleRowId && change.columnKey === sampleColumnKey
    )) ?? null
    if (sampleChange) {
      serverFillSampleAfterText.value = String(sampleChange.after)
      const sampleRowIndex = parseSampleRowIndex() ?? record.targetRange.start
      serverFillSamplePullAfterText.value = String(resolveColumnValue(createRow(sampleRowIndex), sampleChange.columnKey))
      serverFillSampleCachedAfterText.value = serverFillSamplePullAfterText.value
    }
    lastHistoryActionText.value = "server-commit"
    return {
      operationId: record.operationId,
      revision: record.revision,
      affectedRowCount: mutatedCount,
      affectedCellCount: mutatedCount,
      invalidation: { kind: "range", range: record.targetRange, reason: "server-fill" },
      undoToken: record.operationId,
      redoToken: record.operationId,
      warnings: [],
    }
  },
  async undoFillOperation(request: ServerDemoUndoFillRequest) {
    const record = toggleFillOperation(request.operationId, false)
    if (!record) {
      return { operationId: request.operationId, revision: fillRevision, warnings: ["missing-operation"] }
    }
    lastHistoryActionText.value = "server-undo"
    return {
      operationId: record.operationId,
      revision: record.revision,
      invalidation: { kind: "range", range: record.targetRange, reason: "server-fill-undo" },
      warnings: [],
    }
  },
  async redoFillOperation(request: ServerDemoUndoFillRequest) {
    const record = toggleFillOperation(request.operationId, true)
    if (!record) {
      return { operationId: request.operationId, revision: fillRevision, warnings: ["missing-operation"] }
    }
    lastHistoryActionText.value = "server-redo"
    return {
      operationId: record.operationId,
      revision: record.revision,
      invalidation: { kind: "range", range: record.targetRange, reason: "server-fill-redo" },
      warnings: [],
    }
  },
}

const serverDemoHttpDatasourceEnabled = import.meta.env.VITE_SERVER_DEMO_HTTP_DATA_SOURCE === "true"
const serverDemoHttpDatasourceBaseUrl = import.meta.env.VITE_SERVER_DEMO_API_BASE_URL?.trim()
const serverDemoHttpDatasource: ServerDemoHttpDatasource | null = serverDemoHttpDatasourceEnabled && serverDemoHttpDatasourceBaseUrl
  ? createAffinoDatasource<ServerDemoRow>({
      baseUrl: serverDemoHttpDatasourceBaseUrl,
      tableId: "server-demo",
    }) as ServerDemoHttpDatasource
  : null
const httpDatasource = serverDemoHttpDatasource
let unsubscribeChangeFeedDiagnostics: (() => void) | null = null
if (httpDatasource) {
  unsubscribeChangeFeedDiagnostics = httpDatasource.subscribeChangeFeedDiagnostics(diagnosticsState => {
    changeFeedDiagnostics.value = diagnosticsState
  })
}
const serverDemoChangeFeedPollingEnabled = serverDemoHttpDatasourceEnabled
const serverDemoChangeFeedPollingIntervalMs = resolveServerDemoChangeFeedPollingIntervalMs(
  import.meta.env.VITE_SERVER_DEMO_CHANGE_FEED_POLL_INTERVAL_MS,
)

void legacyDataSource

const dataSource: DataGridDataSource<ServerDemoRow> = serverDemoHttpDatasourceEnabled && serverDemoHttpDatasource
  ? {
    ...createServerDemoDatasourceHttpFillDataSource({
      enabled: true,
      fallbackDataSource: serverDatasource.dataSource,
      httpDatasource: serverDemoHttpDatasource,
      refreshHistoryStatus: () => refreshHistoryStatus(),
      applyInvalidation: serverDemoChangeFeedPollingEnabled
        ? undefined
        : invalidation => applyServerDemoMutationInvalidation(rowModel, invalidation),
      applyRowSnapshots: rows => {
        serverDemoHttpDatasource.applyRowSnapshots(rows)
      },
    }),
      async pull(request: DataGridDataSourcePullRequest): Promise<DataGridDataSourcePullResult<ServerDemoRow>> {
        if (serverDatasourceUnavailable.value) {
          error.value = new Error(serverDatasourceUnavailableMessage)
          return {
            rows: [],
            total: 0,
            cursor: null,
          }
        }
        if (!failureMode.value && supportsHttpReadPath(request) && !hasComplexValueRangeFilter(request.filterModel)) {
          pendingRequests.value += 1
          loading.value = true
          error.value = null
          lastViewportRange.value = request.range
          try {
            const response = await httpDatasource!.pull(request)
            totalRows.value = response.total ?? response.rows.length
            loadedRows.value = Math.min(totalRows.value, Math.max(loadedRows.value, Math.trunc(request.range.end) + 1))
            return response
          } catch (caught) {
            if (caught instanceof Error && caught.name === "AbortError") {
              throw caught
            }
            if (isHttpUnavailableError(caught)) {
              markHttpDatasourceUnavailable()
              totalRows.value = 0
              loadedRows.value = 0
              return {
                rows: [],
                total: 0,
                cursor: null,
              }
            }
            error.value = caught instanceof Error ? caught : new Error(String(caught))
            throw error.value
          } finally {
            pendingRequests.value = Math.max(0, pendingRequests.value - 1)
            loading.value = pendingRequests.value > 0
          }
        }
        return serverDatasource.dataSource.pull(request)
      },
      async getColumnHistogram(request: DataGridDataSourceColumnHistogramRequest): Promise<DataGridColumnHistogram> {
        if (serverDatasourceUnavailable.value) {
          error.value = new Error(serverDatasourceUnavailableMessage)
          return []
        }
        if (supportsHttpHistogramPath(request)) {
          const histogram = httpDatasource?.getColumnHistogram
          if (typeof histogram === "function") {
            try {
              return await histogram(request)
            } catch (caught) {
              if (isHttpUnavailableError(caught)) {
                markHttpDatasourceUnavailable()
                return []
              }
              throw caught
            }
          }
        }
        return serverDatasource.dataSource.getColumnHistogram!(request)
      },
      async commitEdits(request: ServerDemoCommitEditsRequest): Promise<ServerDemoCommitEditsResult> {
        if (serverDatasourceUnavailable.value) {
          const unavailableError = new Error(serverDatasourceUnavailableMessage)
          error.value = unavailableError
          throw unavailableError
        }
        const commitEdits = httpDatasource?.commitEdits
        if (typeof commitEdits !== "function") {
          const unsupportedError = new Error("Server demo HTTP adapter does not implement commitEdits")
          error.value = unsupportedError
          throw unsupportedError
        }
        try {
          const result = await commitEdits(request) as ServerDemoCommitEditsResult & {
            operationId?: string | null
            canUndo?: boolean
            canRedo?: boolean
            latestUndoOperationId?: string | null
            latestRedoOperationId?: string | null
            affectedRows?: number
            affectedCells?: number
            datasetVersion?: number | null
            serverInvalidation?: Parameters<typeof applyServerDemoMutationInvalidation>[1]
          }
          const snapshotsApplied = await applyServerDemoRowSnapshots(result.rows)
          if (!snapshotsApplied && result.serverInvalidation) {
            applyServerDemoMutationInvalidation(rowModel, result.serverInvalidation)
          } else if (!snapshotsApplied) {
            await rowModel.refresh("manual")
          }
          const affectedRowCount = new Set(result.committed?.map(entry => entry.rowId) ?? []).size
          const historyApplied = applyCommitHistoryDiagnostics(
            result,
            affectedRowCount,
            result.committed?.length ?? 0,
          )
          invalidateHistoryStatusRefreshes()
          if (!historyApplied) {
            syncHistoryDiagnostics({
              operationId: result.operationId ?? null,
              canUndo: true,
              canRedo: false,
              affectedRows: affectedRowCount,
              affectedCells: result.committed?.length ?? 0,
              latestUndoOperationId: result.latestUndoOperationId ?? null,
              latestRedoOperationId: result.latestRedoOperationId ?? null,
              action: "commit",
            })
            void refreshHistoryStatus()
          }
          return result
        } catch (caught) {
          if (caught instanceof Error && caught.name === "AbortError") {
            throw caught
          }
          if (isHttpUnavailableError(caught)) {
            markHttpDatasourceUnavailable()
          } else {
            error.value = caught instanceof Error ? caught : new Error(String(caught))
          }
          throw caught
        }
      },
      subscribe(listener: DataGridDataSourcePushListener<ServerDemoRow>): () => void {
        const httpSubscribe = httpDatasource?.subscribe
        if (typeof httpSubscribe === "function") {
          return httpSubscribe(listener)
        }
        return () => {}
      },
      invalidate(_invalidation: DataGridDataSourceInvalidation): void {
        // HTTP invalidations are source-of-truth signals from the backend. Do not echo them
        // into the fake datasource, or the row model will receive the same invalidation again.
      },
    }
  : serverDatasource.dataSource

rowModel = createDataSourceBackedRowModel<ServerDemoRow>({
  dataSource,
  initialTotal: ROW_COUNT,
  rowCacheLimit: 8_000,
  prefetch: {
    enabled: true,
    triggerViewportFactor: 0.8,
    windowViewportFactor: 3,
    minBatchSize: 150,
    maxBatchSize: 600,
    directionalBias: "scroll-direction",
  },
  resolveRowId: row => row.id,
})

const unsubscribeSampleDiagnostics = rowModel.subscribe(() => {
  diagnostics.value = rowModel.getBackpressureDiagnostics()
  scheduleRenderedSampleDiagnostics()
})

datasourceKeysText.value = Object.keys(dataSource).sort().join(", ")
rowModelKeysText.value = Object.keys((rowModel as typeof rowModel & { dataSource?: Record<string, unknown> }).dataSource ?? {}).sort().join(", ")
datasourceCommitFillOperationText.value = typeof dataSource.commitFillOperation === "function" ? "yes" : "no"
rowModelCommitFillOperationText.value = typeof (rowModel as typeof rowModel & { dataSource?: { commitFillOperation?: unknown } }).dataSource?.commitFillOperation === "function" ? "yes" : "no"
datasourceDetailText.value = serverDemoHttpDatasourceEnabled
  ? `http read path${serverDemoHttpDatasourceBaseUrl ? ` @ ${serverDemoHttpDatasourceBaseUrl}` : ""} + fake writes`
  : "fake datasource"

const safeEditableColumns = new Set(["name", "segment", "status", "region", "value"])

const columns = [
  { key: "id", label: "Row ID", minWidth: 120, flex: 1, capabilities: { sortable: true } },
  { key: "name", label: "Account", minWidth: 180, flex: 1.2, capabilities: { sortable: true, editable: true } },
  { key: "segment", label: "Segment", minWidth: 120, flex: 0.9, capabilities: { sortable: true, editable: true } },
  { key: "status", label: "Status", minWidth: 120, flex: 0.8, capabilities: { sortable: true, editable: true } },
  { key: "region", label: "Region", minWidth: 100, flex: 0.8, capabilities: { sortable: true, editable: true } },
  { key: "value", label: "Value", minWidth: 110, flex: 0.8, capabilities: { sortable: true, editable: true } },
  { key: "updatedAt", label: "Updated", minWidth: 180, flex: 1.1, capabilities: { sortable: true } },
] satisfies readonly DataGridAppColumnInput<ServerDemoRow>[]
serverFillVisibleColumnText.value = String(columns[4]?.key ?? "missing")

const diagnostics = ref(rowModel.getBackpressureDiagnostics())
const sortModelLabel = computed(() => {
  return sortModelText.value
})
const filterModelLabel = computed(() => {
  return filterModelText.value
})
const aggregationActiveLabel = computed(() => aggregationActive.value ? "yes" : "no")
const lastAggregationRequestLabel = computed(() => lastAggregationRequestText.value)
const aggregateResponseRowsLabel = computed(() => aggregateResponseRowsText.value)
const aggregatePreviewRowsLabel = computed(() => aggregatePreviewRowsText.value)
const editedRowsLabel = computed(() => String(serverDatasource.getEditedRowCount()))
const lastEditLabel = computed(() => lastEditText.value)
const rowCacheLabel = computed(() => `${diagnostics.value.rowCacheSize} / ${diagnostics.value.rowCacheLimit}`)
const commitModeLabel = computed(() => commitModeText.value)
const commitMessageLabel = computed(() => commitMessageText.value)
const commitDetailsLabel = computed(() => commitDetailsText.value)
const clientBatchAppliedLabel = computed(() => clientBatchAppliedText.value)
const clientBatchWarningLabel = computed(() => clientBatchWarningText.value)
const datasourceKeysLabel = computed(() => datasourceKeysText.value)
const datasourceDetailLabel = computed(() => datasourceDetailText.value)
const datasourceCommitFillOperationLabel = computed(() => datasourceCommitFillOperationText.value)
const rowModelCommitFillOperationLabel = computed(() => rowModelCommitFillOperationText.value)
const rowModelKeysLabel = computed(() => rowModelKeysText.value)
const lastBatchRowsLabel = computed(() => lastBatchRowsText.value)
const lastSkippedRowsLabel = computed(() => lastSkippedRowsText.value)
const fillWarningLabel = computed(() => fillWarningText.value)
const selectionRangeLabel = computed(() => selectionRangeText.value)
const selectionVirtualLabel = computed(() => selectionVirtualText.value)
const selectionFullyLoadedLabel = computed(() => selectionFullyLoadedText.value)
const selectionMissingIntervalsLabel = computed(() => selectionMissingIntervalsText.value)
const selectionProjectionStaleLabel = computed(() => selectionProjectionStaleText.value)
const selectionBlockedReasonLabel = computed(() => selectionBlockedReasonText.value)
const fillBoundaryLabel = computed(() => fillBoundaryText.value)
const fillBoundaryLeftLabel = computed(() => fillBoundaryLeftText.value)
const fillBoundaryRightLabel = computed(() => fillBoundaryRightText.value)
const fillBlockedLabel = computed(() => fillBlockedText.value)
const fillAppliedLabel = computed(() => fillAppliedText.value)
const commitFillOperationAvailableLabel = computed(() => commitFillOperationAvailableText.value)
const serverFillDispatchAttemptedLabel = computed(() => serverFillDispatchAttemptedText.value)
const commitFillOperationCalledLabel = computed(() => commitFillOperationCalledText.value)
const serverFillOperationIdLabel = computed(() => serverFillOperationIdText.value)
const serverFillAffectedRowsLabel = computed(() => serverFillAffectedRowsText.value)
const serverFillAffectedRangeLabel = computed(() => serverFillAffectedRangeText.value)
const serverFillVisibleOverlapLabel = computed(() => serverFillVisibleOverlapText.value)
const serverFillRequestLabel = computed(() => serverFillRequestText.value)
const serverFillRequestModeLabel = computed(() => serverFillRequestModeText.value)
const serverFillRequestFillColumnsLabel = computed(() => serverFillRequestFillColumnsText.value)
const serverFillRequestReferenceColumnsLabel = computed(() => serverFillRequestReferenceColumnsText.value)
const serverFillRenderedViewportLabel = computed(() => serverFillRenderedViewportText.value)
const serverFillRawInvalidationLabel = computed(() => serverFillRawInvalidationText.value)
const serverFillInvalidationRangeLabel = computed(() => serverFillInvalidationRangeText.value)
const serverFillNormalizedInvalidationLabel = computed(() => serverFillNormalizedInvalidationText.value)
const serverFillInvalidationAppliedLabel = computed(() => serverFillInvalidationAppliedText.value)
const serverFillRuntimeRowModelInvalidateTypeLabel = computed(() => serverFillRuntimeRowModelInvalidateTypeText.value)
const serverFillInvalidateCalledLabel = computed(() => serverFillInvalidateCalledText.value)
const serverFillCacheRow1BeforeInvalidationLabel = computed(() => serverFillCacheRow1BeforeInvalidationText.value)
const serverFillCacheRow1AfterInvalidationLabel = computed(() => serverFillCacheRow1AfterInvalidationText.value)
const serverFillSyncInputRangeLabel = computed(() => serverFillSyncInputRangeText.value)
const serverFillLatestRenderedViewportLabel = computed(() => serverFillLatestRenderedViewportText.value)
const serverFillRuntimeRenderedViewportLabel = computed(() => serverFillRuntimeRenderedViewportText.value)
const serverFillDisplayRowsRenderedViewportLabel = computed(() => serverFillDisplayRowsRenderedViewportText.value)
const serverFillSelectedRenderedViewportLabel = computed(() => serverFillSelectedRenderedViewportText.value)
const serverFillRefreshUsedStoredRenderedLabel = computed(() => serverFillRefreshUsedStoredRenderedText.value)
const centerPaneStoredRenderedViewportLabel = computed(() => centerPaneStoredRenderedViewportText.value)
const serverFillSampleColumnLabel = computed(() => serverFillSampleColumnText.value)
const serverFillSampleStateLabel = computed(() => serverFillSampleStateText.value)
const serverFillSampleRowLabel = computed(() => serverFillSampleRowText.value)
const serverFillSampleBeforeLabel = computed(() => serverFillSampleBeforeText.value)
const serverFillSampleAfterLabel = computed(() => serverFillSampleAfterText.value)
const serverFillSamplePullAfterLabel = computed(() => serverFillSamplePullAfterText.value)
const serverFillSampleCachedAfterLabel = computed(() => serverFillSampleCachedAfterText.value)
const serverFillSampleRowIndexLabel = computed(() => serverFillSampleRowIndexText.value)
const serverFillSampleVisibleIndexLabel = computed(() => serverFillSampleVisibleIndexText.value)
const serverFillSampleLookupByIndexLabel = computed(() => serverFillSampleLookupByIndexText.value)
const serverFillSampleLookupByIdLabel = computed(() => serverFillSampleLookupByIdText.value)
const serverFillSampleRowCacheLabel = computed(() => serverFillSampleRowCacheText.value)
const serverFillSampleCellReaderLabel = computed(() => serverFillSampleCellReaderText.value)
const serverFillSampleRenderedLabel = computed(() => serverFillSampleRenderedText.value)
const serverFillRowModelSnapshotLabel = computed(() => serverFillRowModelSnapshotText.value)
const serverFillVisibleRowsPreviewLabel = computed(() => serverFillVisibleRowsPreviewText.value)
const runtimeViewportRangeLabel = computed(() => runtimeViewportRangeText.value)
const runtimeRowModelSnapshotLabel = computed(() => runtimeRowModelSnapshotText.value)
const runtimeVisibleFirst5Label = computed(() => runtimeVisibleFirst5Text.value)
const runtimeSampleRow25VisibleIndexLabel = computed(() => runtimeSampleRow25VisibleIndexText.value)
const runtimeSampleRow25RegionLabel = computed(() => runtimeSampleRow25RegionText.value)
const runtimeRedrawReasonLabel = computed(() => runtimeRedrawReasonText.value)
const runtimeRedrawHappenedLabel = computed(() => runtimeRedrawHappenedText.value)
const runtimeDiagnosticsAliveLabel = computed(() => runtimeDiagnosticsAliveText.value)
const centerPaneAliveLabel = computed(() => centerPaneAliveText.value)
const centerPaneMountedLabel = computed(() => centerPaneMountedText.value)
const centerPaneDebugJsonLabel = computed(() => centerPaneDebugJsonText.value)
const displayRowsRecomputeCountLabel = computed(() => displayRowsRecomputeCountText.value)
const centerPaneRuntimeRevisionLabel = computed(() => centerPaneRuntimeRevisionText.value)
const centerPaneBodyRowsRevisionLabel = computed(() => centerPaneBodyRowsRevisionText.value)
const sourceBodyRow1Label = computed(() => sourceBodyRow1Text.value)
const sourceBodyRow1IdentityLabel = computed(() => sourceBodyRow1IdentityText.value)
const sourceSyncRow1Label = computed(() => sourceSyncRow1Text.value)
const serverFillRow1CacheStatusLabel = computed(() => serverFillRow1CacheStatusText.value)
const serverFillRow1SyncValueLabel = computed(() => serverFillRow1SyncValueText.value)
type CenterPaneDebugJson = {
  rowsLength?: number
  renderedViewport?: { start?: number | null; end?: number | null }
  displayRowsRecomputeCount?: number
  centerPaneRuntimeRevision?: string | number | null
  centerPaneBodyRowsRevision?: string | number | null
  firstFive?: readonly unknown[]
  row1?: {
    exists?: boolean
    id?: string | null
    keys?: readonly unknown[]
    summary?: {
      index?: number | null
      kind?: string | null
      dataKeys?: readonly string[]
      dataRegion?: string | null
      rowRegion?: string | null
    } | null
    regionCandidates?: unknown
  }
  sampleRenderedValue?: string | null
}

const centerPaneDebugPayload = computed<CenterPaneDebugJson | null>(() => {
  if (centerPaneDebugJsonText.value === "none" || centerPaneDebugJsonText.value.length === 0) {
    return null
  }
  try {
    const parsed = JSON.parse(centerPaneDebugJsonText.value) as CenterPaneDebugJson
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
})
const serverFillVisibleColumnLabel = computed(() => serverFillVisibleColumnText.value)
const plumbingLabel = computed(() => {
  const entries = Object.entries(plumbingState.value).map(([layer, present]) => `${layer}:${present ? "yes" : "no"}`)
  return entries.length > 0 ? entries.join(", ") : "none"
})
const branchLabel = computed(() => branchState.value)
const canUndoHistory = computed(() => {
  if (serverDemoHttpDatasourceEnabled) {
    return serverHistoryCanUndo.value
  }
  return gridRef.value?.history.canUndo() ?? false
})
const canRedoHistory = computed(() => {
  if (serverDemoHttpDatasourceEnabled) {
    return serverHistoryCanRedo.value
  }
  return gridRef.value?.history.canRedo() ?? false
})
const serverHistoryAdapter = serverDemoHttpDatasourceEnabled
  ? {
      captureSnapshot: () => rowModel?.getSnapshot?.() ?? null,
      captureSnapshotForRowIds: () => rowModel?.getSnapshot?.() ?? null,
      recordIntentTransaction: () => undefined,
      recordServerFillTransaction: descriptor => {
        syncHistoryDiagnostics({
          operationId: descriptor.operationId,
          canUndo: true,
          canRedo: false,
          action: "commit",
          resetAffected: true,
        })
      },
      canUndo: () => serverHistoryCanUndo.value,
      canRedo: () => serverHistoryCanRedo.value,
      runHistoryAction: (direction: "undo" | "redo") => runHistoryAction(direction),
    } satisfies DataGridTableStageHistoryAdapter
  : null
const gridHistory = serverDemoHttpDatasourceEnabled
  ? {
      adapter: serverHistoryAdapter!,
      shortcuts: "window" as const,
      controls: false as const,
    }
  : true
const canUndoLabel = computed(() => (canUndoHistory.value ? "yes" : "no"))
const canRedoLabel = computed(() => (canRedoHistory.value ? "yes" : "no"))
const lastHistoryActionLabel = computed(() => lastHistoryActionText.value)
const lastEditRecordedLabel = computed(() => lastEditRecordedText.value)
const loadingLabel = computed(() => {
  if (error.value) return "error"
  if (pendingRequests.value > 0 || loading.value) return "loading"
  return "idle"
})
const errorLabel = computed(() => error.value?.message ?? "none")
const totalRowsLabel = computed(() => totalRows.value.toLocaleString())
const viewportLabel = computed(() => `${lastViewportRange.value.start}..${lastViewportRange.value.end}`)
const renderedViewportLabel = computed(() => {
  const renderedViewport = centerPaneDebugPayload.value?.renderedViewport
  if (!renderedViewport) {
    return "none"
  }
  return `${renderedViewport.start ?? "none"}..${renderedViewport.end ?? "none"}`
})
const loadedRowsLabel = computed(() => loadedRows.value.toLocaleString())
const pendingRequestsLabel = computed(() => String(pendingRequests.value))
const datasetVersionLabel = computed(() => {
  const value = changeFeedDiagnostics.value.currentDatasetVersion
  return value === null ? "none" : String(value)
})
const lastSeenVersionLabel = computed(() => {
  const value = changeFeedDiagnostics.value.lastSeenVersion
  return value === null ? "none" : String(value)
})
const changeFeedPollingLabel = computed(() => changeFeedDiagnostics.value.polling ? "yes" : "no")
const changeFeedPendingLabel = computed(() => changeFeedDiagnostics.value.pending ? "yes" : "no")
const appliedChangeCountLabel = computed(() => String(changeFeedDiagnostics.value.appliedChanges))

function refreshVisibleRange(): void {
  resetHttpDatasourceAvailability()
  void rowModel.refresh("manual")
}

function applyRegionAggregation(): void {
  aggregationActive.value = true
  rowModel.setGroupBy(null)
  rowModel.setAggregationModel({
    basis: "filtered",
    columns: [{ key: "value", op: "sum" }],
  })
}

function clearRegionAggregation(): void {
  aggregationActive.value = false
  rowModel.setAggregationModel(null)
  rowModel.setGroupBy(null)
}

function handleStateUpdate(state: unknown): void {
  const parsedState = state as {
    rows?: {
      snapshot?: {
        sortModel?: readonly DataGridSortState[]
        filterModel?: DataGridFilterSnapshot | null
        rowCount?: number
        loading?: boolean
        initialLoading?: boolean
        refreshing?: boolean
        viewportRange?: DataGridViewportRange
      }
    }
    selection?: {
      ranges?: readonly {
        startRow: number
        endRow: number
        startCol?: number
        endCol?: number
        virtual?: {
          isVirtualSelection?: boolean
          projectionStale?: boolean
          staleReason?: string | null
          coverage?: {
            isFullyLoaded?: boolean
            missingIntervals?: readonly { startRow: number; endRow: number }[]
          } | null
        } | null
      }[]
      activeRangeIndex?: number
    } | null
  } | null
  const snapshot = parsedState?.rows?.snapshot
  const sortModel = snapshot?.sortModel ?? []
  const filterModel = snapshot?.filterModel ?? null
  const aggregationModel = rowModel.getAggregationModel()
  const rowModelSnapshot = snapshot ?? null
  aggregationActive.value = Boolean(aggregationModel?.columns?.length)
  const activeRange = parsedState?.selection?.ranges?.[parsedState.selection.activeRangeIndex ?? 0] ?? parsedState?.selection?.ranges?.[0] ?? null
  lastSelectionRange.value = activeRange ? {
    startRow: Math.min(activeRange.startRow, activeRange.endRow),
    endRow: Math.max(activeRange.startRow, activeRange.endRow),
  } : null
  if (activeRange) {
    const startRow = Math.min(activeRange.startRow, activeRange.endRow)
    const endRow = Math.max(activeRange.startRow, activeRange.endRow)
    const startCol = typeof activeRange.startCol === "number" ? Math.min(activeRange.startCol, activeRange.endCol ?? activeRange.startCol) : 0
    const endCol = typeof activeRange.endCol === "number" ? Math.max(activeRange.startCol ?? activeRange.endCol, activeRange.endCol) : startCol
    const virtual = activeRange.virtual ?? null
    const coverage = virtual?.coverage ?? null
    selectionRangeText.value = `${startRow}..${endRow} x ${startCol}..${endCol}`
    selectionVirtualText.value = virtual?.isVirtualSelection === true ? "yes" : "no"
    selectionFullyLoadedText.value = coverage?.isFullyLoaded === true
      ? "yes"
      : coverage?.isFullyLoaded === false
        ? "no"
        : "unknown"
    selectionMissingIntervalsText.value = formatSelectionMissingIntervals(coverage?.missingIntervals ?? [])
    selectionProjectionStaleText.value = virtual?.projectionStale === true
      ? `yes${virtual.staleReason ? ` (${virtual.staleReason})` : ""}`
      : "no"
  } else {
    selectionRangeText.value = "none"
    selectionVirtualText.value = "no"
    selectionFullyLoadedText.value = "unknown"
    selectionMissingIntervalsText.value = "none"
    selectionProjectionStaleText.value = "no"
  }
  filterModelText.value = filterModel
    ? [
        ...Object.keys(filterModel.columnFilters ?? {}),
        ...(filterModel.advancedExpression ? ["advanced"] : []),
        ...(Object.keys(filterModel.advancedFilters ?? {}).length > 0 ? ["legacy-advanced"] : []),
      ].join(", ") || "active"
    : "none"
  sortModelText.value = sortModel.length > 0
    ? sortModel.map(entry => `${entry.key}:${entry.direction}`).join(", ")
    : "none"
  const rowModelSnapshotText = formatRowModelSnapshot(rowModelSnapshot)
  serverFillRowModelSnapshotText.value = rowModelSnapshotText
  runtimeRowModelSnapshotText.value = rowModelSnapshotText
  diagnostics.value = rowModel.getBackpressureDiagnostics()
}

function formatSelectionMissingIntervals(intervals: readonly { startRow: number; endRow: number }[]): string {
  if (!intervals.length) {
    return "none"
  }
  return intervals
    .map(interval => `${interval.startRow}..${interval.endRow}`)
    .join(", ")
}

function updateFillDiagnostics(batchRowCount: number, warnings: string[]): void {
  lastBatchRowsText.value = String(batchRowCount)
  const expectedRows = lastSelectionRange.value
    ? Math.max(0, lastSelectionRange.value.endRow - lastSelectionRange.value.startRow + 1)
    : batchRowCount
  const skippedRows = Math.max(0, expectedRows - batchRowCount)
  lastSkippedRowsText.value = String(skippedRows)
  const derivedWarnings = [...warnings]
  if (skippedRows > 0 && loadedRows.value < totalRows.value) {
    derivedWarnings.push("likely stopped at cache boundary")
  }
  clientBatchAppliedText.value = batchRowCount > 0 ? "yes" : "no"
  clientBatchWarningText.value = derivedWarnings.length > 0 ? derivedWarnings.join("; ") : "none"
}

function handleFillWarning(message: string): void {
  fillWarningText.value = message
  const isServerPath = message === "server fill committed" || message === "server fill no-op"
  if (!isServerPath) {
    selectionBlockedReasonText.value = message
  }
  fillBlockedText.value = isServerPath ? "no" : "yes"
  if (isServerPath) {
    fillAppliedText.value = "server"
  }
}

function reportFillPlumbingDetail(layer: string, value: string): void {
  if (layer === "controller_runtimeRowModel_dataSource_keys") {
    datasourceDetailText.value = value || "none"
  } else if (layer === "controller_runtime_rowModel_keys") {
    rowModelKeysText.value = value || "none"
  } else if (layer === "server_fill_affected_range") {
    serverFillAffectedRangeText.value = value || "none"
  } else if (layer === "server_fill_visible_overlap") {
    serverFillVisibleOverlapText.value = value || "unknown"
  } else if (layer === "runtime_viewport_range") {
    runtimeViewportRangeText.value = value || "none"
  } else if (layer === "runtime_rowModel_snapshot") {
    runtimeRowModelSnapshotText.value = value || "none"
  } else if (layer === "runtime_visible_first5") {
    runtimeVisibleFirst5Text.value = value || "none"
  } else if (layer === "runtime_sample_row25_visible_index") {
    runtimeSampleRow25VisibleIndexText.value = value || "none"
  } else if (layer === "runtime_sample_row25_region") {
    runtimeSampleRow25RegionText.value = value || "none"
  } else if (layer === "runtime_redraw_reason") {
    runtimeRedrawReasonText.value = value || "none"
  } else if (layer === "runtime_diagnostics_alive") {
    runtimeDiagnosticsAliveText.value = value || "none"
  } else if (layer === "runtime_body_rows_length") {
    runtimeRowModelSnapshotText.value = value ? `bodyRows=${value}` : runtimeRowModelSnapshotText.value
  } else if (layer === "runtime_body_first5_ids") {
    runtimeVisibleFirst5Text.value = value || runtimeVisibleFirst5Text.value
  } else if (layer === "runtime_body_first5_indexes") {
    runtimeRedrawReasonText.value = value ? `bodyIndexes=${value}` : runtimeRedrawReasonText.value
  } else if (layer === "runtime_body_sample_row25_visible_index") {
    runtimeSampleRow25VisibleIndexText.value = value || runtimeSampleRow25VisibleIndexText.value
  } else if (layer === "runtime_body_sample_row25_region") {
    runtimeSampleRow25RegionText.value = value || runtimeSampleRow25RegionText.value
  } else if (layer === "runtime_body_diagnostics_reason") {
    runtimeRedrawReasonText.value = value || runtimeRedrawReasonText.value
  } else if (layer === "server_fill_rendered_viewport") {
    serverFillRenderedViewportText.value = value || "none"
  } else if (layer === "server_fill_raw_invalidation") {
    serverFillRawInvalidationText.value = value || "none"
  } else if (layer === "server_fill_invalidation_range") {
    serverFillInvalidationRangeText.value = value || "none"
  } else if (layer === "server_fill_normalized_invalidation") {
    serverFillNormalizedInvalidationText.value = value || "none"
  } else if (layer === "server_fill_invalidation_applied") {
    serverFillInvalidationAppliedText.value = value || "unknown"
  } else if (layer === "server_fill_runtime_rowModel_invalidate_type") {
    serverFillRuntimeRowModelInvalidateTypeText.value = value || "none"
  } else if (layer === "server_fill_invalidation_called") {
    serverFillInvalidateCalledText.value = value || "unknown"
  } else if (layer === "server_fill_cache_row1_before_invalidation") {
    serverFillCacheRow1BeforeInvalidationText.value = value || "unknown"
  } else if (layer === "server_fill_cache_row1_after_invalidation") {
    serverFillCacheRow1AfterInvalidationText.value = value || "unknown"
  } else if (layer === "server_fill_sync_input_range") {
    serverFillSyncInputRangeText.value = value || "none"
  } else if (layer === "server_fill_latest_rendered_viewport") {
    serverFillLatestRenderedViewportText.value = value || "none"
  } else if (layer === "server_fill_runtime_rendered_viewport") {
    serverFillRuntimeRenderedViewportText.value = value || "none"
  } else if (layer === "server_fill_displayrows_rendered_viewport") {
    serverFillDisplayRowsRenderedViewportText.value = value || "none"
  } else if (layer === "server_fill_selected_rendered_viewport") {
    serverFillSelectedRenderedViewportText.value = value || "none"
  } else if (layer === "server_fill_refresh_used_stored_rendered") {
    serverFillRefreshUsedStoredRenderedText.value = value || "no"
  } else if (layer === "centerPaneStoredRenderedViewport") {
    centerPaneStoredRenderedViewportText.value = value || "none"
  } else if (layer === "source_body_row1") {
    sourceBodyRow1Text.value = value || "none"
  } else if (layer === "source_body_row1_identity") {
    sourceBodyRow1IdentityText.value = value || "none"
  } else if (layer === "source_sync_row1") {
    sourceSyncRow1Text.value = value || "none"
  } else if (layer === "server_fill_row1_cache_status") {
    serverFillRow1CacheStatusText.value = value || "unknown"
  } else if (layer === "server_fill_row1_sync_value") {
    serverFillRow1SyncValueText.value = value || "none"
  }
}

function reportCenterPaneDiagnostics(payload: {
  mounted?: boolean
  debugJson?: string
  renderedViewport?: { start: number; end: number } | null
  displayRowsRecomputeCount?: number
  centerPaneRuntimeRevision?: string | number | null
  centerPaneBodyRowsRevision?: string | number | null
}): void {
  if (typeof payload.mounted === "boolean") {
    centerPaneMountedText.value = payload.mounted ? "yes" : "no"
    centerPaneAliveText.value = payload.mounted ? "yes" : centerPaneAliveText.value
  }
  if (typeof payload.debugJson === "string") {
    centerPaneDebugJsonText.value = payload.debugJson || "none"
  }
  if (typeof payload.displayRowsRecomputeCount === "number") {
    displayRowsRecomputeCountText.value = String(payload.displayRowsRecomputeCount)
  }
  if ("centerPaneRuntimeRevision" in payload) {
    centerPaneRuntimeRevisionText.value = payload.centerPaneRuntimeRevision == null
      ? "none"
      : String(payload.centerPaneRuntimeRevision)
  }
  if ("centerPaneBodyRowsRevision" in payload) {
    centerPaneBodyRowsRevisionText.value = payload.centerPaneBodyRowsRevision == null
      ? "none"
      : String(payload.centerPaneBodyRowsRevision)
  }
}

function reportFillPlumbingState(layer: string, present: boolean): void {
  plumbingState.value = {
    ...plumbingState.value,
    [layer]: present,
  }
  if (layer === "commitFillOperation_available") {
    commitFillOperationAvailableText.value = present ? "yes" : "no"
  } else if (layer === "server_fill_dispatch_attempted") {
    serverFillDispatchAttemptedText.value = present ? "yes" : "no"
  } else if (layer === "commitFillOperation_called") {
    commitFillOperationCalledText.value = present ? "yes" : "no"
  } else if (layer === "server_fill_operationId") {
    serverFillOperationIdText.value = "set"
  } else if (layer === "server_fill_affectedRowCount") {
    serverFillAffectedRowsText.value = "set"
  } else if (layer === "server_fill_invalidation_applied") {
    serverFillInvalidationAppliedText.value = present ? "yes" : "no"
  } else if (layer === "server_fill_invalidation_called") {
    serverFillInvalidateCalledText.value = present ? "yes" : "no"
  } else if (layer === "runtime_redraw_happened") {
    runtimeRedrawHappenedText.value = present ? "yes" : "no"
  } else if (layer === "runtime_diagnostics_alive") {
    runtimeDiagnosticsAliveText.value = present ? "yes" : "no"
  } else if (layer === "server-fill-committed" && present) {
    branchState.value = "server-fill-committed"
    fillWarningText.value = "server fill committed"
    fillBlockedText.value = "no"
    fillAppliedText.value = "server"
  }
  if (layer === "double_click_handler" && present) {
    branchState.value = "double-click"
  } else if (layer === "double_click_resolved_server_branch" && present) {
    branchState.value = "server-resolved"
  } else if (layer === "double_click_blocked_large" && present) {
    branchState.value = "server-blocked-large"
  } else if (layer === "double_click_blocked_unloaded" && present) {
    branchState.value = "server-blocked-unloaded"
  } else if (layer === "double_click_batch_commit_path" && present) {
    branchState.value = "batch-commit"
  }
}

function isCellEditable(ctx: { rowId: string | number; columnKey: string }): boolean {
  return safeEditableColumns.has(ctx.columnKey) && ctx.rowId != null
}

function handleCellEdit(payload: {
  rowId: string | number
  columnKey: string
  oldValue: unknown
  newValue: unknown
  patch: {
    rowId: string | number
    data: Partial<ServerDemoRow>
  }
}): void {
  lastEditText.value = `${payload.columnKey} ${String(payload.oldValue ?? "")} → ${String(payload.newValue ?? "")}`
  updateFillDiagnostics(1, [])
  lastEditRecordedText.value = "pending"
  void Promise.resolve().then(() => {
    lastEditRecordedText.value = canUndoHistory.value ? "yes" : "no"
  })
}

function syncHistoryDiagnostics(result: {
  operationId?: string | null
  canUndo?: boolean
  canRedo?: boolean
  affectedRows?: number | null
  affectedCells?: number | null
  action?: "undo" | "redo" | "commit" | string | null
  resetAffected?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
}): void {
  if (typeof result.operationId === "string" && result.operationId.trim().length > 0) {
    serverHistoryLastOperationIdText.value = result.operationId
  }
  if ("latestUndoOperationId" in result) {
    serverHistoryLatestUndoOperationId.value = result.latestUndoOperationId ?? null
  }
  if ("latestRedoOperationId" in result) {
    serverHistoryLatestRedoOperationId.value = result.latestRedoOperationId ?? null
  }
  if (typeof result.canUndo === "boolean") {
    serverHistoryCanUndo.value = result.canUndo
  }
  if (typeof result.canRedo === "boolean") {
    serverHistoryCanRedo.value = result.canRedo
  }
  if (typeof result.affectedRows === "number" && Number.isFinite(result.affectedRows)) {
    serverHistoryAffectedRowsText.value = String(Math.max(0, Math.trunc(result.affectedRows)))
  } else if (result.resetAffected === true) {
    serverHistoryAffectedRowsText.value = "unknown"
  }
  if (typeof result.affectedCells === "number" && Number.isFinite(result.affectedCells)) {
    serverHistoryAffectedCellsText.value = String(Math.max(0, Math.trunc(result.affectedCells)))
  } else if (result.resetAffected === true) {
    serverHistoryAffectedCellsText.value = "unknown"
  }
  const operationId = serverHistoryLastOperationIdText.value
  const action = typeof result.action === "string" && result.action.length > 0 ? result.action : "history"
  lastHistoryActionText.value = `${action}:${operationId}`
  lastEditRecordedText.value = `op=${operationId} rows=${serverHistoryAffectedRowsText.value} cells=${serverHistoryAffectedCellsText.value}`
}

function invalidateHistoryStatusRefreshes(): void {
  // MVP adapter does not surface server-side history status invalidation.
}

function applyCommitHistoryDiagnostics(
  result: unknown,
  fallbackAffectedRows: number,
  fallbackAffectedCells: number,
): boolean {
  const historyState = normalizeServerDemoHistoryState(result)
  if (!historyState) {
    return false
  }
  syncHistoryDiagnostics({
    operationId: historyState.operationId ?? null,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    affectedRows: historyState.affectedRows ?? fallbackAffectedRows,
    affectedCells: historyState.affectedCells ?? fallbackAffectedCells,
    latestUndoOperationId: historyState.latestUndoOperationId ?? null,
    latestRedoOperationId: historyState.latestRedoOperationId ?? null,
    action: "commit",
  })
  return true
}

async function applyServerDemoRowSnapshots(
  rows: readonly ServerDemoRow[] | null | undefined,
): Promise<boolean> {
  const serverDatasource = httpDatasource as ServerDemoHttpDatasource | null
  if (!serverDatasource || !rows || rows.length === 0) {
    return false
  }
  return serverDatasource.applyRowSnapshots(rows)
}

async function refreshHistoryStatus(): Promise<void> {
  return
}

async function runHistoryAction(direction: "undo" | "redo"): Promise<string | null> {
  const result = await gridRef.value?.history.runHistoryAction(direction) ?? null
  if (result) {
    invalidateHistoryStatusRefreshes()
    syncHistoryDiagnostics({
      operationId: result,
      canUndo: gridRef.value?.history.canUndo() ?? false,
      canRedo: gridRef.value?.history.canRedo() ?? false,
      latestUndoOperationId: serverHistoryLatestUndoOperationId.value,
      latestRedoOperationId: serverHistoryLatestRedoOperationId.value,
      action: direction,
    })
  } else {
    syncHistoryDiagnostics({
      action: `${direction}:none`,
      canUndo: gridRef.value?.history.canUndo() ?? false,
      canRedo: gridRef.value?.history.canRedo() ?? false,
      latestUndoOperationId: serverHistoryLatestUndoOperationId.value,
      latestRedoOperationId: serverHistoryLatestRedoOperationId.value,
    })
  }
  gridRef.value?.restoreFocus?.()
  return result
}

function shouldRejectCommittedRow(rowId: string | number): boolean {
  if (!commitFailureMode.value) {
    return false
  }
  const numeric = Number(String(rowId).replace(/^srv-/, ""))
  return Number.isFinite(numeric) && numeric % 2 === 0
}

function applyCommitEdits(request: ServerDemoCommitEditsRequest): Promise<{
  committed?: readonly { rowId: string | number }[]
  rejected?: readonly { rowId: string | number; reason?: string }[]
}> {
  try {
    const committedRows: Array<{ rowId: string | number }> = []
    const rejectedRows: Array<{ rowId: string | number; reason?: string }> = []
    const nextCommittedOverrides = new Map(committedOverrides.value)
    const nextPendingOverrides = new Map(pendingOverrides.value)
    for (const edit of request.edits) {
      const rowId = String(edit.rowId)
      const pending = pendingOverrides.value.get(rowId) ?? {}
      if (shouldRejectCommittedRow(rowId)) {
        nextPendingOverrides.delete(rowId)
        nextCommittedOverrides.delete(rowId)
        rejectedRows.push({
          rowId: edit.rowId,
          reason: "simulated failure",
        })
        continue
      }
      const committed = committedOverrides.value.get(rowId) ?? {}
      const nextData = { ...pending, ...edit.data }
      if ("value" in nextData) {
        nextData.value = normalizeServerDemoValueCellInput(nextData.value)
      }
      nextPendingOverrides.delete(rowId)
      nextCommittedOverrides.set(rowId, {
        ...committed,
        ...nextData,
      })
      committedRows.push({ rowId: edit.rowId })
    }
    committedOverrides.value = nextCommittedOverrides
    pendingOverrides.value = nextPendingOverrides
    if (rejectedRows.length > 0) {
      commitModeText.value = "failed"
      commitMessageText.value = `partial rejection: ${rejectedRows.length} row${rejectedRows.length === 1 ? "" : "s"}`
      commitDetailsText.value = rejectedRows.map(entry => String(entry.rowId)).join(", ")
      updateFillDiagnostics(committedRows.length, [
        "partial rejection suppressed refresh",
        committedRows.length > 1 ? "batch commit path used" : "single-row commit path used",
      ])
      diagnostics.value = rowModel.getBackpressureDiagnostics()
      void rowModel.refresh("manual")
      commitFailureMode.value = false
      return Promise.resolve({
        committed: committedRows,
        rejected: rejectedRows,
      })
    }
    commitModeText.value = "ok"
    commitMessageText.value = "committed"
    commitDetailsText.value = committedRows.length > 0
      ? committedRows.map(entry => String(entry.rowId)).join(", ")
      : "none"
    updateFillDiagnostics(committedRows.length, committedRows.length > 1
      ? ["batch commit path used"]
      : [])
    diagnostics.value = rowModel.getBackpressureDiagnostics()
    return Promise.resolve({
      committed: committedRows,
    })
  } catch (caught) {
    commitModeText.value = "failed"
    commitMessageText.value = `error: ${caught instanceof Error ? caught.message : String(caught)}`
    commitDetailsText.value = "rollback"
    for (const edit of request.edits) {
      const rowId = String(edit.rowId)
      const nextPending = new Map(pendingOverrides.value)
      nextPending.delete(rowId)
      pendingOverrides.value = nextPending
      const nextCommitted = new Map(committedOverrides.value)
      nextCommitted.delete(rowId)
      committedOverrides.value = nextCommitted
    }
    diagnostics.value = rowModel.getBackpressureDiagnostics()
    void rowModel.refresh("manual")
    updateFillDiagnostics(0, ["commit failed", "refresh suppressed until rollback recovery"])
    return Promise.resolve({
      rejected: request.edits.map((edit) => ({
        rowId: edit.rowId,
        reason: caught instanceof Error ? caught.message : String(caught),
      })),
    })
  }
}

function simulateErrorOnce(): void {
  failureMode.value = true
  void Promise.resolve(rowModel.refresh("manual")).catch(() => {})
}

function simulateCommitFailure(): void {
  commitFailureMode.value = true
}

onMounted(() => {
  invalidateHistoryStatusRefreshes()
  serverHistoryCanUndo.value = false
  serverHistoryCanRedo.value = false
  serverHistoryLatestUndoOperationId.value = null
  serverHistoryLatestRedoOperationId.value = null
  serverHistoryLastOperationIdText.value = "none"
  totalRows.value = ROW_COUNT
  handleStateUpdate(rowModel.getSnapshot())
  void refreshHistoryStatus()
  void rowModel.refresh("mount").catch(() => {}).finally(() => {
    if (serverDemoChangeFeedPollingEnabled) {
      httpDatasource?.startChangeFeedPolling({
        intervalMs: serverDemoChangeFeedPollingIntervalMs,
      })
    }
  })
  lastEditRecordedText.value = "no"
})

onBeforeUnmount(() => {
  httpDatasource?.stopChangeFeedPolling()
  if (unsubscribeChangeFeedDiagnostics) {
    unsubscribeChangeFeedDiagnostics()
    unsubscribeChangeFeedDiagnostics = null
  }
  unsubscribeSampleDiagnostics()
  rowModel.dispose()
})
</script>

<style scoped>
.server-grid__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
  gap: 1rem;
  align-items: stretch;
  margin-top: 0.75rem;
  min-width: 0;
  min-height: 0;
}

.server-grid__surface {
  min-width: 0;
  min-height: 0;
}

.server-grid__diagnostics {
  margin-top: 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  padding: 0.75rem 0.85rem 0.9rem;
  border-radius: 0.75rem;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(35, 42, 48, 0.12);
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 0.82rem;
}

.server-grid__diagnostics h3 {
  margin: 0 0 0.7rem;
  font-size: 0.9rem;
}

.server-grid__diagnostics-section + .server-grid__diagnostics-section {
  margin-top: 0.8rem;
}

.server-grid__diagnostics-section h4 {
  margin: 0 0 0.45rem;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(35, 42, 48, 0.62);
}

.server-grid__diagnostics-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  margin: 0;
  min-width: 0;
  align-items: start;
}

.server-grid__diagnostics-card {
  display: grid;
  grid-template-columns: minmax(5rem, 6.5rem) minmax(0, 1fr);
  gap: 0.55rem;
  align-items: start;
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(35, 42, 48, 0.08);
  overflow: hidden;
}

.server-grid__diagnostics-card dt,
.server-grid__diagnostics-card dd {
  margin: 0;
  line-height: 1.35;
}

.server-grid__diagnostics-card dt {
  font-weight: 600;
  color: rgba(35, 42, 48, 0.72);
}

.server-grid__diagnostics-card dd {
  color: rgba(35, 42, 48, 0.98);
  word-break: break-word;
  min-width: 0;
}

.server-grid__diagnostics-json {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.72rem;
  line-height: 1.35;
}

@media (max-width: 1100px) {
  .server-grid__body {
    grid-template-columns: minmax(0, 1fr);
  }

  .server-grid__diagnostics {
    height: auto;
    max-height: 24rem;
  }
}
</style>

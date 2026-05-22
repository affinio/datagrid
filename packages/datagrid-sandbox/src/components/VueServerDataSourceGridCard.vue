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
        <button type="button" class="server-grid__button" @click="jumpToRow(50_000)">Jump 50k</button>
        <button type="button" class="server-grid__button" @click="jumpToRow(99_500)">Jump tail</button>
        <label class="server-grid__transport-select">
          Transport
          <select :value="liveUpdateTransport" @change="handleLiveUpdateTransportChange">
            <option value="polling">Current</option>
            <option value="websocket">WebSocket</option>
          </select>
        </label>
        <button
          type="button"
          class="server-grid__button"
          :aria-pressed="latencyProfile === 'steady'"
          @click="setLatencyProfile('steady')"
        >
          Steady latency
        </button>
        <button
          type="button"
          class="server-grid__button"
          :aria-pressed="latencyProfile === 'jitter'"
          @click="setLatencyProfile('jitter')"
        >
          Jitter latency
        </button>
        <button
          type="button"
          class="server-grid__button"
          :aria-pressed="latencyProfile === 'slow'"
          @click="setLatencyProfile('slow')"
        >
          Slow backend
        </button>
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
          :row-selection="true"
          :column-menu="columnMenu"
          advanced-filter
          :quick-filter="quickFilter"
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
          state-persistence="affino-datagrid-sandbox:vue-server-data-source-grid:state-with-viewport"
          @update:state="handleStateUpdate"
          @selection-change="syncSelectionAggregatesLabel"
          @cell-edit="handleCellEdit"
        />
        <div
          v-if="selectionAggregatesLabel"
          class="server-grid__selection-summary"
          role="status"
        >
          {{ selectionAggregatesLabel }}
        </div>
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
              <dt>Latency</dt>
              <dd>{{ latencyLabel }}</dd>
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
              <dt>Live transport</dt>
              <dd>{{ liveUpdateTransportLabel }} / {{ changeFeedPendingLabel }}</dd>
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
            <div class="server-grid__diagnostics-card">
              <dt>Viewport loading</dt>
              <dd
                data-datagrid-server-viewport-loading-ratio
                :data-ratio="viewportLoadingRatioData"
              >
                {{ viewportLoadingLabel }}
              </dd>
            </div>
            <div class="server-grid__diagnostics-card">
              <dt>Placeholder exposure</dt>
              <dd
                data-datagrid-server-placeholder-exposure
                :data-active-rows="placeholderExposureActiveRowsData"
                :data-events="placeholderExposureEventsData"
                :data-total-ms="placeholderExposureTotalMsData"
                :data-max-ms="placeholderExposureMaxMsData"
                :data-viewport-availability-ms="viewportDataAvailabilityLastMsData"
                :data-blank-viewport-active="blankViewportActiveData"
                :data-blank-viewport-events="blankViewportEventsData"
                :data-cache-hit-ratio="viewportCacheHitRatioData"
                :data-cache-miss-rows="viewportCacheMissRowsData"
                :data-pull-duration-ms="pullDurationLastMsData"
                :data-pull-duration-max-ms="pullDurationMaxMsData"
              >
                {{ placeholderExposureLabel }}
              </dd>
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
            <div class="server-grid__diagnostics-card">
              <dt>Summary</dt>
              <dd>{{ selectionAggregatesLabel || "none" }}</dd>
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
  createDataSourceBackedRowModel,
  type DataGridColumnHistogram,
  type DataGridDataSourceColumnHistogramRequest,
  type DataGridDataSource,
  type DataGridDataSourceInvalidation,
  type DataGridDataSourcePullRequest,
  type DataGridDataSourcePullResult,
  type DataGridDataSourcePushListener,
  type DataGridFilterSnapshot,
  type DataGridViewportRange,
  type DataGridSortState,
} from "@affino/datagrid-vue"
import type { DataGridSparseRowModelDiagnostics } from "@affino/datagrid-core"
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
  type AffinoDatasource,
} from "@affino/datagrid-server-adapters"
import {
  resolveServerDemoChangeFeedPollingIntervalMs,
  resolveServerDemoChangeFeedPollingEnabled,
} from "../serverDatasourceDemo/serverDemoChangeFeedPolling"
import {
  createPollingLiveUpdateTransport,
  createWebSocketLiveUpdateTransport,
  type ServerDatasourceLiveUpdateTransport,
  type ServerDatasourceLiveUpdateTransportFactory,
} from "@affino/datagrid-server-client"
import {
  normalizeServerDemoHistoryState,
} from "../serverDatasourceDemo/serverDemoHistoryState"
import {
  type ServerDemoDatasourceHooks,
  type ServerDemoCommitEditsResult,
  type ServerDemoChangeFeedDiagnostics,
  type ServerDemoRow,
  SERVER_DEMO_ROW_COUNT as ROW_COUNT,
  SERVER_DEMO_LATENCY_MS as LATENCY_MS,
} from "../serverDatasourceDemo/types"
import type { DataGridTableStageHistoryAdapter } from "@affino/datagrid-vue-app"

const props = defineProps<{
  title: string
}>()

const quickFilter = {
  placeholder: "Search account, segment, status, region",
  columns: ["name", "segment", "status", "region"],
  mode: "tokens" as const,
}

const gridKey = ref(0)
const gridRef = ref<{
  scrollToRow?: (target: { rowIndex?: number | null; align?: "start" | "center" | "nearest" }) => void
  history: {
    canUndo: () => boolean
    canRedo: () => boolean
    runHistoryAction: (direction: "undo" | "redo") => Promise<string | null>
  }
  restoreFocus?: () => void
  getSelectionAggregatesLabel?: () => string
} | null>(null)
const failureMode = ref(false)
const commitFailureMode = ref(false)
type ServerDemoLatencyProfile = "steady" | "jitter" | "slow"
const latencyProfile = ref<ServerDemoLatencyProfile>("jitter")
type ServerDemoLiveUpdateTransport = "polling" | "websocket"
const liveUpdateTransport = ref<ServerDemoLiveUpdateTransport>("polling")
const lastLatencyMs = ref(LATENCY_MS)
const lastViewportRange = ref<{ start: number; end: number }>({ start: 0, end: 0 })
const totalRows = ref(0)
const loadedRows = ref(0)
const pendingRequests = ref(0)
const loading = ref(true)
const error = ref<Error | null>(null)
const changeFeedDiagnostics = ref<ServerDemoChangeFeedDiagnostics>({
  currentDatasetVersion: null,
  lastSeenVersion: null,
  transportKind: "polling",
  polling: false,
  pending: false,
  appliedChanges: 0,
  intervalMs: null,
  consecutiveFailures: 0,
  retryAttempt: 0,
  retryDelayMs: null,
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
const selectionAggregatesLabel = ref("")
const aggregationActive = ref(false)
const lastAggregationRequestText = ref("none")
const aggregateResponseRowsText = ref("0")
const aggregatePreviewRowsText = ref("none")
let rowModel: any = null
const sparseDiagnostics = ref<DataGridSparseRowModelDiagnostics | null>(null)

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
  latencyMs: number
}

function applyPullDiagnostics(state: ServerDemoPullDiagnosticsState): void {
  pendingRequests.value = state.pendingRequests
  loading.value = state.loading
  error.value = state.error
  lastViewportRange.value = state.lastViewportRange
  totalRows.value = state.totalRows
  loadedRows.value = state.loadedRows
  lastLatencyMs.value = state.latencyMs
}

function setLatencyProfile(profile: ServerDemoLatencyProfile): void {
  latencyProfile.value = profile
}

function resolveDemoPullDelayMs(request: DataGridDataSourcePullRequest): number {
  if (latencyProfile.value === "steady") {
    return LATENCY_MS
  }
  if (latencyProfile.value === "slow") {
    return 420
  }
  const start = Math.max(0, Math.trunc(request.range.start))
  const end = Math.max(start, Math.trunc(request.range.end))
  const deterministicJitter = ((start * 31) + (end * 17)) % 90
  return LATENCY_MS + deterministicJitter
}

function jumpToRow(rowIndex: number): void {
  const normalized = Math.max(0, Math.min(ROW_COUNT - 1, Math.trunc(rowIndex)))
  gridRef.value?.scrollToRow?.({ rowIndex: normalized, align: "start" })
  rowModel?.setViewportRange?.({ start: normalized, end: Math.min(ROW_COUNT - 1, normalized + 32) })
}

const SERVER_DEMO_SUPPORTED_TREE_PULL_OPERATIONS = new Set([
  "set-group-by",
  "set-group-expansion",
  "toggle-group",
  "expand-group",
  "collapse-group",
  "expand-all-groups",
  "collapse-all-groups",
])

function supportsHttpRegionTreePullContext(treeData: DataGridDataSourcePullRequest["treeData"]): boolean {
  if (treeData === null) {
    return true
  }
  if (!SERVER_DEMO_SUPPORTED_TREE_PULL_OPERATIONS.has(treeData.operation)) {
    return false
  }
  return treeData.groupKeys.every(groupKey => String(groupKey).startsWith("group:region:"))
}

function supportsHttpRegionGrouping(request: Pick<DataGridDataSourcePullRequest, "groupBy" | "treeData">): boolean {
  if (request.groupBy === null) {
    return request.treeData === null
  }
  return (
    request.groupBy.fields.length === 1
    && request.groupBy.fields[0] === "region"
    && supportsHttpRegionTreePullContext(request.treeData)
  )
}

function supportsHttpReadPath(request: Pick<DataGridDataSourcePullRequest, "groupBy" | "pivot" | "treeData">): boolean {
  return (
    supportsHttpRegionGrouping(request)
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
  httpDatasource?.stopLiveUpdates()
  error.value = new Error(serverDatasourceUnavailableMessage)
}

function resetHttpDatasourceAvailability(): void {
  serverDatasourceUnavailable.value = false
  if (error.value?.message === serverDatasourceUnavailableMessage) {
    error.value = null
  }
}

const serverDatasource = createFakeServerDatasource({
  resolvePullDelayMs: resolveDemoPullDelayMs,
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

type ServerDemoCommitEditsRequest = Parameters<NonNullable<DataGridDataSource<ServerDemoRow>["commitEdits"]>>[0]
type ServerDemoHttpDatasource = AffinoDatasource<ServerDemoRow>

function formatRowModelSnapshot(snapshot: {
  rowCount?: number
  loading?: boolean
  initialLoading?: boolean
  refreshing?: boolean
  viewportRange?: DataGridViewportRange | null
} | null | undefined): string {
  if (!snapshot) {
    return "none"
  }
  const viewport = snapshot.viewportRange
  return `rowCount=${snapshot.rowCount ?? 0} loading=${snapshot.loading ? "yes" : "no"} initialLoading=${snapshot.initialLoading ? "yes" : "no"} refreshing=${snapshot.refreshing ? "yes" : "no"} viewport=${viewport ? `${viewport.start}..${viewport.end}` : "none"}`
}

function readDebugRegion(row: { kind?: string; row?: unknown; data?: unknown } | null | undefined): string {
  if (!row || row.kind === "group") {
    return "none"
  }
  const rawRow = row.row as Record<string, unknown> | undefined
  const dataRow = row.data as Record<string, unknown> | undefined
  return String(rawRow?.region ?? dataRow?.region ?? "none")
}

function formatDebugRow(row: { rowId?: string | number; kind?: string; row?: unknown; data?: unknown } | null | undefined): string {
  if (!row) {
    return "none"
  }
  return `${String(row.rowId)}:${readDebugRegion(row)}`
}

function reportRuntimeBodyDiagnostics(reason: string): void {
  const snapshot = rowModel?.getSnapshot?.() as {
    viewportRange?: DataGridViewportRange | null
    rowCount?: number
    loading?: boolean
    revision?: string | number | null
  } | null | undefined
  const viewportRange = snapshot?.viewportRange ?? lastViewportRange.value
  const visibleRows = viewportRange && rowModel?.getRowsInRange
    ? rowModel.getRowsInRange(viewportRange)
    : []
  const sampleRowId = "srv-000025"
  const sampleVisibleIndex = visibleRows.findIndex((row: { rowId?: string | number }) => String(row.rowId) === sampleRowId)
  const sampleRow = sampleVisibleIndex >= 0 ? visibleRows[sampleVisibleIndex] : null
  const firstVisibleRows = visibleRows
    .slice(0, 5)
    .map((row: { rowId?: string | number }) => String(row.rowId))
    .join(", ")
  const sourceRow1BeforeSync = rowModel?.getRow?.(1) ?? null
  const sourceSyncRows = rowModel?.getRowsInRange?.({
    start: 0,
    end: Math.min(23, Math.max(0, (snapshot?.rowCount ?? loadedRows.value) - 1)),
  }) ?? []
  const sourceSyncRow1 = sourceSyncRows.find((row: { displayIndex?: number }) => Math.trunc(Number(row.displayIndex)) === 1) ?? sourceSyncRows[1] ?? null
  const sourceRow1AfterSync = rowModel?.getRow?.(1) ?? null
  const displayRow1 = visibleRows[1] ?? null

  runtimeViewportRangeText.value = viewportRange ? `${viewportRange.start}..${viewportRange.end}` : "none"
  runtimeRowModelSnapshotText.value = formatRowModelSnapshot(snapshot ?? null)
  runtimeVisibleFirst5Text.value = firstVisibleRows || "none"
  runtimeSampleRow25VisibleIndexText.value = sampleVisibleIndex >= 0 ? String(sampleVisibleIndex) : "none"
  runtimeSampleRow25RegionText.value = sampleRow && sampleRow.kind !== "group"
    ? String((sampleRow.row as Record<string, unknown>).region ?? "none")
    : "none"
  sourceBodyRow1Text.value = formatDebugRow(sourceRow1AfterSync)
  sourceBodyRow1IdentityText.value = [
    `before=${formatDebugRow(sourceRow1BeforeSync)}`,
    `sameDisplay=${sourceRow1AfterSync != null && displayRow1 != null && sourceRow1AfterSync === displayRow1 ? "yes" : "no"}`,
    `sameSync=${sourceRow1AfterSync != null && sourceSyncRow1 != null && sourceRow1AfterSync === sourceSyncRow1 ? "yes" : "no"}`,
    `revision=${snapshot?.revision ?? "none"}`,
  ].join(" ")
  sourceSyncRow1Text.value = formatDebugRow(sourceSyncRow1)
  serverFillRow1CacheStatusText.value = sourceRow1BeforeSync != null && sourceSyncRow1 != null && sourceRow1BeforeSync === sourceSyncRow1
    ? "cache-hit"
    : "pulled-fresh"
  serverFillRow1SyncValueText.value = formatDebugRow(sourceSyncRow1)
  runtimeRedrawHappenedText.value = "yes"
  runtimeRedrawReasonText.value = reason
  reportFillPlumbingState("runtime_redraw_happened", true)
  reportFillPlumbingDetail("runtime_viewport_range", runtimeViewportRangeText.value)
  reportFillPlumbingDetail("runtime_rowModel_snapshot", runtimeRowModelSnapshotText.value)
  reportFillPlumbingDetail("runtime_visible_first5", runtimeVisibleFirst5Text.value)
  reportFillPlumbingDetail("runtime_sample_row25_visible_index", runtimeSampleRow25VisibleIndexText.value)
  reportFillPlumbingDetail("runtime_sample_row25_region", runtimeSampleRow25RegionText.value)
  reportFillPlumbingDetail("source_body_row1", sourceBodyRow1Text.value)
  reportFillPlumbingDetail("source_body_row1_identity", sourceBodyRow1IdentityText.value)
  reportFillPlumbingDetail("source_sync_row1", sourceSyncRow1Text.value)
  reportFillPlumbingDetail("server_fill_row1_cache_status", serverFillRow1CacheStatusText.value)
  reportFillPlumbingDetail("server_fill_row1_sync_value", serverFillRow1SyncValueText.value)
  reportFillPlumbingDetail("runtime_redraw_reason", runtimeRedrawReasonText.value)
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

function resolveColumnValue(row: ServerDemoRow, columnKey: string): unknown {
  return row[columnKey as keyof ServerDemoRow]
}

const forceFakeDatasource = typeof window !== "undefined"
  && new URLSearchParams(window.location.search).get("datasource") === "fake"
const serverDemoHttpDatasourceEnabled = import.meta.env.VITE_SERVER_DEMO_HTTP_DATA_SOURCE === "true" && !forceFakeDatasource
const serverDemoHttpDatasourceBaseUrl = import.meta.env.VITE_SERVER_DEMO_API_BASE_URL?.trim()

function resolveServerDemoWebSocketUrl(baseUrl: string, sinceVersion: number): string {
  const url = new URL(`/api/changes/ws?tableId=server-demo&sinceVersion=${encodeURIComponent(String(sinceVersion))}`, baseUrl)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.toString()
}

function createServerDemoLiveUpdateTransportFactory(baseUrl: string): ServerDatasourceLiveUpdateTransportFactory<unknown> {
  return options => {
    let activeTransport: ServerDatasourceLiveUpdateTransport | null = null

    function createTransport(): ServerDatasourceLiveUpdateTransport {
      return liveUpdateTransport.value === "websocket"
        ? createWebSocketLiveUpdateTransport(options, {
            url: sinceVersion => resolveServerDemoWebSocketUrl(baseUrl, sinceVersion),
          })
        : createPollingLiveUpdateTransport(options)
    }

    function ensureTransport(): ServerDatasourceLiveUpdateTransport {
      if (!activeTransport) {
        activeTransport = createTransport()
      }
      return activeTransport
    }

    return {
      kind: "custom",
      start(startOptions) {
        activeTransport?.stop()
        activeTransport = createTransport()
        activeTransport.start(startOptions)
      },
      stop() {
        activeTransport?.stop()
      },
      pollNow(signal) {
        return ensureTransport().pollNow(signal)
      },
      diagnostics() {
        return ensureTransport().diagnostics()
      },
      incrementAppliedChanges(count) {
        ensureTransport().incrementAppliedChanges(count)
      },
    }
  }
}

const serverDemoHttpDatasource: ServerDemoHttpDatasource | null = serverDemoHttpDatasourceEnabled && serverDemoHttpDatasourceBaseUrl
  ? createAffinoDatasource<ServerDemoRow>({
      baseUrl: serverDemoHttpDatasourceBaseUrl,
      tableId: "server-demo",
      liveUpdateTransportFactory: createServerDemoLiveUpdateTransportFactory(serverDemoHttpDatasourceBaseUrl),
    })
  : null
const httpDatasource = serverDemoHttpDatasource
let unsubscribeChangeFeedDiagnostics: (() => void) | null = null
if (httpDatasource) {
  unsubscribeChangeFeedDiagnostics = httpDatasource.subscribeChangeFeedDiagnostics(diagnosticsState => {
    changeFeedDiagnostics.value = diagnosticsState
  })
}
const serverDemoChangeFeedPollingEnabled = resolveServerDemoChangeFeedPollingEnabled({
  httpModeEnabled: serverDemoHttpDatasourceEnabled,
  envValue: import.meta.env.VITE_SERVER_DEMO_CHANGE_FEED_POLLING_ENABLED,
})
const serverDemoChangeFeedPollingIntervalMs = resolveServerDemoChangeFeedPollingIntervalMs(
  import.meta.env.VITE_SERVER_DEMO_CHANGE_FEED_POLL_INTERVAL_MS,
)

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
sparseDiagnostics.value = rowModel.getSparseRowModelDiagnostics()

const unsubscribeSampleDiagnostics = rowModel.subscribe(() => {
  diagnostics.value = rowModel.getBackpressureDiagnostics()
  sparseDiagnostics.value = rowModel.getSparseRowModelDiagnostics()
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
const latencyLabel = computed(() => `${latencyProfile.value} / ${lastLatencyMs.value}ms`)
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
const viewportLoadingRatioData = computed(() => String(sparseDiagnostics.value?.viewportLoadingRowRatio ?? 0))
const placeholderExposureActiveRowsData = computed(() => String(sparseDiagnostics.value?.placeholderExposureActiveRows ?? 0))
const placeholderExposureEventsData = computed(() => String(sparseDiagnostics.value?.placeholderExposureEvents ?? 0))
const placeholderExposureTotalMsData = computed(() => String(sparseDiagnostics.value?.placeholderExposureTotalMs ?? 0))
const placeholderExposureMaxMsData = computed(() => String(sparseDiagnostics.value?.placeholderExposureMaxMs ?? 0))
const viewportDataAvailabilityLastMsData = computed(() => String(sparseDiagnostics.value?.viewportDataAvailabilityLastMs ?? 0))
const blankViewportActiveData = computed(() => String(sparseDiagnostics.value?.blankViewportActive ? 1 : 0))
const blankViewportEventsData = computed(() => String(sparseDiagnostics.value?.blankViewportEvents ?? 0))
const viewportCacheHitRatioData = computed(() => String(sparseDiagnostics.value?.viewportCacheHitRatio ?? 1))
const viewportCacheMissRowsData = computed(() => String(sparseDiagnostics.value?.viewportCacheMissRows ?? 0))
const pullDurationLastMsData = computed(() => String(sparseDiagnostics.value?.pullDurationLastMs ?? 0))
const pullDurationMaxMsData = computed(() => String(sparseDiagnostics.value?.pullDurationMaxMs ?? 0))
const viewportLoadingLabel = computed(() => {
  const diagnosticsState = sparseDiagnostics.value
  if (!diagnosticsState) {
    return "none"
  }
  const viewportRows = diagnosticsState.viewportRowCount ?? 0
  const loadedViewportRows = diagnosticsState.viewportLoadedRowCount ?? 0
  const loadingViewportRows = diagnosticsState.viewportLoadingRowCount ?? 0
  const loadingPercent = Math.round((diagnosticsState.viewportLoadingRowRatio ?? 0) * 100)
  return `${loadingViewportRows} loading / ${loadedViewportRows} loaded / ${viewportRows} rows (${loadingPercent}%)`
})
const placeholderExposureLabel = computed(() => {
  const diagnosticsState = sparseDiagnostics.value
  if (!diagnosticsState) {
    return "none"
  }
  const activeRows = diagnosticsState.placeholderExposureActiveRows ?? 0
  const events = diagnosticsState.placeholderExposureEvents ?? 0
  const totalMs = Math.round(diagnosticsState.placeholderExposureTotalMs ?? 0)
  const maxMs = Math.round(diagnosticsState.placeholderExposureMaxMs ?? 0)
  const availabilityMs = Math.round(diagnosticsState.viewportDataAvailabilityLastMs ?? 0)
  const cachePercent = Math.round((diagnosticsState.viewportCacheHitRatio ?? 1) * 100)
  const blankEvents = diagnosticsState.blankViewportEvents ?? 0
  const pullMs = Math.round(diagnosticsState.pullDurationLastMs ?? 0)
  return `${activeRows} active / ${events} events / ${totalMs}ms total / ${maxMs}ms max / ${availabilityMs}ms viewport / ${cachePercent}% cache / ${blankEvents} blank / ${pullMs}ms pull`
})
const datasetVersionLabel = computed(() => {
  const value = changeFeedDiagnostics.value.currentDatasetVersion
  return value === null ? "none" : String(value)
})
const lastSeenVersionLabel = computed(() => {
  const value = changeFeedDiagnostics.value.lastSeenVersion
  return value === null ? "none" : String(value)
})
const liveUpdateTransportLabel = computed(() => `${changeFeedDiagnostics.value.transportKind ?? liveUpdateTransport.value}:${changeFeedDiagnostics.value.polling ? "on" : "off"}`)
const changeFeedPendingLabel = computed(() => changeFeedDiagnostics.value.pending ? "yes" : "no")
const appliedChangeCountLabel = computed(() => String(changeFeedDiagnostics.value.appliedChanges))

function startServerDemoLiveUpdates(): void {
  if (!serverDemoChangeFeedPollingEnabled || serverDatasourceUnavailable.value) {
    return
  }
  httpDatasource?.startLiveUpdates({
    intervalMs: serverDemoChangeFeedPollingIntervalMs,
  })
}

function handleLiveUpdateTransportChange(event: Event): void {
  const target = event.target as HTMLSelectElement | null
  const nextTransport = target?.value === "websocket" ? "websocket" : "polling"
  if (liveUpdateTransport.value === nextTransport) {
    return
  }
  liveUpdateTransport.value = nextTransport
  httpDatasource?.stopLiveUpdates()
  startServerDemoLiveUpdates()
}

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

function syncSelectionAggregatesLabel(): void {
  selectionAggregatesLabel.value = gridRef.value?.getSelectionAggregatesLabel?.() ?? ""
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
        ...(filterModel.quickFilter ? ["quick"] : []),
      ].join(", ") || "active"
    : "none"
  sortModelText.value = sortModel.length > 0
    ? sortModel.map(entry => `${entry.key}:${entry.direction}`).join(", ")
    : "none"
  const rowModelSnapshotText = formatRowModelSnapshot(rowModelSnapshot)
  serverFillRowModelSnapshotText.value = rowModelSnapshotText
  runtimeRowModelSnapshotText.value = rowModelSnapshotText
  diagnostics.value = rowModel.getBackpressureDiagnostics()
  reportRuntimeBodyDiagnostics("body-rows-update")
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
    syncSelectionAggregatesLabel()
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
  rows: Parameters<AffinoDatasource<ServerDemoRow>["applyRowSnapshots"]>[0] | null | undefined,
): Promise<boolean> {
  if (!httpDatasource || !rows || rows.length === 0) {
    return false
  }
  return httpDatasource.applyRowSnapshots(rows)
}

function applyServerHistoryStatus(status: {
  canUndo?: boolean
  canRedo?: boolean
  latestUndoOperationId?: string | null
  latestRedoOperationId?: string | null
}): void {
  if (typeof status.canUndo === "boolean") {
    serverHistoryCanUndo.value = status.canUndo
  }
  if (typeof status.canRedo === "boolean") {
    serverHistoryCanRedo.value = status.canRedo
  }
  if ("latestUndoOperationId" in status) {
    serverHistoryLatestUndoOperationId.value = status.latestUndoOperationId ?? null
  }
  if ("latestRedoOperationId" in status) {
    serverHistoryLatestRedoOperationId.value = status.latestRedoOperationId ?? null
  }
}

async function refreshHistoryStatus(): Promise<void> {
  if (!httpDatasource || typeof httpDatasource.getHistoryStatus !== "function") {
    return
  }
  try {
    const status = await httpDatasource.getHistoryStatus()
    applyServerHistoryStatus(status)
  } catch (caught) {
    if (isHttpUnavailableError(caught)) {
      markHttpDatasourceUnavailable()
      lastHistoryActionText.value = "status:unavailable"
      return
    }
    error.value = caught instanceof Error ? caught : new Error(String(caught))
    lastHistoryActionText.value = "status:error"
  }
}

async function runHistoryAction(direction: "undo" | "redo"): Promise<string | null> {
  if (httpDatasource && typeof httpDatasource.undoHistoryStack === "function" && typeof httpDatasource.redoHistoryStack === "function") {
    try {
      const result = direction === "undo"
        ? await httpDatasource.undoHistoryStack()
        : await httpDatasource.redoHistoryStack()
      const snapshotsApplied = await applyServerDemoRowSnapshots(result.rows)
      if (!snapshotsApplied && result.invalidation) {
        applyServerDemoMutationInvalidation(
          rowModel,
          result.invalidation as unknown as Parameters<typeof applyServerDemoMutationInvalidation>[1],
        )
      } else if (!snapshotsApplied) {
        await rowModel.refresh("manual")
      }
      applyServerHistoryStatus({
        canUndo: result.canUndo,
        canRedo: result.canRedo,
        latestUndoOperationId: result.latestUndoOperationId,
        latestRedoOperationId: result.latestRedoOperationId,
      })
      syncHistoryDiagnostics({
        operationId: result.operationId ?? null,
        canUndo: result.canUndo,
        canRedo: result.canRedo,
        affectedRows: result.affectedRows ?? 0,
        affectedCells: result.affectedCells ?? 0,
        latestUndoOperationId: result.latestUndoOperationId ?? null,
        latestRedoOperationId: result.latestRedoOperationId ?? null,
        action: direction,
      })
      gridRef.value?.restoreFocus?.()
      return result.operationId ?? null
    } catch (caught) {
      error.value = caught instanceof Error ? caught : new Error(String(caught))
      throw caught
    }
  }
  const result = await gridRef.value?.history.runHistoryAction(direction) ?? null
  syncHistoryDiagnostics({
    operationId: result ?? null,
    canUndo: gridRef.value?.history.canUndo() ?? false,
    canRedo: gridRef.value?.history.canRedo() ?? false,
    latestUndoOperationId: serverHistoryLatestUndoOperationId.value,
    latestRedoOperationId: serverHistoryLatestRedoOperationId.value,
    action: direction,
  })
  gridRef.value?.restoreFocus?.()
  return result
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
  void rowModel.refresh("mount").then(() => {
    startServerDemoLiveUpdates()
  }).catch((caught: unknown) => {
    if (isHttpUnavailableError(caught)) {
      markHttpDatasourceUnavailable()
      return
    }
    error.value = caught instanceof Error ? caught : new Error(String(caught))
  })
  reportFillPlumbingState("runtime_diagnostics_alive", true)
  reportFillPlumbingDetail("runtime_diagnostics_alive", "yes")
  lastEditRecordedText.value = "no"
})

onBeforeUnmount(() => {
  httpDatasource?.stopLiveUpdates()
  if (unsubscribeChangeFeedDiagnostics) {
    unsubscribeChangeFeedDiagnostics()
    unsubscribeChangeFeedDiagnostics = null
  }
  unsubscribeSampleDiagnostics()
  rowModel.dispose()
})
</script>

<style scoped>
.server-grid__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.server-grid__transport-select {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 2rem;
  padding: 0 0.55rem;
  border: 1px solid rgba(35, 42, 48, 0.14);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.68);
  color: rgba(35, 42, 48, 0.82);
  font-size: 0.78rem;
  font-weight: 650;
}

.server-grid__transport-select select {
  min-width: 7.5rem;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.server-grid__button[aria-pressed="true"] {
  border-color: rgba(37, 99, 235, 0.45);
  background: rgba(37, 99, 235, 0.1);
}

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

.server-grid__selection-summary {
  margin-top: 0.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: 0.55rem;
  background: rgba(15, 23, 42, 0.06);
  color: rgba(35, 42, 48, 0.86);
  font-size: 0.82rem;
  font-weight: 600;
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

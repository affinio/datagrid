<template>
  <section
    ref="stageRootEl"
    class="grid-stage"
    :class="{
      'grid-stage--canvas-chrome': true,
      'grid-stage--auto-row-height': mode === 'base' && rowHeightMode === 'auto',
      'grid-stage--range-moving': isRangeMoving,
    }"
  >
    <div ref="headerShellEl" class="grid-header-shell" :style="paneLayoutStyle">
      <canvas
        ref="centerHeaderChromeCanvasEl"
        class="grid-chrome-canvas grid-chrome-canvas--header-center"
        :style="centerHeaderChromeCanvasStyle"
        aria-hidden="true"
      />
      <div class="grid-header-pane grid-header-pane--left" :style="leftPaneStyle" @wheel="handleLinkedViewportWheel">
        <canvas ref="leftHeaderChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        <div class="grid-header-row grid-pane-track" :style="leftTrackStyle">
          <div class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header" :style="resolvedIndexColumnStyle">
            <div class="col-head">
              <span>#</span>
            </div>
            <div v-if="!hasColumnMenu()" class="col-filter col-filter--index-spacer" aria-hidden="true" />
          </div>
          <template v-if="hasColumnMenu()">
            <DataGridColumnMenu
              v-for="column in pinnedLeftColumns"
              :key="`header-left-${column.key}`"
              :rows="props.sourceRows ?? []"
              :column-key="column.key"
              :column-label="column.column.label ?? column.key"
              :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
              :sort-enabled="isColumnSortable(column)"
              :pin="column.pin"
              :filter-enabled="isColumnFilterable(column)"
              :filter-active="isColumnFilterActiveSafe(column.key)"
              :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
              :max-filter-values="columnMenuMaxFilterValues"
              @sort="applyColumnMenuSortSafe(column.key, $event)"
              @pin="applyColumnMenuPinSafe(column.key, $event)"
              @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
              @clear-filter="clearColumnMenuFilterSafe(column.key)"
              v-slot="{ open }"
            >
              <div
                class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
                :class="{
                  'grid-cell--header-menu-enabled': true,
                  'grid-cell--header-menu-open': open,
                }"
                :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
                :data-column-key="column.key"
                data-datagrid-column-menu-trigger="true"
              >
                <div class="col-head">
                  <span>{{ column.column.label ?? column.key }}</span>
                  <span v-if="isColumnFilterActiveSafe(column.key)" class="col-filter-badge" aria-hidden="true">F</span>
                  <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                  <button
                    type="button"
                    class="col-resize"
                    aria-label="Resize column"
                    @mousedown.stop.prevent="startResize($event, column.key)"
                    @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                    @click.stop
                  />
                </div>
              </div>
            </DataGridColumnMenu>
          </template>
          <template v-else>
            <div
              v-for="column in pinnedLeftColumns"
              :key="`header-left-${column.key}`"
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
              @click="handleHeaderColumnClick(column, $event.shiftKey)"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
              <div class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :value="columnFilterTextByKey[column.key] ?? ''"
                  :disabled="!isColumnFilterable(column)"
                  placeholder="Filter..."
                  @mousedown.stop
                  @keydown.stop
                  @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <div
        :ref="headerViewportRef"
        class="grid-header-viewport"
        @scroll="handleHeaderScroll"
        @wheel="handleLinkedViewportWheel"
      >
        <div class="grid-header-row grid-center-track" :style="mainTrackStyle">
          <div
            v-if="leftColumnSpacerWidth > 0"
            class="grid-column-spacer"
            :style="spacerStyle(leftColumnSpacerWidth)"
          />
          <template v-if="hasColumnMenu()">
            <DataGridColumnMenu
              v-for="column in renderedColumns"
              :key="`header-${column.key}`"
              :rows="props.sourceRows ?? []"
              :column-key="column.key"
              :column-label="column.column.label ?? column.key"
              :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
              :sort-enabled="isColumnSortable(column)"
              :pin="column.pin"
              :filter-enabled="isColumnFilterable(column)"
              :filter-active="isColumnFilterActiveSafe(column.key)"
              :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
              :max-filter-values="columnMenuMaxFilterValues"
              @sort="applyColumnMenuSortSafe(column.key, $event)"
              @pin="applyColumnMenuPinSafe(column.key, $event)"
              @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
              @clear-filter="clearColumnMenuFilterSafe(column.key)"
              v-slot="{ open }"
            >
              <div
                class="grid-cell grid-cell--header grid-cell--header-sortable"
                :class="{
                  'grid-cell--header-menu-enabled': true,
                  'grid-cell--header-menu-open': open,
                }"
                :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
                :data-column-key="column.key"
                data-datagrid-column-menu-trigger="true"
              >
                <div class="col-head">
                  <span>{{ column.column.label ?? column.key }}</span>
                  <span v-if="isColumnFilterActiveSafe(column.key)" class="col-filter-badge" aria-hidden="true">F</span>
                  <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                  <button
                    type="button"
                    class="col-resize"
                    aria-label="Resize column"
                    @mousedown.stop.prevent="startResize($event, column.key)"
                    @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                    @click.stop
                  />
                </div>
              </div>
            </DataGridColumnMenu>
          </template>
          <template v-else>
            <div
              v-for="column in renderedColumns"
              :key="`header-${column.key}`"
              class="grid-cell grid-cell--header grid-cell--header-sortable"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
              @click="handleHeaderColumnClick(column, $event.shiftKey)"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
              <div class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :value="columnFilterTextByKey[column.key] ?? ''"
                  :disabled="!isColumnFilterable(column)"
                  placeholder="Filter..."
                  @mousedown.stop
                  @keydown.stop
                  @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </template>
          <div
            v-if="rightColumnSpacerWidth > 0"
            class="grid-column-spacer"
            :style="spacerStyle(rightColumnSpacerWidth)"
          />
        </div>
      </div>

      <div class="grid-header-pane grid-header-pane--right" :style="rightPaneStyle" @wheel="handleLinkedViewportWheel">
        <canvas ref="rightHeaderChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        <div class="grid-header-row grid-pane-track" :style="rightTrackStyle">
          <template v-if="hasColumnMenu()">
            <DataGridColumnMenu
              v-for="column in pinnedRightColumns"
              :key="`header-right-${column.key}`"
              :rows="props.sourceRows ?? []"
              :column-key="column.key"
              :column-label="column.column.label ?? column.key"
              :sort-direction="resolveColumnMenuSortDirectionSafe(column.key)"
              :sort-enabled="isColumnSortable(column)"
              :pin="column.pin"
              :filter-enabled="isColumnFilterable(column)"
              :filter-active="isColumnFilterActiveSafe(column.key)"
              :selected-filter-tokens="resolveColumnMenuSelectedTokensSafe(column.key)"
              :max-filter-values="columnMenuMaxFilterValues"
              @sort="applyColumnMenuSortSafe(column.key, $event)"
              @pin="applyColumnMenuPinSafe(column.key, $event)"
              @apply-filter="applyColumnMenuFilterSafe(column.key, $event)"
              @clear-filter="clearColumnMenuFilterSafe(column.key)"
              v-slot="{ open }"
            >
              <div
                class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
                :class="{
                  'grid-cell--header-menu-enabled': true,
                  'grid-cell--header-menu-open': open,
                }"
                :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
                :data-column-key="column.key"
                data-datagrid-column-menu-trigger="true"
              >
                <div class="col-head">
                  <span>{{ column.column.label ?? column.key }}</span>
                  <span v-if="isColumnFilterActiveSafe(column.key)" class="col-filter-badge" aria-hidden="true">F</span>
                  <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                  <button
                    type="button"
                    class="col-resize"
                    aria-label="Resize column"
                    @mousedown.stop.prevent="startResize($event, column.key)"
                    @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                    @click.stop
                  />
                </div>
              </div>
            </DataGridColumnMenu>
          </template>
          <template v-else>
            <div
              v-for="column in pinnedRightColumns"
              :key="`header-right-${column.key}`"
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
              :data-column-key="column.key"
              @click="handleHeaderColumnClick(column, $event.shiftKey)"
            >
              <div class="col-head">
                <span>{{ column.column.label ?? column.key }}</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  aria-label="Resize column"
                  @mousedown.stop.prevent="startResize($event, column.key)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
              <div class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :value="columnFilterTextByKey[column.key] ?? ''"
                  :disabled="!isColumnFilterable(column)"
                  placeholder="Filter..."
                  @mousedown.stop
                  @keydown.stop
                  @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div ref="bodyShellRef" class="grid-body-shell" :style="paneLayoutStyle" @mouseleave="clearHoveredRow">
      <canvas
        ref="centerChromeCanvasEl"
        class="grid-chrome-canvas grid-chrome-canvas--center-shell"
        :style="centerChromeCanvasStyle"
        aria-hidden="true"
      />
      <div
        class="grid-body-pane grid-body-pane--left"
        :style="leftPaneStyle"
        @wheel="handleLinkedViewportWheel"
      >
        <canvas ref="leftChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        <div ref="leftPaneContentRef" class="grid-pane-content" :style="pinnedContentStyle">
          <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
          <div
            v-for="(row, rowOffset) in displayRows"
            :key="`${String(row.rowId)}-left-row`"
            class="grid-row"
            :class="[rowClass(row), rowStateClasses(rowOffset), { 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }]"
            :style="paneRowStyle(row, rowOffset, leftPaneWidth)"
            @click="toggleGroupRow(row)"
            @mouseenter="setHoveredRow(rowOffset)"
          >
            <div class="grid-cell grid-cell--index" :style="resolvedIndexColumnStyle" @click.stop="handleGroupCellClick(row)">
              {{ rowIndexLabel(row, rowOffset) }}
              <button
                v-if="mode === 'base'"
                type="button"
                class="row-resize-handle"
                aria-label="Resize rows"
                @mousedown.stop.prevent="startRowResize($event, row, rowOffset)"
                @dblclick.stop.prevent="autosizeRow($event, row, rowOffset)"
              />
            </div>
            <div
              v-for="column in pinnedLeftColumns"
              :key="`${String(row.rowId)}-left-${column.key}`"
              class="grid-cell grid-cell--pinned-left"
              :class="[cellStateClasses(row, rowOffset, columnIndexByKey(column.key)), resolveCellCustomClass(row, rowOffset, column, columnIndexByKey(column.key))]"
              :style="[columnStyle(column.key), bodyCellPresentationStyle(column), bodyCellSelectionStyle(column, rowOffset, columnIndexByKey(column.key)), resolveCellCustomStyle(row, rowOffset, column, columnIndexByKey(column.key))]"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              :tabindex="cellTabIndex(rowOffset, columnIndexByKey(column.key))"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @click.stop="handleGroupCellClick(row)"
              @mousemove="handleCellMouseMove($event, rowOffset, columnIndexByKey(column.key))"
              @mouseleave="clearRangeMoveHandleHover"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEditIfAllowed(row, column)"
            >
              <button
                v-if="mode === 'base' && isColumnEditable(column) && isFillHandleCellSafe(rowOffset, columnIndexByKey(column.key)) && !isEditingCellSafe(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="handleFillHandleMouseDown($event)"
                @dblclick.stop.prevent="handleFillHandleDoubleClick($event)"
              />
              <input
                v-if="isColumnEditable(column) && isEditingCellSafe(row, column.key)"
                class="cell-editor-input"
                :value="editingCellValue"
                @mousedown.stop
                @click.stop
                @input="updateEditingCellValue(($event.target as HTMLInputElement).value)"
                @keydown.stop="handleEditorKeydown"
                @blur="commitInlineEdit"
              />
              <template v-else>{{ readCell(row, column.key) }}</template>
            </div>
          </div>
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
          <div v-if="leftSelectionOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in leftSelectionOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment"
              :style="segment.style"
            />
          </div>
          <div v-if="leftFillPreviewOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in leftFillPreviewOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment grid-selection-overlay__segment--fill-preview"
              :style="segment.style"
            />
          </div>
          <div v-if="leftMovePreviewOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in leftMovePreviewOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment grid-selection-overlay__segment--move-preview"
              :style="segment.style"
            />
          </div>
        </div>
      </div>

      <div
        :ref="captureBodyViewportRef"
        class="grid-body-viewport table-wrap"
        tabindex="0"
        @scroll="handleCenterViewportScroll"
        @wheel="handleBodyViewportWheel"
        @keydown.stop="handleViewportKeydown"
      >
        <div class="grid-body-content" :style="gridContentStyle">
          <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
          <div
            v-for="(row, rowOffset) in displayRows"
            :key="String(row.rowId)"
            class="grid-row"
            :class="[rowClass(row), rowStateClasses(rowOffset), { 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }]"
            :style="rowStyle(row, rowOffset)"
            @click="toggleGroupRow(row)"
            @mouseenter="setHoveredRow(rowOffset)"
          >
            <div class="grid-center-track" :style="mainTrackStyle">
              <div
                v-if="leftColumnSpacerWidth > 0"
                class="grid-column-spacer"
                :style="spacerStyle(leftColumnSpacerWidth)"
              />
              <div
                v-for="column in renderedColumns"
                :key="`${String(row.rowId)}-${column.key}`"
                class="grid-cell"
                :class="[cellStateClasses(row, rowOffset, columnIndexByKey(column.key)), resolveCellCustomClass(row, rowOffset, column, columnIndexByKey(column.key))]"
                :style="[columnStyle(column.key), bodyCellPresentationStyle(column), bodyCellSelectionStyle(column, rowOffset, columnIndexByKey(column.key)), resolveCellCustomStyle(row, rowOffset, column, columnIndexByKey(column.key))]"
                :data-row-index="viewportRowStart + rowOffset"
                :data-column-index="columnIndexByKey(column.key)"
                :tabindex="cellTabIndex(rowOffset, columnIndexByKey(column.key))"
                @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
                @click.stop="handleGroupCellClick(row)"
                @mousemove="handleCellMouseMove($event, rowOffset, columnIndexByKey(column.key))"
                @mouseleave="clearRangeMoveHandleHover"
                @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
                @dblclick.stop="startInlineEditIfAllowed(row, column)"
              >
                <button
                  v-if="mode === 'base' && isColumnEditable(column) && isFillHandleCellSafe(rowOffset, columnIndexByKey(column.key)) && !isEditingCellSafe(row, column.key)"
                  type="button"
                  class="cell-fill-handle"
                  aria-label="Fill handle"
                  tabindex="-1"
                  @mousedown.stop.prevent="handleFillHandleMouseDown($event)"
                  @dblclick.stop.prevent="handleFillHandleDoubleClick($event)"
                />
                <input
                  v-if="isColumnEditable(column) && isEditingCellSafe(row, column.key)"
                  class="cell-editor-input"
                  :value="editingCellValue"
                  @mousedown.stop
                  @click.stop
                  @input="updateEditingCellValue(($event.target as HTMLInputElement).value)"
                  @keydown.stop="handleEditorKeydown"
                  @blur="commitInlineEdit"
                />
                <template v-else>{{ readCell(row, column.key) }}</template>
              </div>
              <div
                v-if="rightColumnSpacerWidth > 0"
                class="grid-column-spacer"
                :style="spacerStyle(rightColumnSpacerWidth)"
              />
            </div>
          </div>
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
          <div v-if="centerSelectionOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in centerSelectionOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment"
              :style="segment.style"
            />
          </div>
          <div v-if="centerFillPreviewOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in centerFillPreviewOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment grid-selection-overlay__segment--fill-preview"
              :style="segment.style"
            />
          </div>
          <div v-if="centerMovePreviewOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in centerMovePreviewOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment grid-selection-overlay__segment--move-preview"
              :style="segment.style"
            />
          </div>
        </div>
      </div>

      <div
        class="grid-body-pane grid-body-pane--right"
        :style="rightPaneStyle"
        @wheel="handleLinkedViewportWheel"
      >
        <canvas ref="rightChromeCanvasEl" class="grid-chrome-canvas" aria-hidden="true" />
        <div ref="rightPaneContentRef" class="grid-pane-content" :style="pinnedContentStyle">
          <div v-if="topSpacerHeight > 0" class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }" />
          <div
            v-for="(row, rowOffset) in displayRows"
            :key="`${String(row.rowId)}-right-row`"
            class="grid-row"
            :class="[rowClass(row), rowStateClasses(rowOffset), { 'grid-row--autosize-probe': isRowAutosizeProbe(row, rowOffset) }]"
            :style="paneRowStyle(row, rowOffset, rightPaneWidth)"
            @click="toggleGroupRow(row)"
            @mouseenter="setHoveredRow(rowOffset)"
          >
            <div
              v-for="column in pinnedRightColumns"
              :key="`${String(row.rowId)}-right-${column.key}`"
              class="grid-cell grid-cell--pinned-right"
              :class="[cellStateClasses(row, rowOffset, columnIndexByKey(column.key)), resolveCellCustomClass(row, rowOffset, column, columnIndexByKey(column.key))]"
              :style="[columnStyle(column.key), bodyCellPresentationStyle(column), bodyCellSelectionStyle(column, rowOffset, columnIndexByKey(column.key)), resolveCellCustomStyle(row, rowOffset, column, columnIndexByKey(column.key))]"
              :data-row-index="viewportRowStart + rowOffset"
              :data-column-index="columnIndexByKey(column.key)"
              :tabindex="cellTabIndex(rowOffset, columnIndexByKey(column.key))"
              @mousedown.prevent.stop="handleCellMouseDown($event, row, rowOffset, columnIndexByKey(column.key))"
              @click.stop="handleGroupCellClick(row)"
              @mousemove="handleCellMouseMove($event, rowOffset, columnIndexByKey(column.key))"
              @mouseleave="clearRangeMoveHandleHover"
              @keydown.stop="handleCellKeydown($event, row, rowOffset, columnIndexByKey(column.key))"
              @dblclick.stop="startInlineEditIfAllowed(row, column)"
            >
              <button
                v-if="mode === 'base' && isColumnEditable(column) && isFillHandleCellSafe(rowOffset, columnIndexByKey(column.key)) && !isEditingCellSafe(row, column.key)"
                type="button"
                class="cell-fill-handle"
                aria-label="Fill handle"
                tabindex="-1"
                @mousedown.stop.prevent="handleFillHandleMouseDown($event)"
                @dblclick.stop.prevent="handleFillHandleDoubleClick($event)"
              />
              <input
                v-if="isColumnEditable(column) && isEditingCellSafe(row, column.key)"
                class="cell-editor-input"
                :value="editingCellValue"
                @mousedown.stop
                @click.stop
                @input="updateEditingCellValue(($event.target as HTMLInputElement).value)"
                @keydown.stop="handleEditorKeydown"
                @blur="commitInlineEdit"
              />
              <template v-else>{{ readCell(row, column.key) }}</template>
            </div>
          </div>
          <div v-if="bottomSpacerHeight > 0" class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }" />
          <div v-if="rightSelectionOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in rightSelectionOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment"
              :style="segment.style"
            />
          </div>
          <div v-if="rightFillPreviewOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in rightFillPreviewOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment grid-selection-overlay__segment--fill-preview"
              :style="segment.style"
            />
          </div>
          <div v-if="rightMovePreviewOverlaySegments.length > 0" class="grid-selection-overlay" aria-hidden="true">
            <div
              v-for="segment in rightMovePreviewOverlaySegments"
              :key="segment.key"
              class="grid-selection-overlay__segment grid-selection-overlay__segment--move-preview"
              :style="segment.style"
            />
          </div>
        </div>
      </div>

      <div
        v-if="floatingFillActionStyle"
        class="grid-fill-action grid-fill-action--floating"
        :style="floatingFillActionStyle"
      >
        <button
          type="button"
          class="grid-fill-action__trigger"
          aria-label="Fill options"
          aria-haspopup="menu"
          :aria-expanded="fillActionMenuOpen ? 'true' : 'false'"
          tabindex="-1"
          @mousedown.stop
          @click.stop="toggleFloatingFillActionMenu($event)"
        >
          v
        </button>
        <div
          v-if="fillActionMenuOpen"
          class="grid-fill-action__menu"
          role="menu"
        >
          <button
            type="button"
            class="grid-fill-action__item"
            :class="{ 'grid-fill-action__item--active': props.fillActionBehavior === 'series' }"
            role="menuitemradio"
            :aria-checked="props.fillActionBehavior === 'series' ? 'true' : 'false'"
            @click.stop="selectFillActionBehavior('series')"
          >
            Series
          </button>
          <button
            type="button"
            class="grid-fill-action__item"
            :class="{ 'grid-fill-action__item--active': props.fillActionBehavior === 'copy' }"
            role="menuitemradio"
            :aria-checked="props.fillActionBehavior === 'copy' ? 'true' : 'false'"
            @click.stop="selectFillActionBehavior('copy')"
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance, type CSSProperties } from "vue"
import type {
  DataGridColumnPin,
  DataGridColumnSnapshot,
} from "@affino/datagrid-vue"
import {
  useDataGridLinkedPaneScrollSync,
  useDataGridManagedWheelScroll,
} from "@affino/datagrid-vue/advanced"
import {
  buildDataGridChromeRenderModel,
  type DataGridChromePaneModel,
  type DataGridChromeRowBand,
} from "@affino/datagrid-chrome"
import DataGridColumnMenu from "./DataGridColumnMenu.vue"
import type { DataGridTableRow, DataGridTableStageProps } from "./dataGridTableStage.types"
import { ensureDataGridAppStyles } from "./ensureDataGridAppStyles"

ensureDataGridAppStyles()

const props = defineProps<DataGridTableStageProps<Record<string, unknown>>>()

type TableRow = DataGridTableRow<Record<string, unknown>>
type TableColumn = DataGridColumnSnapshot & {
  column: DataGridColumnSnapshot["column"] & {
    presentation?: {
      align?: "left" | "center" | "right"
      headerAlign?: "left" | "center" | "right"
    }
    capabilities?: {
      editable?: boolean
      sortable?: boolean
      filterable?: boolean
    }
  }
}

type OverlaySegment = {
  key: string
  style: CSSProperties
}

type OverlayRange = NonNullable<DataGridTableStageProps<Record<string, unknown>>["selectionRange"]>
const RANGE_MOVE_HANDLE_HOVER_EDGE_PX = 6
const FILL_ACTION_ROOT_SELECTOR = ".grid-fill-action"
const FILL_ACTION_TRIGGER_SIZE_PX = 14
const FILL_ACTION_VIEWPORT_MARGIN_PX = 8

const columnMenuMaxFilterValues = computed(() => (
  typeof props.columnMenuMaxFilterValues === "number"
    ? props.columnMenuMaxFilterValues
    : 250
))

function hasColumnMenu(): boolean {
  if (props.columnMenuEnabled === true) {
    return true
  }
  return typeof props.applyColumnMenuSort === "function"
    || typeof props.applyColumnMenuPin === "function"
    || typeof props.applyColumnMenuFilter === "function"
    || typeof props.clearColumnMenuFilter === "function"
}

function resolveElementRef(value: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (value instanceof HTMLElement) {
    return value
  }
  if (value && "$el" in value) {
    const element = value.$el
    return element instanceof HTMLElement ? element : null
  }
  return null
}

function createSyntheticScrollEvent(target: HTMLElement): Event {
  return { target } as unknown as Event
}

function parsePixelValue(value: unknown, fallback: number): number {
  const parsed = Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveColumnWidth(column: TableColumn): number {
  const style = props.columnStyle(column.key)
  return parsePixelValue(style.width ?? style.minWidth ?? column.width, column.width ?? 140)
}

function resolveTextAlign(value: unknown): CSSProperties["textAlign"] | undefined {
  return value === "left" || value === "center" || value === "right"
    ? value
    : undefined
}

function isColumnEditable(column: TableColumn): boolean {
  return column.column.capabilities?.editable !== false
}

function isColumnSortable(column: TableColumn): boolean {
  return column.column.capabilities?.sortable !== false
}

function isColumnFilterable(column: TableColumn): boolean {
  return column.column.capabilities?.filterable !== false
}

function headerCellPresentationStyle(column: TableColumn): CSSProperties {
  const textAlign = resolveTextAlign(
    column.column.presentation?.headerAlign ?? column.column.presentation?.align,
  )
  return textAlign ? { textAlign } : {}
}

function bodyCellPresentationStyle(column: TableColumn): CSSProperties {
  const textAlign = resolveTextAlign(column.column.presentation?.align)
  return textAlign ? { textAlign } : {}
}

function bodyCellSelectionStyle(column: TableColumn, rowOffset: number, columnIndex: number): CSSProperties {
  if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
    if (column.pin === "left") {
      return { background: "var(--datagrid-pinned-left-bg)" }
    }
    if (column.pin === "right") {
      return { background: "var(--datagrid-pinned-right-bg)" }
    }
    return { background: "var(--datagrid-row-background-color)" }
  }
  if (shouldHighlightSelectedCellVisual(rowOffset, columnIndex)) {
    return { background: "var(--datagrid-selection-range-bg)" }
  }
  return {}
}

function resolveCellCustomClass(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
) {
  return props.cellClass?.(row, rowOffset, column, columnIndex) ?? null
}

function resolveCellCustomStyle(
  row: TableRow,
  rowOffset: number,
  column: TableColumn,
  columnIndex: number,
): CSSProperties {
  return props.cellStyle?.(row, rowOffset, column, columnIndex) ?? {}
}

function handleSortColumnClick(column: TableColumn, additive: boolean): void {
  if (!isColumnSortable(column)) {
    return
  }
  props.toggleSortForColumn(column.key, additive)
}

function isColumnFilterActiveSafe(columnKey: string): boolean {
  const evaluate = props.isColumnFilterActive
  return typeof evaluate === "function"
    ? evaluate(columnKey)
    : false
}

function resolveColumnMenuSortDirectionSafe(columnKey: string): "asc" | "desc" | null {
  const resolve = props.resolveColumnMenuSortDirection
  return typeof resolve === "function"
    ? resolve(columnKey)
    : null
}

function resolveColumnMenuSelectedTokensSafe(columnKey: string): readonly string[] {
  const resolve = props.resolveColumnMenuSelectedTokens
  return typeof resolve === "function"
    ? resolve(columnKey)
    : []
}

function applyColumnMenuSortSafe(columnKey: string, direction: "asc" | "desc" | null): void {
  props.applyColumnMenuSort?.(columnKey, direction)
}

function applyColumnMenuPinSafe(columnKey: string, pin: DataGridColumnPin): void {
  props.applyColumnMenuPin?.(columnKey, pin)
}

function applyColumnMenuFilterSafe(columnKey: string, tokens: readonly string[]): void {
  props.applyColumnMenuFilter?.(columnKey, tokens)
}

function clearColumnMenuFilterSafe(columnKey: string): void {
  props.clearColumnMenuFilter?.(columnKey)
}

function handleHeaderColumnClick(column: TableColumn, additive: boolean): void {
  handleSortColumnClick(column, additive)
}

function startInlineEditIfAllowed(row: TableRow, column: TableColumn): void {
  if (!isColumnEditable(column)) {
    return
  }
  props.startInlineEdit(row, column.key)
}

function cellTabIndex(rowOffset: number, columnIndex: number): number {
  return isVisualSelectionAnchorCell(rowOffset, columnIndex) ? 0 : -1
}

function handleFillHandleMouseDown(event: MouseEvent): void {
  fillActionMenuOpen.value = false
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
  props.startFillHandleDrag(event)
}

function handleFillHandleDoubleClick(event: MouseEvent): void {
  fillActionMenuOpen.value = false
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const cell = handle?.closest<HTMLElement>(".grid-cell")
  cell?.focus({ preventScroll: true })
  props.startFillHandleDoubleClick(event)
}

function focusFillActionAnchorCell(): void {
  const anchorCell = props.fillActionAnchorCell
  if (!anchorCell) {
    bodyViewportEl.value?.focus({ preventScroll: true })
    return
  }
  const cellElement = resolveVisibleCellElement(anchorCell.rowIndex, anchorCell.columnIndex)
  if (cellElement) {
    cellElement.focus({ preventScroll: true })
    return
  }
  bodyViewportEl.value?.focus({ preventScroll: true })
}

function toggleFloatingFillActionMenu(event: MouseEvent): void {
  if (!floatingFillActionStyle.value) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  focusFillActionAnchorCell()
  fillActionMenuOpen.value = !fillActionMenuOpen.value
}

function selectFillActionBehavior(behavior: "copy" | "series"): void {
  props.applyFillActionBehavior(behavior)
  fillActionMenuOpen.value = false
  focusFillActionAnchorCell()
}

function isCellSelectedSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isCellSelected
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function resolveVisualSelectionAnchorCell(): { rowIndex: number; columnIndex: number } | null {
  return props.selectionAnchorCell ?? null
}

function isVisualSelectionAnchorCell(rowOffset: number, columnIndex: number): boolean {
  const anchorCell = resolveVisualSelectionAnchorCell()
  return Boolean(
    anchorCell
    && props.viewportRowStart + rowOffset === anchorCell.rowIndex
    && columnIndex === anchorCell.columnIndex,
  )
}

function shouldHighlightSelectedCellVisual(rowOffset: number, columnIndex: number): boolean {
  if (!isCellSelectedSafe(rowOffset, columnIndex)) {
    return false
  }
  if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
    return false
  }
  return !isSingleSelectedCell.value
}

function isSelectionAnchorCellSafe(rowOffset: number, columnIndex: number): boolean {
  if (isVisualSelectionAnchorCell(rowOffset, columnIndex)) {
    return true
  }
  const evaluate = props.isSelectionAnchorCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellInFillPreviewSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isCellInFillPreview
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellInPendingClipboardRangeSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isCellInPendingClipboardRange
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

function isCellOnPendingClipboardEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  const evaluate = props.isCellOnPendingClipboardEdge
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex, edge)
    : false
}

function isEditingCellSafe(row: TableRow, columnKey: string): boolean {
  const evaluate = props.isEditingCell
  return typeof evaluate === "function"
    ? evaluate(row, columnKey)
    : false
}

function isFillHandleCellSafe(rowOffset: number, columnIndex: number): boolean {
  const evaluate = props.isFillHandleCell
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex)
    : false
}

const DEFAULT_INDEX_COLUMN_WIDTH = 72

const indexColumnWidthPx = computed(() => {
  const width = parsePixelValue(
    props.indexColumnStyle.width ?? props.indexColumnStyle.minWidth,
    DEFAULT_INDEX_COLUMN_WIDTH,
  )
  return width > 0 ? width : DEFAULT_INDEX_COLUMN_WIDTH
})

const resolvedIndexColumnStyle = computed<CSSProperties>(() => {
  const width = `${indexColumnWidthPx.value}px`
  return {
    ...props.indexColumnStyle,
    width,
    minWidth: width,
    maxWidth: width,
    left: "0px",
  }
})

const isRangeMoving = computed(() => props.isRangeMoving)

const pinnedLeftColumns = computed(() => props.visibleColumns.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => props.visibleColumns.filter(column => column.pin === "right"))

const leftPaneWidth = computed(() => {
  return indexColumnWidthPx.value + pinnedLeftColumns.value.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const rightPaneWidth = computed(() => {
  return pinnedRightColumns.value.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
})

const paneLayoutStyle = computed<CSSProperties>(() => ({
  gridTemplateColumns: `${leftPaneWidth.value}px minmax(0, 1fr) ${rightPaneWidth.value}px`,
}))

const leftPaneStyle = computed<CSSProperties>(() => ({
  width: `${leftPaneWidth.value}px`,
  minWidth: `${leftPaneWidth.value}px`,
  maxWidth: `${leftPaneWidth.value}px`,
}))

const rightPaneStyle = computed<CSSProperties>(() => ({
  width: `${rightPaneWidth.value}px`,
  minWidth: `${rightPaneWidth.value}px`,
  maxWidth: `${rightPaneWidth.value}px`,
}))

const centerHeaderChromeCanvasStyle = computed<CSSProperties>(() => ({
  left: `${leftPaneWidth.value}px`,
  width: `${Math.max(0, headerViewportClientWidth.value)}px`,
  height: `${Math.max(0, headerShellHeight.value)}px`,
}))

const centerChromeCanvasStyle = computed<CSSProperties>(() => ({
  left: `${leftPaneWidth.value}px`,
  width: `${Math.max(0, bodyViewportClientWidth.value)}px`,
  height: `${Math.max(0, bodyViewportClientHeight.value)}px`,
}))

const stageRootEl = ref<HTMLElement | null>(null)
const headerShellEl = ref<HTMLElement | null>(null)
const bodyViewportEl = ref<HTMLElement | null>(null)
const bodyShellRef = ref<HTMLElement | null>(null)
const leftPaneContentRef = ref<HTMLElement | null>(null)
const rightPaneContentRef = ref<HTMLElement | null>(null)
const leftHeaderChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const centerHeaderChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const rightHeaderChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const leftChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const centerChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const rightChromeCanvasEl = ref<HTMLCanvasElement | null>(null)
const hoveredRangeMoveHandleCell = ref<{ rowIndex: number; columnIndex: number } | null>(null)
const hoveredRowIndex = ref<number | null>(null)
const fillActionMenuOpen = ref(false)
const headerShellHeight = ref(0)
const headerViewportClientWidth = ref(0)
const bodyViewportScrollTop = ref(0)
const bodyViewportScrollLeft = ref(0)
const bodyViewportClientWidth = ref(0)
const bodyViewportClientHeight = ref(0)
const bodyViewportTopOffset = ref(0)
let gridChromeAnimationFrame = 0
let gridChromeResizeObserver: ResizeObserver | null = null

function clearRangeMoveHandleHover(): void {
  hoveredRangeMoveHandleCell.value = null
}

function clearHoveredRow(): void {
  hoveredRowIndex.value = null
}

function resolveAbsoluteRowIndex(rowOffset: number): number {
  return props.viewportRowStart + rowOffset
}

function setHoveredRow(rowOffset: number): void {
  if (!props.rowHover) {
    return
  }
  hoveredRowIndex.value = resolveAbsoluteRowIndex(rowOffset)
}

function isHoveredRow(rowOffset: number): boolean {
  return props.rowHover === true && hoveredRowIndex.value === resolveAbsoluteRowIndex(rowOffset)
}

function isStripedRow(rowOffset: number): boolean {
  return props.stripedRows === true && resolveAbsoluteRowIndex(rowOffset) % 2 === 1
}

function rowStateClasses(rowOffset: number): Record<string, boolean> {
  return {
    "grid-row--hoverable": props.rowHover === true,
    "grid-row--hovered": isHoveredRow(rowOffset),
    "grid-row--striped": isStripedRow(rowOffset),
  }
}

function isCellOnSelectionEdgeSafe(
  rowOffset: number,
  columnIndex: number,
  edge: "top" | "right" | "bottom" | "left",
): boolean {
  const evaluate = props.isCellOnSelectionEdge
  return typeof evaluate === "function"
    ? evaluate(rowOffset, columnIndex, edge)
    : false
}

function isNearRangeMoveSelectionEdge(
  event: MouseEvent,
  rowOffset: number,
  columnIndex: number,
): boolean {
  if (props.mode !== "base" || isRangeMoving.value || !props.selectionRange) {
    return false
  }
  if (!isCellSelectedSafe(rowOffset, columnIndex)) {
    return false
  }
  const cell = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  if (!cell) {
    return false
  }
  const rect = cell.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) {
    return false
  }
  const edgeThreshold = Math.max(
    1,
    Math.min(
      RANGE_MOVE_HANDLE_HOVER_EDGE_PX,
      Math.floor(rect.width / 2),
      Math.floor(rect.height / 2),
    ),
  )
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  return (
    (offsetY <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "top"))
    || (rect.height - offsetY <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "bottom"))
    || (offsetX <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "left"))
    || (rect.width - offsetX <= edgeThreshold && isCellOnSelectionEdgeSafe(rowOffset, columnIndex, "right"))
  )
}

function handleCellMouseMove(event: MouseEvent, rowOffset: number, columnIndex: number): void {
  if (!isNearRangeMoveSelectionEdge(event, rowOffset, columnIndex)) {
    clearRangeMoveHandleHover()
    return
  }
  hoveredRangeMoveHandleCell.value = {
    rowIndex: resolveAbsoluteRowIndex(rowOffset),
    columnIndex,
  }
}

function handleGroupCellClick(row: TableRow): void {
  if (row.kind !== "group") {
    return
  }
  props.toggleGroupRow(row)
}

function isRangeMoveHandleHoverCell(rowOffset: number, columnIndex: number): boolean {
  return (
    hoveredRangeMoveHandleCell.value?.rowIndex === resolveAbsoluteRowIndex(rowOffset)
    && hoveredRangeMoveHandleCell.value?.columnIndex === columnIndex
  )
}

function resolveVisibleAnchorCellPosition(): { rowIndex: number; columnIndex: number } | null {
  for (let rowOffset = 0; rowOffset < props.displayRows.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < props.visibleColumns.length; columnIndex += 1) {
      if (!isSelectionAnchorCellSafe(rowOffset, columnIndex)) {
        continue
      }
      return {
        rowIndex: resolveAbsoluteRowIndex(rowOffset),
        columnIndex,
      }
    }
  }
  return null
}

function resolveVisibleCellElement(rowIndex: number, columnIndex: number): HTMLElement | null {
  const selector = `.grid-cell[data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`
  for (const root of [leftPaneContentRef.value, bodyViewportEl.value, rightPaneContentRef.value]) {
    const match = root?.querySelector<HTMLElement>(selector)
    if (match) {
      return match
    }
  }
  return null
}

function resolveVisibleRowElement(rowIndex: number): HTMLElement | null {
  const selector = `.grid-cell[data-row-index="${rowIndex}"]`
  for (const root of [leftPaneContentRef.value, bodyViewportEl.value, rightPaneContentRef.value]) {
    const match = root?.querySelector<HTMLElement>(selector)
    if (match) {
      return match
    }
  }
  return null
}

function resolveHeaderViewportElement(): HTMLElement | null {
  return headerShellEl.value?.querySelector<HTMLElement>(".grid-header-viewport") ?? null
}

function resolveRelativeCellRect(cell: { rowIndex: number; columnIndex: number } | null): {
  left: number
  right: number
  top: number
  bottom: number
} | null {
  if (!cell) {
    return null
  }
  const cellElement = resolveVisibleCellElement(cell.rowIndex, cell.columnIndex)
  const shellRect = bodyShellRef.value?.getBoundingClientRect()
  if (!cellElement || !shellRect) {
    return null
  }
  const cellRect = cellElement.getBoundingClientRect()
  return {
    left: cellRect.left - shellRect.left,
    right: cellRect.right - shellRect.left,
    top: cellRect.top - shellRect.top,
    bottom: cellRect.bottom - shellRect.top,
  }
}

function focusVisibleAnchorCell(): void {
  const anchorCell = resolveVisibleAnchorCellPosition()
  if (!anchorCell) {
    bodyViewportEl.value?.focus({ preventScroll: true })
    return
  }
  const cellElement = resolveVisibleCellElement(anchorCell.rowIndex, anchorCell.columnIndex)
  if (cellElement) {
    cellElement.focus({ preventScroll: true })
    return
  }
  bodyViewportEl.value?.focus({ preventScroll: true })
}

function restoreAnchorCellFocus(): void {
  focusVisibleAnchorCell()
  void nextTick(() => {
    focusVisibleAnchorCell()
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        focusVisibleAnchorCell()
      })
    }
  })
}

function captureBodyViewportRef(value: Element | ComponentPublicInstance | null): void {
  bodyViewportEl.value = resolveElementRef(value)
  props.bodyViewportRef(value)
  syncBodyViewportMetrics()
  connectGridChromeResizeObserver()
  scheduleGridChromeRedraw()
}

function syncBodyViewportMetrics(): void {
  const viewport = bodyViewportEl.value
  const shell = bodyShellRef.value
  if (!viewport || !shell) {
    return
  }
  const viewportRect = viewport.getBoundingClientRect()
  const shellRect = shell.getBoundingClientRect()
  bodyViewportScrollTop.value = viewport.scrollTop
  bodyViewportScrollLeft.value = viewport.scrollLeft
  bodyViewportClientWidth.value = viewport.clientWidth
  bodyViewportClientHeight.value = viewport.clientHeight
  bodyViewportTopOffset.value = Math.max(0, viewportRect.top - shellRect.top)
  headerShellHeight.value = headerShellEl.value?.getBoundingClientRect().height ?? 0
  headerViewportClientWidth.value = resolveHeaderViewportElement()?.clientWidth ?? bodyViewportClientWidth.value
}

function resolveGridChromeDevicePixelRatio(): number {
  if (typeof window === "undefined") {
    return 1
  }
  return Math.max(1, window.devicePixelRatio || 1)
}

function resolveGridChromeColor(variableName: string, fallback: string): string {
  const root = stageRootEl.value
  if (!root || typeof window === "undefined") {
    return fallback
  }
  const value = window.getComputedStyle(root).getPropertyValue(variableName).trim()
  return value || fallback
}

function resolveGridChromeLineWidth(variableName: string, fallback: number): number {
  const root = stageRootEl.value
  if (!root || typeof window === "undefined") {
    return fallback
  }
  const value = Number.parseFloat(window.getComputedStyle(root).getPropertyValue(variableName))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function prepareGridChromeCanvas(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  if (!canvas || width <= 0 || height <= 0) {
    if (canvas) {
      const context = canvas.getContext("2d")
      context?.clearRect(0, 0, canvas.width, canvas.height)
    }
    return null
  }
  const dpr = resolveGridChromeDevicePixelRatio()
  const pixelWidth = Math.max(1, Math.round(width * dpr))
  const pixelHeight = Math.max(1, Math.round(height * dpr))
  if (canvas.width !== pixelWidth) {
    canvas.width = pixelWidth
  }
  if (canvas.height !== pixelHeight) {
    canvas.height = pixelHeight
  }
  const context = canvas.getContext("2d")
  if (!context) {
    return null
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, width, height)
  return context
}

function drawGridChromeHorizontalLines(
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
  rowDividerColor: string,
  rowDividerWidth: number,
): void {
  if (pane.width <= 0 || pane.height <= 0 || rowDividerWidth <= 0) {
    return
  }
  context.save()
  context.strokeStyle = rowDividerColor
  context.lineWidth = rowDividerWidth
  context.beginPath()
  for (const line of pane.horizontalLines) {
    const y = Math.round(line.position) - 0.5
    if (y < -rowDividerWidth || y > pane.height + rowDividerWidth) {
      continue
    }
    context.moveTo(0, y)
    context.lineTo(pane.width, y)
  }
  context.stroke()
  context.restore()
}

function resolveGridChromeBandColor(kind: string): string {
  switch (kind) {
    case "base":
      return resolveGridChromeColor(
        "--datagrid-row-band-base-bg",
        "rgba(255, 255, 255, 1)",
      )
    case "striped":
      return resolveGridChromeColor(
        "--datagrid-row-band-striped-bg",
        "rgba(59, 130, 246, 0.06)",
      )
    case "group":
      return resolveGridChromeColor(
        "--datagrid-row-band-group-bg",
        "rgba(59, 130, 246, 0.08)",
      )
    case "tree":
      return resolveGridChromeColor(
        "--datagrid-row-band-tree-bg",
        "rgba(59, 130, 246, 0.12)",
      )
    case "pivot":
      return resolveGridChromeColor(
        "--datagrid-row-band-pivot-bg",
        "rgba(59, 130, 246, 0.1)",
      )
    case "pivot-group":
      return resolveGridChromeColor(
        "--datagrid-row-band-pivot-group-bg",
        "rgba(59, 130, 246, 0.14)",
      )
    default:
      return ""
  }
}

function drawGridChromeBands(
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
): void {
  if (pane.width <= 0 || pane.height <= 0 || pane.bands.length === 0) {
    return
  }
  context.save()
  for (const band of pane.bands) {
    const fillStyle = resolveGridChromeBandColor(band.kind)
    if (!fillStyle) {
      continue
    }
    const top = Math.round(band.top)
    const height = Math.max(1, Math.round(band.height))
    const clippedTop = Math.max(0, top)
    const clippedBottom = Math.min(pane.height, top + height)
    const clippedHeight = clippedBottom - clippedTop
    if (clippedHeight <= 0) {
      continue
    }
    context.fillStyle = fillStyle
    context.fillRect(0, clippedTop, pane.width, clippedHeight)
  }
  context.restore()
}

function drawGridChromeVerticalLines(
  context: CanvasRenderingContext2D,
  pane: DataGridChromePaneModel,
  columnDividerColor: string,
  columnDividerWidth: number,
): void {
  if (pane.height <= 0 || columnDividerWidth <= 0 || pane.verticalLines.length === 0) {
    return
  }
  context.save()
  context.strokeStyle = columnDividerColor
  context.lineWidth = columnDividerWidth
  context.beginPath()
  for (const line of pane.verticalLines) {
    const x = Math.round(line.position) - 0.5
    if (x < -columnDividerWidth || x > pane.width + columnDividerWidth) {
      continue
    }
    context.moveTo(x, 0)
    context.lineTo(x, pane.height)
  }
  context.stroke()
  context.restore()
}

function drawGridChromeCanvas(): void {
  gridChromeAnimationFrame = 0
  const headerRenderModel = headerChromeRenderModel.value
  const renderModel = chromeRenderModel.value
  const rowDividerColor = resolveGridChromeColor("--datagrid-row-divider-color", "rgba(0, 0, 0, 0.08)")
  const columnDividerColor = resolveGridChromeColor("--datagrid-column-divider-color", "rgba(0, 0, 0, 0.08)")
  const headerColumnDividerColor = resolveGridChromeColor("--datagrid-header-column-divider-color", columnDividerColor)
  const rowDividerWidth = resolveGridChromeLineWidth("--datagrid-row-divider-size", 1)
  const columnDividerWidth = resolveGridChromeLineWidth("--datagrid-column-divider-size", 1)

  const leftHeaderContext = prepareGridChromeCanvas(
    leftHeaderChromeCanvasEl.value,
    headerRenderModel.left.width,
    headerRenderModel.left.height,
  )
  if (leftHeaderContext) {
    drawGridChromeVerticalLines(leftHeaderContext, headerRenderModel.left, headerColumnDividerColor, columnDividerWidth)
  }

  const centerHeaderContext = prepareGridChromeCanvas(
    centerHeaderChromeCanvasEl.value,
    headerRenderModel.center.width,
    headerRenderModel.center.height,
  )
  if (centerHeaderContext) {
    drawGridChromeVerticalLines(centerHeaderContext, headerRenderModel.center, headerColumnDividerColor, columnDividerWidth)
  }

  const rightHeaderContext = prepareGridChromeCanvas(
    rightHeaderChromeCanvasEl.value,
    headerRenderModel.right.width,
    headerRenderModel.right.height,
  )
  if (rightHeaderContext) {
    drawGridChromeVerticalLines(rightHeaderContext, headerRenderModel.right, headerColumnDividerColor, columnDividerWidth)
  }

  const leftContext = prepareGridChromeCanvas(leftChromeCanvasEl.value, renderModel.left.width, renderModel.left.height)
  if (leftContext) {
    drawGridChromeBands(leftContext, renderModel.left)
    drawGridChromeHorizontalLines(leftContext, renderModel.left, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(leftContext, renderModel.left, columnDividerColor, columnDividerWidth)
  }

  const centerContext = prepareGridChromeCanvas(centerChromeCanvasEl.value, renderModel.center.width, renderModel.center.height)
  if (centerContext) {
    drawGridChromeBands(centerContext, renderModel.center)
    drawGridChromeHorizontalLines(centerContext, renderModel.center, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(centerContext, renderModel.center, columnDividerColor, columnDividerWidth)
  }

  const rightContext = prepareGridChromeCanvas(rightChromeCanvasEl.value, renderModel.right.width, renderModel.right.height)
  if (rightContext) {
    drawGridChromeBands(rightContext, renderModel.right)
    drawGridChromeHorizontalLines(rightContext, renderModel.right, rowDividerColor, rowDividerWidth)
    drawGridChromeVerticalLines(rightContext, renderModel.right, columnDividerColor, columnDividerWidth)
  }
}

function scheduleGridChromeRedraw(): void {
  if (typeof window === "undefined") {
    drawGridChromeCanvas()
    return
  }
  if (gridChromeAnimationFrame !== 0) {
    return
  }
  gridChromeAnimationFrame = window.requestAnimationFrame(() => {
    drawGridChromeCanvas()
  })
}

function connectGridChromeResizeObserver(): void {
  if (typeof ResizeObserver === "undefined") {
    return
  }
  if (!gridChromeResizeObserver) {
    gridChromeResizeObserver = new ResizeObserver(() => {
      syncBodyViewportMetrics()
      scheduleGridChromeRedraw()
    })
  }
  gridChromeResizeObserver.disconnect()
  if (bodyViewportEl.value) {
    gridChromeResizeObserver.observe(bodyViewportEl.value)
  }
  if (bodyShellRef.value) {
    gridChromeResizeObserver.observe(bodyShellRef.value)
  }
  if (headerShellEl.value) {
    gridChromeResizeObserver.observe(headerShellEl.value)
  }
  const headerViewport = resolveHeaderViewportElement()
  if (headerViewport) {
    gridChromeResizeObserver.observe(headerViewport)
  }
}

const chromeRenderModel = computed(() => (
  buildDataGridChromeRenderModel({
    rowMetrics: rowMetrics.value,
    rowBands: rowBands.value,
    scrollTop: bodyViewportScrollTop.value,
    leftPaneWidth: leftPaneWidth.value,
    centerPaneWidth: bodyViewportClientWidth.value,
    rightPaneWidth: rightPaneWidth.value,
    viewportHeight: bodyViewportClientHeight.value,
    leftColumnWidths: [
      indexColumnWidthPx.value,
      ...pinnedLeftColumns.value.map(resolveColumnWidth),
    ],
    centerColumnWidths: [
      props.leftColumnSpacerWidth,
      ...props.renderedColumns.map(resolveColumnWidth),
      props.rightColumnSpacerWidth,
    ].filter(width => width > 0),
    rightColumnWidths: pinnedRightColumns.value.map(resolveColumnWidth),
    centerScrollLeft: bodyViewportScrollLeft.value,
  })
))

const headerChromeRenderModel = computed(() => (
  buildDataGridChromeRenderModel({
    rowMetrics: headerShellHeight.value > 0
      ? [{ top: 0, height: headerShellHeight.value }]
      : [],
    scrollTop: 0,
    leftPaneWidth: leftPaneWidth.value,
    centerPaneWidth: headerViewportClientWidth.value,
    rightPaneWidth: rightPaneWidth.value,
    viewportHeight: headerShellHeight.value,
    leftColumnWidths: [
      indexColumnWidthPx.value,
      ...pinnedLeftColumns.value.map(resolveColumnWidth),
    ],
    centerColumnWidths: [
      props.leftColumnSpacerWidth,
      ...props.renderedColumns.map(resolveColumnWidth),
      props.rightColumnSpacerWidth,
    ].filter(width => width > 0),
    rightColumnWidths: pinnedRightColumns.value.map(resolveColumnWidth),
    centerScrollLeft: bodyViewportScrollLeft.value,
  })
))

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min
  }
  return Math.min(Math.max(value, min), max)
}

const centerColumns = computed(() => props.visibleColumns.filter(column => column.pin !== "left" && column.pin !== "right"))

const effectiveBodyViewportWidth = computed(() => {
  return bodyViewportClientWidth.value > 0
    ? bodyViewportClientWidth.value
    : parsePixelValue(props.gridContentStyle.width ?? props.gridContentStyle.minWidth, 0)
})

function resolveVisibleFillActionAnchorCell(): { rowIndex: number; columnIndex: number } | null {
  const anchorCell = props.fillActionAnchorCell
  if (!anchorCell) {
    return null
  }

  const visibleRowStart = props.viewportRowStart
  const visibleRowEnd = props.viewportRowStart + Math.max(0, props.displayRows.length - 1)
  const range = props.selectionRange
  const selectionRowStart = range ? Math.min(range.startRow, range.endRow) : anchorCell.rowIndex
  const selectionRowEnd = range ? Math.max(range.startRow, range.endRow) : anchorCell.rowIndex
  const selectionColumnStart = range ? Math.min(range.startColumn, range.endColumn) : anchorCell.columnIndex
  const selectionColumnEnd = range ? Math.max(range.startColumn, range.endColumn) : anchorCell.columnIndex
  const clampedRowStart = Math.max(selectionRowStart, visibleRowStart)
  const clampedRowEnd = Math.min(selectionRowEnd, visibleRowEnd)
  const rowIndex = clampedRowStart <= clampedRowEnd
    ? clamp(anchorCell.rowIndex, clampedRowStart, clampedRowEnd)
    : anchorCell.rowIndex

  const visibleCenterColumnKeys = new Set(props.renderedColumns.map(column => column.key))
  const visibleColumnIndexes = props.visibleColumns
    .map((column, columnIndex) => ({ column, columnIndex }))
    .filter(({ column, columnIndex }) => {
      if (columnIndex < selectionColumnStart || columnIndex > selectionColumnEnd) {
        return false
      }
      return column.pin === "left"
        || column.pin === "right"
        || visibleCenterColumnKeys.has(column.key)
    })
    .map(({ columnIndex }) => columnIndex)

  const columnIndex = visibleColumnIndexes.length > 0
    ? clamp(
        anchorCell.columnIndex,
        visibleColumnIndexes[0] ?? anchorCell.columnIndex,
        visibleColumnIndexes[visibleColumnIndexes.length - 1] ?? anchorCell.columnIndex,
      )
    : anchorCell.columnIndex

  return {
    rowIndex,
    columnIndex,
  }
}

function resolveFloatingFillActionLeft(): number | null {
  const anchorCell = resolveVisibleFillActionAnchorCell() ?? props.fillActionAnchorCell
  if (!anchorCell) {
    return null
  }
  const relativeCellRect = resolveRelativeCellRect(anchorCell)
  if (relativeCellRect) {
    return clamp(
      relativeCellRect.right - FILL_ACTION_TRIGGER_SIZE_PX,
      FILL_ACTION_VIEWPORT_MARGIN_PX,
      leftPaneWidth.value + effectiveBodyViewportWidth.value + rightPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
    )
  }
  const column = props.visibleColumns[anchorCell.columnIndex]
  if (!column) {
    return null
  }

  if (column.pin === "left") {
    let cellRight = indexColumnWidthPx.value
    for (const pinnedColumn of pinnedLeftColumns.value) {
      cellRight += resolveColumnWidth(pinnedColumn)
      if (pinnedColumn.key === column.key) {
        break
      }
    }
    return clamp(
      cellRight - FILL_ACTION_TRIGGER_SIZE_PX,
      FILL_ACTION_VIEWPORT_MARGIN_PX,
      Math.max(FILL_ACTION_VIEWPORT_MARGIN_PX, leftPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX),
    )
  }

  if (column.pin === "right") {
    let cellRight = leftPaneWidth.value + effectiveBodyViewportWidth.value
    for (const pinnedColumn of pinnedRightColumns.value) {
      cellRight += resolveColumnWidth(pinnedColumn)
      if (pinnedColumn.key === column.key) {
        break
      }
    }
    const rightPaneStart = leftPaneWidth.value + effectiveBodyViewportWidth.value
    return clamp(
      cellRight - FILL_ACTION_TRIGGER_SIZE_PX,
      rightPaneStart + FILL_ACTION_VIEWPORT_MARGIN_PX,
      Math.max(
        rightPaneStart + FILL_ACTION_VIEWPORT_MARGIN_PX,
        rightPaneStart + rightPaneWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
      ),
    )
  }

  let cellRight = leftPaneWidth.value - bodyViewportScrollLeft.value
  for (const centerColumn of centerColumns.value) {
    cellRight += resolveColumnWidth(centerColumn)
    if (centerColumn.key === column.key) {
      break
    }
  }
  const viewportLeft = leftPaneWidth.value + FILL_ACTION_VIEWPORT_MARGIN_PX
  const viewportRight = leftPaneWidth.value + effectiveBodyViewportWidth.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX
  return clamp(cellRight - FILL_ACTION_TRIGGER_SIZE_PX, viewportLeft, viewportRight)
}

function resolveFloatingFillActionTop(): number {
  const viewportTop = bodyViewportTopOffset.value + FILL_ACTION_VIEWPORT_MARGIN_PX
  const viewportBottom = bodyViewportTopOffset.value + Math.max(
    0,
    bodyViewportClientHeight.value - FILL_ACTION_TRIGGER_SIZE_PX - FILL_ACTION_VIEWPORT_MARGIN_PX,
  )
  const anchorCell = props.fillActionAnchorCell
  const targetCell = resolveVisibleFillActionAnchorCell()
  if (anchorCell && targetCell && anchorCell.rowIndex !== targetCell.rowIndex) {
    return viewportBottom
  }
  const relativeCellRect = resolveRelativeCellRect(targetCell)
  if (relativeCellRect) {
    return clamp(relativeCellRect.bottom - FILL_ACTION_TRIGGER_SIZE_PX, viewportTop, viewportBottom)
  }
  const shellRect = bodyShellRef.value?.getBoundingClientRect()
  const rowElement = targetCell ? resolveVisibleRowElement(targetCell.rowIndex) : null
  if (!shellRect || !rowElement) {
    return viewportBottom
  }
  const rowRect = rowElement.getBoundingClientRect()
  const rowBottom = rowRect.bottom - shellRect.top - FILL_ACTION_TRIGGER_SIZE_PX
  return clamp(rowBottom, viewportTop, viewportBottom)
}

const floatingFillActionStyle = computed<CSSProperties | null>(() => {
  if (!props.fillActionAnchorCell) {
    return null
  }
  const left = resolveFloatingFillActionLeft()
  if (left == null) {
    return null
  }
  const top = resolveFloatingFillActionTop()
  return {
    left: `${left}px`,
    top: `${top}px`,
  }
})

watch(
  () => props.fillPreviewRange,
  (nextRange, previousRange) => {
    if (previousRange && !nextRange) {
      restoreAnchorCellFocus()
    }
  },
)

watch(
  () => props.fillActionAnchorCell
    ? `${props.fillActionAnchorCell.rowIndex}:${props.fillActionAnchorCell.columnIndex}`
    : "",
  () => {
    fillActionMenuOpen.value = false
  },
)

watch(fillActionMenuOpen, (open, _previous, onCleanup) => {
  if (!open || typeof window === "undefined") {
    return
  }

  const handlePointerDown = (event: MouseEvent) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest(FILL_ACTION_ROOT_SELECTOR)) {
      return
    }
    fillActionMenuOpen.value = false
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      fillActionMenuOpen.value = false
      focusFillActionAnchorCell()
    }
  }

  window.addEventListener("mousedown", handlePointerDown, true)
  window.addEventListener("keydown", handleKeydown)
  onCleanup(() => {
    window.removeEventListener("mousedown", handlePointerDown, true)
    window.removeEventListener("keydown", handleKeydown)
  })
})

const linkedPaneScrollSync = useDataGridLinkedPaneScrollSync({
  resolveSourceScrollTop: () => bodyViewportEl.value?.scrollTop ?? 0,
  mode: "direct-transform",
  resolvePaneElements: () => [leftPaneContentRef.value, rightPaneContentRef.value],
})

const managedWheelScroll = useDataGridManagedWheelScroll({
  resolveBodyViewport: () => bodyViewportEl.value,
  resolveMainViewport: () => bodyViewportEl.value,
  setHandledScrollTop: (value: number) => {
    if (bodyViewportEl.value) {
      bodyViewportEl.value.scrollTop = value
    }
  },
  setHandledScrollLeft: (value: number) => {
    if (bodyViewportEl.value) {
      bodyViewportEl.value.scrollLeft = value
    }
  },
  syncLinkedScroll: (scrollTop: number) => {
    linkedPaneScrollSync.syncNow(scrollTop)
  },
  scheduleLinkedScrollSyncLoop: linkedPaneScrollSync.scheduleSyncLoop,
  isLinkedScrollSyncLoopScheduled: linkedPaneScrollSync.isSyncLoopScheduled,
  onWheelConsumed: () => {
    const bodyViewport = bodyViewportEl.value
    if (!bodyViewport) {
      return
    }
    props.handleViewportScroll(createSyntheticScrollEvent(bodyViewport))
  },
})

function handleCenterViewportScroll(event: Event): void {
  props.handleViewportScroll(event)
  const element = event.target as HTMLElement | null
  if (!element) {
    return
  }
  linkedPaneScrollSync.onSourceScroll(element.scrollTop)
  syncBodyViewportMetrics()
  scheduleGridChromeRedraw()
}

function handleLinkedViewportWheel(event: WheelEvent): void {
  managedWheelScroll.onLinkedViewportWheel(event)
}

function handleBodyViewportWheel(event: WheelEvent): void {
  managedWheelScroll.onBodyViewportWheel(event)
}

onBeforeUnmount(() => {
  linkedPaneScrollSync.reset()
  managedWheelScroll.reset()
  if (gridChromeAnimationFrame !== 0 && typeof window !== "undefined") {
    window.cancelAnimationFrame(gridChromeAnimationFrame)
    gridChromeAnimationFrame = 0
  }
  gridChromeResizeObserver?.disconnect()
  gridChromeResizeObserver = null
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", syncBodyViewportMetrics)
  }
})

onMounted(() => {
  syncBodyViewportMetrics()
  connectGridChromeResizeObserver()
  scheduleGridChromeRedraw()
  if (typeof window !== "undefined") {
    window.addEventListener("resize", syncBodyViewportMetrics)
  }
})

const leftTrackStyle = computed<CSSProperties>(() => ({
  width: `${leftPaneWidth.value}px`,
  minWidth: `${leftPaneWidth.value}px`,
  maxWidth: `${leftPaneWidth.value}px`,
}))

const rightTrackStyle = computed<CSSProperties>(() => ({
  width: `${rightPaneWidth.value}px`,
  minWidth: `${rightPaneWidth.value}px`,
  maxWidth: `${rightPaneWidth.value}px`,
}))

const rowMetrics = computed(() => {
  const metrics: Array<{ top: number; height: number }> = []
  let currentTop = props.topSpacerHeight
  props.displayRows.forEach((row, rowOffset) => {
    const style = props.rowStyle(row, rowOffset)
    const height = parsePixelValue(style.height ?? style.minHeight, 31)
    metrics.push({
      top: currentTop,
      height,
    })
    currentTop += height
  })
  return metrics
})

const rowMetricsSignature = computed(() => (
  rowMetrics.value.map(metric => `${metric.top}:${metric.height}`).join("|")
))

function resolveChromeRowBandKind(row: TableRow, rowOffset: number): string | null {
  const className = props.rowClass(row)
  if (className.includes("row--group") && className.includes("row--pivot")) {
    return "pivot-group"
  }
  if (className.includes("row--group")) {
    return "group"
  }
  if (className.includes("row--tree")) {
    return "tree"
  }
  if (className.includes("row--pivot")) {
    return "pivot"
  }
  if (isStripedRow(rowOffset)) {
    return "striped"
  }
  return "base"
}

const rowBands = computed<readonly DataGridChromeRowBand[]>(() => (
  props.displayRows.flatMap((row, rowOffset) => {
    const metric = rowMetrics.value[rowOffset]
    const kind = resolveChromeRowBandKind(row, rowOffset)
    if (!metric || !kind) {
      return []
    }
    return [{
      rowIndex: rowOffset,
      top: metric.top,
      height: metric.height,
      kind,
    }]
  })
))

const rowBandsSignature = computed(() => (
  rowBands.value.map(band => `${band.kind}:${band.top}:${band.height}`).join("|")
))

const leftChromeColumnsSignature = computed(() => (
  [
    indexColumnWidthPx.value,
    ...pinnedLeftColumns.value.map(resolveColumnWidth),
  ].join("|")
))

const centerChromeColumnsSignature = computed(() => (
  [
    props.leftColumnSpacerWidth,
    ...props.renderedColumns.map(resolveColumnWidth),
    props.rightColumnSpacerWidth,
  ].join("|")
))

const rightChromeColumnsSignature = computed(() => (
  pinnedRightColumns.value.map(resolveColumnWidth).join("|")
))

watch(
  () => [
    leftPaneWidth.value,
    rightPaneWidth.value,
    rowMetricsSignature.value,
    rowBandsSignature.value,
    leftChromeColumnsSignature.value,
    centerChromeColumnsSignature.value,
    rightChromeColumnsSignature.value,
  ].join("|"),
  () => {
    syncBodyViewportMetrics()
    scheduleGridChromeRedraw()
  },
)

function resolveVisibleRowMetricsFromDom(): readonly { top: number; height: number }[] {
  const viewport = bodyViewportEl.value
  if (!viewport) {
    return rowMetrics.value
  }
  const viewportRect = viewport.getBoundingClientRect()
  const rowElements = Array.from(
    viewport.querySelectorAll<HTMLElement>(".grid-body-content > .grid-row"),
  )
  if (rowElements.length !== props.displayRows.length) {
    return rowMetrics.value
  }
  return rowElements.map(rowElement => {
    const rowRect = rowElement.getBoundingClientRect()
    return {
      top: viewport.scrollTop + (rowRect.top - viewportRect.top),
      height: rowRect.height,
    }
  })
}

const visibleColumnIndexByKey = computed(() => {
  const indexByKey = new Map<string, number>()
  props.visibleColumns.forEach((column, index) => {
    indexByKey.set(column.key, index)
  })
  return indexByKey
})

const visibleSelectionBounds = computed(() => {
  let startRowOffset: number | null = null
  let endRowOffset: number | null = null
  let startColumnIndex: number | null = null
  let endColumnIndex: number | null = null

  for (let rowOffset = 0; rowOffset < props.displayRows.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < props.visibleColumns.length; columnIndex += 1) {
      if (!isCellSelectedSafe(rowOffset, columnIndex)) {
        continue
      }
      startRowOffset ??= rowOffset
      endRowOffset = rowOffset
      startColumnIndex = startColumnIndex == null ? columnIndex : Math.min(startColumnIndex, columnIndex)
      endColumnIndex = endColumnIndex == null ? columnIndex : Math.max(endColumnIndex, columnIndex)
    }
  }

  if (
    startRowOffset == null
    || endRowOffset == null
    || startColumnIndex == null
    || endColumnIndex == null
  ) {
    return null
  }

  return {
    startRowOffset,
    endRowOffset,
    startColumnIndex,
    endColumnIndex,
  }
})

const visibleFillPreviewBounds = computed(() => {
  let startRowOffset: number | null = null
  let endRowOffset: number | null = null
  let startColumnIndex: number | null = null
  let endColumnIndex: number | null = null

  for (let rowOffset = 0; rowOffset < props.displayRows.length; rowOffset += 1) {
    for (let columnIndex = 0; columnIndex < props.visibleColumns.length; columnIndex += 1) {
      if (!isCellInFillPreviewSafe(rowOffset, columnIndex)) {
        continue
      }
      startRowOffset ??= rowOffset
      endRowOffset = rowOffset
      startColumnIndex = startColumnIndex == null ? columnIndex : Math.min(startColumnIndex, columnIndex)
      endColumnIndex = endColumnIndex == null ? columnIndex : Math.max(endColumnIndex, columnIndex)
    }
  }

  if (
    startRowOffset == null
    || endRowOffset == null
    || startColumnIndex == null
    || endColumnIndex == null
  ) {
    return null
  }

  return {
    startRowOffset,
    endRowOffset,
    startColumnIndex,
    endColumnIndex,
  }
})

const isSingleSelectedCell = computed(() => {
  const range = props.selectionRange
  if (!range) {
    return false
  }
  return range.startRow === range.endRow
    && range.startColumn === range.endColumn
})

function columnIndexByKey(columnKey: string): number {
  return visibleColumnIndexByKey.value.get(columnKey) ?? 0
}

function paneRowStyle(row: TableRow, rowOffset: number, paneWidth: number): CSSProperties {
  return {
    ...props.rowStyle(row, rowOffset),
    width: `${paneWidth}px`,
    minWidth: `${paneWidth}px`,
    maxWidth: `${paneWidth}px`,
  }
}

function spacerStyle(width: number): CSSProperties {
  const px = `${width}px`
  return {
    width: px,
    minWidth: px,
    maxWidth: px,
  }
}

const pinnedContentStyle = computed<CSSProperties>(() => ({}))

function rangesEqual(left: OverlayRange | null, right: OverlayRange | null): boolean {
  if (!left || !right) {
    return false
  }
  return left.startRow === right.startRow
    && left.endRow === right.endRow
    && left.startColumn === right.startColumn
    && left.endColumn === right.endColumn
}

function resolveVisibleRangeBounds(range: OverlayRange | null) {
  if (!range || props.displayRows.length === 0 || props.visibleColumns.length === 0) {
    return null
  }

  const visibleRowStart = props.viewportRowStart
  const visibleRowEnd = visibleRowStart + props.displayRows.length - 1
  const visibleColumnStart = 0
  const visibleColumnEnd = props.visibleColumns.length - 1

  const startRowIndex = Math.max(range.startRow, visibleRowStart)
  const endRowIndex = Math.min(range.endRow, visibleRowEnd)
  const startColumnIndex = Math.max(range.startColumn, visibleColumnStart)
  const endColumnIndex = Math.min(range.endColumn, visibleColumnEnd)

  if (startRowIndex > endRowIndex || startColumnIndex > endColumnIndex) {
    return null
  }

  const startRowOffset = startRowIndex - visibleRowStart
  const endRowOffset = endRowIndex - visibleRowStart
  const startMetric = rowMetrics.value[startRowOffset]
  const endMetric = rowMetrics.value[endRowOffset]
  if (!startMetric || !endMetric) {
    return null
  }

  return {
    startRowOffset,
    endRowOffset,
    startColumnIndex,
    endColumnIndex,
  }
}

function resolveOverlayMetrics(bounds: {
  startRowOffset: number
  endRowOffset: number
  startColumnIndex: number
  endColumnIndex: number
} | null) {
  if (!bounds) {
    return null
  }
  const startMetric = rowMetrics.value[bounds.startRowOffset]
  const endMetric = rowMetrics.value[bounds.endRowOffset]
  if (!startMetric || !endMetric) {
    return null
  }

  return {
    ...bounds,
    top: startMetric.top,
    height: Math.max(1, (endMetric.top + endMetric.height) - startMetric.top),
  }
}

function mergeOverlayBounds(
  left: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
  } | null,
  right: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
  } | null,
) {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return {
    startRowOffset: Math.min(left.startRowOffset, right.startRowOffset),
    endRowOffset: Math.max(left.endRowOffset, right.endRowOffset),
    startColumnIndex: Math.min(left.startColumnIndex, right.startColumnIndex),
    endColumnIndex: Math.max(left.endColumnIndex, right.endColumnIndex),
  }
}

function buildOverlaySegment(
  key: string,
  top: number,
  left: number,
  width: number,
  height: number,
  options?: {
    omitLeftBorder?: boolean
    omitRightBorder?: boolean
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
    topBleed?: number
    bottomBleed?: number
    leftBleed?: number
    rightBleed?: number
  },
): OverlaySegment {
  const topBleed = Math.max(0, options?.topBleed ?? 1)
  const bottomBleed = Math.max(0, options?.bottomBleed ?? 1)
  const leftBleed = options?.omitLeftBorder ? 0 : Math.max(0, options?.leftBleed ?? 1)
  const rightBleed = options?.omitRightBorder ? 0 : Math.max(0, options?.rightBleed ?? 1)
  return {
    key,
    style: {
      position: "absolute",
      top: `${top - topBleed}px`,
      left: `${left - leftBleed}px`,
      width: `${Math.max(1, width + leftBleed + rightBleed)}px`,
      height: `${Math.max(1, height + topBleed + bottomBleed)}px`,
      border: `2px ${options?.borderStyle ?? "solid"} ${options?.borderColor ?? "var(--datagrid-selection-overlay-border)"}`,
      borderLeftWidth: options?.omitLeftBorder ? "0px" : "2px",
      borderRightWidth: options?.omitRightBorder ? "0px" : "2px",
      background: options?.backgroundColor ?? "transparent",
      boxSizing: "border-box",
      borderTopLeftRadius: options?.omitLeftBorder ? "0px" : "1px",
      borderBottomLeftRadius: options?.omitLeftBorder ? "0px" : "1px",
      borderTopRightRadius: options?.omitRightBorder ? "0px" : "1px",
      borderBottomRightRadius: options?.omitRightBorder ? "0px" : "1px",
      pointerEvents: "none",
      zIndex: 6,
    },
  }
}

function buildPaneOverlaySegments(
  metrics: {
    startRowOffset: number
    endRowOffset: number
    startColumnIndex: number
    endColumnIndex: number
    top: number
    height: number
  } | null,
  pane: "left" | "center" | "right",
  keyPrefix: string,
  options?: {
    borderColor?: string
    backgroundColor?: string
    borderStyle?: "solid" | "dashed"
  },
): OverlaySegment[] {
  if (!metrics) {
    return []
  }

  const viewportHeight = Math.max(0, bodyViewportClientHeight.value)
  const topBleed = metrics.top <= 0 ? 0 : 1
  const bottomBleed = viewportHeight > 0 && metrics.top + metrics.height >= viewportHeight ? 0 : 1

  if (pane === "left") {
    const selectedColumns = pinnedLeftColumns.value.filter(column => {
      const index = columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
    })
    if (selectedColumns.length === 0) {
      return []
    }

    let left = indexColumnWidthPx.value
    for (const column of pinnedLeftColumns.value) {
      if (column.key === selectedColumns[0]?.key) {
        break
      }
      left += resolveColumnWidth(column)
    }

    const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
    const lastSelectedIndex = columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    const paneWidth = leftPaneWidth.value
    const leftBleed = left <= 0 ? 0 : 1
    const rightBleed = paneWidth > 0 && left + width >= paneWidth ? 0 : 1
    return [
      buildOverlaySegment(
        `${keyPrefix}-left-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        left,
        width,
        metrics.height,
        {
          omitRightBorder: metrics.endColumnIndex > lastSelectedIndex,
          topBleed,
          bottomBleed,
          leftBleed,
          rightBleed,
          borderColor: options?.borderColor,
          backgroundColor: options?.backgroundColor,
          borderStyle: options?.borderStyle,
        },
      ),
    ]
  }

  if (pane === "center") {
    const selectedColumns = props.renderedColumns.filter(column => {
      const index = columnIndexByKey(column.key)
      return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
    })
    if (selectedColumns.length === 0) {
      return []
    }

    let left = props.leftColumnSpacerWidth
    for (const column of props.renderedColumns) {
      if (column.key === selectedColumns[0]?.key) {
        break
      }
      left += resolveColumnWidth(column)
    }

    const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
    const firstSelectedIndex = columnIndexByKey(selectedColumns[0]?.key ?? "")
    const lastSelectedIndex = columnIndexByKey(selectedColumns[selectedColumns.length - 1]?.key ?? "")
    const contentWidth = Math.max(
      0,
      parsePixelValue(props.gridContentStyle.width ?? props.gridContentStyle.minWidth, 0),
    )
    const leftBleed = left <= 0 ? 0 : 1
    const rightBleed = contentWidth > 0 && left + width >= contentWidth ? 0 : 1
    return [
      buildOverlaySegment(
        `${keyPrefix}-center-${metrics.startRowOffset}-${metrics.endRowOffset}`,
        metrics.top,
        left,
        width,
        metrics.height,
        {
          omitLeftBorder: metrics.startColumnIndex < firstSelectedIndex,
          omitRightBorder: metrics.endColumnIndex > lastSelectedIndex,
          topBleed,
          bottomBleed,
          leftBleed,
          rightBleed,
          borderColor: options?.borderColor,
          backgroundColor: options?.backgroundColor,
          borderStyle: options?.borderStyle,
        },
      ),
    ]
  }

  const selectedColumns = pinnedRightColumns.value.filter(column => {
    const index = columnIndexByKey(column.key)
    return index >= metrics.startColumnIndex && index <= metrics.endColumnIndex
  })
  if (selectedColumns.length === 0) {
    return []
  }

  let left = 0
  for (const column of pinnedRightColumns.value) {
    if (column.key === selectedColumns[0]?.key) {
      break
    }
    left += resolveColumnWidth(column)
  }

  const width = selectedColumns.reduce((sum, column) => sum + resolveColumnWidth(column), 0)
  const firstSelectedIndex = columnIndexByKey(selectedColumns[0]?.key ?? "")
  const paneWidth = rightPaneWidth.value
  const leftBleed = left <= 0 ? 0 : 1
  const rightBleed = paneWidth > 0 && left + width >= paneWidth ? 0 : 1
  return [
    buildOverlaySegment(
      `${keyPrefix}-right-${metrics.startRowOffset}-${metrics.endRowOffset}`,
      metrics.top,
      left,
      width,
      metrics.height,
      {
        omitLeftBorder: metrics.startColumnIndex < firstSelectedIndex,
        topBleed,
        bottomBleed,
        leftBleed,
        rightBleed,
        borderColor: options?.borderColor,
        backgroundColor: options?.backgroundColor,
        borderStyle: options?.borderStyle,
      },
    ),
  ]
}

const normalizedMovePreviewRange = computed<OverlayRange | null>(() => {
  if (!props.isRangeMoving || !props.rangeMovePreviewRange) {
    return null
  }
  return rangesEqual(props.rangeMovePreviewRange, props.selectionRange)
    ? null
    : props.rangeMovePreviewRange
})

const visibleCombinedFillPreviewBounds = computed(() => (
  mergeOverlayBounds(visibleSelectionBounds.value, visibleFillPreviewBounds.value)
))
const visibleSelectionOverlayMetrics = computed(() => {
  if (visibleFillPreviewBounds.value) {
    return null
  }
  return resolveOverlayMetrics(visibleSelectionBounds.value)
})
const visibleFillPreviewOverlayMetrics = computed(() => resolveOverlayMetrics(visibleCombinedFillPreviewBounds.value))
const visibleMovePreviewOverlayMetrics = computed(() => (
  resolveOverlayMetrics(resolveVisibleRangeBounds(normalizedMovePreviewRange.value))
))

const leftSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleSelectionOverlayMetrics.value, "left", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  })
))

const centerSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleSelectionOverlayMetrics.value, "center", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  })
))

const rightSelectionOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleSelectionOverlayMetrics.value, "right", "selection", {
    borderColor: "var(--datagrid-selection-overlay-border)",
  })
))

const leftFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "left", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const centerFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "center", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const rightFillPreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleFillPreviewOverlayMetrics.value, "right", "fill-preview", {
    borderColor: "var(--datagrid-selection-overlay-fill-border)",
    backgroundColor: "var(--datagrid-selection-overlay-fill-bg)",
  })
))

const leftMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleMovePreviewOverlayMetrics.value, "left", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  })
))

const centerMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleMovePreviewOverlayMetrics.value, "center", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  })
))

const rightMovePreviewOverlaySegments = computed<OverlaySegment[]>(() => (
  buildPaneOverlaySegments(visibleMovePreviewOverlayMetrics.value, "right", "move-preview", {
    borderColor: "var(--datagrid-selection-overlay-move-border)",
    backgroundColor: "var(--datagrid-selection-overlay-move-bg)",
    borderStyle: "dashed",
  })
))

function cellStateClasses(row: TableRow, rowOffset: number, columnIndex: number): Record<string, boolean> {
  const columnKey = props.visibleColumns[columnIndex]?.key ?? ""
  const isAnchorCell = isVisualSelectionAnchorCell(rowOffset, columnIndex)
  return {
    "grid-cell--selected": !isAnchorCell && shouldHighlightSelectedCellVisual(rowOffset, columnIndex),
    "grid-cell--selection-anchor": isAnchorCell,
    "grid-cell--range-move-handle-hover": isRangeMoveHandleHoverCell(rowOffset, columnIndex),
    "grid-cell--fill-preview": isCellInFillPreviewSafe(rowOffset, columnIndex),
    "grid-cell--clipboard-pending": isCellInPendingClipboardRangeSafe(rowOffset, columnIndex),
    "grid-cell--clipboard-pending-top": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "top"),
    "grid-cell--clipboard-pending-right": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "right"),
    "grid-cell--clipboard-pending-bottom": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "bottom"),
    "grid-cell--clipboard-pending-left": isCellOnPendingClipboardEdgeSafe(rowOffset, columnIndex, "left"),
    "grid-cell--editing": isEditingCellSafe(row, columnKey),
  }
}

defineExpose({
  getStageRootElement: () => stageRootEl.value,
  getHeaderElement: () => headerShellEl.value,
  getBodyViewportElement: () => bodyViewportEl.value,
  getVisibleRowMetrics: () => resolveVisibleRowMetricsFromDom(),
})
</script>

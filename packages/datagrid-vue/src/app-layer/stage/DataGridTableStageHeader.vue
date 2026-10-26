<template>
  <div ref="headerShellElement" class="grid-header-shell" :class="{ 'grid-header-shell--pivot-groups': hasHeaderGroups, 'grid-header-shell--filter-row': filterRowEnabled }" :style="paneLayoutStyle" @click.capture="resizeClickGuard.onHeaderClickCapture" @keydown="handleHeaderKeyboardNavigation">
    <slot name="center-chrome" />

    <div ref="leftPaneElement" class="grid-header-pane grid-header-pane--left" :style="leftPaneStyle" @wheel="onLinkedViewportWheel">
      <slot name="left-chrome" />
      <div
        v-for="(headerGroups, rowIndex) in leftHeaderGroupRows"
        :key="`left-pivot-group-row-${rowIndex}`"
        class="grid-header-row grid-pane-track grid-header-row--pivot-groups"
        :style="leftTrackStyle"
      >
        <div
          v-if="showIndexColumn"
          class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header grid-cell--header-group grid-cell--header-group-empty"
          :style="rowIndexColumnStyle"
          aria-hidden="true"
        />
        <div
          v-for="(group, groupIndex) in headerGroups"
          :key="group.key"
          class="grid-cell grid-cell--header grid-cell--header-group grid-cell--pinned-left"
          :class="{
            'grid-cell--header-group-empty': !group.label,
            'grid-cell--header-group-last': groupIndex === headerGroups.length - 1,
          }"
          :style="headerGroupStyle(group)"
          :data-datagrid-pivot-group-label="group.label ?? undefined"
          :data-datagrid-pivot-group-span="group.columns.length"
          :data-datagrid-pivot-group-depth="rowIndex"
          :data-datagrid-column-group-label="group.label ?? undefined"
          :data-datagrid-column-group-id="group.key"
          :data-datagrid-column-group-span="group.columns.length"
          :data-datagrid-column-group-depth="rowIndex"
        >
          <span v-if="group.label" class="col-head__pivot-group-label" :data-datagrid-group-label-measure-key="groupLabelMeasureKey(group, 'left', rowIndex)" :style="groupLabelStyle(group, 'left', rowIndex)">{{ group.label }}</span>
          <button v-if="group.label && group.resizeColumnKey" type="button" class="col-resize col-resize--group" :aria-label="`Resize ${group.label} group`" :data-column-key="group.resizeColumnKey" :data-datagrid-resize-column-width="group.resizeColumnWidth" @mousedown.stop="startResize($event, group.resizeColumnKey)" @touchstart.stop.passive="startTouchResize($event, group.resizeColumnKey)" @touchmove.stop.prevent="handleTouchResizeMove" @touchend.stop="handleTouchResizeEnd" @touchcancel.stop="handleTouchResizeEnd" @dblclick.stop="handleResizeDoubleClick($event, group.resizeColumnKey)" @click.stop />
        </div>
      </div>
      <div class="grid-header-row grid-pane-track" :style="leftTrackStyle">
        <div
          v-if="showIndexColumn"
          class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header"
          :class="{ 'grid-cell--header-merged-untitled': headerGroupDepth > 0, 'grid-cell--header-selected': isIndexHeaderSelected, 'grid-cell--focus-axis': focusedBodyColumnKey === null && focusedBodyRowIndex !== null && !hasMultiCellSelection }"
          :style="indexColumnHeaderStyle"
          :id="DATA_GRID_STAGE_ROW_INDEX_HEADER_ID"
          role="columnheader"
          tabindex="-1"
          data-datagrid-row-index-header="true"
          aria-colindex="1"
          aria-label="Row index"
          :aria-selected="isIndexHeaderSelected"
          @focus="selectAllIndexedRows"
          @blur="handleIndexHeaderBlur"
          @click="focusRowIndexHeaderFromClick"
        >
          <div class="col-head col-head--index">
            <span>#</span>
          </div>
        </div>
        <template v-if="shouldUseColumnMenus()">
          <template v-for="column in pinnedLeftColumns" :key="`header-left-${column.key}`">
            <div
              v-if="isRowSelectionColumn(column)"
              class="grid-cell grid-cell--header grid-cell--pinned-left grid-cell--checkbox grid-cell--row-selection"
              :class="{ 'grid-cell--header-merged-untitled': trailingEmptyHeaderGroupDepth(column) > 0, 'grid-cell--focus-axis': focusedBodyColumnKey === column.key }"
              :style="headerColumnStyle(column)"
              :data-column-key="column.key"
              :id="headerCellId(column)"
              v-bind="headerCellA11y(column)"
            >
              <div class="col-head col-head--index">
                <button
                  class="grid-checkbox-trigger"
                  :class="headerRowSelectionInteraction.triggerClass"
                  type="button"
                  :role="headerRowSelectionInteraction.role"
                  :aria-label="headerRowSelectionInteraction.label"
                  :aria-checked="headerRowSelectionInteraction.checked"
                  @mousedown.stop
                  @click.stop
                  @click="headerRowSelectionInteraction.activate()"
                  @keydown.enter.stop.prevent="headerRowSelectionInteraction.activate()"
                  @keydown.space.stop.prevent="headerRowSelectionInteraction.activate()"
                >
                  <span class="grid-checkbox-indicator" :class="headerRowSelectionInteraction.triggerClass" aria-hidden="true">
                    <span class="grid-checkbox-indicator__mark" :class="headerRowSelectionInteraction.markClass" />
                  </span>
                </button>
              </div>
            </div>
            <div
              v-else
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
              :class="resolveHeaderCellClasses(column, { menuEnabled: true, menuOpen: isColumnMenuOpen(column.key) })"
              :style="headerColumnStyle(column)"
              :data-column-key="column.key"
              :id="headerCellId(column)"
              v-bind="headerCellA11y(column)"
              :draggable="isHeaderColumnDraggable(column)"
              @click="handleHeaderColumnClick(column, { additive: $event.ctrlKey || $event.metaKey, extend: $event.shiftKey })"
            @contextmenu="handleHeaderColumnContextMenu(column, $event)"
              @dragstart.stop="handleHeaderColumnDragStart($event, column)"
              @dragover.stop="handleHeaderColumnDragOver($event, column)"
              @drop.stop="handleHeaderColumnDrop($event, column)"
              @dragend.stop="handleHeaderColumnDragEnd"
            >
              <div class="col-head">
                <span class="col-head__label">{{ resolveHeaderDisplayLabel(column) }}</span>
                <span v-if="externalFilterTooltip(column.key)" class="datagrid-external-filter-indicator" aria-hidden="true" :title="externalFilterTooltip(column.key)" data-datagrid-external-filter-indicator="true">●</span>
                <button
                  v-if="shouldShowColumnMenuButton()"
                  type="button"
                  class="col-menu-trigger"
                  :class="resolveColumnMenuTriggerClass(column.key, isColumnMenuOpen(column.key))"
                  :aria-label="resolveColumnMenuButtonLabel(column)"
                  :title="resolveColumnMenuButtonLabel(column)"
                  aria-haspopup="menu"
                  :aria-expanded="isColumnMenuOpen(column.key) ? 'true' : 'false'"
                  :data-column-key="column.key"
                  data-datagrid-column-menu-trigger="true"
                  data-datagrid-column-menu-button="true"
                  @pointerenter="preloadColumnMenu"
                  @focus="preloadColumnMenu"
                  @mousedown.stop
                  @click.stop="handleColumnMenuButtonClick(column, $event)"
                  @keydown.enter.stop.prevent="handleColumnMenuButtonKeydown(column, $event)"
                  @keydown.space.stop.prevent="handleColumnMenuButtonKeydown(column, $event)"
                >
                  <svg class="col-menu-trigger__icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      v-if="shouldShowColumnMenuFilterIcon(column.key)"
                      d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"
                    />
                    <path
                      v-if="shouldShowColumnMenuSortAscIcon(column.key)"
                      d="M9 11V6.75M9 6.75 7.25 8.5M9 6.75 10.75 8.5"
                    />
                    <path
                      v-else-if="shouldShowColumnMenuSortDescIcon(column.key)"
                      d="M9 5v4.25M9 9.25 7.25 7.5M9 9.25 10.75 7.5"
                    />
                    <path
                      v-else
                      d="M5.5 6.5 8 9l2.5-2.5"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="col-resize"
                  :aria-label="resolveColumnResizeLabel(column)"
                  @mousedown.stop="startResize($event, column.key)"
                  @touchstart.stop.passive="startTouchResize($event, column.key)"
                  @touchmove.stop.passive="handleTouchResizeMove($event)"
                  @touchend.stop.passive="handleTouchResizeEnd($event)"
                  @touchcancel.stop.passive="handleTouchResizeEnd($event)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
            </div>

          </template>
        </template>
        <template v-else>
          <template v-for="column in pinnedLeftColumns" :key="`header-left-${column.key}`">
            <div
              v-if="isRowSelectionColumn(column)"
              class="grid-cell grid-cell--header grid-cell--pinned-left grid-cell--checkbox grid-cell--row-selection"
              :class="{ 'grid-cell--header-merged-untitled': trailingEmptyHeaderGroupDepth(column) > 0, 'grid-cell--focus-axis': focusedBodyColumnKey === column.key }"
              :style="headerColumnStyle(column)"
              :data-column-key="column.key"
              :id="headerCellId(column)"
              v-bind="headerCellA11y(column)"
            >
              <div class="col-head col-head--index">
                <button
                  class="grid-checkbox-trigger"
                  :class="headerRowSelectionInteraction.triggerClass"
                  type="button"
                  :role="headerRowSelectionInteraction.role"
                  :aria-label="headerRowSelectionInteraction.label"
                  :aria-checked="headerRowSelectionInteraction.checked"
                  @mousedown.stop
                  @click.stop
                  @click="headerRowSelectionInteraction.activate()"
                  @keydown.enter.stop.prevent="headerRowSelectionInteraction.activate()"
                  @keydown.space.stop.prevent="headerRowSelectionInteraction.activate()"
                >
                  <span class="grid-checkbox-indicator" :class="headerRowSelectionInteraction.triggerClass" aria-hidden="true">
                    <span class="grid-checkbox-indicator__mark" :class="headerRowSelectionInteraction.markClass" />
                  </span>
                </button>
              </div>
            </div>
            <div
              v-else
              class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-left"
              :class="resolveHeaderCellClasses(column)"
              :style="headerColumnStyle(column)"
              :data-column-key="column.key"
              :id="headerCellId(column)"
              v-bind="headerCellA11y(column)"
              :draggable="isHeaderColumnDraggable(column)"
              @click="handleHeaderColumnClick(column, { additive: $event.ctrlKey || $event.metaKey, extend: $event.shiftKey })"
            @contextmenu="handleHeaderColumnContextMenu(column, $event)"
              @dragstart.stop="handleHeaderColumnDragStart($event, column)"
              @dragover.stop="handleHeaderColumnDragOver($event, column)"
              @drop.stop="handleHeaderColumnDrop($event, column)"
              @dragend.stop="handleHeaderColumnDragEnd"
            >
              <div class="col-head">
                <span>{{ resolveHeaderDisplayLabel(column) }}</span>
                <span
                  v-if="resolveColumnGroupBadgeLabel(column.key)"
                  class="col-head__group-badge"
                  :title="resolveColumnGroupBadgeTitle(column.key)"
                >
                  {{ resolveColumnGroupBadgeLabel(column.key) }}
                </span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
                <button
                  type="button"
                  class="col-resize"
                  :aria-label="resolveColumnResizeLabel(column)"
                  @mousedown.stop="startResize($event, column.key)"
                  @touchstart.stop.passive="startTouchResize($event, column.key)"
                  @touchmove.stop.passive="handleTouchResizeMove($event)"
                  @touchend.stop.passive="handleTouchResizeEnd($event)"
                  @touchcancel.stop.passive="handleTouchResizeEnd($event)"
                  @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                  @click.stop
                />
              </div>
              <div v-if="!filterRowEnabled" class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :name="`datagrid-header-filter-left-${column.key}`"
                  :aria-label="resolveColumnFilterLabel(column)"
                  :value="columnFilterTextByKey[column.key] ?? ''"
                  :disabled="!isColumnFilterable(column)"
                  placeholder="Filter..."
                  @mousedown.stop
                  @keydown.stop="handleColumnFilterKeydown"
                  @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </template>
        </template>
      </div>
      <div v-if="filterRowEnabled" class="grid-header-row grid-pane-track grid-header-filter-row" :style="leftTrackStyle">
        <div
          v-if="showIndexColumn"
          class="grid-header-filter-cell grid-header-filter-cell--index"
          :style="indexColumnHeaderStyle"
          aria-hidden="true"
        />
        <div
          v-for="column in pinnedLeftColumns"
          :key="`filter-left-${column.key}`"
          class="grid-header-filter-cell"
          :class="{ 'grid-header-filter-cell--selection': isRowSelectionColumn(column) }"
          :style="headerColumnStyle(column)"
          :data-column-key="column.key"
        >
          <DataGridHeaderFilterRow
            v-if="!isRowSelectionColumn(column)"
            :label="resolveHeaderDisplayLabel(column)"
            :data-type="column.column.dataType"
            :disabled="!isColumnFilterable(column)"
            :draft="filterRowDraft(column.key)"
            @update="updateFilterRowDraft(column.key, $event)"
            @apply="applyFilterRowDraft(column.key)"
            @cancel="cancelFilterRowDraft(column.key)"
          />
        </div>
      </div>
    </div>

    <div
      :ref="headerViewportRef"
      class="grid-header-viewport"
      @wheel="onLinkedViewportWheel"
      @scroll="handleHeaderViewportScroll"
    >
      <div
        v-for="(headerGroups, rowIndex) in centerHeaderGroupRows"
        :key="`center-pivot-group-row-${rowIndex}`"
        class="grid-header-row grid-center-track grid-header-row--pivot-groups"
        :style="mainTrackStyle"
      >
        <div
          v-if="leftColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(leftColumnSpacerWidth)"
        />
        <div
          v-for="(group, groupIndex) in headerGroups"
          :key="group.key"
          class="grid-cell grid-cell--header grid-cell--header-group"
          :class="{
            'grid-cell--header-group-empty': !group.label,
            'grid-cell--header-group-last': groupIndex === headerGroups.length - 1 && rightColumnSpacerWidth <= 0,
          }"
          :style="headerGroupStyle(group)"
          :data-datagrid-pivot-group-label="group.label ?? undefined"
          :data-datagrid-pivot-group-span="group.columns.length"
          :data-datagrid-pivot-group-depth="rowIndex"
          :data-datagrid-column-group-label="group.label ?? undefined"
          :data-datagrid-column-group-id="group.key"
          :data-datagrid-column-group-span="group.columns.length"
          :data-datagrid-column-group-depth="rowIndex"
        >
          <span v-if="group.label" class="col-head__pivot-group-label" :data-datagrid-group-label-measure-key="groupLabelMeasureKey(group, 'center', rowIndex)" :style="groupLabelStyle(group, 'center', rowIndex)">{{ group.label }}</span>
          <button v-if="group.label && group.resizeColumnKey" type="button" class="col-resize col-resize--group" :aria-label="`Resize ${group.label} group`" :data-column-key="group.resizeColumnKey" :data-datagrid-resize-column-width="group.resizeColumnWidth" @mousedown.stop="startResize($event, group.resizeColumnKey)" @touchstart.stop.passive="startTouchResize($event, group.resizeColumnKey)" @touchmove.stop.prevent="handleTouchResizeMove" @touchend.stop="handleTouchResizeEnd" @touchcancel.stop="handleTouchResizeEnd" @dblclick.stop="handleResizeDoubleClick($event, group.resizeColumnKey)" @click.stop />
        </div>
        <div
          v-if="rightColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(rightColumnSpacerWidth)"
        />
      </div>
      <div class="grid-header-row grid-center-track" :style="mainTrackStyle">
        <div
          v-if="leftColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(leftColumnSpacerWidth)"
        />
        <template v-if="shouldUseColumnMenus()">
          <div
            v-for="column in centerHeaderColumns"
            :key="`header-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable"
            :class="resolveHeaderCellClasses(column, { menuEnabled: true, menuOpen: isColumnMenuOpen(column.key) })"
            :style="headerColumnStyle(column)"
            :data-column-key="column.key"
            :id="headerCellId(column)"
            v-bind="headerCellA11y(column)"
            :draggable="isHeaderColumnDraggable(column)"
            @click="handleHeaderColumnClick(column, { additive: $event.ctrlKey || $event.metaKey, extend: $event.shiftKey })"
            @contextmenu="handleHeaderColumnContextMenu(column, $event)"
            @dragstart.stop="handleHeaderColumnDragStart($event, column)"
            @dragover.stop="handleHeaderColumnDragOver($event, column)"
            @drop.stop="handleHeaderColumnDrop($event, column)"
            @dragend.stop="handleHeaderColumnDragEnd"
          >
            <div class="col-head">
              <span class="col-head__label">{{ resolveHeaderDisplayLabel(column) }}</span>
              <span v-if="externalFilterTooltip(column.key)" class="datagrid-external-filter-indicator" aria-hidden="true" :title="externalFilterTooltip(column.key)" data-datagrid-external-filter-indicator="true">●</span>
              <span
                v-if="resolveColumnGroupBadgeLabel(column.key)"
                class="col-head__group-badge"
                :title="resolveColumnGroupBadgeTitle(column.key)"
              >
                {{ resolveColumnGroupBadgeLabel(column.key) }}
              </span>
              <button
                v-if="shouldShowColumnMenuButton()"
                type="button"
                class="col-menu-trigger"
                :class="resolveColumnMenuTriggerClass(column.key, isColumnMenuOpen(column.key))"
                :aria-label="resolveColumnMenuButtonLabel(column)"
                :title="resolveColumnMenuButtonLabel(column)"
                aria-haspopup="menu"
                :aria-expanded="isColumnMenuOpen(column.key) ? 'true' : 'false'"
                :data-column-key="column.key"
                data-datagrid-column-menu-trigger="true"
                data-datagrid-column-menu-button="true"
                @pointerenter="preloadColumnMenu"
                @focus="preloadColumnMenu"
                @mousedown.stop
                @click.stop="handleColumnMenuButtonClick(column, $event)"
                @keydown.enter.stop.prevent="handleColumnMenuButtonKeydown(column, $event)"
                @keydown.space.stop.prevent="handleColumnMenuButtonKeydown(column, $event)"
              >
                <svg class="col-menu-trigger__icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    v-if="shouldShowColumnMenuFilterIcon(column.key)"
                    d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"
                  />
                  <path
                    v-if="shouldShowColumnMenuSortAscIcon(column.key)"
                    d="M9 11V6.75M9 6.75 7.25 8.5M9 6.75 10.75 8.5"
                  />
                  <path
                    v-else-if="shouldShowColumnMenuSortDescIcon(column.key)"
                    d="M9 5v4.25M9 9.25 7.25 7.5M9 9.25 10.75 7.5"
                  />
                  <path
                    v-else
                    d="M5.5 6.5 8 9l2.5-2.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="col-resize"
                :aria-label="resolveColumnResizeLabel(column)"
                  @mousedown.stop="startResize($event, column.key)"
                  @touchstart.stop.passive="startTouchResize($event, column.key)"
                @touchmove.stop.passive="handleTouchResizeMove($event)"
                @touchend.stop.passive="handleTouchResizeEnd($event)"
                @touchcancel.stop.passive="handleTouchResizeEnd($event)"
                @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                @click.stop
              />
            </div>
          </div>

        </template>
        <template v-else>
          <div
            v-for="column in centerHeaderColumns"
            :key="`header-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable"
            :class="resolveHeaderCellClasses(column)"
            :style="headerColumnStyle(column)"
            :data-column-key="column.key"
            :id="headerCellId(column)"
            v-bind="headerCellA11y(column)"
            :draggable="isHeaderColumnDraggable(column)"
            @click="handleHeaderColumnClick(column, { additive: $event.ctrlKey || $event.metaKey, extend: $event.shiftKey })"
            @contextmenu="handleHeaderColumnContextMenu(column, $event)"
            @dragstart.stop="handleHeaderColumnDragStart($event, column)"
            @dragover.stop="handleHeaderColumnDragOver($event, column)"
            @drop.stop="handleHeaderColumnDrop($event, column)"
            @dragend.stop="handleHeaderColumnDragEnd"
          >
            <div class="col-head">
              <span>{{ resolveHeaderDisplayLabel(column) }}</span>
              <span
                v-if="resolveColumnGroupBadgeLabel(column.key)"
                class="col-head__group-badge"
                :title="resolveColumnGroupBadgeTitle(column.key)"
              >
                {{ resolveColumnGroupBadgeLabel(column.key) }}
              </span>
              <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
              <button
                type="button"
                class="col-resize"
                :aria-label="resolveColumnResizeLabel(column)"
                  @mousedown.stop="startResize($event, column.key)"
                  @touchstart.stop.passive="startTouchResize($event, column.key)"
                @touchmove.stop.passive="handleTouchResizeMove($event)"
                @touchend.stop.passive="handleTouchResizeEnd($event)"
                @touchcancel.stop.passive="handleTouchResizeEnd($event)"
                @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                @click.stop
              />
            </div>
            <div v-if="!filterRowEnabled" class="col-filter" @click.stop>
              <input
                class="col-filter-input"
                :name="`datagrid-header-filter-center-${column.key}`"
                :aria-label="resolveColumnFilterLabel(column)"
                :value="columnFilterTextByKey[column.key] ?? ''"
                :disabled="!isColumnFilterable(column)"
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop="handleColumnFilterKeydown"
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
      <div v-if="filterRowEnabled" class="grid-header-row grid-center-track grid-header-filter-row" :style="mainTrackStyle">
        <div
          v-if="leftColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(leftColumnSpacerWidth)"
        />
        <div
          v-for="column in centerHeaderColumns"
          :key="`filter-center-${column.key}`"
          class="grid-header-filter-cell"
          :class="{ 'grid-header-filter-cell--selection': isRowSelectionColumn(column) }"
          :style="headerColumnStyle(column)"
          :data-column-key="column.key"
        >
          <DataGridHeaderFilterRow
            v-if="!isRowSelectionColumn(column)"
            :label="resolveHeaderDisplayLabel(column)"
            :data-type="column.column.dataType"
            :disabled="!isColumnFilterable(column)"
            :draft="filterRowDraft(column.key)"
            @update="updateFilterRowDraft(column.key, $event)"
            @apply="applyFilterRowDraft(column.key)"
            @cancel="cancelFilterRowDraft(column.key)"
          />
        </div>
        <div
          v-if="rightColumnSpacerWidth > 0"
          class="grid-column-spacer"
          :style="spacerStyle(rightColumnSpacerWidth)"
        />
      </div>
    </div>

    <div ref="rightPaneElement" class="grid-header-pane grid-header-pane--right" :style="rightPaneStyle" @wheel="onLinkedViewportWheel">
      <slot name="right-chrome" />
      <div
        v-for="(headerGroups, rowIndex) in rightHeaderGroupRows"
        :key="`right-pivot-group-row-${rowIndex}`"
        class="grid-header-row grid-pane-track grid-header-row--pivot-groups"
        :style="rightTrackStyle"
      >
        <div
          v-for="(group, groupIndex) in headerGroups"
          :key="group.key"
          class="grid-cell grid-cell--header grid-cell--header-group grid-cell--pinned-right"
          :class="{
            'grid-cell--header-group-empty': !group.label,
            'grid-cell--header-group-last': groupIndex === headerGroups.length - 1,
          }"
          :style="headerGroupStyle(group)"
          :data-datagrid-pivot-group-label="group.label ?? undefined"
          :data-datagrid-pivot-group-span="group.columns.length"
          :data-datagrid-pivot-group-depth="rowIndex"
          :data-datagrid-column-group-label="group.label ?? undefined"
          :data-datagrid-column-group-id="group.key"
          :data-datagrid-column-group-span="group.columns.length"
          :data-datagrid-column-group-depth="rowIndex"
        >
          <span v-if="group.label" class="col-head__pivot-group-label" :data-datagrid-group-label-measure-key="groupLabelMeasureKey(group, 'right', rowIndex)" :style="groupLabelStyle(group, 'right', rowIndex)">{{ group.label }}</span>
          <button v-if="group.label && group.resizeColumnKey" type="button" class="col-resize col-resize--group" :aria-label="`Resize ${group.label} group`" :data-column-key="group.resizeColumnKey" :data-datagrid-resize-column-width="group.resizeColumnWidth" @mousedown.stop="startResize($event, group.resizeColumnKey)" @touchstart.stop.passive="startTouchResize($event, group.resizeColumnKey)" @touchmove.stop.prevent="handleTouchResizeMove" @touchend.stop="handleTouchResizeEnd" @touchcancel.stop="handleTouchResizeEnd" @dblclick.stop="handleResizeDoubleClick($event, group.resizeColumnKey)" @click.stop />
        </div>
      </div>
      <div class="grid-header-row grid-pane-track" :style="rightTrackStyle">
        <template v-if="shouldUseColumnMenus()">
          <div
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
            :class="resolveHeaderCellClasses(column, { menuEnabled: true, menuOpen: isColumnMenuOpen(column.key) })"
            :style="headerColumnStyle(column)"
            :data-column-key="column.key"
            :id="headerCellId(column)"
            v-bind="headerCellA11y(column)"
            :draggable="isHeaderColumnDraggable(column)"
            @click="handleHeaderColumnClick(column, { additive: $event.ctrlKey || $event.metaKey, extend: $event.shiftKey })"
            @contextmenu="handleHeaderColumnContextMenu(column, $event)"
            @dragstart.stop="handleHeaderColumnDragStart($event, column)"
            @dragover.stop="handleHeaderColumnDragOver($event, column)"
            @drop.stop="handleHeaderColumnDrop($event, column)"
            @dragend.stop="handleHeaderColumnDragEnd"
          >
            <div class="col-head">
              <span class="col-head__label">{{ resolveHeaderDisplayLabel(column) }}</span>
              <span v-if="externalFilterTooltip(column.key)" class="datagrid-external-filter-indicator" aria-hidden="true" :title="externalFilterTooltip(column.key)" data-datagrid-external-filter-indicator="true">●</span>
              <span
                v-if="resolveColumnGroupBadgeLabel(column.key)"
                class="col-head__group-badge"
                :title="resolveColumnGroupBadgeTitle(column.key)"
              >
                {{ resolveColumnGroupBadgeLabel(column.key) }}
              </span>
              <button
                v-if="shouldShowColumnMenuButton()"
                type="button"
                class="col-menu-trigger"
                :class="resolveColumnMenuTriggerClass(column.key, isColumnMenuOpen(column.key))"
                :aria-label="resolveColumnMenuButtonLabel(column)"
                :title="resolveColumnMenuButtonLabel(column)"
                aria-haspopup="menu"
                :aria-expanded="isColumnMenuOpen(column.key) ? 'true' : 'false'"
                :data-column-key="column.key"
                data-datagrid-column-menu-trigger="true"
                data-datagrid-column-menu-button="true"
                @pointerenter="preloadColumnMenu"
                @focus="preloadColumnMenu"
                @mousedown.stop
                @click.stop="handleColumnMenuButtonClick(column, $event)"
                @keydown.enter.stop.prevent="handleColumnMenuButtonKeydown(column, $event)"
                @keydown.space.stop.prevent="handleColumnMenuButtonKeydown(column, $event)"
              >
                <svg class="col-menu-trigger__icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    v-if="shouldShowColumnMenuFilterIcon(column.key)"
                    d="M2.5 3.5h11L9.25 8.5v3.25l-2.5 1.25V8.5z"
                  />
                  <path
                    v-if="shouldShowColumnMenuSortAscIcon(column.key)"
                    d="M9 11V6.75M9 6.75 7.25 8.5M9 6.75 10.75 8.5"
                  />
                  <path
                    v-else-if="shouldShowColumnMenuSortDescIcon(column.key)"
                    d="M9 5v4.25M9 9.25 7.25 7.5M9 9.25 10.75 7.5"
                  />
                  <path
                    v-else
                    d="M5.5 6.5 8 9l2.5-2.5"
                  />
                </svg>
              </button>
              <button
                type="button"
                class="col-resize"
                :class="{ 'col-resize--left': isLeadingPinnedRightColumn(column) }"
                :aria-label="resolveColumnResizeLabel(column)"
                @mousedown.stop="startResize($event, column.key, isLeadingPinnedRightColumn(column) ? 'left' : 'right')"
                @touchstart.stop.passive="startTouchResize($event, column.key, isLeadingPinnedRightColumn(column) ? 'left' : 'right')"
                @touchmove.stop.passive="handleTouchResizeMove($event)"
                @touchend.stop.passive="handleTouchResizeEnd($event)"
                @touchcancel.stop.passive="handleTouchResizeEnd($event)"
                @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                @click.stop
              />
            </div>
          </div>

        </template>
        <template v-else>
          <div
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
            :class="resolveHeaderCellClasses(column)"
            :style="headerColumnStyle(column)"
            :data-column-key="column.key"
            :id="headerCellId(column)"
            v-bind="headerCellA11y(column)"
            :draggable="isHeaderColumnDraggable(column)"
            @click="handleHeaderColumnClick(column, { additive: $event.ctrlKey || $event.metaKey, extend: $event.shiftKey })"
            @contextmenu="handleHeaderColumnContextMenu(column, $event)"
            @dragstart.stop="handleHeaderColumnDragStart($event, column)"
            @dragover.stop="handleHeaderColumnDragOver($event, column)"
            @drop.stop="handleHeaderColumnDrop($event, column)"
            @dragend.stop="handleHeaderColumnDragEnd"
          >
            <div class="col-head">
              <span>{{ resolveHeaderDisplayLabel(column) }}</span>
              <span class="sort-indicator" aria-hidden="true">{{ sortIndicator(column.key) }}</span>
              <button
                type="button"
                class="col-resize"
                :class="{ 'col-resize--left': isLeadingPinnedRightColumn(column) }"
                :aria-label="resolveColumnResizeLabel(column)"
                @mousedown.stop="startResize($event, column.key, isLeadingPinnedRightColumn(column) ? 'left' : 'right')"
                @touchstart.stop.passive="startTouchResize($event, column.key, isLeadingPinnedRightColumn(column) ? 'left' : 'right')"
                @touchmove.stop.passive="handleTouchResizeMove($event)"
                @touchend.stop.passive="handleTouchResizeEnd($event)"
                @touchcancel.stop.passive="handleTouchResizeEnd($event)"
                @dblclick.stop="handleResizeDoubleClick($event, column.key)"
                @click.stop
              />
            </div>
              <div v-if="!filterRowEnabled" class="col-filter" @click.stop>
              <input
                class="col-filter-input"
                :name="`datagrid-header-filter-right-${column.key}`"
                :aria-label="resolveColumnFilterLabel(column)"
                :value="columnFilterTextByKey[column.key] ?? ''"
                :disabled="!isColumnFilterable(column)"
                placeholder="Filter..."
                @mousedown.stop
                @keydown.stop="handleColumnFilterKeydown"
                @input="setColumnFilterText(column.key, ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </template>
      </div>
      <div v-if="filterRowEnabled" class="grid-header-row grid-pane-track grid-header-filter-row" :style="rightTrackStyle">
        <div
          v-for="column in pinnedRightColumns"
          :key="`filter-right-${column.key}`"
          class="grid-header-filter-cell"
          :class="{ 'grid-header-filter-cell--selection': isRowSelectionColumn(column) }"
          :style="headerColumnStyle(column)"
          :data-column-key="column.key"
        >
          <DataGridHeaderFilterRow
            v-if="!isRowSelectionColumn(column)"
            :label="resolveHeaderDisplayLabel(column)"
            :data-type="column.column.dataType"
            :disabled="!isColumnFilterable(column)"
            :draft="filterRowDraft(column.key)"
            @update="updateFilterRowDraft(column.key, $event)"
            @apply="applyFilterRowDraft(column.key)"
            @cancel="cancelFilterRowDraft(column.key)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type PropType } from "vue"
import type { DataGridExternalFilterIndicator } from "../config/dataGridExternalFilterIndicators"
import { useDataGridResizeClickGuard } from "@affino/datagrid-vue/advanced"
import type { DataGridColumnMenuTriggerMode } from "../overlays/dataGridColumnMenu"
import DataGridHeaderFilterRow from "./DataGridHeaderFilterRow.vue"
import type { DataGridTableStageBodyColumn as TableColumn } from "./dataGridTableStageBody.types"
import type { DataGridColumnMenuOpenReason } from "./dataGridTableStage.types"
import {
  useDataGridTableStageMode,
  useDataGridTableStageColumnsSection,
  useDataGridTableStageLayoutSection,
  useDataGridTableStageRowsSection,
  useDataGridTableStageSelectionSection,
  useDataGridTableStageViewportSection,
} from "./dataGridTableStageContext"
import { shouldPrioritizeNativeScrollForMouseDown, shouldPrioritizeNativeScrollForMouseEvent } from "./dataGridMouseEventGuards"
import {
  DATA_GRID_STAGE_ROW_INDEX_HEADER_ID,
  resolveDataGridStageHeaderId,
} from "./dataGridTableStageA11y"
import { resolveDataGridGroupHeaderGeometry } from "./dataGridGroupHeaderGeometry"

interface DataGridPivotHeaderMeta {
  groupLabels?: readonly string[]
  groupLabel?: string
  leafLabel?: string
}

interface DataGridHeaderGroup {
  key: string
  label: string | null
  width: number
  columns: TableColumn[]
  start: number
  resizeColumnKey: string | null
  resizeColumnWidth: number | null
  renderedWidth?: number
  renderedStart?: number
}

type DataGridHeaderAriaSort = "ascending" | "descending" | "none"

interface DataGridHeaderCellA11yAttributes {
  role: "columnheader"
  tabindex: -1
  "aria-colindex": number
  "aria-label": string
  "aria-sort"?: DataGridHeaderAriaSort
}

const props = defineProps({
  externalFilterIndicators: {
    type: Array as PropType<readonly DataGridExternalFilterIndicator[]>,
    default: () => [],
  },
  paneLayoutStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  leftPaneStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  rightPaneStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  leftTrackStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  rightTrackStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  rowIndexColumnStyle: {
    type: Object as PropType<CSSProperties>,
    required: true,
  },
  showIndexColumn: {
    type: Boolean,
    required: true,
  },
  navigateToRowIndex: {
    type: Function as PropType<(rowIndex: number, extend: boolean) => boolean>,
    default: undefined,
  },
  focusedBodyColumnKey: {
    type: String as PropType<string | null>,
    default: null,
  },
  focusedBodyRowIndex: {
    type: Number as PropType<number | null>,
    default: null,
  },
  copySelectedCells: {
    type: Function as PropType<(trigger?: "keyboard" | "context-menu") => Promise<boolean>>,
    default: undefined,
  },
  isCoarsePointer: {
    type: Boolean,
    default: false,
  },
  onLinkedViewportWheel: {
    type: Function as PropType<(event: WheelEvent) => void>,
    required: true,
  },
})

const mode = useDataGridTableStageMode<Record<string, unknown>>()
const layout = useDataGridTableStageLayoutSection<Record<string, unknown>>()
const viewport = useDataGridTableStageViewportSection<Record<string, unknown>>()
const columns = useDataGridTableStageColumnsSection<Record<string, unknown>>()
const rows = useDataGridTableStageRowsSection<Record<string, unknown>>()
const selection = useDataGridTableStageSelectionSection<Record<string, unknown>>()

const visibleColumns = computed(() => columns.value.visibleColumns)
const indexedDataColumnIndexes = computed(() => visibleColumns.value
  .map((column, index) => isRowSelectionColumn(column) ? -1 : index)
  .filter(index => index >= 0))
const centerHeaderScrollLeft = ref(0)
const hasMultiCellSelection = computed(() => {
  const ranges = selection.value.selectionRanges
    ?? (selection.value.selectionRange ? [selection.value.selectionRange] : [])
  return ranges.some(range => range.startRow !== range.endRow || range.startColumn !== range.endColumn)
})
const isIndexHeaderSelectionActive = ref(false)
const isIndexHeaderSelected = computed(() => {
  const range = selection.value.selectionRange
  const firstColumn = indexedDataColumnIndexes.value[0]
  const lastColumn = indexedDataColumnIndexes.value[indexedDataColumnIndexes.value.length - 1]
  const lastRow = (selection.value.totalRowCount ?? 0) - 1
  return isIndexHeaderSelectionActive.value
    && range != null && firstColumn != null && lastColumn != null && lastRow >= 0
    && range.startRow === 0 && range.endRow >= lastRow
    && range.startColumn === firstColumn && range.endColumn >= lastColumn
})

function selectAllIndexedRows(): void {
  isIndexHeaderSelectionActive.value = true
  const firstColumn = indexedDataColumnIndexes.value[0]
  const lastColumn = indexedDataColumnIndexes.value[indexedDataColumnIndexes.value.length - 1]
  if (firstColumn != null && lastColumn != null) {
    selection.value.selectColumnRange?.(firstColumn, lastColumn)
  }
}

function handleIndexHeaderBlur(): void {
  isIndexHeaderSelectionActive.value = false
}

function focusRowIndexHeaderFromClick(event: MouseEvent): void {
  (event.currentTarget as HTMLElement).focus({ preventScroll: true })
  selectAllIndexedRows()
}
const renderedColumns = computed(() => columns.value.renderedColumns)
const centerHeaderColumns = computed(() => renderedColumns.value)
const allCenterHeaderColumns = computed(() => visibleColumns.value.filter(column => column.pin !== "left" && column.pin !== "right"))
const allCenterHeaderWidth = computed(() => allCenterHeaderColumns.value.reduce((sum, column) => sum + resolveColumnWidth(column), 0))
const hasCenterTrailingWhitespace = computed(() => {
  if (rightColumnSpacerWidth.value > 0) return false
  const centerContentRight = allCenterHeaderWidth.value - centerHeaderScrollLeft.value
  return paneWidths.value.center > centerContentRight + 0.5
})
const pinnedLeftColumns = computed(() => visibleColumns.value.filter(column => column.pin === "left"))
const pinnedRightColumns = computed(() => visibleColumns.value.filter(column => column.pin === "right"))
const interactionModeInput = computed(() => ({
  interactionMode: "auto" as const,
  isCoarsePointer: props.isCoarsePointer,
}))
const pivotHeaderGroupDepth = computed(() => {
  if (mode.value !== "pivot") {
    return 0
  }
  return visibleColumns.value.reduce((maxDepth, column) => {
    const meta = readPivotHeaderMeta(column)
    return Math.max(maxDepth, meta?.groupLabels?.length ?? 0)
  }, 0)
})
const columnHeaderGroupDepth = computed(() => visibleColumns.value.reduce((maxDepth, column) => (
  Math.max(maxDepth, column.groupPath?.length ?? 0)
), 0))
const headerGroupDepth = computed(() => Math.max(pivotHeaderGroupDepth.value, columnHeaderGroupDepth.value))
const hasHeaderGroups = computed(() => headerGroupDepth.value > 0)
const leftHeaderGroupRows = computed(() => buildHeaderGroupRows(
  pinnedLeftColumns.value,
  props.showIndexColumn ? Number.parseFloat(String(props.rowIndexColumnStyle.width ?? "0")) || 0 : 0,
))
const allCenterHeaderGroupRows = computed(() => buildHeaderGroupRows(allCenterHeaderColumns.value))
const centerHeaderGroupRows = computed(() => {
  const windowStart = viewport.value.leftColumnSpacerWidth
  const totalWidth = allCenterHeaderWidth.value
  const windowEnd = Math.max(windowStart, totalWidth - viewport.value.rightColumnSpacerWidth)
  return allCenterHeaderGroupRows.value.map(row => row.flatMap(group => {
    const groupEnd = group.start + group.width
    const renderedStart = Math.max(group.start, windowStart)
    const renderedEnd = Math.min(groupEnd, windowEnd)
    if (renderedEnd <= renderedStart) return []
    return [{
      ...group,
      renderedStart,
      renderedWidth: renderedEnd - renderedStart,
      resizeColumnKey: renderedEnd >= groupEnd ? group.resizeColumnKey : null,
    }]
  }))
})
const rightHeaderGroupRows = computed(() => buildHeaderGroupRows(pinnedRightColumns.value))
const mainTrackStyle = computed(() => layout.value.mainTrackStyle)
const leftColumnSpacerWidth = computed(() => viewport.value.leftColumnSpacerWidth)
const rightColumnSpacerWidth = computed(() => viewport.value.rightColumnSpacerWidth)
const columnFilterTextByKey = computed(() => columns.value.columnFilterTextByKey)
const filterRowEnabled = computed(() => columns.value.filterRowEnabled === true)
const draggedHeaderColumnKey = ref<string | null>(null)
const dragOverHeaderColumnKey = ref<string | null>(null)
const dragOverHeaderPlacement = ref<"before" | "after" | null>(null)
const pendingHeaderFocusColumnKey = ref<string | null>(null)
let pendingHeaderFocusSelectColumn = true
let suppressHeaderClick = false
let keyboardHeaderSelectionAnchorColumnIndex: number | null = null
let activeTouchResizeId: number | null = null
const resizeClickGuard = useDataGridResizeClickGuard()
const headerShellElement = ref<HTMLElement | null>(null)
const leftPaneElement = ref<HTMLElement | null>(null)
const rightPaneElement = ref<HTMLElement | null>(null)
const paneWidths = ref({ left: 0, center: 0, right: 0 })
const groupLabelWidths = ref<Record<string, number>>({})
let groupHeaderFrame: number | null = null
let groupHeaderResizeObserver: ResizeObserver | null = null
function syncGroupHeaderGeometry(): void {
  groupHeaderFrame = null
  const nextPaneWidths = {
    left: leftPaneElement.value?.clientWidth ?? 0,
    center: centerHeaderViewportElement?.clientWidth ?? 0,
    right: rightPaneElement.value?.clientWidth ?? 0,
  }
  if (paneWidths.value.left !== nextPaneWidths.left
    || paneWidths.value.center !== nextPaneWidths.center
    || paneWidths.value.right !== nextPaneWidths.right) {
    paneWidths.value = nextPaneWidths
  }
}
function scheduleGroupHeaderGeometry(): void {
  if (groupHeaderFrame != null || typeof window === "undefined") return
  groupHeaderFrame = window.requestAnimationFrame(syncGroupHeaderGeometry)
}
let centerHeaderViewportElement: HTMLElement | null = null
function groupLabelMeasureKey(group: DataGridHeaderGroup, pane: "left" | "center" | "right", depth: number): string {
  return `${pane}:${depth}:${group.key}`
}
function measureGroupLabelWidths(): void {
  const labels = headerShellElement.value?.querySelectorAll<HTMLElement>("[data-datagrid-group-label-measure-key]")
  const nextWidths: Record<string, number> = { ...groupLabelWidths.value }
  for (const label of Array.from(labels ?? [])) {
    const key = label.dataset.datagridGroupLabelMeasureKey
    const width = label.scrollWidth
    if (key && width > 0) {
      nextWidths[key] = width
    }
  }
  const keys = Object.keys(nextWidths)
  if (keys.length > 512) {
    for (const key of keys.slice(0, keys.length - 512)) delete nextWidths[key]
  }
  const currentKeys = Object.keys(groupLabelWidths.value)
  const nextKeys = Object.keys(nextWidths)
  if (currentKeys.length !== nextKeys.length || nextKeys.some(key => groupLabelWidths.value[key] !== nextWidths[key])) {
    groupLabelWidths.value = nextWidths
  }
}
onMounted(() => {
  syncGroupHeaderGeometry()
  void nextTick(measureGroupLabelWidths)
  if (typeof ResizeObserver !== "undefined") {
    groupHeaderResizeObserver = new ResizeObserver(scheduleGroupHeaderGeometry)
    for (const element of [leftPaneElement.value, rightPaneElement.value, centerHeaderViewportElement]) {
      if (element) groupHeaderResizeObserver.observe(element)
    }
  }
  window.addEventListener("resize", scheduleGroupHeaderGeometry, { passive: true })
})
watch(
  [leftHeaderGroupRows, centerHeaderGroupRows, rightHeaderGroupRows],
  () => measureGroupLabelWidths(),
  { flush: "post" },
)
watch(
  [renderedColumns, visibleColumns],
  () => {
    const columnKey = pendingHeaderFocusColumnKey.value
    if (!columnKey) return
    if (!visibleColumns.value.some(column => column.key === columnKey)) {
      pendingHeaderFocusColumnKey.value = null
      return
    }
    const headerCell = resolveHeaderCellElement(columnKey)
    if (headerCell) {
      pendingHeaderFocusColumnKey.value = null
      focusMountedHeaderColumn(headerCell, columnKey, pendingHeaderFocusSelectColumn)
    }
  },
  { flush: "post" },
)
onBeforeUnmount(() => {
  resizeClickGuard.dispose()
  groupHeaderResizeObserver?.disconnect()
  groupHeaderResizeObserver = null
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", scheduleGroupHeaderGeometry)
    if (groupHeaderFrame != null) window.cancelAnimationFrame(groupHeaderFrame)
  }
})

function hasColumnMenu(): boolean {
  if (columns.value.columnMenuEnabled === true) {
    return true
  }
  return typeof columns.value.applyColumnMenuSort === "function"
    || typeof columns.value.applyColumnMenuPin === "function"
    || typeof columns.value.applyColumnMenuFilter === "function"
    || typeof columns.value.clearColumnMenuFilter === "function"
}

function shouldUseColumnMenus(): boolean {
  return hasColumnMenu() && columns.value.columnMenuValueFilterEnabled !== false
}

function resolveTextAlign(value: unknown): CSSProperties["textAlign"] | undefined {
  return value === "left" || value === "center" || value === "right"
    ? value
    : undefined
}

function scheduleHeaderClickSuppressionReset(): void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => {
      suppressHeaderClick = false
    })
    return
  }
  queueMicrotask(() => {
    suppressHeaderClick = false
  })
}

function clearHeaderColumnDragState(resetClickSuppression = false): void {
  draggedHeaderColumnKey.value = null
  dragOverHeaderColumnKey.value = null
  dragOverHeaderPlacement.value = null
  if (resetClickSuppression) {
    scheduleHeaderClickSuppressionReset()
  }
}

function isHeaderColumnDraggable(column: TableColumn): boolean {
  return typeof columns.value.reorderColumnsByHeader === "function"
    && mode.value !== "pivot"
    && !props.isCoarsePointer
    && !isRowSelectionColumn(column)
}

function isLeadingPinnedRightColumn(column: TableColumn): boolean {
  return pinnedRightColumns.value[0]?.key === column.key
}

function isHeaderDragBlockedFromTarget(event: DragEvent): boolean {
  const target = event.target instanceof HTMLElement ? event.target : null
  return Boolean(target?.closest(".col-resize, .col-menu-trigger, .col-filter, .col-filter-input, input, button"))
}

function resolveHeaderColumnDropPlacement(event: DragEvent): "before" | "after" {
  const target = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  const rect = target?.getBoundingClientRect()
  if (!rect || rect.width <= 0) {
    return "after"
  }
  return event.clientX < rect.left + rect.width / 2 ? "before" : "after"
}

function resolveHeaderCellClasses(
  column: TableColumn,
  options: { menuEnabled?: boolean; menuOpen?: boolean } = {},
): Record<string, boolean> {
  const isTerminalCenterColumn = column.pin !== "left"
    && column.pin !== "right"
    && allCenterHeaderColumns.value[allCenterHeaderColumns.value.length - 1]?.key === column.key
    && (pinnedRightColumns.value.length === 0 || hasCenterTrailingWhitespace.value)
  const selectionEdges = resolveColumnSelectionRangeEdges(column)
  return {
    "grid-cell--header-selected": selectionEdges.selected,
    "grid-cell--focus-axis": props.focusedBodyColumnKey === column.key,
    "grid-cell--header-selection-range": selectionEdges.selected,
    "grid-cell--header-selection-range-start": selectionEdges.start,
    "grid-cell--header-selection-range-end": selectionEdges.end,
    "grid-cell--header-terminal": isTerminalCenterColumn,
    "grid-cell--header-menu-enabled": options.menuEnabled === true,
    "grid-cell--header-menu-open": options.menuOpen === true,
    "grid-cell--header-reorderable": isHeaderColumnDraggable(column),
    "grid-cell--header-merged-untitled": trailingEmptyHeaderGroupDepth(column) > 0,
    "grid-cell--header-reorder-source": draggedHeaderColumnKey.value === column.key,
    "grid-cell--header-drop-before": dragOverHeaderColumnKey.value === column.key && dragOverHeaderPlacement.value === "before",
    "grid-cell--header-drop-after": dragOverHeaderColumnKey.value === column.key && dragOverHeaderPlacement.value === "after",
  }
}

function resolveColumnSelectionRangeEdges(column: TableColumn): { selected: boolean; start: boolean; end: boolean } {
  const columnIndex = isRowSelectionColumn(column)
    ? -1
    : visibleColumns.value.findIndex(entry => entry.key === column.key)
  const totalRowCount = selection.value.totalRowCount ?? 0
  if (columnIndex < 0 || totalRowCount <= 0) {
    return { selected: false, start: false, end: false }
  }
  const ranges = selection.value.selectionRanges
    ?? (selection.value.selectionRange ? [selection.value.selectionRange] : [])
  let selected = false
  let start = false
  let end = false
  for (const range of ranges) {
    const startRow = Math.min(range.startRow, range.endRow)
    const endRow = Math.max(range.startRow, range.endRow)
    const startColumn = Math.min(range.startColumn, range.endColumn)
    const endColumn = Math.max(range.startColumn, range.endColumn)
    const firstDataColumn = indexedDataColumnIndexes.value[0]
    const lastDataColumn = indexedDataColumnIndexes.value[indexedDataColumnIndexes.value.length - 1]
    const coversAllRows = startRow <= 0 && endRow >= totalRowCount - 1
    const coversAllDataColumns = firstDataColumn != null && lastDataColumn != null
      && startColumn <= firstDataColumn && endColumn >= lastDataColumn
    if (coversAllDataColumns && !coversAllRows) continue
    const intersectsRows = endRow >= 0 && startRow < totalRowCount
    if (!intersectsRows || columnIndex < startColumn || columnIndex > endColumn) continue
    selected = true
    start ||= columnIndex === startColumn
    end ||= columnIndex === endColumn
  }
  return { selected, start, end }
}

function columnStyle(key: string): CSSProperties {
  return layout.value.columnStyle(key)
}

function resolveColumnWidth(column: TableColumn): number {
  const styleWidth = Number.parseFloat(String(layout.value.columnStyle(column.key).width ?? ""))
  if (Number.isFinite(styleWidth) && styleWidth > 0) {
    return Math.max(0, Math.trunc(styleWidth))
  }
  if (typeof column.width === "number" && Number.isFinite(column.width)) {
    return Math.max(0, Math.trunc(column.width))
  }
  return 140
}

function readPivotHeaderMeta(column: TableColumn): DataGridPivotHeaderMeta | null {
  const rawMeta = column.column.meta?.affinoPivotHeader
  if (!rawMeta || typeof rawMeta !== "object") {
    return null
  }
  const meta = rawMeta as Record<string, unknown>
  return {
    groupLabels: Array.isArray(meta.groupLabels)
      ? meta.groupLabels.filter((value): value is string => typeof value === "string" && value.length > 0)
      : typeof meta.groupLabel === "string" && meta.groupLabel.length > 0
        ? [meta.groupLabel]
        : undefined,
    groupLabel: typeof meta.groupLabel === "string" ? meta.groupLabel : undefined,
    leafLabel: typeof meta.leafLabel === "string" ? meta.leafLabel : undefined,
  }
}

function resolveHeaderDisplayLabel(column: TableColumn): string {
  if (mode.value !== "pivot") {
    return column.column.label ?? column.key
  }
  return readPivotHeaderMeta(column)?.leafLabel ?? column.column.label ?? column.key
}

function resolveColumnGroupLabel(column: TableColumn, depth: number): string | null {
  if (mode.value === "pivot") {
    const meta = readPivotHeaderMeta(column)
    return typeof meta?.groupLabels?.[depth] === "string" && meta.groupLabels[depth].length > 0
      ? meta.groupLabels[depth]
      : null
  }
  const group = column.groupPath?.[depth]
  return group?.label ? group.label : null
}

function buildHeaderGroups(columnsList: readonly TableColumn[], depth: number): readonly DataGridHeaderGroup[] {
  const groups: DataGridHeaderGroup[] = []
  let start = 0
  for (const column of columnsList) {
    const label = resolveColumnGroupLabel(column, depth)
    const width = resolveColumnWidth(column)
    const previous = groups[groups.length - 1]
    if (previous && previous.label === label) {
      previous.width += width
      previous.columns.push(column)
      previous.resizeColumnKey = column.key
      previous.resizeColumnWidth = width
      start += width
      continue
    }
    groups.push({
      key: `${label ?? "empty"}:${column.key}`,
      label,
      width,
      columns: [column],
      start,
      resizeColumnKey: label ? column.key : null,
      resizeColumnWidth: label ? width : null,
    })
    start += width
  }
  return groups
}

function buildHeaderGroupRows(columnsList: readonly TableColumn[], initialOffset = 0): readonly (readonly DataGridHeaderGroup[])[] {
  if (!hasHeaderGroups.value) {
    return []
  }
  const rows: Array<readonly DataGridHeaderGroup[]> = []
  for (let depth = 0; depth < headerGroupDepth.value; depth += 1) {
    rows.push(buildHeaderGroups(columnsList, depth).map(group => ({ ...group, start: group.start + initialOffset })))
  }
  return rows
}

function headerGroupStyle(group: DataGridHeaderGroup): CSSProperties {
  const width = `${Math.max(0, group.renderedWidth ?? group.width)}px`
  return {
    width,
    minWidth: width,
    maxWidth: width,
    textAlign: "center",
  }
}

function groupLabelStyle(group: DataGridHeaderGroup, pane: "left" | "center" | "right", depth: number): CSSProperties {
  const viewportWidth = paneWidths.value[pane]
  const scrollLeft = pane === "center" ? centerHeaderScrollLeft.value : 0
  const measureKey = groupLabelMeasureKey(group, pane, depth)
  const measuredLabelWidth = groupLabelWidths.value[measureKey]
  const geometry = resolveDataGridGroupHeaderGeometry({
    groupStart: group.start,
    groupWidth: group.width,
    scrollLeft,
    viewportWidth,
    labelWidth: measuredLabelWidth ?? estimateGroupLabelWidth(group.label ?? ""),
  })
  if (!geometry.visible) return { display: "none" }
  return {
    position: "absolute",
    left: `${geometry.left - ((group.renderedStart ?? group.start) - group.start)}px`,
    width: `${geometry.width}px`,
    maxWidth: `${geometry.width}px`,
    textAlign: geometry.alignment,
  }
}

function handleHeaderViewportScroll(event: Event): void {
  if (!hasHeaderGroups.value) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  if (centerHeaderScrollLeft.value !== target.scrollLeft) {
    centerHeaderScrollLeft.value = target.scrollLeft
  }
}

function estimateGroupLabelWidth(label: string): number {
  // Give newly virtualized labels a useful first-frame width before their DOM
  // width is measured after mount. This prevents a visible group from flashing
  // an empty label while preserving the measured width on the next render.
  return Math.max(12, label.length * 8 + 12)
}

function trailingEmptyHeaderGroupDepth(column: TableColumn): number {
  let emptyDepth = 0
  for (let depth = headerGroupDepth.value - 1; depth >= 0; depth -= 1) {
    if (resolveColumnGroupLabel(column, depth)) break
    emptyDepth += 1
  }
  return emptyDepth
}

function mergedHeaderCellStyle(depth: number): CSSProperties {
  return depth > 0 ? {
    "--datagrid-header-merge-offset": `${depth * 34}px`,
    "--datagrid-header-merge-center-offset": `${depth * 17}px`,
  } as CSSProperties : {}
}

function headerColumnStyle(column: TableColumn): CSSProperties[] {
  return [columnStyle(column.key), headerCellPresentationStyle(column), mergedHeaderCellStyle(trailingEmptyHeaderGroupDepth(column))]
}

const indexColumnHeaderStyle = computed<CSSProperties>(() => ({
  ...props.rowIndexColumnStyle,
  ...mergedHeaderCellStyle(headerGroupDepth.value),
}))

function sortIndicator(columnKey: string): string {
  return columns.value.sortIndicator(columnKey)
}

function startResize(event: MouseEvent, columnKey: string, edge: "left" | "right" = "right"): void {
  if (shouldPrioritizeNativeScrollForMouseDown(event, interactionModeInput.value)) {
    return
  }
  resizeClickGuard.armResizeGuard()
  event.preventDefault()
  columns.value.startResize(event, columnKey, edge)
}

function readTouchAt(touches: TouchList, identifier: number): Touch | null {
  const indexedTouches = touches as TouchList & { [index: number]: Touch | undefined }
  for (let index = 0; index < touches.length; index += 1) {
    const touch = typeof touches.item === "function" ? touches.item(index) : indexedTouches[index]
    if (touch?.identifier === identifier) {
      return touch
    }
  }
  return null
}

function readFirstTouch(touches: TouchList): Touch | null {
  const indexedTouches = touches as TouchList & { [index: number]: Touch | undefined }
  return (typeof touches.item === "function" ? touches.item(0) : indexedTouches[0]) ?? null
}

function createTouchResizeMouseEvent(type: "mousedown" | "mousemove" | "mouseup", touch: Touch): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: touch.clientX,
    clientY: touch.clientY,
  })
}

function startTouchResize(event: TouchEvent, columnKey: string, edge: "left" | "right" = "right"): void {
  const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
  if (!touch) {
    activeTouchResizeId = null
    return
  }
  resizeClickGuard.armResizeGuard()
  activeTouchResizeId = touch.identifier
  columns.value.startResize(createTouchResizeMouseEvent("mousedown", touch), columnKey, edge)
}

function handleTouchResizeMove(event: TouchEvent): void {
  if (activeTouchResizeId == null || typeof window === "undefined") {
    return
  }
  const touch = readTouchAt(event.touches, activeTouchResizeId)
  if (!touch) {
    return
  }
  window.dispatchEvent(createTouchResizeMouseEvent("mousemove", touch))
}

function handleTouchResizeEnd(event: TouchEvent): void {
  if (activeTouchResizeId == null || typeof window === "undefined") {
    activeTouchResizeId = null
    resizeClickGuard.releaseResizeGuard()
    return
  }
  const touch = readTouchAt(event.changedTouches, activeTouchResizeId)
  activeTouchResizeId = null
  resizeClickGuard.releaseResizeGuard()
  if (!touch) {
    return
  }
  window.dispatchEvent(createTouchResizeMouseEvent("mouseup", touch))
}

function handleResizeDoubleClick(event: MouseEvent, columnKey: string): void {
  if (shouldPrioritizeNativeScrollForMouseEvent(event, interactionModeInput.value)) {
    return
  }
  columns.value.handleResizeDoubleClick(event, columnKey)
}

function setColumnFilterText(columnKey: string, value: string): void {
  columns.value.setColumnFilterText(columnKey, value)
}

function filterRowDraft(columnKey: string) {
  return columns.value.filterRowDraftByKey?.[columnKey] ?? { operator: "contains", value: "", value2: "" }
}

function updateFilterRowDraft(columnKey: string, draft: { operator: string; value: string; value2: string }): void {
  columns.value.updateFilterRowDraft?.(columnKey, draft)
}

function applyFilterRowDraft(columnKey: string): void {
  columns.value.applyFilterRowDraft?.(columnKey)
}

function cancelFilterRowDraft(columnKey: string): void {
  columns.value.cancelFilterRowDraft?.(columnKey)
}

function headerViewportRef(value: Element | { $el?: unknown } | null): void {
  const element = typeof HTMLElement === "undefined"
    ? null
    : value instanceof HTMLElement
      ? value
      : value && "$el" in value && value.$el instanceof HTMLElement
        ? value.$el
        : null
  if (centerHeaderViewportElement === element) return
  if (centerHeaderViewportElement) {
    groupHeaderResizeObserver?.unobserve(centerHeaderViewportElement)
  }
  centerHeaderViewportElement = element
  if (element) {
    centerHeaderScrollLeft.value = element.scrollLeft
    if (groupHeaderResizeObserver) groupHeaderResizeObserver.observe(element)
    scheduleGroupHeaderGeometry()
  }
  viewport.value.headerViewportRef(value as never)
}

function isRowSelectionColumn(column: TableColumn): boolean {
  return column.column.meta?.rowSelection === true
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

function headerCellId(column: TableColumn): string {
  return resolveDataGridStageHeaderId(column.key)
}

function resolveHeaderColumnIndex(column: TableColumn): number {
  const index = visibleColumns.value.findIndex(entry => entry.key === column.key)
  return Math.max(0, index) + 1
}

function resolveHeaderSortDirection(column: TableColumn): DataGridHeaderAriaSort | undefined {
  if (!isColumnSortable(column)) {
    return undefined
  }
  const menuDirection = resolveColumnMenuSortDirectionSafe(column.key)
  if (menuDirection === "asc") {
    return "ascending"
  }
  if (menuDirection === "desc") {
    return "descending"
  }
  const indicator = sortIndicator(column.key)
  if (indicator.startsWith("↑")) {
    return "ascending"
  }
  if (indicator.startsWith("↓")) {
    return "descending"
  }
  return "none"
}

function resolveColumnHeaderLabel(column: TableColumn): string {
  if (isRowSelectionColumn(column)) {
    return "Row selection"
  }
  const label = resolveHeaderDisplayLabel(column)
  const states: string[] = []
  const sortDirection = resolveHeaderSortDirection(column)
  if (sortDirection === "ascending") {
    states.push("sorted ascending")
  } else if (sortDirection === "descending") {
    states.push("sorted descending")
  }
  if (isColumnMenuFilterActive(column.key)) {
    states.push("filtered")
  }
  const externalFilterDescription = externalFilterTooltip(column.key)
  if (externalFilterDescription) {
    states.push(`filtered externally: ${externalFilterDescription}`)
  }
  if (isColumnGroupedSafe(column.key)) {
    const order = resolveColumnGroupOrderSafe(column.key)
    states.push(Number.isFinite(order) ? `grouped level ${Number(order) + 1}` : "grouped")
  }
  return states.length > 0 ? `${label}, ${states.join(", ")}` : label
}

const externalFilterIndicatorsByColumn = computed(() => {
  const ids = new Set<string>()
  const byColumn = new Map<string, string[]>()
  for (const indicator of props.externalFilterIndicators) {
    const id = indicator.id.trim()
    const columnKey = indicator.columnKey.trim()
    const description = indicator.description.trim()
    if (!id || !columnKey || !description || !indicator.active || ids.has(id)) continue
    ids.add(id)
    const descriptions = byColumn.get(columnKey) ?? []
    descriptions.push(description)
    byColumn.set(columnKey, descriptions)
  }
  return byColumn
})

function externalFilterTooltip(columnKey: string): string {
  return externalFilterIndicatorsByColumn.value.get(columnKey)?.join("; ") ?? ""
}

function headerCellA11y(column: TableColumn): DataGridHeaderCellA11yAttributes {
  const sortDirection = resolveHeaderSortDirection(column)
  const attributes: DataGridHeaderCellA11yAttributes = {
    role: "columnheader",
    tabindex: -1,
    "aria-colindex": resolveHeaderColumnIndex(column),
    "aria-label": resolveColumnHeaderLabel(column),
  }
  if (sortDirection) {
    attributes["aria-sort"] = sortDirection
  }
  return attributes
}

function resolveHeaderCellElement(columnKey: string): HTMLElement | null {
  const stageRoot = headerShellElement.value?.closest(".grid-stage")
  return Array.from(stageRoot?.querySelectorAll<HTMLElement>(".grid-header-shell .grid-cell--header[data-column-key]") ?? [])
    .find(element => element.dataset.columnKey === columnKey) ?? null
}

function revealHeaderColumnInBodyViewport(headerCell: HTMLElement): void {
  if (!headerCell.closest(".grid-header-viewport")) return
  const stageRoot = headerShellElement.value?.closest(".grid-stage")
  const bodyViewport = stageRoot?.querySelector<HTMLElement>(".grid-body-center-horizontal-scrollport--scroll-owner")
    ?? stageRoot?.querySelector<HTMLElement>(".grid-body-viewport")
  const headerViewport = centerHeaderViewportElement
  if (!bodyViewport || !headerViewport) return

  const headerBounds = headerViewport.getBoundingClientRect()
  const cellBounds = headerCell.getBoundingClientRect()
  const columnLeft = cellBounds.left - headerBounds.left + headerViewport.scrollLeft
  const columnRight = columnLeft + cellBounds.width
  const viewportLeft = bodyViewport.scrollLeft
  const viewportRight = viewportLeft + bodyViewport.clientWidth
  if (columnLeft < viewportLeft) {
    bodyViewport.scrollLeft = columnLeft
  } else if (columnRight > viewportRight) {
    bodyViewport.scrollLeft = columnRight - bodyViewport.clientWidth
  }
}

function focusMountedHeaderColumn(headerCell: HTMLElement, columnKey: string, selectColumn: boolean): void {
  revealHeaderColumnInBodyViewport(headerCell)
  const columnIndex = visibleColumns.value.findIndex(column => column.key === columnKey)
  const column = visibleColumns.value[columnIndex]
  if (column && !isRowSelectionColumn(column)) {
    if (selectColumn) {
      selection.value.selectColumn?.(columnIndex)
      keyboardHeaderSelectionAnchorColumnIndex = columnIndex
    }
  } else if (column && isRowSelectionColumn(column)) {
    selection.value.clearCellSelection?.()
    keyboardHeaderSelectionAnchorColumnIndex = null
  }
  const focusTarget = column && isRowSelectionColumn(column)
    ? headerCell.querySelector<HTMLElement>(".grid-checkbox-trigger") ?? headerCell
    : headerCell
  focusTarget.focus({ preventScroll: true })
}

function focusHeaderColumn(columnKey: string, selectColumn = true): void {
  const headerCell = resolveHeaderCellElement(columnKey)
  if (headerCell) {
    pendingHeaderFocusColumnKey.value = null
    focusMountedHeaderColumn(headerCell, columnKey, selectColumn)
    return
  }
  if (!columns.value.scrollToColumn) return
  pendingHeaderFocusColumnKey.value = columnKey
  pendingHeaderFocusSelectColumn = selectColumn
  columns.value.scrollToColumn({ columnKey, align: "nearest" })
  // One post-render check handles the synchronous model update. Further
  // waiting is driven by the rendered-column watch, never a recursive tick loop.
  void nextTick(() => {
    if (pendingHeaderFocusColumnKey.value !== columnKey) return
    const mountedHeaderCell = resolveHeaderCellElement(columnKey)
    if (!mountedHeaderCell) return
    pendingHeaderFocusColumnKey.value = null
    focusMountedHeaderColumn(mountedHeaderCell, columnKey, pendingHeaderFocusSelectColumn)
  })
}

function focusRowIndexHeader(stageRoot: ParentNode): void {
  const header = stageRoot.querySelector<HTMLElement>("[data-datagrid-row-index-header='true']")
  header?.focus({ preventScroll: true })
}

function focusSelectionAnchorBodyCell(stageRoot: ParentNode): void {
  const anchor = selection.value.selectionAnchorCell
  if (anchor) {
    focusBodyCell(stageRoot, anchor.rowIndex, anchor.columnIndex)
    return
  }
  stageRoot.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell")?.focus({ preventScroll: true })
}

function focusBodyCell(stageRoot: ParentNode, rowIndex: number, columnIndex: number): void {
  const bodyCell = Array.from(stageRoot.querySelectorAll<HTMLElement>(".datagrid-stage__cell[data-row-index][data-column-index]"))
    .find(element => Number(element.dataset.rowIndex) === rowIndex && Number(element.dataset.columnIndex) === columnIndex)
  if (bodyCell) bodyCell.focus({ preventScroll: true })
  else stageRoot.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell")?.focus({ preventScroll: true })
}

function focusFirstRowSelectionCell(stageRoot: ParentNode): void {
  const firstCheckboxCell = stageRoot.querySelector<HTMLElement>(
    ".grid-body-pane--left .grid-cell--row-selection[data-row-index], .grid-body-viewport .grid-cell--row-selection[data-row-index]",
  )
  if (firstCheckboxCell) {
    firstCheckboxCell.focus({ preventScroll: true })
    return
  }
  stageRoot.querySelector<HTMLElement>(".grid-body-shared-vertical-scroll-shell")?.focus({ preventScroll: true })
}

function handleColumnFilterKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== "ArrowDown") return
  event.preventDefault()
  const stageRoot = (event.target as HTMLElement).closest(".grid-stage")
  if (!stageRoot) return
  void nextTick(() => focusSelectionAnchorBodyCell(stageRoot))
}

function handleHeaderKeyboardNavigation(event: KeyboardEvent): void {
  const target = event.target
  if (!(target instanceof HTMLElement)) {
    return
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "c") {
    const isTextInput = target.closest("input, textarea, [contenteditable]:not([contenteditable='false'])") !== null
    if (!isTextInput && props.copySelectedCells) {
      event.preventDefault()
      void props.copySelectedCells("keyboard")
    }
    return
  }
  const stageRoot = target.closest(".grid-stage")
  const isIndexHeader = target.closest("[data-datagrid-row-index-header='true']") !== null
  if (isIndexHeader) {
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
      && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault()
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === "ArrowRight") {
      const firstColumn = visibleColumns.value[0]
      if (firstColumn) {
        event.preventDefault()
        focusHeaderColumn(firstColumn.key)
      }
    } else if (event.key === "ArrowDown" && stageRoot) {
      if (props.navigateToRowIndex?.(0, false) === true) {
        event.preventDefault()
        return
      }
      const firstRowIndexCell = stageRoot.querySelector<HTMLElement>(".grid-cell--index-number[data-row-index='0']")
      if (firstRowIndexCell) {
        event.preventDefault()
        firstRowIndexCell.focus({ preventScroll: true })
      }
    }
    return
  }
  const headerCell = target.closest<HTMLElement>(".grid-cell--header[data-column-key]")
  if (!headerCell) return
  const columnKey = headerCell.dataset.columnKey
  if (!columnKey) return
  const columnIndex = visibleColumns.value.findIndex(column => column.key === columnKey)
  if (columnIndex < 0 || !stageRoot) {
    return
  }
  const keyboardDirection = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
  const isKeyboardReorder = keyboardDirection !== 0
    && event.shiftKey
    && ((event.ctrlKey || event.metaKey) !== event.altKey)
  if (isKeyboardReorder) {
    const column = visibleColumns.value[columnIndex]
    const nextColumn = visibleColumns.value[columnIndex + keyboardDirection]
    if (column && nextColumn && column.pin === nextColumn.pin
      && isHeaderColumnDraggable(column) && isHeaderColumnDraggable(nextColumn)) {
      const moved = columns.value.reorderColumnsByHeader?.({
        sourceColumnKey: column.key,
        targetColumnKey: nextColumn.key,
        placement: keyboardDirection > 0 ? "after" : "before",
      }) === true
      if (moved) {
        event.preventDefault()
        // Reorder may replace or move the focused header node. Restore focus only
        // after Vue has committed the new keyed DOM order so repeated chords keep
        // acting on the same logical column.
        void nextTick(() => {
          focusHeaderColumn(column.key, false)
        })
      }
    }
    return
  }
  if (keyboardDirection !== 0 && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault()
    columns.value.resizeColumnByKeyboard?.(columnKey, keyboardDirection as -1 | 1)
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.shiftKey && event.key === "ArrowDown") {
    event.preventDefault()
    const targetRow = Math.min(1, (selection.value.totalRowCount ?? 0) - 1)
    if (targetRow >= 0) {
      selection.value.selectColumnThroughRow?.(targetRow, columnIndex)
      focusBodyCell(stageRoot, targetRow, columnIndex)
    }
    return
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault()
    const nextColumnIndex = columnIndex + (event.key === "ArrowRight" ? 1 : -1)
    const nextColumn = visibleColumns.value[nextColumnIndex]
    if (event.key === "ArrowLeft" && columnIndex === 0 && props.showIndexColumn) {
      focusRowIndexHeader(stageRoot)
      return
    }
    if (nextColumn) {
      if (event.shiftKey) {
        if (isRowSelectionColumn(nextColumn)) {
          focusHeaderColumn(nextColumn.key)
          return
        }
        const currentRange = selection.value.selectionRange
        const hasMultiColumnRange = currentRange != null && currentRange.startColumn !== currentRange.endColumn
        const anchorColumnIndex = hasMultiColumnRange
          ? keyboardHeaderSelectionAnchorColumnIndex ?? selection.value.selectionAnchorCell?.columnIndex ?? columnIndex
          : columnIndex
        selection.value.selectColumnRange?.(anchorColumnIndex, nextColumnIndex)
        keyboardHeaderSelectionAnchorColumnIndex = anchorColumnIndex
        focusHeaderColumn(nextColumn.key, false)
      } else {
        focusHeaderColumn(nextColumn.key)
      }
    }
    return
  }
  if (event.shiftKey) return
  if (event.key === "ArrowDown" || event.key === "Escape") {
    event.preventDefault()
    if (event.key === "ArrowDown") {
      const anchor = selection.value.selectionAnchorCell
      const column = visibleColumns.value[columnIndex]
      if (column && isRowSelectionColumn(column)) {
        selection.value.selectCell?.(0, columnIndex)
        focusFirstRowSelectionCell(stageRoot)
      } else if (column) {
        const rowIndex = anchor?.rowIndex ?? 0
        selection.value.selectCell?.(rowIndex, columnIndex)
        focusBodyCell(stageRoot, rowIndex, columnIndex)
      } else {
        focusSelectionAnchorBodyCell(stageRoot)
      }
    } else {
      focusSelectionAnchorBodyCell(stageRoot)
    }
    return
  }
  if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
    // Let the native checkbox button synthesize its click for Enter/Space.
    if (target !== headerCell && target.closest(".grid-checkbox-trigger")) return
    event.preventDefault()
    const column = visibleColumns.value[columnIndex]
    if (column) {
      if (isRowSelectionColumn(column)) {
        headerRowSelectionInteraction.value.activate()
      } else {
        handleHeaderColumnClick(column, { additive: false, extend: false })
      }
    }
  }
}

function resolveColumnResizeLabel(column: TableColumn): string {
  return `Resize ${resolveHeaderDisplayLabel(column)} column`
}

function resolveColumnFilterLabel(column: TableColumn): string {
  return `Filter ${resolveHeaderDisplayLabel(column)} column`
}

function handleHeaderColumnClick(
  column: TableColumn,
  modifiers: { additive: boolean; extend: boolean },
): void {
  if (suppressHeaderClick) {
    return
  }
  if (columns.value.handleHeaderColumnClick) {
    columns.value.handleHeaderColumnClick(column.key, modifiers)
    focusHeaderColumn(column.key, false)
    return
  }
  const columnIndex = visibleColumns.value.findIndex(entry => entry.key === column.key)
  if (columnIndex >= 0) {
    if (modifiers.extend) {
      const anchor = keyboardHeaderSelectionAnchorColumnIndex ?? selection.value.selectionAnchorCell?.columnIndex ?? columnIndex
      selection.value.selectColumnRange?.(anchor, columnIndex)
      keyboardHeaderSelectionAnchorColumnIndex = anchor
      focusHeaderColumn(column.key, false)
    } else {
      focusHeaderColumn(column.key)
    }
  }
  if (!isColumnSortable(column)) {
    return
  }
  columns.value.toggleSortForColumn(column.key, modifiers.extend)
}

function handleHeaderColumnDragStart(event: DragEvent, column: TableColumn): void {
  if (
    !isHeaderColumnDraggable(column)
    || isHeaderDragBlockedFromTarget(event)
    || shouldPrioritizeNativeScrollForMouseDown(event, interactionModeInput.value)
  ) {
    clearHeaderColumnDragState()
    return
  }
  suppressHeaderClick = true
  draggedHeaderColumnKey.value = column.key
  dragOverHeaderColumnKey.value = null
  dragOverHeaderPlacement.value = null
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.dropEffect = "move"
    event.dataTransfer.setData("text/plain", column.key)
  }
}

function handleHeaderColumnDragOver(event: DragEvent, column: TableColumn): void {
  if (!draggedHeaderColumnKey.value || !isHeaderColumnDraggable(column)) {
    dragOverHeaderColumnKey.value = null
    dragOverHeaderPlacement.value = null
    return
  }
  if (draggedHeaderColumnKey.value === column.key) {
    dragOverHeaderColumnKey.value = null
    dragOverHeaderPlacement.value = null
    return
  }
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }
  dragOverHeaderColumnKey.value = column.key
  dragOverHeaderPlacement.value = resolveHeaderColumnDropPlacement(event)
}

function handleHeaderColumnDrop(event: DragEvent, column: TableColumn): void {
  const sourceColumnKey = draggedHeaderColumnKey.value
  if (!sourceColumnKey || !isHeaderColumnDraggable(column)) {
    clearHeaderColumnDragState(true)
    return
  }
  if (sourceColumnKey === column.key) {
    clearHeaderColumnDragState(true)
    return
  }
  event.preventDefault()
  columns.value.reorderColumnsByHeader?.({
    sourceColumnKey,
    targetColumnKey: column.key,
    placement: resolveHeaderColumnDropPlacement(event),
  })
  clearHeaderColumnDragState(true)
}

function handleHeaderColumnDragEnd(): void {
  clearHeaderColumnDragState(true)
}

function isColumnFilterActiveSafe(columnKey: string): boolean {
  const evaluate = columns.value.isColumnFilterActive
  return typeof evaluate === "function" ? evaluate(columnKey) : false
}

function resolveColumnMenuSortDirectionSafe(columnKey: string): "asc" | "desc" | null {
  const resolve = columns.value.resolveColumnMenuSortDirection
  return typeof resolve === "function" ? resolve(columnKey) : null
}

function isColumnMenuSortActive(columnKey: string): boolean {
  return resolveColumnMenuSortDirectionSafe(columnKey) !== null
}

function isColumnMenuFilterActive(columnKey: string): boolean {
  return isColumnFilterActiveSafe(columnKey)
}

function isColumnGroupedSafe(columnKey: string): boolean {
  const evaluate = columns.value.isColumnGrouped
  return typeof evaluate === "function" ? evaluate(columnKey) : false
}

function resolveColumnGroupOrderSafe(columnKey: string): number | null {
  const resolve = columns.value.resolveColumnGroupOrder
  return typeof resolve === "function" ? resolve(columnKey) : null
}

function resolveColumnGroupBadgeLabel(columnKey: string): string | null {
  const order = resolveColumnGroupOrderSafe(columnKey)
  if (!Number.isFinite(order)) {
    return null
  }
  return `G${Number(order) + 1}`
}

function resolveColumnGroupBadgeTitle(columnKey: string): string {
  const order = resolveColumnGroupOrderSafe(columnKey)
  if (!Number.isFinite(order)) {
    return "Grouped column"
  }
  return `Grouped column, level ${Number(order) + 1}`
}

function shouldShowColumnMenuFilterIcon(columnKey: string): boolean {
  return isColumnMenuFilterActive(columnKey)
}

function shouldShowColumnMenuSortAscIcon(columnKey: string): boolean {
  return resolveColumnMenuSortDirectionSafe(columnKey) === "asc"
}

function shouldShowColumnMenuSortDescIcon(columnKey: string): boolean {
  return resolveColumnMenuSortDirectionSafe(columnKey) === "desc"
}

function resolveColumnMenuTriggerClass(columnKey: string, open: boolean): Record<string, boolean> {
  return {
    "col-menu-trigger--open": open,
    "col-menu-trigger--active": open || isColumnMenuSortActive(columnKey) || isColumnMenuFilterActive(columnKey) || isColumnGroupedSafe(columnKey),
    "col-menu-trigger--filtered": isColumnMenuFilterActive(columnKey),
    "col-menu-trigger--grouped": isColumnGroupedSafe(columnKey),
    "col-menu-trigger--sorted": isColumnMenuSortActive(columnKey),
  }
}

function resolveColumnMenuButtonLabel(column: TableColumn): string {
  const states: string[] = []
  if (isColumnMenuFilterActive(column.key)) {
    states.push("filtered")
  }
  if (isColumnGroupedSafe(column.key)) {
    const order = resolveColumnGroupOrderSafe(column.key)
    states.push(Number.isFinite(order) ? `grouped level ${Number(order) + 1}` : "grouped")
  }
  if (shouldShowColumnMenuSortAscIcon(column.key)) {
    states.push("sorted ascending")
  } else if (shouldShowColumnMenuSortDescIcon(column.key)) {
    states.push("sorted descending")
  }
  const suffix = states.length > 0 ? `, ${states.join(" and ")}` : ""
  return `Open column menu for ${column.column.label ?? column.key}${suffix}`
}

function isColumnMenuOpen(columnKey: string): boolean {
  return columns.value.activeColumnMenu?.columnId === columnKey
}

function openColumnMenuFromElement(
  column: TableColumn,
  element: HTMLElement | null,
  reason: DataGridColumnMenuOpenReason,
): void {
  if (!element || !shouldUseColumnMenus()) {
    return
  }
  columns.value.openColumnMenu?.(column.key, element, reason)
}

function preloadColumnMenu(): void {
  void import("../overlays/DataGridColumnMenu.vue").catch(() => undefined)
}

function toggleColumnMenuFromElement(
  column: TableColumn,
  element: HTMLElement | null,
  reason: DataGridColumnMenuOpenReason,
): void {
  if (isColumnMenuOpen(column.key)) {
    columns.value.closeColumnMenu?.()
    return
  }
  openColumnMenuFromElement(column, element, reason)
}

function handleColumnMenuButtonClick(column: TableColumn, event: MouseEvent): void {
  toggleColumnMenuFromElement(
    column,
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
    "button",
  )
}

function handleColumnMenuButtonKeydown(column: TableColumn, event: KeyboardEvent): void {
  toggleColumnMenuFromElement(
    column,
    event.currentTarget instanceof HTMLElement ? event.currentTarget : null,
    "keyboard",
  )
}

function handleHeaderColumnContextMenu(column: TableColumn, event: MouseEvent): void {
  if (resolveColumnMenuTriggerModeSafe() === "button" || isRowSelectionColumn(column)) {
    return
  }
  const element = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  if (!element || !shouldUseColumnMenus()) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  openColumnMenuFromElement(column, element, "contextmenu")
}

function resolveColumnMenuTriggerModeSafe(): DataGridColumnMenuTriggerMode {
  return columns.value.columnMenuTrigger ?? "button+contextmenu"
}

function shouldShowColumnMenuButton(): boolean {
  return resolveColumnMenuTriggerModeSafe() !== "contextmenu"
}

function isAllVisibleRowsSelectedSafe(): boolean {
  return rows.value.allVisibleRowsSelected === true
}

function isSomeVisibleRowsSelectedSafe(): boolean {
  return rows.value.someVisibleRowsSelected === true
}

function resolveHeaderRowSelectionAriaChecked(): "true" | "false" | "mixed" {
  if (isAllVisibleRowsSelectedSafe()) {
    return "true"
  }
  if (isSomeVisibleRowsSelectedSafe()) {
    return "mixed"
  }
  return "false"
}

const headerRowSelectionInteraction = computed(() => ({
  role: "checkbox" as const,
  label: "Select all filtered rows",
  checked: resolveHeaderRowSelectionAriaChecked(),
  triggerClass: headerCheckboxIndicatorClass(),
  markClass: headerCheckboxMarkClass(),
  activate: () => {
    handleToggleAllVisibleRowsSafe()
  },
}))

function headerCheckboxIndicatorClass(): Record<string, boolean> {
  return {
    "grid-checkbox-indicator--checked": isAllVisibleRowsSelectedSafe(),
    "grid-checkbox-indicator--mixed": isSomeVisibleRowsSelectedSafe() && !isAllVisibleRowsSelectedSafe(),
  }
}

function headerCheckboxMarkClass(): Record<string, boolean> {
  return {
    "grid-checkbox-indicator__mark--checked": isAllVisibleRowsSelectedSafe(),
    "grid-checkbox-indicator__mark--mixed": isSomeVisibleRowsSelectedSafe() && !isAllVisibleRowsSelectedSafe(),
  }
}

function handleToggleAllVisibleRowsSafe(): void {
  rows.value.handleToggleAllVisibleRows?.()
}

function spacerStyle(width: number): CSSProperties {
  const px = `${width}px`
  return {
    width: px,
    minWidth: px,
    maxWidth: px,
  }
}
</script>

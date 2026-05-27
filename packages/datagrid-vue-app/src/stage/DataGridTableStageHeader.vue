<template>
  <div class="grid-header-shell" :class="{ 'grid-header-shell--pivot-groups': hasHeaderGroups }" :style="paneLayoutStyle" @click.capture="resizeClickGuard.onHeaderClickCapture">
    <slot name="center-chrome" />

    <div class="grid-header-pane grid-header-pane--left" :style="leftPaneStyle" @wheel="onLinkedViewportWheel">
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
          :data-datagrid-column-group-span="group.columns.length"
          :data-datagrid-column-group-depth="rowIndex"
        >
          <span v-if="group.label" class="col-head__pivot-group-label">{{ group.label }}</span>
        </div>
      </div>
      <div class="grid-header-row grid-pane-track" :style="leftTrackStyle">
        <div
          v-if="showIndexColumn"
          class="grid-cell grid-cell--header grid-cell--index grid-cell--index-header"
          :style="rowIndexColumnStyle"
          :id="DATA_GRID_STAGE_ROW_INDEX_HEADER_ID"
          role="columnheader"
          aria-colindex="1"
          aria-label="Row index"
        >
          <div class="col-head col-head--index">
            <span>#</span>
          </div>
          <div v-if="!hasColumnMenu()" class="col-filter col-filter--index-spacer" aria-hidden="true" />
        </div>
        <template v-if="shouldUseColumnMenus()">
          <template v-for="column in pinnedLeftColumns" :key="`header-left-${column.key}`">
            <div
              v-if="isRowSelectionColumn(column)"
              class="grid-cell grid-cell--header grid-cell--pinned-left grid-cell--checkbox grid-cell--row-selection"
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
              :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
              <div class="col-filter" @click.stop>
                <input
                  class="col-filter-input"
                  :name="`datagrid-header-filter-left-${column.key}`"
                  :aria-label="resolveColumnFilterLabel(column)"
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
        </template>
      </div>
    </div>

    <div
      :ref="headerViewportRef"
      class="grid-header-viewport"
      @wheel="onLinkedViewportWheel"
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
          :data-datagrid-column-group-span="group.columns.length"
          :data-datagrid-column-group-depth="rowIndex"
        >
          <span v-if="group.label" class="col-head__pivot-group-label">{{ group.label }}</span>
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
            :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
            :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
            <div class="col-filter" @click.stop>
              <input
                class="col-filter-input"
                :name="`datagrid-header-filter-center-${column.key}`"
                :aria-label="resolveColumnFilterLabel(column)"
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

    <div class="grid-header-pane grid-header-pane--right" :style="rightPaneStyle" @wheel="onLinkedViewportWheel">
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
          :data-datagrid-column-group-span="group.columns.length"
          :data-datagrid-column-group-depth="rowIndex"
        >
          <span v-if="group.label" class="col-head__pivot-group-label">{{ group.label }}</span>
        </div>
      </div>
      <div class="grid-header-row grid-pane-track" :style="rightTrackStyle">
        <template v-if="shouldUseColumnMenus()">
          <div
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
            :class="resolveHeaderCellClasses(column, { menuEnabled: true, menuOpen: isColumnMenuOpen(column.key) })"
            :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
            v-for="column in pinnedRightColumns"
            :key="`header-right-${column.key}`"
            class="grid-cell grid-cell--header grid-cell--header-sortable grid-cell--pinned-right"
            :class="resolveHeaderCellClasses(column)"
            :style="[columnStyle(column.key), headerCellPresentationStyle(column)]"
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
            <div class="col-filter" @click.stop>
              <input
                class="col-filter-input"
                :name="`datagrid-header-filter-right-${column.key}`"
                :aria-label="resolveColumnFilterLabel(column)"
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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type CSSProperties, type PropType } from "vue"
import { useDataGridResizeClickGuard } from "@affino/datagrid-vue/advanced"
import type { DataGridColumnMenuTriggerMode } from "../overlays/dataGridColumnMenu"
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

interface DataGridPivotHeaderMeta {
  groupLabels?: readonly string[]
  groupLabel?: string
  leafLabel?: string
}

interface DataGridHeaderGroup {
  key: string
  label: string | null
  width: number
  columns: readonly TableColumn[]
}

type DataGridHeaderAriaSort = "ascending" | "descending" | "none"

interface DataGridHeaderCellA11yAttributes {
  role: "columnheader"
  "aria-colindex": number
  "aria-label": string
  "aria-sort"?: DataGridHeaderAriaSort
}

const props = defineProps({
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
const renderedColumns = computed(() => columns.value.renderedColumns)
const centerHeaderColumns = computed(() => renderedColumns.value)
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
const leftHeaderGroupRows = computed(() => buildHeaderGroupRows(pinnedLeftColumns.value))
const centerHeaderGroupRows = computed(() => buildHeaderGroupRows(centerHeaderColumns.value))
const rightHeaderGroupRows = computed(() => buildHeaderGroupRows(pinnedRightColumns.value))
const mainTrackStyle = computed(() => layout.value.mainTrackStyle)
const leftColumnSpacerWidth = computed(() => viewport.value.leftColumnSpacerWidth)
const rightColumnSpacerWidth = computed(() => viewport.value.rightColumnSpacerWidth)
const columnFilterTextByKey = computed(() => columns.value.columnFilterTextByKey)
const draggedHeaderColumnKey = ref<string | null>(null)
const dragOverHeaderColumnKey = ref<string | null>(null)
const dragOverHeaderPlacement = ref<"before" | "after" | null>(null)
let suppressHeaderClick = false
let activeTouchResizeId: number | null = null
const resizeClickGuard = useDataGridResizeClickGuard()
onBeforeUnmount(() => {
  resizeClickGuard.dispose()
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
  return {
    "grid-cell--header-selected": isFullColumnSelection(column),
    "grid-cell--header-menu-enabled": options.menuEnabled === true,
    "grid-cell--header-menu-open": options.menuOpen === true,
    "grid-cell--header-reorderable": isHeaderColumnDraggable(column),
    "grid-cell--header-reorder-source": draggedHeaderColumnKey.value === column.key,
    "grid-cell--header-drop-before": dragOverHeaderColumnKey.value === column.key && dragOverHeaderPlacement.value === "before",
    "grid-cell--header-drop-after": dragOverHeaderColumnKey.value === column.key && dragOverHeaderPlacement.value === "after",
  }
}

function isFullColumnSelection(column: TableColumn): boolean {
  const columnIndex = visibleColumns.value.findIndex(entry => entry.key === column.key)
  const totalRowCount = selection.value.totalRowCount ?? 0
  if (columnIndex < 0 || totalRowCount <= 0) {
    return false
  }
  const ranges = selection.value.selectionRanges
    ?? (selection.value.selectionRange ? [selection.value.selectionRange] : [])
  return ranges.some(range => {
    const startRow = Math.min(range.startRow, range.endRow)
    const endRow = Math.max(range.startRow, range.endRow)
    const startColumn = Math.min(range.startColumn, range.endColumn)
    const endColumn = Math.max(range.startColumn, range.endColumn)
    return startRow === 0
      && endRow >= totalRowCount - 1
      && columnIndex >= startColumn
      && columnIndex <= endColumn
  })
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
  for (const column of columnsList) {
    const label = resolveColumnGroupLabel(column, depth)
    const width = resolveColumnWidth(column)
    const previous = groups[groups.length - 1]
    if (previous && previous.label === label) {
      previous.width += width
      previous.columns = [...previous.columns, column]
      continue
    }
    groups.push({
      key: `${label ?? "empty"}:${column.key}`,
      label,
      width,
      columns: [column],
    })
  }
  return groups
}

function buildHeaderGroupRows(columnsList: readonly TableColumn[]): readonly (readonly DataGridHeaderGroup[])[] {
  if (!hasHeaderGroups.value) {
    return []
  }
  const rows: Array<readonly DataGridHeaderGroup[]> = []
  for (let depth = 0; depth < headerGroupDepth.value; depth += 1) {
    rows.push(buildHeaderGroups(columnsList, depth))
  }
  return rows
}

function headerGroupStyle(group: DataGridHeaderGroup): CSSProperties {
  const width = `${Math.max(0, group.width)}px`
  return {
    width,
    minWidth: width,
    maxWidth: width,
    textAlign: "center",
  }
}

function sortIndicator(columnKey: string): string {
  return columns.value.sortIndicator(columnKey)
}

function startResize(event: MouseEvent, columnKey: string): void {
  if (shouldPrioritizeNativeScrollForMouseDown(event, interactionModeInput.value)) {
    return
  }
  resizeClickGuard.armResizeGuard()
  event.preventDefault()
  columns.value.startResize(event, columnKey)
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

function startTouchResize(event: TouchEvent, columnKey: string): void {
  const touch = event.touches.length === 1 ? readFirstTouch(event.touches) : null
  if (!touch) {
    activeTouchResizeId = null
    return
  }
  resizeClickGuard.armResizeGuard()
  activeTouchResizeId = touch.identifier
  columns.value.startResize(createTouchResizeMouseEvent("mousedown", touch), columnKey)
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

function headerViewportRef(value: Element | { $el?: unknown } | null): void {
  const element = typeof HTMLElement === "undefined"
    ? null
    : value instanceof HTMLElement
      ? value
      : value && "$el" in value && value.$el instanceof HTMLElement
        ? value.$el
        : null
  if (element && element.scrollLeft !== 0) {
    element.scrollLeft = 0
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
  if (isColumnGroupedSafe(column.key)) {
    const order = resolveColumnGroupOrderSafe(column.key)
    states.push(Number.isFinite(order) ? `grouped level ${Number(order) + 1}` : "grouped")
  }
  return states.length > 0 ? `${label}, ${states.join(", ")}` : label
}

function headerCellA11y(column: TableColumn): DataGridHeaderCellA11yAttributes {
  const sortDirection = resolveHeaderSortDirection(column)
  const attributes: DataGridHeaderCellA11yAttributes = {
    role: "columnheader",
    "aria-colindex": resolveHeaderColumnIndex(column),
    "aria-label": resolveColumnHeaderLabel(column),
  }
  if (sortDirection) {
    attributes["aria-sort"] = sortDirection
  }
  return attributes
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
    return
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

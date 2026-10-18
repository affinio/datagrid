import { isGroupExpanded } from "../rowModel.js"
import {
  projectionSegmentMatches,
  replaceProjectionSegment,
  resolveExpansionToggledKeys,
  resolveGroupRowIndexByRowId,
  resolveSingleExpansionDelta,
  updateGroupIndexAfterSubtreeReplacement,
} from "./treeProjectionExpansion.js"
import { appendTreeParentRowChildren } from "./treeProjectionParentMaterializer.js"
import { appendTreePathBranchChildren } from "./treeProjectionPathMaterializer.js"
import type {
  TreeParentSubtreeToggleInput,
  TreePathSubtreeToggleInput,
  TreeProjectionResult,
} from "./treeProjectionTypes.js"

export function tryProjectTreePathSubtreeToggle<T>(
  input: TreePathSubtreeToggleInput<T>,
): TreeProjectionResult<T> | null {
  if (input.treeData.filterMode === "leaf-only") {
    return null
  }
  const previousExpandedKeys = resolveExpansionToggledKeys(input.previousExpansionSnapshot)
  const nextExpandedKeys = resolveExpansionToggledKeys(input.nextExpansionSnapshot)
  const changedGroupKey = resolveSingleExpansionDelta(
    input.previousExpansionSnapshot,
    input.nextExpansionSnapshot,
    previousExpandedKeys,
    nextExpandedKeys,
  )
  if (!changedGroupKey) {
    return null
  }
  const branch = input.cacheState.cache.branchByKey.get(changedGroupKey)
  if (!branch || branch.matchedLeaves <= 0) {
    return null
  }
  const previousExpanded = isGroupExpanded(
    input.previousExpansionSnapshot,
    changedGroupKey,
    previousExpandedKeys,
  )
  const nextExpanded = isGroupExpanded(
    input.nextExpansionSnapshot,
    changedGroupKey,
    nextExpandedKeys,
  )
  const groupIndex = resolveGroupRowIndexByRowId(input.rows, changedGroupKey, input.groupIndexByRowId)
  const resolvedGroupIndex = groupIndex >= 0
    ? groupIndex
    : resolveGroupRowIndexByRowId(
      input.rows,
      changedGroupKey,
      input.cacheState.cache.groupIndexByRowId,
    )
  if (resolvedGroupIndex < 0) {
    return null
  }

  const previousDescendants = input.cacheState.cache.togglePreviousDescendantsBuffer
  previousDescendants.length = 0
  if (previousExpanded) {
    appendTreePathBranchChildren(
      input.cacheState.cache,
      branch,
      input.previousExpansionSnapshot,
      previousExpandedKeys,
      previousDescendants,
      input.cacheState.cache.groupIndexByRowId,
    )
  }

  const nextDescendants = input.cacheState.cache.toggleNextDescendantsBuffer
  nextDescendants.length = 0
  if (nextExpanded) {
    appendTreePathBranchChildren(
      input.cacheState.cache,
      branch,
      input.nextExpansionSnapshot,
      nextExpandedKeys,
      nextDescendants,
      input.cacheState.cache.groupIndexByRowId,
    )
  }

  const replaceStart = resolvedGroupIndex + 1
  if (!projectionSegmentMatches(input.rows, replaceStart, previousDescendants)) {
    return null
  }
  const replacedRows = replaceProjectionSegment(
    input.rows,
    replaceStart,
    previousDescendants.length,
    nextDescendants,
  )
  const currentGroup = replacedRows[resolvedGroupIndex]
  if (currentGroup && currentGroup.kind === "group") {
    replacedRows[resolvedGroupIndex] = {
      ...currentGroup,
      state: {
        ...currentGroup.state,
        expanded: nextExpanded,
      },
    }
  }
  updateGroupIndexAfterSubtreeReplacement(
    input.cacheState.cache.groupIndexByRowId,
    input.cacheState.cache.groupIndexShiftHistory,
    input.cacheState.cache.groupIndexBornAt,
    replaceStart,
    previousDescendants,
    nextDescendants,
  )
  return {
    rows: replacedRows,
    diagnostics: input.cacheState.cache.diagnostics,
  }
}

export function tryProjectTreeParentSubtreeToggle<T>(
  input: TreeParentSubtreeToggleInput<T>,
): TreeProjectionResult<T> | null {
  const previousExpandedKeys = resolveExpansionToggledKeys(input.previousExpansionSnapshot)
  const nextExpandedKeys = resolveExpansionToggledKeys(input.nextExpansionSnapshot)
  const changedGroupKey = resolveSingleExpansionDelta(
    input.previousExpansionSnapshot,
    input.nextExpansionSnapshot,
    previousExpandedKeys,
    nextExpandedKeys,
  )
  if (!changedGroupKey) {
    return null
  }
  const rowId = input.cacheState.cache.groupRowIdByGroupKey.get(changedGroupKey)
  if (typeof rowId === "undefined") {
    return null
  }
  const previousExpanded = isGroupExpanded(
    input.previousExpansionSnapshot,
    changedGroupKey,
    previousExpandedKeys,
  )
  const nextExpanded = isGroupExpanded(
    input.nextExpansionSnapshot,
    changedGroupKey,
    nextExpandedKeys,
  )
  const groupIndex = resolveGroupRowIndexByRowId(
    input.rows,
    rowId,
    input.groupIndexByRowId,
    input.cacheState.cache.groupIndexByRowId,
  )
  const resolvedGroupIndex = groupIndex >= 0
    ? groupIndex
    : resolveGroupRowIndexByRowId(
      input.rows,
      rowId,
      input.cacheState.cache.groupIndexByRowId,
      undefined,
      input.cacheState.cache.groupIndexShiftHistory,
      input.cacheState.cache.groupIndexBornAt,
    )
  if (resolvedGroupIndex < 0) {
    return null
  }
  const groupRow = input.rows[resolvedGroupIndex]
  const baseLevel = groupRow?.groupMeta?.level
  if (typeof baseLevel !== "number") {
    return null
  }

  const previousDescendants = input.cacheState.cache.togglePreviousDescendantsBuffer
  previousDescendants.length = 0
  if (previousExpanded) {
    appendTreeParentRowChildren(
      input.cacheState.cache,
      rowId,
      baseLevel,
      input.previousExpansionSnapshot,
      previousExpandedKeys,
      previousDescendants,
    )
  }

  const nextDescendants = input.cacheState.cache.toggleNextDescendantsBuffer
  nextDescendants.length = 0
  if (nextExpanded) {
    appendTreeParentRowChildren(
      input.cacheState.cache,
      rowId,
      baseLevel,
      input.nextExpansionSnapshot,
      nextExpandedKeys,
      nextDescendants,
    )
  }

  const replaceStart = resolvedGroupIndex + 1
  if (!projectionSegmentMatches(input.rows, replaceStart, previousDescendants)) {
    return null
  }
  const replacedRows = replaceProjectionSegment(
    input.rows,
    replaceStart,
    previousDescendants.length,
    nextDescendants,
  )
  const currentGroup = replacedRows[resolvedGroupIndex]
  if (currentGroup && currentGroup.kind === "group") {
    replacedRows[resolvedGroupIndex] = {
      ...currentGroup,
      state: {
        ...currentGroup.state,
        expanded: nextExpanded,
      },
    }
  }
  updateGroupIndexAfterSubtreeReplacement(
    input.cacheState.cache.groupIndexByRowId,
    input.cacheState.cache.groupIndexShiftHistory,
    input.cacheState.cache.groupIndexBornAt,
    replaceStart,
    previousDescendants,
    nextDescendants,
  )
  return {
    rows: replacedRows,
    diagnostics: input.cacheState.cache.diagnostics,
  }
}


import { createStore } from "zustand/vanilla";
import type { IssueView } from "../api/schemas";
import {
  mergeViewStatePersisted,
  viewStoreSlice,
  type IssueViewState,
} from "../issues/stores/view-store";

/** What a saved view stores: its filters, and the display it opens with. */
export interface IssueViewDefinition {
  query: Record<string, unknown>;
  display: Record<string, unknown>;
}

export function issueViewDefinitionFromState(state: IssueViewState): IssueViewDefinition {
  return {
    query: {
      statusFilters: state.statusFilters,
      priorityFilters: state.priorityFilters,
      assigneeFilters: state.assigneeFilters,
      includeNoAssignee: state.includeNoAssignee,
      creatorFilters: state.creatorFilters,
      projectFilters: state.projectFilters,
      includeNoProject: state.includeNoProject,
      projectStatusFilters: state.projectStatusFilters,
      labelFilters: state.labelFilters,
      propertyFilters: state.propertyFilters,
    },
    display: {
      showSubIssues: state.showSubIssues,
      viewMode: state.viewMode,
      grouping: state.grouping,
      sortBy: state.sortBy,
      sortDirection: state.sortDirection,
      cardProperties: state.cardProperties,
      cardPropertyIds: state.cardPropertyIds,
      tableColumns: state.tableColumns,
      tableGrouping: state.tableGrouping,
      tableHierarchy: state.tableHierarchy,
      tableCalculation: state.tableCalculation,
      swimlaneGrouping: state.swimlaneGrouping,
      ganttZoom: state.ganttZoom,
      ganttShowCompleted: state.ganttShowCompleted,
    },
  };
}

/**
 * The definition a view opens with, sanitized exactly like the surface seed,
 * so comparing it with live state never reports a fresh view as modified.
 */
export function issueViewSeedDefinition(
  view: Pick<IssueView, "query" | "display">,
): IssueViewDefinition {
  const defaults = createStore<IssueViewState>()(viewStoreSlice).getState();
  return issueViewDefinitionFromState(
    mergeViewStatePersisted({ ...view.query, ...view.display }, defaults),
  );
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner,
  );
}

/** Whether the live state drifted from what the view saves. */
export function isIssueViewModified(
  view: Pick<IssueView, "query" | "display">,
  state: IssueViewState,
): { filters: boolean; display: boolean } {
  const seed = issueViewSeedDefinition(view);
  const live = issueViewDefinitionFromState(state);
  return {
    filters: stableStringify(seed.query) !== stableStringify(live.query),
    display: stableStringify(seed.display) !== stableStringify(live.display),
  };
}

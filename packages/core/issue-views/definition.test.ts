import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { viewStoreSlice, type IssueViewState } from "../issues/stores/view-store";
import { isIssueViewModified, issueViewSeedDefinition } from "./definition";

function liveStateFor(view: { query: Record<string, unknown>; display: Record<string, unknown> }) {
  const store = createStore<IssueViewState>()(viewStoreSlice);
  const seed = issueViewSeedDefinition(view);
  store.setState({ ...seed.query, ...seed.display } as Partial<IssueViewState>);
  return store;
}

describe("isIssueViewModified", () => {
  const view = {
    query: { statusFilters: ["todo"] },
    display: { viewMode: "list", sortBy: "priority" },
  };

  it("reports a freshly opened view as unmodified, even with sparse definitions", () => {
    expect(isIssueViewModified(view, liveStateFor(view).getState())).toEqual({
      filters: false,
      display: false,
    });
  });

  it("separates filter edits from display edits", () => {
    const store = liveStateFor(view);
    store.setState({ priorityFilters: ["high"] });
    expect(isIssueViewModified(view, store.getState())).toEqual({ filters: true, display: false });
    store.setState({ priorityFilters: [], viewMode: "board" });
    expect(isIssueViewModified(view, store.getState())).toEqual({ filters: false, display: true });
  });
});

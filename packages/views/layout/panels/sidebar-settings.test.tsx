import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildIssueStatusCatalog } from "@multica/core/issue-statuses/queries";
import {
  DEFAULT_SIDEBAR_ISSUE_SETTINGS,
  DEFAULT_SIDEBAR_PROJECT_SETTINGS,
  useSidebarTreeStore,
} from "@multica/core/issues/stores/sidebar-tree-store";
import { renderWithI18n } from "../../test/i18n";
import { IssueDisplaySettings, ProjectsSectionSettings } from "./sidebar-settings";

vi.mock("@multica/core/issue-statuses/hooks", () => ({
  useIssueStatuses: () =>
    buildIssueStatusCatalog(
      [
        ["todo", "Todo", "unstarted"],
        ["in_progress", "In Progress", "started"],
        ["done", "Done", "done"],
      ].map(([key, name, category], position) => ({
        id: key!,
        workspace_id: "ws-1",
        key: key!,
        name: name!,
        description: "",
        category: category as "unstarted",
        color: "",
        is_system: true,
        position,
        archived_at: null,
        created_at: "",
        updated_at: "",
      })),
    ),
}));
vi.mock("../../issues/components/status-icon", () => ({ StatusIcon: () => <span /> }));

beforeEach(() => {
  useSidebarTreeStore.setState({
    issueSettings: DEFAULT_SIDEBAR_ISSUE_SETTINGS,
    projectSettings: DEFAULT_SIDEBAR_PROJECT_SETTINGS,
  });
});

describe("IssueDisplaySettings", () => {
  it("shows each status as checked or not, and hides one when unchecked", () => {
    renderWithI18n(<IssueDisplaySettings wsId="ws-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Issue display" }));

    expect(screen.getByRole("checkbox", { name: "Todo" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Done" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Todo" }));
    const hidden = useSidebarTreeStore.getState().issueSettings.hiddenStatuses;
    expect(hidden).toContain("todo");
    expect(hidden).toContain("done");
    expect(screen.getByRole("checkbox", { name: "Todo" })).not.toBeChecked();
  });
});

describe("ProjectsSectionSettings", () => {
  it("toggles a project status from its checkbox", () => {
    renderWithI18n(<ProjectsSectionSettings />);
    fireEvent.click(screen.getByRole("button", { name: "Project display" }));

    expect(screen.getByRole("checkbox", { name: "Completed" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Completed" }));
    expect(useSidebarTreeStore.getState().projectSettings.statuses).toContain("completed");
  });
});

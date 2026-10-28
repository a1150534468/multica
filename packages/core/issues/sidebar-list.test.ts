import { describe, expect, it } from "vitest";
import type { Project } from "../types";
import {
  projectSidebarParams,
  shownSidebarStatuses,
  sidebarProjects,
  viewSidebarParams,
} from "./sidebar-list";
import {
  DEFAULT_SIDEBAR_ISSUE_SETTINGS,
  DEFAULT_SIDEBAR_PROJECT_SETTINGS,
  type SidebarIssueSettings,
  type SidebarProjectSettings,
} from "./stores/sidebar-tree-store";

const STATUSES = [
  { key: "backlog", category: "unstarted" },
  { key: "todo", category: "unstarted" },
  { key: "in_progress", category: "started" },
  { key: "merged", category: "started" },
  { key: "done", category: "done" },
  { key: "cancelled", category: "closed" },
] as const;

describe("projectSidebarParams", () => {
  it("leaves out finished statuses and sorts by update time by default", () => {
    expect(projectSidebarParams("p1", DEFAULT_SIDEBAR_ISSUE_SETTINGS, STATUSES, "u1")).toEqual({
      project_id: "p1",
      statuses: ["backlog", "todo", "in_progress", "merged"],
      sort_by: "updated_at",
      sort_direction: "desc",
    });
  });

  it("maps the assignee and sub-issue settings onto server filters", () => {
    const settings: SidebarIssueSettings = {
      ...DEFAULT_SIDEBAR_ISSUE_SETTINGS,
      hiddenStatuses: [],
      assignee: "my_agents",
      showSubIssues: false,
    };
    expect(projectSidebarParams("p1", settings, STATUSES, "u1")).toEqual({
      project_id: "p1",
      involves_user_id: "u1",
      top_level_only: true,
      sort_by: "updated_at",
      sort_direction: "desc",
    });
  });

  it("lists nothing when every status is hidden", () => {
    const settings = { ...DEFAULT_SIDEBAR_ISSUE_SETTINGS, hiddenStatuses: STATUSES.map((s) => s.key) };
    expect(shownSidebarStatuses(settings, STATUSES)).toEqual([]);
    expect(projectSidebarParams("p1", settings, STATUSES, "u1")).toBeNull();
  });
});

describe("viewSidebarParams", () => {
  it("carries the view's own filters, variant and ordering", () => {
    expect(
      viewSidebarParams(
        {
          query: { statusFilters: ["todo"], labelFilters: ["l1"], priorityFilters: ["bogus"] },
          display: { sortBy: "due_date", sortDirection: "desc", showSubIssues: false },
          scope_variant: "agents",
        },
        [],
      ),
    ).toEqual({
      statuses: ["todo"],
      label_ids: ["l1"],
      assignee_types: ["agent", "squad"],
      top_level_only: true,
      sort_by: "due_date",
      sort_direction: "desc",
    });
  });

  it("resolves a project-status filter to project ids, or nothing when none match", () => {
    const projects = [
      { id: "p1", status: "in_progress" },
      { id: "p2", status: "completed" },
    ] as const;
    expect(
      viewSidebarParams({ query: { projectStatusFilters: ["completed"] }, display: {}, scope_variant: null }, projects)
        ?.project_ids,
    ).toEqual(["p2"]);
    expect(
      viewSidebarParams({ query: { projectStatusFilters: ["paused"] }, display: {}, scope_variant: null }, projects),
    ).toBeNull();
  });
});

describe("sidebarProjects", () => {
  const project = (id: string, title: string, status: Project["status"], lead_id: string | null = null) =>
    ({
      id,
      title,
      status,
      lead_type: lead_id ? "member" : null,
      lead_id,
      created_at: `2026-10-0${id.slice(1)}T00:00:00Z`,
      updated_at: `2026-10-0${id.slice(1)}T00:00:00Z`,
    }) as Project;
  const projects = [
    project("p1", "Beta", "in_progress", "u1"),
    project("p2", "Alpha", "planned"),
    project("p3", "Gamma", "completed"),
    project("p4", "Delta", "paused"),
  ];

  it("follows the manual order, then list order for projects it does not name", () => {
    expect(sidebarProjects(projects, DEFAULT_SIDEBAR_PROJECT_SETTINGS, ["p4"], "u1").map((p) => p.id)).toEqual([
      "p4",
      "p1",
      "p2",
    ]);
  });

  it("filters by status and lead, and sorts by name", () => {
    const settings: SidebarProjectSettings = {
      ...DEFAULT_SIDEBAR_PROJECT_SETTINGS,
      ordering: "name",
      statuses: ["completed", "planned"],
    };
    expect(sidebarProjects(projects, settings, [], "u1").map((p) => p.title)).toEqual(["Alpha", "Gamma"]);
    expect(
      sidebarProjects(projects, { ...DEFAULT_SIDEBAR_PROJECT_SETTINGS, onlyMine: true }, [], "u1").map((p) => p.id),
    ).toEqual(["p1"]);
  });
});

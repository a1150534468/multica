import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildIssueStatusCatalog } from "@multica/core/issue-statuses/queries";
import { issueKeys } from "@multica/core/issues/queries";
import type { Issue, Project } from "@multica/core/types";
import { renderWithI18n } from "../../test/i18n";
import { ProjectTreeItem, sortProjectIssues } from "./project-tree-item";

vi.mock("@multica/core/issue-statuses/hooks", () => ({
  useIssueStatuses: () => buildIssueStatusCatalog([]),
}));
vi.mock("../../navigation", () => ({
  AppLink: ({
    children,
    href,
    newTabTitle: _newTabTitle,
    ...props
  }: { children: ReactNode; href: string; newTabTitle?: string } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("../../issues/components/status-icon", () => ({ StatusIcon: () => <span /> }));
vi.mock("../../projects/components/project-icon", () => ({ ProjectIcon: () => <span /> }));
vi.mock("@multica/core/paths", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@multica/core/paths")>();
  return { ...actual, useWorkspacePaths: () => actual.paths.workspace("acme") };
});

const project = {
  id: "proj-1",
  title: "Desktop",
  issue_count: 9,
  done_count: 2,
} as Project;

const issue = (n: number, status: string, updated: string): Issue =>
  ({ id: `issue-${n}`, title: `Issue ${n}`, status, updated_at: updated }) as Issue;

const SEVEN_ISSUES = [
  issue(1, "todo", "2026-10-07T00:00:00Z"),
  issue(2, "in_progress", "2026-10-01T00:00:00Z"),
  issue(3, "backlog", "2026-10-06T00:00:00Z"),
  issue(4, "in_review", "2026-10-02T00:00:00Z"),
  issue(5, "todo", "2026-10-05T00:00:00Z"),
  issue(6, "todo", "2026-10-04T00:00:00Z"),
  issue(7, "todo", "2026-10-03T00:00:00Z"),
];

function Harness({
  initiallyExpanded = false,
  activeIssueId = null,
}: {
  initiallyExpanded?: boolean;
  activeIssueId?: string | null;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return (
    <ul>
      <ProjectTreeItem
        wsId="ws-1"
        project={project}
        active={false}
        expanded={expanded}
        onExpandedChange={setExpanded}
        activeIssueId={activeIssueId}
      />
    </ul>
  );
}

function renderTree(props: Parameters<typeof Harness>[0] = {}, issues = SEVEN_ISSUES) {
  const qc = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  qc.setQueryData(issueKeys.projectOpen("ws-1", project.id), issues);
  return renderWithI18n(
    <QueryClientProvider client={qc}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

const toggle = () => screen.getByRole("button", { name: "Issues in Desktop" });

describe("sortProjectIssues", () => {
  it("puts started work first, then the most recently updated", () => {
    expect(sortProjectIssues(SEVEN_ISSUES).map((i) => i.id)).toEqual([
      "issue-4",
      "issue-2",
      "issue-1",
      "issue-3",
      "issue-5",
      "issue-6",
      "issue-7",
    ]);
  });
});

describe("ProjectTreeItem", () => {
  it("shows the open count while collapsed and the issues once expanded", () => {
    renderTree();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.queryByText("Issue 1")).toBeNull();

    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("7")).toBeNull();
    expect(screen.getByText("Issue 4").closest("a")).toHaveAttribute("href", "/acme/issues/issue-4");
  });

  it("previews five issues and links the rest to the project page", () => {
    renderTree({ initiallyExpanded: true });
    const list = document.getElementById(toggle().getAttribute("aria-controls")!)!;
    const links = within(list).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Issue 4",
      "Issue 2",
      "Issue 1",
      "Issue 3",
      "Issue 5",
      "View all 7",
    ]);
    expect(links.at(-1)).toHaveAttribute("href", "/acme/projects/proj-1");
  });

  it("keeps the issue on screen visible and lit past the preview cap", () => {
    renderTree({ initiallyExpanded: true, activeIssueId: "issue-7" });
    const row = screen.getByText("Issue 7").closest("a");
    expect(row).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Issue 4").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("expands with the right arrow and collapses with the left arrow from a child", () => {
    renderTree();
    fireEvent.keyDown(screen.getByRole("link", { name: "Desktop" }), { key: "ArrowRight" });
    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(screen.getByText("Issue 2").closest("a")!, { key: "ArrowLeft" });
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Desktop" })).toHaveFocus();
  });

  it("says so when the project has no open issues", () => {
    renderTree({ initiallyExpanded: true }, []);
    expect(screen.getByText("No open issues")).toBeInTheDocument();
  });
});

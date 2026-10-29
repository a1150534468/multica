import type { ReactNode } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarTreeStore } from "@multica/core/issues/stores/sidebar-tree-store";
import { renderWithI18n } from "../../test/i18n";
import { ViewsSection } from "./views-section";

const actions = vi.hoisted(() => ({
  sidebar: { items: [] as unknown[], reorder: vi.fn(), unstar: vi.fn() },
  create: vi.fn(),
  remove: vi.fn(),
  canManage: () => true,
}));

vi.mock("../../issue-views/use-view-actions", () => ({ useIssueViewActions: () => actions }));
vi.mock("../../issue-views/delete-view-dialog", () => ({ DeleteViewDialog: () => null }));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSortable: () => ({ listeners: {}, setNodeRef: vi.fn(), setActivatorNodeRef: vi.fn() }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn(),
}));
vi.mock("../../navigation", () => ({
  AppLink: ({ children, href, ...props }: { children: ReactNode; href: string } & React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@multica/ui/components/common/tooltip-hint", () => ({
  TooltipHint: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@multica/core/paths", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@multica/core/paths")>();
  return { ...actual, useWorkspacePaths: () => actual.paths.workspace("acme") };
});
vi.mock("@multica/core/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@multica/core/hooks")>()),
  useWorkspaceId: () => "ws-1",
}));
vi.mock("@multica/core/issue-statuses/hooks", async () => {
  const { buildIssueStatusCatalog } = await import("@multica/core/issue-statuses/queries");
  return { useIssueStatuses: () => buildIssueStatusCatalog([]) };
});
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({}),
}));

function renderSection() {
  return renderWithI18n(
    <ViewsSection
      wsId="ws-1"
      pathname="/acme/issues"
      plainRowsLit
      issueLitInTree={false}
      activeIssueId={null}
    />,
  );
}

beforeEach(() => {
  actions.create.mockReset();
  actions.sidebar.items = [];
  useSidebarTreeStore.setState({ viewsCollapsed: false });
});

describe("ViewsSection", () => {
  it("collapses from the section label", () => {
    renderSection();
    expect(screen.getByText("All views")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Views" }));
    expect(useSidebarTreeStore.getState().viewsCollapsed).toBe(true);
    expect(screen.queryByText("All views")).toBeNull();
    expect(screen.getByRole("button", { name: "Views" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens again to name a new view inline", () => {
    useSidebarTreeStore.setState({ viewsCollapsed: true });
    renderSection();

    fireEvent.click(screen.getByRole("button", { name: "New view" }));
    expect(useSidebarTreeStore.getState().viewsCollapsed).toBe(false);
    expect(actions.create).toHaveBeenCalledWith(expect.objectContaining({ renameIn: "sidebar" }));
  });

  it("lets every view expand, built-in or saved, whatever its filters", () => {
    actions.sidebar.items = [
      { id: "builtin:all_issues", kind: "builtin", key: "all_issues" },
      {
        id: "view:v1",
        kind: "view",
        view: {
          id: "v1",
          name: "Not done",
          scope_type: "workspace",
          scope_id: null,
          scope_variant: null,
          query: { statusFilters: ["done"], negatedFilters: ["status"], relationFilters: ["assigned"] },
          display: {},
        },
      },
    ];
    renderSection();
    expect(screen.getByRole("button", { name: "Issues in All issues" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Issues in Not done" })).toHaveAttribute("aria-expanded", "false");
  });
});

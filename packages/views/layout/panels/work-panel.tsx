"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";
import { Bot, CircleUser, ListTodo, SquarePen } from "lucide-react";
import { IconButton } from "@multica/ui/components/common/icon-button";
import { useAuthStore } from "@multica/core/auth";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { myIssuesViewStore } from "@multica/core/issues/stores";
import { useIssueDraftStore } from "@multica/core/issues/stores/draft-store";
import { openCreateIssueWithPreference } from "@multica/core/issues/stores/create-mode-store";
import { issueViewListOptions } from "@multica/core/issue-views/queries";
import {
  issueViewContainerKey,
  useActiveIssueViewStore,
} from "@multica/core/issue-views/active-view-store";
import { issueDetailOptions } from "@multica/core/issues/queries";
import { projectSidebarSource, sidebarProjects } from "@multica/core/issues/sidebar-list";
import { useSidebarTreeStore } from "@multica/core/issues/stores/sidebar-tree-store";
import { projectListOptions } from "@multica/core/projects/queries";
import { useShortcut } from "@multica/core/shortcuts";
import type { IssueView } from "@multica/core/api/schemas";
import type { Project } from "@multica/core/types";
import { useNavigation } from "../../navigation";
import { ShortcutKeycaps } from "../../common/shortcut-keycaps";
import { useT } from "../../i18n";
import { PanelBody, PanelHeader, PanelLink, PanelList, isPathWithin } from "../panel-nav";
import { PinnedSection, usePanelPins } from "./pinned-section";
import { ProjectsSection, ViewsSection, useIssueShownInTree } from "./work-tree";

const EMPTY_PROJECTS: Project[] = [];
const EMPTY_VIEWS: IssueView[] = [];
const WORKSPACE_VIEW_SCOPE = { scope_type: "workspace" } as const;

/** The `{id}` of an `/issues/{id}` route — a UUID or an identifier like `MUL-123`. */
function issueRouteSegment(pathname: string, issuesPath: string): string | null {
  if (!pathname.startsWith(issuesPath + "/")) return null;
  const segment = pathname.slice(issuesPath.length + 1).split("/")[0];
  return segment ? decodeURIComponent(segment) : null;
}

function DraftDot() {
  const hasDraft = useIssueDraftStore((s) => s.hasDraft());
  if (!hasDraft) return null;
  return <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand" />;
}

export function WorkPanel() {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const { pathname } = useNavigation();
  const wsId = useCurrentWorkspace()?.id;
  const userId = useAuthStore((s) => s.user?.id);
  const createIssueShortcut = useShortcut("createIssue");
  const myIssuesScope = useStore(myIssuesViewStore, (s) => s.scope);
  const setMyIssuesScope = useStore(myIssuesViewStore, (s) => s.setScope);
  const pins = usePanelPins(wsId, userId, pathname);

  const { data: projects = EMPTY_PROJECTS } = useQuery({
    ...projectListOptions(wsId ?? ""),
    enabled: !!wsId,
  });
  // Cache read only: the detail page owns resolving the route's issue.
  const issueSegment = issueRouteSegment(pathname, p.issues());
  const { data: currentIssue } = useQuery({
    ...issueDetailOptions(wsId ?? "", issueSegment ?? ""),
    enabled: false,
  });
  const currentIssueId = issueSegment ? (currentIssue?.id ?? null) : null;
  const revealProjectId = issueSegment ? (currentIssue?.project_id ?? null) : null;

  const setExpanded = useSidebarTreeStore((s) => s.setExpanded);
  useEffect(() => {
    if (revealProjectId) setExpanded(projectSidebarSource(revealProjectId), true);
  }, [revealProjectId, setExpanded]);

  const projectSettings = useSidebarTreeStore((s) => s.projectSettings);
  const projectOrder = useSidebarTreeStore((s) => s.projectOrder);
  const shownProjects = useMemo(() => {
    const shown = sidebarProjects(projects, projectSettings, projectOrder, userId);
    const revealed = projects.find((project) => project.id === revealProjectId);
    return revealed && !shown.includes(revealed) ? [...shown, revealed] : shown;
  }, [projects, projectSettings, projectOrder, userId, revealProjectId]);
  // A tree row takes the highlight from "All issues" while it lists the issue.
  const issueLitInTree = useIssueShownInTree(wsId ?? "", currentIssueId);
  // Older backends without the views endpoint error here; the section hides.
  const { data: views = EMPTY_VIEWS } = useQuery({
    ...issueViewListOptions(wsId ?? "", WORKSPACE_VIEW_SCOPE),
    enabled: !!wsId,
  });
  const viewContainerKey = issueViewContainerKey(wsId ?? "", WORKSPACE_VIEW_SCOPE);
  const activeViewId = useActiveIssueViewStore((s) => s.active[viewContainerKey] ?? null);
  const setActiveView = useActiveIssueViewStore((s) => s.setActive);

  const onMyIssues = pathname === p.myIssues();
  const onIssues = pathname === p.issues();
  const plainRowsLit = !pins.isActivePinnedRoute;

  return (
    <>
      <PanelHeader title={t(($) => $.spaces.work)}>
        <IconButton
          label={t(($) => $.sidebar.new_issue)}
          shortcut={
            createIssueShortcut ? <ShortcutKeycaps shortcut={createIssueShortcut} decorative /> : undefined
          }
          tooltipSide="bottom"
          className="text-muted-foreground"
          onClick={() => openCreateIssueWithPreference()}
        >
          <span className="relative">
            <SquarePen />
            <DraftDot />
          </span>
        </IconButton>
      </PanelHeader>
      <PanelBody>
        <PanelList>
          <PanelLink
            href={p.myIssues()}
            icon={<CircleUser />}
            label={t(($) => $.nav.my_issues)}
            active={plainRowsLit && onMyIssues && myIssuesScope !== "agents"}
            onNavigate={() => {
              if (myIssuesScope === "agents") setMyIssuesScope("assigned");
            }}
          />
          <PanelLink
            href={p.myIssues()}
            icon={<Bot />}
            label={t(($) => $.panels.work.my_agents)}
            active={plainRowsLit && onMyIssues && myIssuesScope === "agents"}
            onNavigate={() => setMyIssuesScope("agents")}
          />
          <PanelLink
            href={p.issues()}
            icon={<ListTodo />}
            label={t(($) => $.panels.work.all_issues)}
            active={
              plainRowsLit &&
              (onIssues
                ? activeViewId === null
                : !issueLitInTree && isPathWithin(pathname, p.issues()))
            }
            onNavigate={() => setActiveView(viewContainerKey, null)}
          />
        </PanelList>

        {wsId && <PinnedSection pins={pins} wsId={wsId} pathname={pathname} />}

        {wsId && views.length > 0 && (
          <ViewsSection
            wsId={wsId}
            views={views}
            projects={projects}
            isActive={(view) => onIssues && activeViewId === view.id}
            onNavigate={(view) => setActiveView(viewContainerKey, view.id)}
            activeIssueId={plainRowsLit ? currentIssueId : null}
          />
        )}

        {wsId && (
          <ProjectsSection
            wsId={wsId}
            userId={userId}
            pathname={pathname}
            projects={shownProjects}
            totalProjects={projects.length}
            plainRowsLit={plainRowsLit}
            activeIssueId={plainRowsLit ? currentIssueId : null}
          />
        )}
      </PanelBody>
    </>
  );
}

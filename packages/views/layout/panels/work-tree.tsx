"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "@multica/ui/icons";
import { cn } from "@multica/ui/lib/utils";
import { IconButton } from "@multica/ui/components/common/icon-button";
import { useIssueStatuses } from "@multica/core/issue-statuses/hooks";
import { issueKeys, sidebarIssuesOptions } from "@multica/core/issues/queries";
import {
  SIDEBAR_FIRST_PAGE,
  projectSidebarParams,
  projectSidebarSource,
} from "@multica/core/issues/sidebar-list";
import { useSidebarTreeStore } from "@multica/core/issues/stores/sidebar-tree-store";
import { useModalStore } from "@multica/core/modals";
import { useWorkspacePaths } from "@multica/core/paths";
import type { ListIssuesParams, ListIssuesResponse, Project } from "@multica/core/types";
import { ProjectIcon } from "../../projects/components/project-icon";
import { useT } from "../../i18n";
import { PanelCount, PanelLink, PanelList, PanelSection, isPathWithin } from "../panel-nav";
import { ProjectsSectionSettings } from "./sidebar-settings";
import { SidebarIssueList, TreeRow } from "./sidebar-tree";

const DRAG_MODIFIERS = [restrictToVerticalAxis, restrictToFirstScrollableAncestor];

function useExpanded(key: string) {
  const expanded = useSidebarTreeStore((s) => s.expanded.includes(key));
  const setExpanded = useSidebarTreeStore((s) => s.setExpanded);
  return [expanded, (next: boolean) => setExpanded(key, next)] as const;
}

function usePrefetch(wsId: string, source: string, params: ListIssuesParams | null | undefined) {
  const qc = useQueryClient();
  return () => {
    if (params) void qc.prefetchQuery(sidebarIssuesOptions(wsId, source, params, SIDEBAR_FIRST_PAGE));
  };
}

/** Whether an expanded row currently lists the issue. */
export function useIssueShownInTree(wsId: string, issueId: string | null): boolean {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((onChange: () => void) => cache.subscribe(onChange), [cache]);
  return useSyncExternalStore(subscribe, () =>
    !!issueId &&
    cache
      .findAll({ queryKey: issueKeys.sidebarAll(wsId) })
      .some(
        (query) =>
          query.getObserversCount() > 0 &&
          !!(query.state.data as ListIssuesResponse | undefined)?.issues?.some((issue) => issue.id === issueId),
      ),
  );
}

interface ProjectsSectionProps {
  wsId: string;
  userId: string | undefined;
  pathname: string;
  /** Already filtered and ordered by the section's settings. */
  projects: Project[];
  totalProjects: number;
  plainRowsLit: boolean;
  activeIssueId: string | null;
}

export function ProjectsSection({
  wsId,
  userId,
  pathname,
  projects,
  totalProjects,
  plainRowsLit,
  activeIssueId,
}: ProjectsSectionProps) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const collapsed = useSidebarTreeStore((s) => s.projectsCollapsed);
  const setCollapsed = useSidebarTreeStore((s) => s.setProjectsCollapsed);
  const showCount = useSidebarTreeStore((s) => s.projectSettings.showCount);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      const ids = projects.map((project) => project.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from === -1 || to === -1) return;
      const store = useSidebarTreeStore.getState();
      const moved = arrayMove(ids, from, to);
      // Projects the filter hides keep their relative place after the shown ones.
      store.setProjectOrder([...moved, ...store.projectOrder.filter((id) => !moved.includes(id))]);
      if (store.projectSettings.ordering !== "manual") store.setProjectSettings({ ordering: "manual" });
    },
    [projects],
  );

  return (
    <PanelSection
      label={t(($) => $.nav.projects)}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      action={
        <>
          <ProjectsSectionSettings wsId={wsId} className="opacity-0 group-hover/section:opacity-100 group-focus-within/section:opacity-100 [@media(pointer:coarse)]:opacity-100" />
          <IconButton
            label={t(($) => $.panels.work.new_project)}
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => useModalStore.getState().open("create-project")}
          >
            <Plus />
          </IconButton>
        </>
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={DRAG_MODIFIERS} onDragEnd={onDragEnd}>
        <SortableContext items={projects.map((project) => project.id)} strategy={verticalListSortingStrategy}>
          <PanelList>
            {projects.map((project) => (
              <ProjectTreeItem
                key={project.id}
                wsId={wsId}
                userId={userId}
                project={project}
                active={plainRowsLit && isPathWithin(pathname, p.projectDetail(project.id))}
                showCount={showCount}
                activeIssueId={activeIssueId}
              />
            ))}
          </PanelList>
        </SortableContext>
      </DndContext>
      <PanelList className="mt-px">
        <PanelLink
          href={p.projects()}
          icon={<span className="size-4" aria-hidden />}
          label={t(($) => $.panels.work.all_projects, { count: totalProjects })}
          active={pathname === p.projects()}
          className="text-caption"
        />
      </PanelList>
    </PanelSection>
  );
}

function ProjectTreeItem({
  wsId,
  userId,
  project,
  active,
  showCount,
  activeIssueId,
}: {
  wsId: string;
  userId: string | undefined;
  project: Project;
  active: boolean;
  showCount: boolean;
  activeIssueId: string | null;
}) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const listId = useId();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const source = projectSidebarSource(project.id);
  const [expanded, setExpanded] = useExpanded(source);
  const statusCatalog = useIssueStatuses(wsId);
  const settings = useSidebarTreeStore((s) => s.issueSettings);
  const params = statusCatalog.isLoaded
    ? projectSidebarParams(project.id, settings, statusCatalog.statuses, userId)
    : undefined;
  const prefetch = usePrefetch(wsId, source, params);

  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const wasDragged = useRef(false);
  useEffect(() => {
    if (isDragging) wasDragged.current = true;
  }, [isDragging]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        isDragging &&
          "relative z-20 rounded-lg bg-surface-raised shadow-[var(--menu-shadow)] ring-1 ring-surface-border",
      )}
    >
      <TreeRow
        ref={linkRef}
        rowRef={setActivatorNodeRef}
        {...listeners}
        href={p.projectDetail(project.id)}
        label={project.title}
        icon={<ProjectIcon project={project} size="sm" />}
        active={active}
        expanded={expanded}
        onExpandedChange={setExpanded}
        listId={listId}
        toggleLabel={t(($) => $.panels.work.project_issues, { name: project.title })}
        onPrefetch={prefetch}
        onNavigate={(event) => {
          if (!wasDragged.current) return;
          wasDragged.current = false;
          event.preventDefault();
        }}
        trailing={showCount ? <PanelCount value={project.issue_count - project.done_count} /> : null}
      />
      {expanded && (
        <SidebarIssueList
          id={listId}
          wsId={wsId}
          source={source}
          params={params}
          activeIssueId={activeIssueId}
          onCollapse={() => {
            setExpanded(false);
            linkRef.current?.focus();
          }}
        />
      )}
    </li>
  );
}

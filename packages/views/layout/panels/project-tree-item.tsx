"use client";

import { useId, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { useIssueStatuses } from "@multica/core/issue-statuses/hooks";
import { issueStatusCategory } from "@multica/core/issues";
import { projectOpenIssuesOptions } from "@multica/core/issues/queries";
import { useWorkspacePaths } from "@multica/core/paths";
import type { Issue, Project } from "@multica/core/types";
import { AppLink } from "../../navigation";
import { StatusIcon } from "../../issues/components/status-icon";
import { ProjectIcon } from "../../projects/components/project-icon";
import { useT } from "../../i18n";
import { PANEL_ROW_CLASS, PanelCount, panelRowStateClass } from "../panel-nav";

export const PROJECT_ISSUE_PREVIEW_LIMIT = 5;

const CATEGORY_RANK: Record<string, number> = { started: 0, unstarted: 1 };
const EMPTY_ISSUES: Issue[] = [];

/** In progress before not started, then most recently touched first. */
export function sortProjectIssues(issues: readonly Issue[]): Issue[] {
  const rank = (issue: Issue) => CATEGORY_RANK[issueStatusCategory(issue) ?? ""] ?? 2;
  return [...issues].sort(
    (a, b) => rank(a) - rank(b) || b.updated_at.localeCompare(a.updated_at),
  );
}

interface ProjectTreeItemProps {
  wsId: string;
  project: Project;
  active: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** The issue on screen, lit and kept visible past the preview cap. */
  activeIssueId: string | null;
}

export function ProjectTreeItem({
  wsId,
  project,
  active,
  expanded,
  onExpandedChange,
  activeIssueId,
}: ProjectTreeItemProps) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const qc = useQueryClient();
  const listId = useId();
  const linkRef = useRef<HTMLAnchorElement>(null);
  const href = p.projectDetail(project.id);
  const issuesOptions = projectOpenIssuesOptions(wsId, project.id);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" && !expanded) {
      event.preventDefault();
      onExpandedChange(true);
    } else if (event.key === "ArrowLeft" && expanded) {
      event.preventDefault();
      onExpandedChange(false);
    }
  };

  return (
    <li>
      <div className={cn(PANEL_ROW_CLASS, panelRowStateClass(active), "group/project relative")}>
        <ProjectIcon project={project} size="sm" />
        <AppLink
          ref={linkRef}
          href={href}
          newTabTitle={project.title}
          aria-current={active ? "page" : undefined}
          onKeyDown={onKeyDown}
          className="min-w-0 truncate outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          {project.title}
        </AppLink>
        <button
          type="button"
          aria-label={t(($) => $.panels.work.project_issues, { name: project.title })}
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          onClick={() => onExpandedChange(!expanded)}
          onKeyDown={onKeyDown}
          onPointerEnter={() => void qc.prefetchQuery(issuesOptions)}
          className={cn(
            "relative z-10 -ml-1 flex size-5 shrink-0 items-center justify-center rounded-md text-faint-foreground outline-none transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring",
            expanded
              ? "opacity-100"
              : "opacity-0 group-hover/project:opacity-100 [@media(pointer:coarse)]:opacity-100",
          )}
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none",
              expanded && "rotate-90",
            )}
          />
        </button>
        <span className="flex-1" />
        {!expanded && <PanelCount value={project.issue_count - project.done_count} />}
      </div>
      {expanded && (
        <ProjectIssueList
          id={listId}
          wsId={wsId}
          projectId={project.id}
          projectHref={href}
          activeIssueId={activeIssueId}
          onCollapse={() => {
            onExpandedChange(false);
            linkRef.current?.focus();
          }}
        />
      )}
    </li>
  );
}

function ProjectIssueList({
  id,
  wsId,
  projectId,
  projectHref,
  activeIssueId,
  onCollapse,
}: {
  id: string;
  wsId: string;
  projectId: string;
  projectHref: string;
  activeIssueId: string | null;
  onCollapse: () => void;
}) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const statusCatalog = useIssueStatuses(wsId);
  const { data = EMPTY_ISSUES, isPending, isError } = useQuery(
    projectOpenIssuesOptions(wsId, projectId),
  );

  const sorted = useMemo(() => sortProjectIssues(data), [data]);
  const visible = useMemo(() => {
    const head = sorted.slice(0, PROJECT_ISSUE_PREVIEW_LIMIT);
    const current = sorted.find((issue) => issue.id === activeIssueId);
    return current && !head.includes(current) ? [...head, current] : head;
  }, [sorted, activeIssueId]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft") return;
    event.preventDefault();
    onCollapse();
  };

  return (
    <ul id={id} className="mt-px ml-[19px] space-y-px border-l border-surface-border pl-2">
      {isPending ? (
        <li className="flex h-8 items-center gap-2.5 px-3">
          <div className="size-3.5 shrink-0 rounded-full bg-muted" />
          <div className="h-3 w-24 rounded-xs bg-muted" />
        </li>
      ) : isError || sorted.length === 0 ? (
        <li className="flex h-8 items-center px-3 text-caption text-faint-foreground">
          {isError
            ? t(($) => $.panels.work.project_issues_error)
            : t(($) => $.panels.work.project_issues_empty)}
        </li>
      ) : (
        <>
          {visible.map((issue) => {
            const active = issue.id === activeIssueId;
            return (
              <li key={issue.id}>
                <AppLink
                  href={p.issueDetail(issue.id)}
                  newTabTitle={issue.title}
                  aria-current={active ? "page" : undefined}
                  onKeyDown={onKeyDown}
                  className={cn(PANEL_ROW_CLASS, panelRowStateClass(active), "px-2")}
                >
                  <StatusIcon
                    status={issue.status}
                    color={statusCatalog.colorOf(issue.status)}
                    icon={statusCatalog.iconOf(issue.status)}
                    category={issueStatusCategory(issue) ?? undefined}
                    className="size-3.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                </AppLink>
              </li>
            );
          })}
          {sorted.length > PROJECT_ISSUE_PREVIEW_LIMIT && (
            <li>
              <AppLink
                href={projectHref}
                onKeyDown={onKeyDown}
                className={cn(PANEL_ROW_CLASS, panelRowStateClass(false), "px-2 text-caption text-faint-foreground")}
              >
                {t(($) => $.panels.work.project_issues_view_all, { count: sorted.length })}
              </AppLink>
            </li>
          )}
        </>
      )}
    </ul>
  );
}

"use client";

import { forwardRef, memo, useCallback, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronUp } from "@multica/ui/icons";
import { cn } from "@multica/ui/lib/utils";
import { ShimmerText } from "@multica/ui/components/common/shimmer-text";
import { agentTaskSnapshotOptions } from "@multica/core/agents";
import { useIssueStatuses } from "@multica/core/issue-statuses/hooks";
import { issueStatusCategory } from "@multica/core/issues";
import { sidebarIssuesOptions } from "@multica/core/issues/queries";
import { SIDEBAR_FIRST_PAGE, SIDEBAR_PAGE_STEP } from "@multica/core/issues/sidebar-list";
import { useWorkspacePaths } from "@multica/core/paths";
import type { AgentTask, Issue, ListIssuesParams } from "@multica/core/types";
import { AppLink } from "../../navigation";
import { AgentAvatarStack } from "../../agents/components/agent-avatar-stack";
import { StatusIcon } from "../../issues/components/status-icon";
import { selectIssueTasks } from "../../issues/surface/activity";
import { useT } from "../../i18n";
import { PANEL_ROW_CLASS, panelRowStateClass } from "../panel-nav";

export const TREE_ROW_BUTTON_CLASS =
  "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-md outline-none transition-[color,opacity] hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring";

interface TreeRowProps extends React.ComponentProps<"div"> {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  /** Omit the expand props for a row that only opens its page. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  listId?: string;
  /** Label for the expand toggle; `aria-expanded` carries its state. */
  toggleLabel?: string;
  onPrefetch?: () => void;
  /** End of the row: a count, or a settings button. */
  trailing?: React.ReactNode;
  onNavigate?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  rowRef?: React.Ref<HTMLDivElement>;
}

/**
 * A nav row that expands in place. The link stretches over the whole row so
 * the row still opens its page; the chevron after the label only toggles.
 */
export const TreeRow = forwardRef<HTMLAnchorElement, TreeRowProps>(function TreeRow(
  {
    href,
    label,
    icon,
    active,
    expanded,
    onExpandedChange,
    listId,
    toggleLabel,
    onPrefetch,
    trailing,
    onNavigate,
    rowRef,
    className,
    ...rowProps
  },
  linkRef,
) {
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!onExpandedChange) return;
    if (event.key === "ArrowRight" && !expanded) {
      event.preventDefault();
      onExpandedChange(true);
    } else if (event.key === "ArrowLeft" && expanded) {
      event.preventDefault();
      onExpandedChange(false);
    }
  };

  return (
    <div
      {...rowProps}
      ref={rowRef}
      className={cn(PANEL_ROW_CLASS, panelRowStateClass(active), "group/row relative", className)}
    >
      {icon}
      <AppLink
        ref={linkRef}
        href={href}
        newTabTitle={label}
        draggable={false}
        aria-current={active ? "page" : undefined}
        onKeyDown={onKeyDown}
        onClick={onNavigate}
        className="min-w-0 truncate outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
      >
        {label}
      </AppLink>
      {onExpandedChange && <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={expanded}
        aria-controls={expanded ? listId : undefined}
        onClick={() => onExpandedChange(!expanded)}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerEnter={onPrefetch}
        className={cn(
          TREE_ROW_BUTTON_CLASS,
          "-ml-1 text-faint-foreground",
          expanded
            ? "opacity-100"
            : "opacity-0 group-hover/row:opacity-100 [@media(pointer:coarse)]:opacity-100",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
      </button>}
      <span className="flex-1" />
      {trailing}
    </div>
  );
});

const EMPTY_PARAMS: ListIssuesParams = {};

/**
 * The issues under an expanded row: the first page, then "Load more" in
 * steps. `params: null` means the row's settings can match nothing;
 * `undefined` that they are still resolving.
 */
export function SidebarIssueList({
  id,
  wsId,
  source,
  params,
  activeIssueId,
  onCollapse,
}: {
  id: string;
  wsId: string;
  source: string;
  params: ListIssuesParams | null | undefined;
  activeIssueId: string | null;
  onCollapse: () => void;
}) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const statusCatalog = useIssueStatuses(wsId);
  const [limit, setLimit] = useState(SIDEBAR_FIRST_PAGE);
  const query = useQuery({
    ...sidebarIssuesOptions(wsId, source, params ?? EMPTY_PARAMS, limit),
    enabled: !!params,
    placeholderData: keepPreviousData,
  });
  const issues = params ? (query.data?.issues ?? []) : [];
  const total = params ? (query.data?.total ?? 0) : 0;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft") return;
    event.preventDefault();
    onCollapse();
  };

  const tailClass = cn(PANEL_ROW_CLASS, panelRowStateClass(false), "gap-1.5 px-2 text-caption text-faint-foreground");

  return (
    <ul id={id} className="mt-px ml-[19px] space-y-px border-l border-surface-border pl-2">
      {params === undefined || (params && query.isPending) ? (
        <li className="flex h-8 items-center gap-2.5 px-3">
          <div className="size-3.5 shrink-0 rounded-full bg-muted" />
          <div className="h-3 w-24 rounded-xs bg-muted" />
        </li>
      ) : query.isError || issues.length === 0 ? (
        <li className="flex h-8 items-center px-3 text-caption text-faint-foreground">
          {query.isError
            ? t(($) => $.panels.work.project_issues_error)
            : t(($) => $.panels.work.project_issues_empty)}
        </li>
      ) : (
        <>
          {issues.map((issue) => (
            <li key={issue.id}>
              <SidebarIssueRow
                wsId={wsId}
                issue={issue}
                href={p.issueDetail(issue.id)}
                active={issue.id === activeIssueId}
                statusColor={statusCatalog.colorOf(issue.status)}
                statusIcon={statusCatalog.iconOf(issue.status)}
                onKeyDown={onKeyDown}
              />
            </li>
          ))}
          {total > issues.length ? (
            <li>
              <button
                type="button"
                className={tailClass}
                disabled={query.isFetching}
                onKeyDown={onKeyDown}
                onClick={() => setLimit(issues.length + SIDEBAR_PAGE_STEP)}
              >
                <ChevronDown className="size-3.5" />
                {t(($) => $.panels.work.load_more)}{" "}
                <span className="tabular-nums">{total - issues.length}</span>
              </button>
            </li>
          ) : (
            limit > SIDEBAR_FIRST_PAGE &&
            issues.length > SIDEBAR_FIRST_PAGE && (
              <li>
                <button type="button" className={tailClass} onKeyDown={onKeyDown} onClick={() => setLimit(SIDEBAR_FIRST_PAGE)}>
                  <ChevronUp className="size-3.5" />
                  {t(($) => $.panels.work.show_less)}
                </button>
              </li>
            )
          )}
        </>
      )}
    </ul>
  );
}

type IssueAgentState = { running: boolean; agentIds: string[] } | null;

/** The title shimmers while an agent runs on the issue; queued agents show dimmed. */
const SidebarIssueRow = memo(function SidebarIssueRow({
  wsId,
  issue,
  href,
  active,
  statusColor,
  statusIcon,
  onKeyDown,
}: {
  wsId: string;
  issue: Issue;
  href: string;
  active: boolean;
  statusColor: string | null;
  statusIcon: string | null;
  onKeyDown: (event: React.KeyboardEvent) => void;
}) {
  const { t } = useT("issues");
  const select = useCallback(
    (snapshot: AgentTask[]): IssueAgentState => {
      const { running, queued } = selectIssueTasks(snapshot, issue.id);
      const tasks = running.length > 0 ? running : queued;
      if (tasks.length === 0) return null;
      return { running: running.length > 0, agentIds: [...new Set(tasks.map((task) => task.agent_id))] };
    },
    [issue.id],
  );
  const { data: agents = null } = useQuery({ ...agentTaskSnapshotOptions(wsId), select });

  return (
    <AppLink
      href={href}
      newTabTitle={issue.title}
      aria-current={active ? "page" : undefined}
      onKeyDown={onKeyDown}
      className={cn(PANEL_ROW_CLASS, panelRowStateClass(active), "px-2")}
    >
      <StatusIcon
        status={issue.status}
        color={statusColor}
        icon={statusIcon}
        category={issueStatusCategory(issue) ?? undefined}
        className="size-3.5 shrink-0"
      />
      <ShimmerText active={!!agents?.running} className="min-w-0 flex-1 truncate">
        {issue.title}
      </ShimmerText>
      {agents && (
        <>
          <AgentAvatarStack agentIds={agents.agentIds} size="xs" max={2} opacity={agents.running ? "full" : "half"} />
          <span className="sr-only">
            {agents.running
              ? t(($) => $.agent_activity.status_running)
              : t(($) => $.agent_activity.status_queued)}
          </span>
        </>
      )}
    </AppLink>
  );
});

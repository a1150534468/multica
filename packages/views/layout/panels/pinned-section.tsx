"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Layers, X } from "@multica/ui/icons";
import { cn } from "@multica/ui/lib/utils";
import { TooltipHint } from "@multica/ui/components/common/tooltip-hint";
import { ApiError } from "@multica/core/api";
import { useIssueStatuses } from "@multica/core/issue-statuses/hooks";
import { issueStatusCategory } from "@multica/core/issues";
import { issueDetailOptions } from "@multica/core/issues/queries";
import { issueViewDetailOptions } from "@multica/core/issue-views/queries";
import {
  issueViewContainerKey,
  useActiveIssueViewStore,
} from "@multica/core/issue-views/active-view-store";
import { projectDetailOptions } from "@multica/core/projects/queries";
import { pinListOptions } from "@multica/core/pins/queries";
import { useDeletePin, useReorderPins } from "@multica/core/pins/mutations";
import { useWorkspacePaths, type WorkspacePaths } from "@multica/core/paths";
import type { PinnedItem } from "@multica/core/types";
import { AppLink } from "../../navigation";
import { StatusIcon } from "../../issues/components/status-icon";
import { ProjectIcon } from "../../projects/components/project-icon";
import { useT } from "../../i18n";
import { PANEL_ROW_CLASS, PanelList, PanelSection, panelRowStateClass } from "../panel-nav";

// Stable empty default: an inline `= []` on useQuery is a new reference every
// render while the query is disabled, which re-fires the sync effect below.
const EMPTY_PINS: PinnedItem[] = [];
const PINNED_PREVIEW_LIMIT = 5;

function pinHref(p: WorkspacePaths, pin: PinnedItem): string {
  if (pin.item_type === "issue") return p.issueDetail(pin.item_id);
  if (pin.item_type === "project") return p.projectDetail(pin.item_id);
  // Views know their target only after their detail loads — the row resolves
  // its own href; this placeholder never renders as a link.
  return "";
}

/**
 * Pin list state for the Issues panel. Lifted out of the section so the
 * panel can keep its plain rows unlit while a pinned item is the page on
 * screen.
 */
export function usePanelPins(wsId: string | undefined, userId: string | undefined, pathname: string) {
  const p = useWorkspacePaths();
  const { data: pinnedItems = EMPTY_PINS } = useQuery({
    ...pinListOptions(wsId ?? "", userId ?? ""),
    enabled: !!wsId && !!userId,
  });

  // Local presentational copy for drop-animation stability. Follows the query
  // at rest; frozen during a drag so a mid-drag cache write (our own
  // optimistic update, or a WS refetch) cannot reorder the DOM under dnd-kit
  // while its drop animation is still interpolating.
  const [localPinned, setLocalPinned] = useState<PinnedItem[]>(pinnedItems);
  const [localPinnedWsId, setLocalPinnedWsId] = useState<string | null>(wsId ?? null);
  const [expandedWsId, setExpandedWsId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  useEffect(() => {
    if (!isDraggingRef.current) setLocalPinned(pinnedItems);
  }, [pinnedItems]);
  useEffect(() => {
    setLocalPinnedWsId(wsId ?? null);
  }, [wsId]);

  const visible = localPinnedWsId === (wsId ?? null) ? localPinned : EMPTY_PINS;
  const expanded = expandedWsId === (wsId ?? null);
  const displayed = expanded ? visible : visible.slice(0, PINNED_PREVIEW_LIMIT);
  // View pins are absent here (their href resolves async): while a view pin
  // is active the plain row for its surface stays highlighted too. Accepted —
  // suppressing it would need every view detail lifted up here.
  const isActivePinnedRoute = displayed.some((pin) => pathname === pinHref(p, pin));

  return {
    visible,
    displayed,
    expanded,
    isActivePinnedRoute,
    setExpanded: (next: boolean) => setExpandedWsId(next ? wsId ?? null : null),
    setLocalPinned,
    isDraggingRef,
  };
}

type PanelPins = ReturnType<typeof usePanelPins>;

export function PinnedSection({
  pins,
  wsId,
  pathname,
}: {
  pins: PanelPins;
  wsId: string;
  pathname: string;
}) {
  const { t } = useT("layout");
  const p = useWorkspacePaths();
  const deletePin = useDeletePin();
  const reorderPins = useReorderPins();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { visible, displayed, expanded, setExpanded, setLocalPinned, isDraggingRef } = pins;

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, [isDraggingRef]);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      isDraggingRef.current = false;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = visible.findIndex((pin) => pin.id === active.id);
      const newIndex = visible.findIndex((pin) => pin.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(visible, oldIndex, newIndex);
      setLocalPinned(reordered);
      reorderPins.mutate(reordered);
    },
    [isDraggingRef, reorderPins, setLocalPinned, visible],
  );

  if (visible.length === 0) return null;

  return (
    <PanelSection label={t(($) => $.sidebar.pinned_label)}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={displayed.map((pin) => pin.id)} strategy={verticalListSortingStrategy}>
          <PanelList>
            {displayed.map((pin) => (
              <PinRow
                key={pin.id}
                pin={pin}
                href={pinHref(p, pin)}
                pathname={pathname}
                onUnpin={() => deletePin.mutate({ itemType: pin.item_type, itemId: pin.item_id })}
                wsId={wsId}
              />
            ))}
          </PanelList>
        </SortableContext>
      </DndContext>
      {visible.length > PINNED_PREVIEW_LIMIT && (
        <button
          type="button"
          aria-expanded={expanded}
          className={cn(PANEL_ROW_CLASS, panelRowStateClass(false), "pl-[2.375rem] text-caption")}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? t(($) => $.sidebar.show_fewer_pins)
            : t(($) => $.sidebar.show_more_pins, { count: visible.length - PINNED_PREVIEW_LIMIT })}
        </button>
      )}
    </PanelSection>
  );
}

function SortablePinItem({
  pin,
  href,
  onUnpin,
  label,
  iconNode,
  active,
  onNavigate,
}: {
  pin: PinnedItem;
  href: string;
  onUnpin: () => void;
  label: string;
  iconNode: React.ReactNode;
  active: boolean;
  /** Runs on a real click (not a drag-release) before navigation. */
  onNavigate?: () => void;
}) {
  const { t } = useT("layout");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pin.id });
  const wasDragged = useRef(false);

  useEffect(() => {
    if (isDragging) wasDragged.current = true;
  }, [isDragging]);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group/pin relative", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <AppLink
        href={href}
        newTabTitle={label}
        draggable={false}
        aria-current={active ? "page" : undefined}
        onClick={(event) => {
          if (wasDragged.current) {
            wasDragged.current = false;
            event.preventDefault();
            return;
          }
          onNavigate?.();
        }}
        className={cn(PANEL_ROW_CLASS, panelRowStateClass(active), "pr-8", isDragging && "pointer-events-none")}
      >
        {iconNode}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </AppLink>
      <TooltipHint label={t(($) => $.sidebar.unpin_tooltip)}>
        <button
          type="button"
          aria-label={t(($) => $.sidebar.unpin_tooltip)}
          className="absolute top-1/2 right-1.5 hidden size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground group-hover/pin:flex group-focus-within/pin:flex hover:bg-surface-selected hover:text-foreground"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onUnpin();
          }}
        >
          <X className="size-3" />
        </button>
      </TooltipHint>
    </li>
  );
}

/**
 * Resolves a pin's display data (label + status/icon) from the issue /
 * project / view detail cache. All three queries are declared unconditionally
 * with `enabled` gates so the hook order stays stable regardless of
 * `pin.item_type`.
 *
 * Loading renders a flat skeleton so the panel height doesn't jump. A missing
 * item (deleted / 404) renders nothing and unpins itself.
 */
function PinRow({
  pin,
  href,
  pathname,
  onUnpin,
  wsId,
}: {
  pin: PinnedItem;
  href: string;
  pathname: string;
  onUnpin: () => void;
  wsId: string;
}) {
  const isIssue = pin.item_type === "issue";
  const isView = pin.item_type === "view";
  const statusCatalog = useIssueStatuses(wsId);
  const p = useWorkspacePaths();
  const setActiveView = useActiveIssueViewStore((s) => s.setActive);
  const activeViewByContainer = useActiveIssueViewStore((s) => s.active);
  const issueQuery = useQuery({ ...issueDetailOptions(wsId, pin.item_id), enabled: isIssue });
  const projectQuery = useQuery({
    ...projectDetailOptions(wsId, pin.item_id),
    enabled: pin.item_type === "project",
  });
  const viewQuery = useQuery({ ...issueViewDetailOptions(wsId, pin.item_id), enabled: isView });

  const triggeredRef = useRef(false);
  useEffect(() => {
    // Views are exempt from 404-auto-unpin: an installed desktop client
    // talking to an older backend without the view endpoints sees 404 for
    // every view pin — auto-unpinning would permanently delete them all.
    // A deleted view's row simply hides instead.
    if (isView) return;
    const err = isIssue ? issueQuery.error : projectQuery.error;
    if (err instanceof ApiError && err.status === 404 && !triggeredRef.current) {
      triggeredRef.current = true;
      onUnpin();
    }
  }, [isIssue, isView, issueQuery.error, onUnpin, projectQuery.error]);

  if (isView) {
    if (viewQuery.isPending) return <PinSkeleton />;
    if (viewQuery.isError || !viewQuery.data) return null;
    const view = viewQuery.data;
    // One resolved scope drives the path AND the container key so an
    // unrecognised scope_type from a newer backend degrades coherently.
    const scopeType: "workspace" | "my" | "project" =
      view.scope_type === "my"
        ? "my"
        : view.scope_type === "project" && view.scope_id
          ? "project"
          : "workspace";
    const viewPath =
      scopeType === "my"
        ? p.myIssues()
        : scopeType === "project"
          ? p.projectDetail(view.scope_id!)
          : p.issues();
    const containerKey = issueViewContainerKey(wsId, {
      scope_type: scopeType,
      scope_id: scopeType === "project" ? view.scope_id : null,
    });
    return (
      <SortablePinItem
        pin={pin}
        // ?view= keeps a web reload on the view for the surfaces that mount
        // the URL-sync hook (/issues, /my-issues). Project pages don't sync
        // yet — there the query is inert and reload falls back to the plain
        // page; click-through activation still works everywhere.
        href={`${viewPath}?view=${view.id}`}
        onUnpin={onUnpin}
        label={view.name}
        iconNode={<Layers className="size-3.5" />}
        // Active only when this exact view is open on its surface — the path
        // alone also matches the plain tab.
        active={pathname === viewPath && activeViewByContainer[containerKey] === view.id}
        onNavigate={() => setActiveView(containerKey, view.id)}
      />
    );
  }

  if (isIssue) {
    if (issueQuery.isPending) return <PinSkeleton />;
    if (issueQuery.isError || !issueQuery.data) return null;
    const issue = issueQuery.data;
    return (
      <SortablePinItem
        pin={pin}
        href={href}
        onUnpin={onUnpin}
        label={issue.title}
        active={pathname === href}
        iconNode={
          <StatusIcon
            status={issue.status}
            color={statusCatalog.colorOf(issue.status)}
            icon={statusCatalog.iconOf(issue.status)}
            category={issueStatusCategory(issue) ?? undefined}
            className="size-3.5 shrink-0"
          />
        }
      />
    );
  }

  if (projectQuery.isPending) return <PinSkeleton />;
  if (projectQuery.isError || !projectQuery.data) return null;
  const project = projectQuery.data;
  return (
    <SortablePinItem
      pin={pin}
      href={href}
      onUnpin={onUnpin}
      label={project.title}
      active={pathname === href}
      iconNode={<ProjectIcon project={project} size="sm" />}
    />
  );
}

function PinSkeleton() {
  return (
    <li className="flex h-8 items-center gap-2.5 px-3">
      <div className="size-3.5 shrink-0 rounded-sm bg-muted" />
      <div className="h-3 w-24 rounded-xs bg-muted" />
    </li>
  );
}

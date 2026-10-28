"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { IssueView } from "../api/schemas";
import { pinListOptions } from "../pins/queries";
import type { PinnedItem } from "../types";
import { issueViewEverywhereOptions } from "./queries";
import { issueViewPreferenceOptions, useUpdateIssueViewPreference } from "./preferences";

/** The views every workspace has without saving anything. */
export type BuiltinViewKey = "my_issues" | "my_agents" | "all_issues";
export const BUILTIN_VIEW_KEYS: readonly BuiltinViewKey[] = ["my_issues", "my_agents", "all_issues"];

export const builtinViewItemId = (key: BuiltinViewKey) => `builtin:${key}`;
export const savedViewItemId = (viewId: string) => `view:${viewId}`;

export const SIDEBAR_VIEWS_SCOPE = { scope_type: "sidebar" } as const;

export type SidebarViewItem =
  | { id: string; kind: "builtin"; key: BuiltinViewKey }
  | { id: string; kind: "view"; view: IssueView };

const EMPTY_VIEWS: IssueView[] = [];
const EMPTY_PINS: PinnedItem[] = [];

/**
 * The starred list before the user has arranged it: the built-ins, the
 * user's own views, then views they had pinned under the old Pinned section.
 */
export function defaultSidebarViewOrder(
  views: readonly IssueView[],
  userId: string | undefined,
  pinnedViewIds: readonly string[],
): string[] {
  const ids = BUILTIN_VIEW_KEYS.map(builtinViewItemId);
  for (const view of views) {
    if (view.owner_id === userId) ids.push(savedViewItemId(view.id));
  }
  for (const viewId of pinnedViewIds) {
    const id = savedViewItemId(viewId);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Resolve starred ids to items, dropping views that were deleted or unshared. */
export function resolveSidebarViewItems(
  order: readonly string[],
  views: readonly IssueView[],
): SidebarViewItem[] {
  const byId = new Map(views.map((view) => [savedViewItemId(view.id), view]));
  const builtins = new Map(BUILTIN_VIEW_KEYS.map((key) => [builtinViewItemId(key), key]));
  const items: SidebarViewItem[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const key = builtins.get(id);
    if (key) {
      items.push({ id, kind: "builtin", key });
      continue;
    }
    const view = byId.get(id);
    if (view) items.push({ id, kind: "view", view });
  }
  return items;
}

/**
 * The user's starred views in sidebar order, with the writes that rearrange
 * them. Until the first write the list is derived, so views the user creates
 * elsewhere still show up.
 */
export function useSidebarViews(wsId: string, userId: string | undefined) {
  const { data: views = EMPTY_VIEWS, isPending: viewsPending } = useQuery(issueViewEverywhereOptions(wsId));
  const { data: preference } = useQuery(issueViewPreferenceOptions(wsId, SIDEBAR_VIEWS_SCOPE));
  const { data: pins = EMPTY_PINS } = useQuery({
    ...pinListOptions(wsId, userId ?? ""),
    enabled: !!wsId && !!userId,
  });
  const update = useUpdateIssueViewPreference(wsId, SIDEBAR_VIEWS_SCOPE);

  const savedOrder = preference && preference.updated_at !== "" ? preference.prefs.order : null;
  const items = useMemo(() => {
    const order =
      savedOrder ??
      defaultSidebarViewOrder(
        views,
        userId,
        pins.filter((pin) => pin.item_type === "view").map((pin) => pin.item_id),
      );
    return resolveSidebarViewItems(order, views);
  }, [savedOrder, views, userId, pins]);

  const write = useCallback(
    (order: string[]) => update.mutate({ hidden: [], order }),
    [update],
  );
  const ids = useMemo(() => items.map((item) => item.id), [items]);

  return {
    items,
    /** Saved views are still loading; built-ins render regardless. */
    viewsPending,
    isStarred: useCallback((id: string) => ids.includes(id), [ids]),
    star: useCallback((id: string) => {
      if (!ids.includes(id)) write([...ids, id]);
    }, [ids, write]),
    unstar: useCallback((id: string) => write(ids.filter((other) => other !== id)), [ids, write]),
    reorder: write,
  };
}

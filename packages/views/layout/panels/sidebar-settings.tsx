"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { Button } from "@multica/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@multica/ui/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@multica/ui/components/ui/select";
import { Switch } from "@multica/ui/components/ui/switch";
import { Toggle } from "@multica/ui/components/ui/toggle";
import { useIssueStatuses } from "@multica/core/issue-statuses/hooks";
import { shownSidebarStatuses } from "@multica/core/issues/sidebar-list";
import {
  DEFAULT_SIDEBAR_ISSUE_SETTINGS,
  DEFAULT_SIDEBAR_PROJECT_SETTINGS,
  useSidebarTreeStore,
  type SidebarIssueAssignee,
  type SidebarIssueSort,
  type SidebarProjectOrdering,
} from "@multica/core/issues/stores/sidebar-tree-store";
import { PROJECT_STATUS_CONFIG, PROJECT_STATUS_ORDER } from "@multica/core/projects/config";
import type { ProjectStatus } from "@multica/core/types";
import { StatusIcon } from "../../issues/components/status-icon";
import { sortDirectionLabelKey } from "../../issues/utils/sort-direction";
import { useProjectStatusLabels } from "../../projects/components/labels";
import { useT } from "../../i18n";
import { TREE_ROW_BUTTON_CLASS } from "./sidebar-tree";

const CHIP_CLASS =
  "h-6 max-w-40 gap-1.5 rounded-md px-2 text-caption text-muted-foreground hover:bg-muted/60 aria-pressed:border-transparent aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:hover:bg-accent/80";

const ISSUE_SORTS: { value: SidebarIssueSort; label: "sort_updated" | "sort_created" | "sort_priority" | "sort_status" | "sort_title" | "sort_due_date" }[] = [
  { value: "updated_at", label: "sort_updated" },
  { value: "created_at", label: "sort_created" },
  { value: "priority", label: "sort_priority" },
  { value: "status", label: "sort_status" },
  { value: "title", label: "sort_title" },
  { value: "due_date", label: "sort_due_date" },
];

function SettingsTrigger({ label, className }: { label: string; className?: string }) {
  return (
    <PopoverTrigger
      render={
        <button
          type="button"
          aria-label={label}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            TREE_ROW_BUTTON_CLASS,
            "text-muted-foreground data-popup-open:bg-surface-selected data-popup-open:text-foreground data-popup-open:opacity-100",
            className,
          )}
        />
      }
    >
      <SlidersHorizontal className="size-3.5" />
    </PopoverTrigger>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-caption font-medium text-muted-foreground">{label}</span>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const sameSettings = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

/** How expanded projects list their issues; shared by every project. */
export function IssueDisplaySettings({ wsId, className }: { wsId: string; className?: string }) {
  const { t } = useT("layout");
  const { t: ti } = useT("issues");
  const statusCatalog = useIssueStatuses(wsId);
  const settings = useSidebarTreeStore((s) => s.issueSettings);
  const update = useSidebarTreeStore((s) => s.setIssueSettings);

  const statuses = statusCatalog.activeStatuses;
  const shown = new Set(shownSidebarStatuses(settings, statusCatalog.statuses));
  const toggleStatus = (key: string, pressed: boolean) => {
    const hidden = statusCatalog.statuses.map((s) => s.key).filter((k) => (k === key ? !pressed : !shown.has(k)));
    update({ hiddenStatuses: hidden });
  };
  const sortLabel = ISSUE_SORTS.find((o) => o.value === settings.sortBy)?.label ?? "sort_updated";
  const directionLabel = ti(($) => $.display[sortDirectionLabelKey(settings.sortBy, settings.sortDirection)]);
  const assigneeLabels: Record<SidebarIssueAssignee, string> = {
    anyone: t(($) => $.panels.work.assignee_anyone),
    me: t(($) => $.panels.work.assignee_me),
    my_agents: t(($) => $.panels.work.assignee_my_agents),
  };

  return (
    <Popover>
      <SettingsTrigger label={t(($) => $.panels.work.issue_settings)} className={className} />
      <PopoverContent side="right" align="start" sideOffset={8} className="w-72 gap-3 p-3">
        <PopoverTitle className="text-label font-semibold">{t(($) => $.panels.work.issue_settings)}</PopoverTitle>
        <div>
          <span className="text-caption font-medium text-muted-foreground">{ti(($) => $.display.ordering_section)}</span>
          <div className="mt-2 flex items-center gap-1.5">
            <Select
              items={ISSUE_SORTS.map((o) => ({ value: o.value as string, label: ti(($) => $.display[o.label]) }))}
              value={settings.sortBy}
              onValueChange={(v) => {
                if (v) update({ sortBy: v as SidebarIssueSort });
              }}
            >
              <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={ti(($) => $.display.ordering_section)}>
                <SelectValue>{ti(($) => $.display[sortLabel])}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {ISSUE_SORTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {ti(($) => $.display[o.label])}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              aria-label={directionLabel}
              onClick={() => update({ sortDirection: settings.sortDirection === "asc" ? "desc" : "asc" })}
            >
              {directionLabel}
            </Button>
          </div>
        </div>
        <div>
          <span className="text-caption font-medium text-muted-foreground">{t(($) => $.panels.work.settings_status)}</span>
          <div className="mt-2 flex flex-wrap gap-1">
            {statuses.map((status) => (
              <Toggle
                key={status.key}
                size="sm"
                variant="outline"
                pressed={shown.has(status.key)}
                onPressedChange={(pressed) => toggleStatus(status.key, pressed)}
                className={CHIP_CLASS}
              >
                <StatusIcon
                  status={status.key}
                  category={status.category}
                  color={statusCatalog.colorOf(status.key)}
                  icon={statusCatalog.iconOf(status.key)}
                  className="size-3 shrink-0"
                />
                <span className="truncate">{statusCatalog.labelOf(status.key)}</span>
              </Toggle>
            ))}
          </div>
        </div>
        <Field label={t(($) => $.panels.work.settings_assignee)}>
          <Select
            items={(Object.keys(assigneeLabels) as SidebarIssueAssignee[]).map((value) => ({ value, label: assigneeLabels[value] }))}
            value={settings.assignee}
            onValueChange={(v) => {
              if (v) update({ assignee: v as SidebarIssueAssignee });
            }}
          >
            <SelectTrigger size="sm" className="w-32" aria-label={t(($) => $.panels.work.settings_assignee)}>
              <SelectValue>{assigneeLabels[settings.assignee]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {(Object.keys(assigneeLabels) as SidebarIssueAssignee[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {assigneeLabels[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <SwitchField
          label={ti(($) => $.display.show_sub_issues)}
          checked={settings.showSubIssues}
          onChange={(checked) => update({ showSubIssues: checked })}
        />
        {!sameSettings(settings, DEFAULT_SIDEBAR_ISSUE_SETTINGS) && (
          <div className="-mx-3 flex justify-end border-t border-surface-border px-1.5 pt-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => update(DEFAULT_SIDEBAR_ISSUE_SETTINGS)}>
              {t(($) => $.panels.work.reset)}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

const PROJECT_ORDERINGS: SidebarProjectOrdering[] = ["manual", "name", "updated", "created"];

/** Which projects the Projects section lists, and in what order. */
export function ProjectsSectionSettings({ className }: { className?: string }) {
  const { t } = useT("layout");
  const statusLabels = useProjectStatusLabels();
  const settings = useSidebarTreeStore((s) => s.projectSettings);
  const update = useSidebarTreeStore((s) => s.setProjectSettings);
  const orderingLabels: Record<SidebarProjectOrdering, string> = {
    manual: t(($) => $.panels.work.projects_order_manual),
    name: t(($) => $.panels.work.projects_order_name),
    updated: t(($) => $.panels.work.projects_order_updated),
    created: t(($) => $.panels.work.projects_order_created),
  };
  const toggleStatus = (status: ProjectStatus, pressed: boolean) =>
    update({
      statuses: PROJECT_STATUS_ORDER.filter((s) => (s === status ? pressed : settings.statuses.includes(s))),
    });

  return (
    <Popover>
      <SettingsTrigger label={t(($) => $.panels.work.projects_settings)} className={className} />
      <PopoverContent side="right" align="start" sideOffset={8} className="w-72 gap-3 p-3">
        <PopoverTitle className="text-label font-semibold">{t(($) => $.panels.work.projects_settings)}</PopoverTitle>
        <Field label={t(($) => $.panels.work.projects_ordering)}>
          <Select
            items={PROJECT_ORDERINGS.map((value) => ({ value, label: orderingLabels[value] }))}
            value={settings.ordering}
            onValueChange={(v) => {
              if (v) update({ ordering: v as SidebarProjectOrdering });
            }}
          >
            <SelectTrigger size="sm" className="w-36" aria-label={t(($) => $.panels.work.projects_ordering)}>
              <SelectValue>{orderingLabels[settings.ordering]}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {PROJECT_ORDERINGS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {orderingLabels[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <div>
          <span className="text-caption font-medium text-muted-foreground">{t(($) => $.panels.work.projects_show)}</span>
          <div className="mt-2 flex flex-wrap gap-1">
            {PROJECT_STATUS_ORDER.map((status) => (
              <Toggle
                key={status}
                size="sm"
                variant="outline"
                pressed={settings.statuses.includes(status)}
                onPressedChange={(pressed) => toggleStatus(status, pressed)}
                className={CHIP_CLASS}
              >
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", PROJECT_STATUS_CONFIG[status].dotColor)} />
                <span className="truncate">{statusLabels[status]}</span>
              </Toggle>
            ))}
          </div>
        </div>
        <SwitchField
          label={t(($) => $.panels.work.projects_only_mine)}
          checked={settings.onlyMine}
          onChange={(checked) => update({ onlyMine: checked })}
        />
        <SwitchField
          label={t(($) => $.panels.work.projects_show_count)}
          checked={settings.showCount}
          onChange={(checked) => update({ showCount: checked })}
        />
        {!sameSettings(settings, DEFAULT_SIDEBAR_PROJECT_SETTINGS) && (
          <div className="-mx-3 flex justify-end border-t border-surface-border px-1.5 pt-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => update(DEFAULT_SIDEBAR_PROJECT_SETTINGS)}>
              {t(($) => $.panels.work.reset)}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

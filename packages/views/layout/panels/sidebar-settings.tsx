"use client";

import { SlidersHorizontal } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { Button } from "@multica/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@multica/ui/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@multica/ui/components/ui/select";
import { Switch } from "@multica/ui/components/ui/switch";
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

const ISSUE_SORTS: {
  value: SidebarIssueSort;
  label: "sort_updated" | "sort_created" | "sort_priority" | "sort_status" | "sort_title" | "sort_due_date";
}[] = [
  { value: "updated_at", label: "sort_updated" },
  { value: "created_at", label: "sort_created" },
  { value: "priority", label: "sort_priority" },
  { value: "status", label: "sort_status" },
  { value: "title", label: "sort_title" },
  { value: "due_date", label: "sort_due_date" },
];
const PROJECT_ORDERINGS: SidebarProjectOrdering[] = ["manual", "name", "updated", "created"];

const sameSettings = <T,>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);

function Caption({ children }: { children: React.ReactNode }) {
  return <span className="text-caption font-medium text-muted-foreground">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Caption>{label}</Caption>
      {children}
    </div>
  );
}

function SwitchField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <Caption>{label}</Caption>
      <Switch size="sm" checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** A filter chip: a solid outline and tint when on, dashed and faded when off. */
function FilterChip({
  selected,
  onChange,
  icon,
  label,
}: {
  selected: boolean;
  onChange: (selected: boolean) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onChange(!selected)}
      className={cn(
        "inline-flex h-6 max-w-40 items-center gap-1.5 rounded-md border px-2 text-caption transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring",
        selected
          ? "border-foreground/25 bg-foreground/[0.06] text-foreground hover:bg-foreground/10"
          : "border-dashed border-input text-faint-foreground hover:bg-surface-hover hover:text-muted-foreground",
      )}
    >
      <span className={cn("flex shrink-0 transition-[opacity,filter]", !selected && "opacity-40 grayscale")}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SortSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
    >
      <SelectTrigger size="sm" className={className} aria-label={label}>
        <SelectValue>{options.find((o) => o.value === value)?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function ProjectsGroup() {
  const { t } = useT("layout");
  const statusLabels = useProjectStatusLabels();
  const settings = useSidebarTreeStore((s) => s.projectSettings);
  const update = useSidebarTreeStore((s) => s.setProjectSettings);
  const toggleStatus = (status: ProjectStatus, on: boolean) =>
    update({ statuses: PROJECT_STATUS_ORDER.filter((s) => (s === status ? on : settings.statuses.includes(s))) });

  return (
    <section className="space-y-3">
      <h3 className="text-label font-semibold">{t(($) => $.nav.projects)}</h3>
      <Field label={t(($) => $.panels.work.projects_ordering)}>
        <SortSelect
          label={t(($) => $.panels.work.projects_ordering)}
          value={settings.ordering}
          options={PROJECT_ORDERINGS.map((value) => ({
            value,
            label: {
              manual: t(($) => $.panels.work.projects_order_manual),
              name: t(($) => $.panels.work.projects_order_name),
              updated: t(($) => $.panels.work.projects_order_updated),
              created: t(($) => $.panels.work.projects_order_created),
            }[value],
          }))}
          onChange={(ordering) => update({ ordering })}
          className="w-36"
        />
      </Field>
      <div>
        <Caption>{t(($) => $.panels.work.projects_show)}</Caption>
        <div className="mt-2 flex flex-wrap gap-1">
          {PROJECT_STATUS_ORDER.map((status) => (
            <FilterChip
              key={status}
              selected={settings.statuses.includes(status)}
              onChange={(on) => toggleStatus(status, on)}
              label={statusLabels[status]}
              icon={<span aria-hidden className={cn("size-1.5 rounded-full", PROJECT_STATUS_CONFIG[status].dotColor)} />}
            />
          ))}
        </div>
      </div>
      <SwitchField
        label={t(($) => $.panels.work.projects_only_mine)}
        checked={settings.onlyMine}
        onChange={(onlyMine) => update({ onlyMine })}
      />
      <SwitchField
        label={t(($) => $.panels.work.projects_show_count)}
        checked={settings.showCount}
        onChange={(showCount) => update({ showCount })}
      />
    </section>
  );
}

function ProjectIssuesGroup({ wsId }: { wsId: string }) {
  const { t } = useT("layout");
  const { t: ti } = useT("issues");
  const statusCatalog = useIssueStatuses(wsId);
  const settings = useSidebarTreeStore((s) => s.issueSettings);
  const update = useSidebarTreeStore((s) => s.setIssueSettings);
  const shown = new Set(shownSidebarStatuses(settings, statusCatalog.statuses));
  const toggleStatus = (key: string, on: boolean) =>
    update({
      hiddenStatuses: statusCatalog.statuses.map((s) => s.key).filter((k) => (k === key ? !on : !shown.has(k))),
    });
  const directionLabel = ti(($) => $.display[sortDirectionLabelKey(settings.sortBy, settings.sortDirection)]);
  const assigneeOptions: { value: SidebarIssueAssignee; label: string }[] = [
    { value: "anyone", label: t(($) => $.panels.work.assignee_anyone) },
    { value: "me", label: t(($) => $.panels.work.assignee_me) },
    { value: "my_agents", label: t(($) => $.panels.work.assignee_my_agents) },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-label font-semibold">{t(($) => $.panels.work.project_issues_settings)}</h3>
      <div>
        <Caption>{ti(($) => $.display.ordering_section)}</Caption>
        <div className="mt-2 flex items-center gap-1.5">
          <SortSelect
            label={ti(($) => $.display.ordering_section)}
            value={settings.sortBy}
            options={ISSUE_SORTS.map((o) => ({ value: o.value, label: ti(($) => $.display[o.label]) }))}
            onChange={(sortBy) => update({ sortBy })}
            className="min-w-0 flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => update({ sortDirection: settings.sortDirection === "asc" ? "desc" : "asc" })}
          >
            {directionLabel}
          </Button>
        </div>
      </div>
      <div>
        <Caption>{t(($) => $.panels.work.settings_status)}</Caption>
        <div className="mt-2 flex flex-wrap gap-1">
          {statusCatalog.activeStatuses.map((status) => (
            <FilterChip
              key={status.key}
              selected={shown.has(status.key)}
              onChange={(on) => toggleStatus(status.key, on)}
              label={statusCatalog.labelOf(status.key)}
              icon={
                <StatusIcon
                  status={status.key}
                  category={status.category}
                  color={statusCatalog.colorOf(status.key)}
                  icon={statusCatalog.iconOf(status.key)}
                  className="size-3"
                />
              }
            />
          ))}
        </div>
      </div>
      <Field label={t(($) => $.panels.work.settings_assignee)}>
        <SortSelect
          label={t(($) => $.panels.work.settings_assignee)}
          value={settings.assignee}
          options={assigneeOptions}
          onChange={(assignee) => update({ assignee })}
          className="w-32"
        />
      </Field>
      <SwitchField
        label={ti(($) => $.display.show_sub_issues)}
        checked={settings.showSubIssues}
        onChange={(showSubIssues) => update({ showSubIssues })}
      />
    </section>
  );
}

/**
 * Display settings for the whole Projects section: which projects it lists,
 * and how every expanded project lists its issues.
 */
export function ProjectsSectionSettings({ wsId, className }: { wsId: string; className?: string }) {
  const { t } = useT("layout");
  const changed = useSidebarTreeStore(
    (s) =>
      !sameSettings(s.projectSettings, DEFAULT_SIDEBAR_PROJECT_SETTINGS) ||
      !sameSettings(s.issueSettings, DEFAULT_SIDEBAR_ISSUE_SETTINGS),
  );
  const reset = () => {
    const store = useSidebarTreeStore.getState();
    store.setProjectSettings(DEFAULT_SIDEBAR_PROJECT_SETTINGS);
    store.setIssueSettings(DEFAULT_SIDEBAR_ISSUE_SETTINGS);
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t(($) => $.panels.work.projects_settings)}
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
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="max-h-(--available-height) w-72 gap-0 overflow-y-auto p-3"
      >
        <ProjectsGroup />
        <div className="-mx-3 my-3 border-t border-surface-border" />
        <ProjectIssuesGroup wsId={wsId} />
        {changed && (
          <div className="-mx-3 mt-3 flex justify-end border-t border-surface-border px-1.5 pt-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>
              {t(($) => $.panels.work.reset)}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

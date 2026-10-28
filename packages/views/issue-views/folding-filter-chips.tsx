"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "@multica/ui/icons";
import { Button } from "@multica/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@multica/ui/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@multica/ui/components/ui/dropdown-menu";
import { TooltipHint } from "@multica/ui/components/common/tooltip-hint";
import type { IssueDateFilter } from "@multica/core/issues/stores/view-store";
import { ChipSpan, useFilterChips } from "../issues/components/filter-chips-bar";
import { useSingleRowFit } from "../common/single-row-fit";
import { useT } from "../i18n";

const CHIP_GAP = 6;
const MORE_BUTTON_WIDTH = 36;
const HEADER_CHIP_CLASS = "border border-border shadow-none";

/**
 * Active filters as one row of chips: the ones that fit stay inline, the rest
 * fold into "+N", which lists them in a popover. `trailing` (the add-filter
 * trigger) always stays right after the last visible chip.
 */
export function FoldingFilterChips({
  dateFilter,
  onDateFilterChange,
  leading,
  trailing,
}: {
  dateFilter: IssueDateFilter | null;
  onDateFilterChange?: (filter: IssueDateFilter | null) => void;
  /** Chips that never fold, e.g. the scope chip. */
  leading?: ReactNode;
  trailing: ReactNode;
}) {
  const { t } = useT("issues");
  const { chips, clearAll } = useFilterChips(dateFilter, onDateFilterChange);
  const trailingRef = useRef<HTMLSpanElement>(null);
  const leadingRef = useRef<HTMLSpanElement>(null);
  const reserve = useCallback(
    (fit: number) =>
      (trailingRef.current?.offsetWidth ?? 0) +
      CHIP_GAP +
      (leadingRef.current?.offsetWidth ? leadingRef.current.offsetWidth + CHIP_GAP : 0) +
      (fit < chips.length ? MORE_BUTTON_WIDTH + CHIP_GAP : 0),
    [chips.length],
  );
  const { containerRef, measureRef, fitCount } = useSingleRowFit({
    count: chips.length,
    gap: CHIP_GAP,
    reserve,
  });
  const hidden = chips.slice(fitCount);
  // Only chips fold; the scope chip, "+N" and the add-filter trigger keep the
  // row from shrinking past them.
  const [minWidth, setMinWidth] = useState(0);
  useLayoutEffect(() => {
    const next = reserve(fitCount) - CHIP_GAP;
    setMinWidth((current) => (current === next ? current : next));
  }, [reserve, fitCount, leading]);

  return (
    <div
      ref={containerRef}
      style={{ minWidth }}
      className="relative flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
    >
      {leading && (
        <span ref={leadingRef} className="flex shrink-0 items-center gap-1.5">
          {leading}
        </span>
      )}
      {chips.slice(0, fitCount).map((chip) => (
        <ChipSpan key={chip.key} chip={chip} className={HEADER_CHIP_CLASS} />
      ))}
      {hidden.length > 0 && (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="h-6 shrink-0 px-2 text-caption font-medium"
                aria-label={t(($) => $.views.more_filters, { count: hidden.length })}
              >
                +{hidden.length}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto min-w-64 gap-2 p-2">
            <div className="flex items-center justify-between px-1 text-caption text-muted-foreground">
              <span>{t(($) => $.views.filter_count, { count: chips.length })}</span>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-sm px-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {t(($) => $.views.clear_all)}
              </button>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              {hidden.map((chip) => (
                <ChipSpan key={chip.key} chip={chip} className={HEADER_CHIP_CLASS} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <span ref={trailingRef} className="flex shrink-0 items-center">
        {trailing}
      </span>
      {/* Natural chip widths for the fit; never visible or focusable. */}
      <div
        ref={measureRef}
        aria-hidden
        inert
        className="pointer-events-none invisible absolute top-0 left-0 flex gap-1.5"
      >
        {chips.map((chip) => (
          <ChipSpan key={chip.key} chip={chip} className={HEADER_CHIP_CLASS} />
        ))}
      </div>
    </div>
  );
}

/**
 * The surface's scope axis as a chip: who the issues are assigned to, or how
 * they relate to me. Saved views fix it, so it renders read-only there.
 */
export function ScopeChip<T extends string>({
  label,
  value,
  options,
  onChange,
  readOnlyHint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange?: (value: T) => void;
  readOnlyHint?: string;
}) {
  const current = options.find((option) => option.value === value)?.label ?? value;
  const body = (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{current}</span>
    </>
  );
  const chipClass =
    "flex h-6 max-w-60 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-caption";
  if (!onChange) {
    return (
      <TooltipHint label={readOnlyHint ?? label}>
        <span className={chipClass}>{body}</span>
      </TooltipHint>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={`${chipClass} pr-1 outline-none hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring`}
          />
        }
      >
        {body}
        <ChevronDown className="size-3 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

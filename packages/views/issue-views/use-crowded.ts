"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

const RELEASE_SLACK = 8;

function isOverfull(zone: HTMLElement): boolean {
  const gap = parseFloat(getComputedStyle(zone).columnGap) || 0;
  const children = [...zone.children] as HTMLElement[];
  const used =
    children.reduce((sum, child) => sum + child.offsetWidth, 0) +
    gap * Math.max(0, children.length - 1);
  if (used > zone.clientWidth + 1) return true;
  return [...zone.querySelectorAll<HTMLElement>("[data-fit-truncate]")].some(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
}

/**
 * How many steps of compaction a header row needs, from 0 (full labels) to
 * `maxLevel`. The caller decides what each step hides.
 *
 * `zoneRef` is the row's shrinking side (the title and what follows it). It
 * is crowded once its children overflow it or a `data-fit-truncate` element
 * inside it truncates; each crowded check takes one more step. A step
 * remembers the row width that forced it and is only undone once the row is
 * wider than that, so two layouts never flip back and forth at one width.
 * Change `resetKey` whenever the row's content changes width on its own (a
 * new title, buttons appearing).
 */
export function useCrowdedLevel(
  zoneRef: RefObject<HTMLElement | null>,
  maxLevel: number,
  resetKey: string,
): number {
  const [level, setLevel] = useState(0);
  const forcedAt = useRef<number[]>([]);

  useLayoutEffect(() => {
    forcedAt.current = [];
    setLevel(0);
  }, [resetKey]);

  useLayoutEffect(() => {
    const zone = zoneRef.current;
    const row = zone?.parentElement;
    if (!zone || !row) return;
    const check = () => {
      if (level < maxLevel && isOverfull(zone)) {
        forcedAt.current[level] = row.clientWidth;
        setLevel(level + 1);
      } else if (level > 0 && row.clientWidth > (forcedAt.current[level - 1] ?? 0) + RELEASE_SLACK) {
        setLevel(level - 1);
      }
    };
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(row);
    observer.observe(zone);
    return () => observer.disconnect();
  }, [zoneRef, level, maxLevel, resetKey]);

  return level;
}

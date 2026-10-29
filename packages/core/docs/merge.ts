/**
 * Line-level diff and three-way merge for knowledge base docs (MUL-8370).
 *
 * The server only rejects stale writes; merging happens here, in the client
 * that holds both the version it started from and its own unsaved edit. A
 * Markdown doc's lines are its blocks (paragraphs, list items, table rows,
 * code lines), so a merge that works line by line keeps two people's edits to
 * different blocks and only stops where both changed the same lines.
 */

export type DiffOp<T> = { op: "eq" | "del" | "ins"; value: T };

/**
 * Longest-common-subsequence diff. Equal prefix and suffix are peeled off
 * first so the quadratic table only covers the edited middle.
 */
export function diffSequences<T>(a: readonly T[], b: readonly T[]): DiffOp<T>[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const ops: DiffOp<T>[] = [];
  for (let i = 0; i < start; i++) ops.push({ op: "eq", value: a[i]! });

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  const width = m + 1;
  const table = new Int32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        midA[i] === midB[j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      ops.push({ op: "eq", value: midA[i]! });
      i++;
      j++;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      ops.push({ op: "del", value: midA[i++]! });
    } else {
      ops.push({ op: "ins", value: midB[j++]! });
    }
  }
  while (i < n) ops.push({ op: "del", value: midA[i++]! });
  while (j < m) ops.push({ op: "ins", value: midB[j++]! });

  for (let k = endA; k < a.length; k++) ops.push({ op: "eq", value: a[k]! });
  return ops;
}

export function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

/** A replacement of base[start, end) by `lines`. */
interface Hunk {
  start: number;
  end: number;
  lines: string[];
  side: "mine" | "theirs";
}

function hunksAgainst(base: readonly string[], side: readonly string[], who: Hunk["side"]): Hunk[] {
  const out: Hunk[] = [];
  let i = 0;
  let cur: Hunk | null = null;
  for (const o of diffSequences(base, side)) {
    if (o.op === "eq") {
      if (cur) {
        out.push(cur);
        cur = null;
      }
      i++;
      continue;
    }
    if (!cur) cur = { start: i, end: i, lines: [], side: who };
    if (o.op === "del") {
      cur.end++;
      i++;
    } else {
      cur.lines.push(o.value);
    }
  }
  if (cur) out.push(cur);
  return out;
}

function applyHunks(base: readonly string[], from: number, to: number, hunks: readonly Hunk[]): string[] {
  const out: string[] = [];
  let i = from;
  for (const h of hunks) {
    out.push(...base.slice(i, h.start), ...h.lines);
    i = h.end;
  }
  out.push(...base.slice(i, to));
  return out;
}

export interface MergeConflict {
  /** The writer's own lines for the contested region (kept in the result). */
  mine: string[];
  /** The other writer's lines for the same region. */
  theirs: string[];
  base: string[];
}

export interface MergeResult {
  /** Merged lines; contested regions hold `mine`. */
  lines: string[];
  conflicts: MergeConflict[];
}

/**
 * Three-way merge of two edits of `base`. Changes to different lines combine;
 * where both sides changed the same lines differently, the result keeps
 * `mine` and reports the region so the UI can offer `theirs` instead.
 */
export function merge3(base: readonly string[], mine: readonly string[], theirs: readonly string[]): MergeResult {
  const all = [...hunksAgainst(base, mine, "mine"), ...hunksAgainst(base, theirs, "theirs")].sort(
    (x, y) => x.start - y.start || x.end - y.end,
  );
  const clusters: { start: number; end: number; hunks: Hunk[] }[] = [];
  for (const h of all) {
    const c = clusters[clusters.length - 1];
    if (c && (h.start < c.end || h.start === c.start)) {
      c.hunks.push(h);
      c.end = Math.max(c.end, h.end);
    } else {
      clusters.push({ start: h.start, end: h.end, hunks: [h] });
    }
  }

  const lines: string[] = [];
  const conflicts: MergeConflict[] = [];
  let i = 0;
  for (const c of clusters) {
    lines.push(...base.slice(i, c.start));
    const m = c.hunks.filter((h) => h.side === "mine");
    const t = c.hunks.filter((h) => h.side === "theirs");
    const x = applyHunks(base, c.start, c.end, m);
    const y = applyHunks(base, c.start, c.end, t);
    if (m.length === 0) {
      lines.push(...y);
    } else if (t.length === 0 || x.join("\n") === y.join("\n")) {
      lines.push(...x);
    } else {
      lines.push(...x);
      conflicts.push({ mine: x, theirs: y, base: base.slice(c.start, c.end) });
    }
    i = c.end;
  }
  lines.push(...base.slice(i));
  return { lines, conflicts };
}

/** {@link merge3} over whole texts. */
export function mergeText(base: string, mine: string, theirs: string): { text: string; conflicts: MergeConflict[] } {
  const result = merge3(splitLines(base), splitLines(mine), splitLines(theirs));
  return { text: result.lines.join("\n"), conflicts: result.conflicts };
}

/**
 * Swap a reported conflict's `mine` lines for `theirs` in a text that still
 * contains them. Returns null when the user has since edited those lines.
 */
export function applyTheirs(text: string, conflict: MergeConflict): string | null {
  const lines = splitLines(text);
  const len = conflict.mine.length;
  for (let i = 0; i + len <= lines.length; i++) {
    let match = true;
    for (let j = 0; j < len; j++) {
      if (lines[i + j] !== conflict.mine[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      lines.splice(i, len, ...conflict.theirs);
      return lines.join("\n");
    }
  }
  return null;
}

/**
 * Undo one version on top of the current text: merge "current" with "the
 * version's parent", using the version itself as the common base. Returns null
 * when later edits overlap the lines that version changed.
 */
export function revertVersion(parent: string, version: string, current: string): string | null {
  const result = merge3(splitLines(version), splitLines(current), splitLines(parent));
  return result.conflicts.length > 0 ? null : result.lines.join("\n");
}

/**
 * Markdown blocks for display diffs: runs of non-blank lines, with fenced code
 * kept whole even across blank lines.
 */
export function splitMarkdownBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    if (cur.length) blocks.push(cur.join("\n"));
    cur = [];
  };
  for (const line of splitLines(markdown)) {
    const marker = /^\s*(```|~~~)/.exec(line)?.[1] ?? null;
    if (fence) {
      cur.push(line);
      if (marker === fence) {
        fence = null;
        flush();
      }
      continue;
    }
    if (marker) {
      flush();
      fence = marker;
      cur.push(line);
      continue;
    }
    if (line.trim() === "") flush();
    else cur.push(line);
  }
  flush();
  return blocks;
}

export type BlockChange =
  | { kind: "same"; block: string }
  | { kind: "added"; block: string }
  | { kind: "removed"; block: string }
  | { kind: "changed"; before: string; after: string };

/**
 * Block-level changes between two Markdown texts. A removal directly followed
 * by an addition pairs up as a "changed" block so the view can show a word
 * diff instead of two unrelated blocks.
 */
export function diffMarkdownBlocks(before: string, after: string): BlockChange[] {
  const ops = diffSequences(splitMarkdownBlocks(before), splitMarkdownBlocks(after));
  const out: BlockChange[] = [];
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k]!;
    if (o.op === "eq") {
      out.push({ kind: "same", block: o.value });
      continue;
    }
    const dels: string[] = [];
    const inss: string[] = [];
    while (k < ops.length && ops[k]!.op !== "eq") {
      const cur = ops[k]!;
      (cur.op === "del" ? dels : inss).push(cur.value);
      k++;
    }
    k--;
    const paired = Math.min(dels.length, inss.length);
    for (let p = 0; p < paired; p++) out.push({ kind: "changed", before: dels[p]!, after: inss[p]! });
    for (let p = paired; p < dels.length; p++) out.push({ kind: "removed", block: dels[p]! });
    for (let p = paired; p < inss.length; p++) out.push({ kind: "added", block: inss[p]! });
  }
  return out;
}

const WORD_TOKEN = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]|[\p{L}\p{N}_.%-]+|\s+|./gu;

/** Word-level diff for a changed block; CJK characters diff one by one. */
export function diffWords(before: string, after: string): DiffOp<string>[] {
  const ops = diffSequences(before.match(WORD_TOKEN) ?? [], after.match(WORD_TOKEN) ?? []);
  const merged: DiffOp<string>[] = [];
  for (const o of ops) {
    const last = merged[merged.length - 1];
    if (last && last.op === o.op) last.value += o.value;
    else merged.push({ ...o });
  }
  return merged;
}

/** Lines added/removed between two texts, ignoring blank lines. */
export function lineStats(before: string, after: string): { added: number; removed: number } {
  const keep = (s: string) => splitLines(s).filter((l) => l.trim() !== "");
  let added = 0;
  let removed = 0;
  for (const o of diffSequences(keep(before), keep(after))) {
    if (o.op === "ins") added++;
    else if (o.op === "del") removed++;
  }
  return { added, removed };
}

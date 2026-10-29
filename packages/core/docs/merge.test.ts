// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyTheirs,
  diffMarkdownBlocks,
  diffSequences,
  diffWords,
  lineStats,
  mergeText,
  revertVersion,
  splitMarkdownBlocks,
} from "./merge";

describe("diffSequences", () => {
  it("marks inserts and deletes around a common middle", () => {
    const ops = diffSequences(["a", "b", "c"], ["a", "x", "c", "d"]);
    expect(ops.map((o) => `${o.op}:${o.value}`)).toEqual(["eq:a", "del:b", "ins:x", "eq:c", "ins:d"]);
  });
});

describe("mergeText", () => {
  const base = "# Plan\n\nstep one\n\nstep two\n\nstep three";

  it("combines edits to different blocks", () => {
    const mine = base.replace("step one", "step 1");
    const theirs = base.replace("step three", "step 3");
    const result = mergeText(base, mine, theirs);
    expect(result.conflicts).toEqual([]);
    expect(result.text).toBe("# Plan\n\nstep 1\n\nstep two\n\nstep 3");
  });

  it("keeps mine and reports a conflict when both edit the same line", () => {
    const mine = base.replace("step two", "step deux");
    const theirs = base.replace("step two", "step zwei");
    const result = mergeText(base, mine, theirs);
    expect(result.text).toBe(mine);
    expect(result.conflicts).toEqual([{ mine: ["step deux"], theirs: ["step zwei"], base: ["step two"] }]);
    expect(applyTheirs(result.text, result.conflicts[0]!)).toBe(theirs);
  });

  it("treats identical edits on both sides as agreement", () => {
    const edited = base.replace("step two", "step 2");
    expect(mergeText(base, edited, edited)).toEqual({ text: edited, conflicts: [] });
  });

  it("takes theirs when mine did not change", () => {
    const theirs = `${base}\n\nstep four`;
    expect(mergeText(base, base, theirs).text).toBe(theirs);
  });

  it("returns null from applyTheirs once the contested lines were edited again", () => {
    expect(applyTheirs("other", { mine: ["gone"], theirs: ["x"], base: [] })).toBeNull();
  });
});

describe("revertVersion", () => {
  it("undoes one version while keeping later unrelated edits", () => {
    const v1 = "a\nb\nc";
    const v2 = "a\nB\nc";
    const current = "a\nB\nc\nd";
    expect(revertVersion(v1, v2, current)).toBe("a\nb\nc\nd");
  });

  it("refuses when later edits overlap the reverted lines", () => {
    expect(revertVersion("a\nb", "a\nB", "a\nBB")).toBeNull();
  });
});

describe("markdown blocks", () => {
  it("splits on blank lines and keeps fenced code whole", () => {
    const md = "# T\n\npara one\nstill one\n\n```go\nx := 1\n\ny := 2\n```\n\n- a\n- b";
    expect(splitMarkdownBlocks(md)).toEqual(["# T", "para one\nstill one", "```go\nx := 1\n\ny := 2\n```", "- a\n- b"]);
  });

  it("pairs a removed and added block as a change", () => {
    const changes = diffMarkdownBlocks("# T\n\nold text\n\nkeep", "# T\n\nnew text\n\nkeep\n\nmore");
    expect(changes).toEqual([
      { kind: "same", block: "# T" },
      { kind: "changed", before: "old text", after: "new text" },
      { kind: "same", block: "keep" },
      { kind: "added", block: "more" },
    ]);
  });

  it("word-diffs CJK per character", () => {
    const ops = diffWords("部署到生产", "部署到预发");
    expect(ops).toEqual([
      { op: "eq", value: "部署到" },
      { op: "del", value: "生产" },
      { op: "ins", value: "预发" },
    ]);
  });
});

describe("lineStats", () => {
  it("ignores blank lines", () => {
    expect(lineStats("a\nb", "a\n\nB\nc")).toEqual({ added: 2, removed: 1 });
  });
});

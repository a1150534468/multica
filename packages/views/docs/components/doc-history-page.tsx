"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, RotateCcw, Undo2 } from "@multica/ui/icons";
import { Button } from "@multica/ui/components/ui/button";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";
import {
  diffMarkdownBlocks,
  diffWords,
  docDetailOptions,
  docTreeOptions,
  docVersionOptions,
  docVersionsOptions,
  folderAncestry,
  isDocRevisionConflict,
  revertVersion,
  useUpdateDoc,
  type BlockChange,
} from "@multica/core/docs";
import { useWorkspaceId } from "@multica/core/hooks";
import { useWorkspacePaths } from "@multica/core/paths";
import { useActorName } from "@multica/core/workspace/hooks";
import type { Doc, DocVersion } from "@multica/core/types";
import { ActorAvatar } from "../../common/actor-avatar";
import { ReadonlyContent } from "../../editor";
import { BreadcrumbHeader } from "../../layout/breadcrumb-header";
import { AppLink, useNavigation } from "../../navigation";
import { useT, useTimeAgo } from "../../i18n";

/** A version pair to compare: `from` 0 means "before the doc existed". */
type Range = { from: number; to: number };

function useVersionContent(wsId: string, docId: string, number: number, latest: number) {
  return useQuery({
    ...docVersionOptions(wsId, docId, number, number === latest),
    enabled: number > 0,
  });
}

function WordDiff({ before, after }: { before: string; after: string }) {
  const ops = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <p className="whitespace-pre-wrap text-body leading-relaxed">
      {ops.map((op, i) =>
        op.op === "eq" ? (
          <span key={i}>{op.value}</span>
        ) : op.op === "ins" ? (
          <ins key={i} className="rounded-xs bg-success/15 text-success no-underline">
            {op.value}
          </ins>
        ) : (
          <del key={i} className="rounded-xs bg-destructive/10 text-destructive">
            {op.value}
          </del>
        ),
      )}
    </p>
  );
}

function BlockDiff({ changes, html }: { changes: BlockChange[]; html: boolean }) {
  const { t } = useT("docs");
  const render = (block: string) =>
    html ? (
      <pre className="whitespace-pre-wrap font-mono text-caption">{block}</pre>
    ) : (
      <ReadonlyContent content={block} />
    );
  if (changes.every((c) => c.kind === "same")) {
    return <p className="py-8 text-center text-caption text-muted-foreground">{t(($) => $.history.no_changes)}</p>;
  }
  return (
    <div className="space-y-2">
      {changes.map((change, i) => {
        switch (change.kind) {
          case "same":
            return (
              <div key={i} className="opacity-50">
                {render(change.block)}
              </div>
            );
          case "added":
            return (
              <div key={i} className="rounded-md border-l-2 border-success bg-success/5 px-3 py-1">
                {render(change.block)}
              </div>
            );
          case "removed":
            return (
              <div key={i} className="rounded-md border-l-2 border-destructive bg-destructive/5 px-3 py-1 line-through decoration-destructive/60">
                {render(change.block)}
              </div>
            );
          case "changed":
            return (
              <div key={i} className="rounded-md border-l-2 border-warning bg-warning/5 px-3 py-1.5">
                <WordDiff before={change.before} after={change.after} />
              </div>
            );
        }
      })}
    </div>
  );
}

function VersionRow({
  version,
  active,
  current,
  onSelect,
}: {
  version: DocVersion;
  active: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const { t } = useT("docs");
  const timeAgo = useTimeAgo();
  const { getActorName } = useActorName();
  const action =
    version.action === "restore"
      ? t(($) => $.history.restored, { number: version.action_ref ?? 0 })
      : version.action === "revert"
        ? t(($) => $.history.reverted, { number: version.action_ref ?? 0 })
        : version.action === "create"
          ? t(($) => $.history.created)
          : null;
  return (
    <li>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          active ? "bg-surface-selected" : "hover:bg-surface-hover",
        )}
      >
        <span className="flex items-center gap-2 text-body">
          <ActorAvatar actorType={version.author_type} actorId={version.author_id} size="xs" />
          <span className="min-w-0 flex-1 truncate font-medium">{getActorName(version.author_type, version.author_id)}</span>
          <span className="shrink-0 text-caption tabular-nums text-faint-foreground">
            {t(($) => $.version_number, { number: version.number })}
          </span>
        </span>
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          <span>{timeAgo(version.updated_at)}</span>
          {(version.lines_added > 0 || version.lines_removed > 0) && (
            <span className="tabular-nums">
              <span className="text-success">+{version.lines_added}</span>{" "}
              <span className="text-destructive">−{version.lines_removed}</span>
            </span>
          )}
          {current && <span className="rounded-xs bg-muted px-1 text-micro">{t(($) => $.history.current)}</span>}
        </span>
        {(version.message || action) && (
          <span className="line-clamp-2 text-caption text-foreground">
            {action && <span className="text-muted-foreground">{action}</span>}
            {action && version.message ? " · " : ""}
            {version.message}
          </span>
        )}
      </button>
    </li>
  );
}

function HistoryBody({ doc, versions, since }: { doc: Doc; versions: DocVersion[]; since: string | null }) {
  const { t } = useT("docs");
  const wsId = useWorkspaceId();
  const qc = useQueryClient();
  const update = useUpdateDoc();
  const latest = doc.version_count;

  // Arriving from "View changes" compares what was last seen with now.
  const initial = useMemo<Range>(() => {
    const seenAt = since ? Date.parse(since) : NaN;
    if (!Number.isNaN(seenAt)) {
      const seen = versions.filter((v) => Date.parse(v.updated_at) <= seenAt);
      return { from: seen.reduce((max, v) => Math.max(max, v.number), 0), to: latest };
    }
    return { from: latest - 1, to: latest };
  }, [since, versions, latest]);
  const [range, setRange] = useState<Range>(initial);
  const single = range.to - range.from === 1;

  const before = useVersionContent(wsId, doc.id, range.from, latest);
  const after = useVersionContent(wsId, doc.id, range.to, latest);
  const ready = (range.from === 0 || before.data) && after.data;
  const changes = useMemo(
    () => (ready ? diffMarkdownBlocks(before.data?.content ?? "", after.data?.content ?? "") : []),
    [ready, before.data, after.data],
  );

  const selected = versions.find((v) => v.number === range.to);

  const write = (body: { content?: string; action: "restore" | "revert"; action_ref: number }) => {
    update.mutate(
      { id: doc.id, base_revision: doc.revision, ...body },
      {
        onSuccess: () => {
          toast.success(body.action === "restore" ? t(($) => $.history.restore_done) : t(($) => $.history.revert_done));
          setRange({ from: latest, to: latest + 1 });
        },
        onError: (error) =>
          toast.error(
            isDocRevisionConflict(error)
              ? t(($) => $.history.changed_meanwhile)
              : error instanceof Error
                ? error.message
                : t(($) => $.errors.save),
          ),
      },
    );
  };

  const restore = () => write({ action: "restore", action_ref: range.to });

  const revert = async () => {
    try {
      const [parent, version] = await Promise.all([
        range.to > 1 ? qc.fetchQuery(docVersionOptions(wsId, doc.id, range.to - 1)) : Promise.resolve({ content: "" }),
        qc.fetchQuery(docVersionOptions(wsId, doc.id, range.to)),
      ]);
      const content = revertVersion(parent?.content ?? "", version?.content ?? "", doc.content);
      if (content === null) {
        toast.error(t(($) => $.history.revert_conflict));
        return;
      }
      write({ content, action: "revert", action_ref: range.to });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(($) => $.errors.save));
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-72 shrink-0 overflow-y-auto border-r p-2">
        <ul className="space-y-px">
          {versions.map((version) => (
            <VersionRow
              key={version.number}
              version={version}
              current={version.number === latest}
              active={single && range.to === version.number}
              onSelect={() => setRange({ from: version.number - 1, to: version.number })}
            />
          ))}
        </ul>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-6 py-2 text-caption">
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {single
              ? t(($) => $.history.comparing_version, { number: range.to })
              : t(($) => $.history.comparing_range, { from: range.from, to: range.to })}
          </span>
          {single && selected && range.to !== latest && (
            <Button size="xs" variant="outline" onClick={restore} disabled={update.isPending}>
              <RotateCcw className="size-3" />
              {t(($) => $.history.restore, { number: range.to })}
            </Button>
          )}
          {single && selected && (
            <Button size="xs" variant="outline" onClick={() => void revert()} disabled={update.isPending}>
              <Undo2 className="size-3" />
              {t(($) => $.history.revert)}
            </Button>
          )}
        </div>
        <div className="mx-auto w-full max-w-3xl px-6 py-6">
          {ready ? (
            <BlockDiff changes={changes} html={doc.format === "html"} />
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export function DocHistoryPage({ docId }: { docId: string }) {
  const { t } = useT("docs");
  const wsId = useWorkspaceId();
  const p = useWorkspacePaths();
  const { searchParams } = useNavigation();
  const since = searchParams.get("since");
  const { data: doc, error } = useQuery(docDetailOptions(wsId, docId));
  const { data: versions } = useQuery(docVersionsOptions(wsId, docId));
  const { data: tree } = useQuery(docTreeOptions(wsId));
  const folders = tree && doc ? folderAncestry(tree.folders, doc.folder_id) : [];

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="size-8 text-faint-foreground" />
        <p className="text-body font-medium">{t(($) => $.not_found.title)}</p>
        <AppLink href={p.docs()} className="text-caption text-brand hover:underline">
          {t(($) => $.not_found.back)}
        </AppLink>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BreadcrumbHeader
        segments={[
          { href: p.docs(), label: t(($) => $.kb) },
          ...folders.map((folder) => ({ href: p.docFolder(folder.id), label: folder.title })),
          ...(doc ? [{ href: p.docDetail(doc.id), label: doc.title || t(($) => $.untitled), className: "min-w-0 max-w-60 truncate" }] : []),
        ]}
        leaf={<span className="text-foreground">{t(($) => $.history.title)}</span>}
      />
      {doc && versions ? (
        <HistoryBody key={`${doc.id}:${since ?? ""}`} doc={doc} versions={versions} since={since} />
      ) : (
        <div className="space-y-3 p-6">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { splitFrontmatter } from "@multica/core/skills/frontmatter";
import { ContentEditor, type ContentEditorRef } from "../../editor";
import { RichContent } from "../../rich-content";
import { useT } from "../../i18n";

export function isMarkdownPath(path: string) {
  return path.endsWith(".md") || path.endsWith(".mdx");
}

/**
 * Body of a single skill file. Markdown opens in the same rich editor and
 * type scale as knowledge base docs, so there is no preview/source switch;
 * anything else (scripts, JSON, YAML) is edited as plain text.
 */
export function FileViewer({
  path,
  content,
  readOnly,
  autoFocus,
  onChange,
  onFocusHandled,
}: {
  path: string;
  content: string;
  readOnly: boolean;
  /** Put the caret in this file's editor once it renders (a just-added file). */
  autoFocus?: boolean;
  onChange: (content: string) => void;
  /** Called once the caret has landed, so the request is not replayed. */
  onFocusHandled?: () => void;
}) {
  if (isMarkdownPath(path)) {
    return (
      <MarkdownFile
        content={content}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onChange={onChange}
        onFocusHandled={onFocusHandled}
      />
    );
  }
  return (
    <PlainFile
      path={path}
      content={content}
      readOnly={readOnly}
      autoFocus={autoFocus}
      onChange={onChange}
      onFocusHandled={onFocusHandled}
    />
  );
}

/**
 * The frontmatter stays out of the editor — `name` and `description` are
 * edited in the side panel — and is put back byte for byte on every change,
 * along with the blank lines around the body, so editing a paragraph never
 * rewrites the parts of the file nobody touched.
 */
function MarkdownFile({
  content,
  readOnly,
  autoFocus,
  onChange,
  onFocusHandled,
}: {
  content: string;
  readOnly: boolean;
  autoFocus?: boolean;
  onChange: (content: string) => void;
  onFocusHandled?: () => void;
}) {
  const { t } = useT("skills");
  const editorRef = useRef<ContentEditorRef>(null);
  const { head, body } = splitFrontmatter(content);
  const lead = /^\n*/.exec(body)![0];
  const rest = body.slice(lead.length);
  const trail = /\n*$/.exec(rest)![0];
  const text = rest.slice(0, rest.length - trail.length);

  const focusRequested = useRef(autoFocus);
  focusRequested.current = autoFocus;
  const focusIfRequested = () => {
    if (!focusRequested.current || !editorRef.current) return;
    editorRef.current.focus();
    onFocusHandled?.();
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* pb-24 keeps the last lines readable under the floating save pill. */}
      <div className="prose-document mx-auto w-full max-w-3xl px-6 pt-8 pb-24 sm:px-10">
        {readOnly ? (
          <RichContent
            content={text || t(($) => $.file_viewer.no_content)}
            density="document"
            phase="settled"
          />
        ) : (
          <ContentEditor
            ref={editorRef}
            value={text}
            placeholder={t(($) => $.file_viewer.markdown_placeholder)}
            onUpdate={(markdown) => onChange(`${head}${lead}${markdown.replace(/^\n+|\n+$/g, "")}${trail}`)}
            onReady={focusIfRequested}
            debounceMs={150}
            flushPendingOnUnmount
            disableMentions
            className="min-h-[50vh]"
          />
        )}
      </div>
    </div>
  );
}

function PlainFile({
  path,
  content,
  readOnly,
  autoFocus,
  onChange,
  onFocusHandled,
}: {
  path: string;
  content: string;
  readOnly: boolean;
  autoFocus?: boolean;
  onChange: (content: string) => void;
  onFocusHandled?: () => void;
}) {
  const { t } = useT("skills");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus !== true || !ref.current) return;
    ref.current.focus();
    // Caret at the top: jumping to the end of a long file would scroll away
    // the content the user just opened.
    ref.current.setSelectionRange(0, 0);
    onFocusHandled?.();
  }, [autoFocus, onFocusHandled]);

  return (
    <Textarea
      ref={ref}
      value={content}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t(($) => $.file_viewer.raw_aria, { path })}
      placeholder={t(($) => $.file_viewer.raw_placeholder)}
      className="h-full min-h-full resize-none rounded-none border-0 px-6 pb-24 pt-5 font-mono text-body leading-relaxed read-only:cursor-default focus-visible:ring-0 sm:px-8"
    />
  );
}

"use client";

import { Plus } from "@multica/ui/icons";
import { openCreateIssueWithPreference } from "@multica/core/issues/stores/create-mode-store";
import { CollectionPageHeaderAction } from "../../layout/collection-page";
import { useT } from "../../i18n";

/** The page-level "New issue" button on issue list pages. */
export function NewIssueHeaderAction({ className }: { className?: string }) {
  const { t } = useT("layout");
  return (
    <CollectionPageHeaderAction
      icon={Plus}
      label={t(($) => $.sidebar.new_issue)}
      className={className}
      onClick={() => openCreateIssueWithPreference()}
    />
  );
}

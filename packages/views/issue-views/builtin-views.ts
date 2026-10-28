"use client";

import { useCallback } from "react";
import { useWorkspaceId } from "@multica/core/hooks";
import { useWorkspacePaths } from "@multica/core/paths";
import { myIssuesViewStore } from "@multica/core/issues/stores/my-issues-view-store";
import { issueViewContainerKey, useActiveIssueViewStore } from "@multica/core/issue-views/active-view-store";
import type { BuiltinViewKey } from "@multica/core/issue-views/sidebar-views";

const WORKSPACE_SCOPE = { scope_type: "workspace" } as const;
const MY_SCOPE = { scope_type: "my" } as const;

/**
 * Where a built-in view lives, and the store writes that make its page show
 * it rather than whichever saved view or My issues relation was left open.
 */
export function useBuiltinViewNavigation() {
  const wsId = useWorkspaceId();
  const p = useWorkspacePaths();
  const setActive = useActiveIssueViewStore((s) => s.setActive);

  const hrefFor = useCallback(
    (key: BuiltinViewKey) => (key === "all_issues" ? p.issues() : p.myIssues()),
    [p],
  );

  const prepare = useCallback(
    (key: BuiltinViewKey) => {
      if (key === "all_issues") {
        setActive(issueViewContainerKey(wsId, WORKSPACE_SCOPE), null);
        return;
      }
      setActive(issueViewContainerKey(wsId, MY_SCOPE), null);
      const { scope, setScope } = myIssuesViewStore.getState();
      if (key === "my_agents") setScope("agents");
      else if (scope === "agents") setScope("assigned");
    },
    [setActive, wsId],
  );

  return { hrefFor, prepare };
}

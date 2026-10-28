"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createWorkspaceAwareStorage, registerForWorkspaceRehydration } from "../../platform/workspace-storage";
import { defaultStorage } from "../../platform/storage";

/**
 * Projects expanded in the sidebar, per workspace. Only expanded ids are
 * stored — collapsed is the default.
 */
interface ProjectSidebarExpandState {
  expandedIds: string[];
  setExpanded: (projectId: string, expanded: boolean) => void;
}

export const useProjectSidebarExpandStore = create<ProjectSidebarExpandState>()(
  persist(
    (set) => ({
      expandedIds: [],
      setExpanded: (projectId, expanded) =>
        set((s) => {
          if (s.expandedIds.includes(projectId) === expanded) return s;
          return {
            expandedIds: expanded
              ? [...s.expandedIds, projectId]
              : s.expandedIds.filter((id) => id !== projectId),
          };
        }),
    }),
    {
      name: "multica_project_sidebar_expanded",
      storage: createJSONStorage(() => createWorkspaceAwareStorage(defaultStorage)),
      partialize: (state) => ({ expandedIds: state.expandedIds }),
    },
  ),
);

registerForWorkspaceRehydration(() => useProjectSidebarExpandStore.persist.rehydrate());

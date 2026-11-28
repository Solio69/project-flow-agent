import { isBoolean, isRecord, isString } from "../../../../shared/lib";
import type { LinkedTaskGroup } from "../linked-tasks";
import { COLLAPSED_PROJECTS_SETTING, DEFAULT_SHOW_COMPLETED, SHOW_COMPLETED_SETTING } from "./constants";
import { collectTaskPanels } from "./task-panels";

type PreferencesListener = () => void;
type PluginSettings = Record<string, unknown>;

type PreferencesSnapshot = { showCompleted: boolean; collapsedProjects: ReadonlySet<string> };
export type SetCompletedVisible = (isVisible: boolean) => Promise<void>;
export type SetProjectsCollapsed = (projectKeys: readonly string[], isCollapsed: boolean) => Promise<void>;

export type ViewPreferences = {
  get: () => PreferencesSnapshot;
  setCompletedVisible: SetCompletedVisible;
  setProjectsCollapsed: SetProjectsCollapsed;
  migrateCollapsedProjects: (groups: readonly LinkedTaskGroup[]) => Promise<void>;
  subscribe: (listener: PreferencesListener) => () => void;
};

export function createViewPreferences(
  data: unknown,
  save: (settings: PluginSettings) => Promise<void>,
  onSaveError: (error: unknown) => void,
): ViewPreferences {
  let settings: PluginSettings = isRecord(data) ? { ...data } : {};
  const { [SHOW_COMPLETED_SETTING]: savedVisibility, [COLLAPSED_PROJECTS_SETTING]: savedProjects } = settings;
  const collapsedProjects = new Set<string>(Array.isArray(savedProjects) ? savedProjects.filter(isString) : []);
  let snapshot: PreferencesSnapshot = {
    showCompleted: isBoolean(savedVisibility) ? savedVisibility : DEFAULT_SHOW_COMPLETED,
    collapsedProjects,
  };
  let pendingSave = Promise.resolve();
  const listeners = new Set<PreferencesListener>();

  function update(next: PreferencesSnapshot, values: PluginSettings) {
    snapshot = next;
    settings = { ...settings, ...values };
    const toSave = settings;
    pendingSave = pendingSave.then(() => save(toSave)).catch(onSaveError);
    for (const listener of listeners) listener();
    return pendingSave;
  }

  function updateCollapsedProjects(next: ReadonlySet<string>) {
    return update({ ...snapshot, collapsedProjects: next }, { [COLLAPSED_PROJECTS_SETTING]: [...next] });
  }

  return {
    get: () => snapshot,
    setCompletedVisible(isVisible) {
      if (isVisible === snapshot.showCompleted) return pendingSave;
      return update({ ...snapshot, showCompleted: isVisible }, { [SHOW_COMPLETED_SETTING]: isVisible });
    },
    setProjectsCollapsed(projectKeys, isCollapsed) {
      const { collapsedProjects: previouslyCollapsed } = snapshot;
      const isAlreadyApplied = projectKeys.every((key) => previouslyCollapsed.has(key) === isCollapsed);
      if (isAlreadyApplied) return pendingSave;
      const nextCollapsedProjects = new Set(previouslyCollapsed);
      for (const key of projectKeys) {
        if (isCollapsed) nextCollapsedProjects.add(key);
        else nextCollapsedProjects.delete(key);
      }
      return updateCollapsedProjects(nextCollapsedProjects);
    },
    migrateCollapsedProjects(groups) {
      const { collapsedProjects: previouslyCollapsed } = snapshot;
      if (!previouslyCollapsed.size) return pendingSave;
      const { projectPanels } = collectTaskPanels(groups);
      const legacyPanels = projectPanels.filter(({ legacyKey }) => previouslyCollapsed.has(legacyKey));
      if (!legacyPanels.length) return pendingSave;

      const nextCollapsedProjects = new Set(previouslyCollapsed);
      for (const { legacyKey, key } of legacyPanels) {
        nextCollapsedProjects.delete(legacyKey);
        nextCollapsedProjects.add(key);
      }
      return updateCollapsedProjects(nextCollapsedProjects);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

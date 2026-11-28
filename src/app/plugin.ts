import { Notice, Plugin } from "obsidian";
import { createViewPreferences, CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW, CurrentTasksView } from "../pages/current-tasks";
import { WORKSPACE_TAB } from "../shared/api/obsidian";
import { CURRENT_TASKS_ICON, ERROR_COPY } from "./plugin.constants";

const { openViewLog, openViewNotice, loadSettingsLog, savePreferencesLog, savePreferencesNotice } = ERROR_COPY;

export default class ProjectFlowAgentPlugin extends Plugin {
  private opening?: Promise<void>;

  async onload(): Promise<void> {
    const savedSettings: unknown = await this.loadData().catch((error: unknown) => {
      console.error(loadSettingsLog, error);
      return undefined;
    });
    const preferences = createViewPreferences(
      savedSettings,
      (settings) => this.saveData(settings),
      (error) => {
        console.error(savePreferencesLog, error);
        new Notice(savePreferencesNotice);
      },
    );
    this.registerView(CURRENT_TASKS_VIEW, (leaf) => new CurrentTasksView(leaf, preferences));
    this.addRibbonIcon(CURRENT_TASKS_ICON, CURRENT_TASKS_TITLE, () => {
      this.opening ??= this.openCurrentTasks()
        .catch((error: unknown) => {
          console.error(openViewLog, error);
          new Notice(openViewNotice);
        })
        .finally(() => {
          this.opening = undefined;
        });
      return this.opening;
    });
  }

  private async openCurrentTasks(): Promise<void> {
    const { workspace } = this.app;
    let [leaf] = workspace.getLeavesOfType(CURRENT_TASKS_VIEW);
    if (!leaf) {
      leaf = workspace.getLeaf(WORKSPACE_TAB);
      try {
        await leaf.setViewState({ type: CURRENT_TASKS_VIEW, active: true });
      } catch (error) {
        leaf.detach();
        throw error;
      }
    }
    await workspace.revealLeaf(leaf);
  }
}

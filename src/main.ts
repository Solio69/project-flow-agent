import { Notice, Plugin } from "obsidian";
import { createCompletedVisibility } from "./current-tasks/completed-visibility";
import { CurrentTasksView } from "./current-tasks/current-tasks-view";
import { CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW } from "./current-tasks/current-tasks.constants";
import { CURRENT_TASKS_ICON, ERROR_COPY } from "./main.constants";
import { WORKSPACE_TAB } from "./obsidian/constants";

const { openViewLog, openViewNotice, loadSettingsLog, saveVisibilityLog, saveVisibilityNotice } = ERROR_COPY;

export default class ProjectFlowAgentPlugin extends Plugin {
  private opening?: Promise<void>;

  async onload(): Promise<void> {
    const savedSettings: unknown = await this.loadData().catch((error: unknown) => {
      console.error(loadSettingsLog, error);
      return undefined;
    });
    const completedVisibility = createCompletedVisibility(
      savedSettings,
      (settings) => this.saveData(settings),
      (error) => {
        console.error(saveVisibilityLog, error);
        new Notice(saveVisibilityNotice);
      },
    );
    this.registerView(CURRENT_TASKS_VIEW, (leaf) => new CurrentTasksView(leaf, completedVisibility));
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

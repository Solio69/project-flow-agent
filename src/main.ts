import { Notice, Plugin } from "obsidian";
import { CurrentTasksView } from "./current-tasks/current-tasks-view";
import { CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW } from "./current-tasks/current-tasks.constants";
import { CURRENT_TASKS_ICON, ERROR_COPY } from "./main.constants";
import { WORKSPACE_TAB } from "./obsidian/constants";

const { openViewLog, openViewNotice } = ERROR_COPY;

export default class ProjectFlowAgentPlugin extends Plugin {
  private opening?: Promise<void>;

  onload(): void {
    this.registerView(CURRENT_TASKS_VIEW, (leaf) => new CurrentTasksView(leaf));
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

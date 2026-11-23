import { Notice, Plugin } from "obsidian";
import {
  CURRENT_ACTIONS_TITLE,
  CURRENT_ACTIONS_VIEW,
  CurrentActionsView,
} from "./current-actions/current-actions-view";

export default class ProjectFlowAgentPlugin extends Plugin {
  private opening?: Promise<void>;

  onload(): void {
    this.registerView(CURRENT_ACTIONS_VIEW, (leaf) => new CurrentActionsView(leaf));
    this.addRibbonIcon("list-checks", CURRENT_ACTIONS_TITLE, () => {
      this.opening ??= this.openCurrentActions()
        .catch((error: unknown) => {
          console.error("Project Flow Agent: открытие вкладки", error);
          new Notice("Не удалось открыть «Текущие действия».");
        })
        .finally(() => {
          this.opening = undefined;
        });
      return this.opening;
    });
  }

  private async openCurrentActions(): Promise<void> {
    const { workspace } = this.app;
    let [leaf] = workspace.getLeavesOfType(CURRENT_ACTIONS_VIEW);
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      try {
        await leaf.setViewState({ type: CURRENT_ACTIONS_VIEW, active: true });
      } catch (error) {
        leaf.detach();
        throw error;
      }
    }
    await workspace.revealLeaf(leaf);
  }
}

import { Notice, Plugin } from "obsidian";
import { CurrentActionsView } from "./current-actions/current-actions-view";
import { CURRENT_ACTIONS_TITLE, CURRENT_ACTIONS_VIEW } from "./current-actions/current-actions.constants";
import { CURRENT_ACTIONS_ICON, ERROR_COPY } from "./main.constants";
import { WORKSPACE_TAB } from "./obsidian/constants";

const { openViewLog, openViewNotice } = ERROR_COPY;

export default class ProjectFlowAgentPlugin extends Plugin {
  private opening?: Promise<void>;

  onload(): void {
    this.registerView(CURRENT_ACTIONS_VIEW, (leaf) => new CurrentActionsView(leaf));
    this.addRibbonIcon(CURRENT_ACTIONS_ICON, CURRENT_ACTIONS_TITLE, () => {
      this.opening ??= this.openCurrentActions()
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

  private async openCurrentActions(): Promise<void> {
    const { workspace } = this.app;
    let [leaf] = workspace.getLeavesOfType(CURRENT_ACTIONS_VIEW);
    if (!leaf) {
      leaf = workspace.getLeaf(WORKSPACE_TAB);
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

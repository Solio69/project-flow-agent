import { ItemView } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { CurrentActions } from "./CurrentActions";

export const CURRENT_ACTIONS_VIEW = "project-flow-agent-current-actions";
export const CURRENT_ACTIONS_TITLE = "Текущие действия";

export class CurrentActionsView extends ItemView {
  private root?: Root;

  getViewType(): string {
    return CURRENT_ACTIONS_VIEW;
  }

  getDisplayText(): string {
    return CURRENT_ACTIONS_TITLE;
  }

  async onOpen(): Promise<void> {
    this.root ??= createRoot(this.contentEl);
    this.root.render(<CurrentActions title={CURRENT_ACTIONS_TITLE} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = undefined;
  }
}

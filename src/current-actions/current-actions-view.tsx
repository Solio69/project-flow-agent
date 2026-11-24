import { ItemView, Notice } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import {
  CURRENT_ACTIONS_STATE,
  CurrentActions,
  isKindReady,
  type CurrentActionsState,
} from "./CurrentActions";
import { ERROR_COPY } from "./current-actions-view.constants";
import { CURRENT_ACTIONS_TITLE, CURRENT_ACTIONS_VIEW } from "./current-actions.constants";
import {
  openLinkedNote,
  readCurrentActions,
  watchCurrentActions,
} from "./obsidian-current-actions";

const { loading, error: errorState, ready } = CURRENT_ACTIONS_STATE;
const { sourceMissing, sourceUnreadable, noteOpenFailed, readLog, openLog } = ERROR_COPY;

export class CurrentActionsView extends ItemView {
  navigation = true;

  private root?: Root;
  private stopWatching?: () => void;
  private relatedPaths = new Set<string>();
  private revision = 0;

  getViewType(): string {
    return CURRENT_ACTIONS_VIEW;
  }

  getDisplayText(): string {
    return CURRENT_ACTIONS_TITLE;
  }

  async onOpen(): Promise<void> {
    this.root ??= createRoot(this.contentEl);
    this.render({ kind: loading });
    this.stopWatching ??= watchCurrentActions(this.app, (path) => this.relatedPaths.has(path), () => {
      void this.refresh();
    });
    await this.refresh();
  }

  async onClose(): Promise<void> {
    this.revision++;
    this.stopWatching?.();
    this.stopWatching = undefined;
    this.relatedPaths.clear();
    this.root?.unmount();
    this.root = undefined;
  }

  private async refresh(): Promise<void> {
    const revision = ++this.revision;
    let state: CurrentActionsState;
    try {
      const document = await readCurrentActions(this.app);
      state = document ? { kind: ready, document } : { kind: errorState, message: sourceMissing };
    } catch (error) {
      console.error(readLog, error);
      state = { kind: errorState, message: sourceUnreadable };
    }

    if (revision !== this.revision || !this.root) return;
    this.relatedPaths.clear();
    if (isKindReady(state)) {
      const { groups } = state.document;
      for (const { notePath, tasks } of groups) {
        if (notePath) this.relatedPaths.add(notePath);
        for (const { notePath: taskPath } of tasks) {
          if (taskPath) this.relatedPaths.add(taskPath);
        }
      }
    }
    this.render(state);
  }

  private render(state: CurrentActionsState): void {
    const onOpenNote = async (link: string, forceNewTab = false) => {
      if (!isKindReady(state)) return;
      const { sourcePath } = state.document;
      try {
        await openLinkedNote(this.app, this.leaf, sourcePath, link, forceNewTab);
      } catch (error) {
        console.error(openLog, error);
        new Notice(noteOpenFailed);
      }
    };
    this.root?.render(<CurrentActions title={CURRENT_ACTIONS_TITLE} state={state} onOpenNote={onOpenNote} />);
  }
}

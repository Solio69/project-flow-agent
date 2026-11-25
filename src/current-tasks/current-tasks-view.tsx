import { ItemView, Notice } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import {
  CURRENT_TASKS_STATE,
  CurrentTasks,
  isKindReady,
  type CurrentTasksState,
} from "./CurrentTasks";
import { ERROR_COPY } from "./current-tasks-view.constants";
import { CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW, TASKS_FORMAT } from "./current-tasks.constants";
import {
  openLinkedNote,
  readCurrentTasks,
  setTaskCompletion,
  watchCurrentTasks,
} from "./obsidian-current-tasks";
import { TaskCompletionError, type SetCompleted } from "./task-completion";

const { loading, error: errorState, ready } = CURRENT_TASKS_STATE;
const { sourceMissing, sourceUnreadable, noteOpenFailed, readLog, openLog, completionLog, completionFailed } = ERROR_COPY;

export class CurrentTasksView extends ItemView {
  navigation = true;

  private root?: Root;
  private stopWatching?: () => void;
  private relatedPaths = new Set<string>();
  private revision = 0;
  private completionInFlight = false;

  getViewType(): string {
    return CURRENT_TASKS_VIEW;
  }

  getDisplayText(): string {
    return CURRENT_TASKS_TITLE;
  }

  async onOpen(): Promise<void> {
    this.root ??= createRoot(this.contentEl);
    this.render({ kind: loading });
    this.stopWatching ??= watchCurrentTasks(this.app, (path) => this.relatedPaths.has(path), () => {
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
    let state: CurrentTasksState;
    try {
      const document = await readCurrentTasks(this.app);
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

  private render(state: CurrentTasksState): void {
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

    const onSetCompleted = this.completionHandler(state);
    this.root?.render(<CurrentTasks title={CURRENT_TASKS_TITLE} state={state} onOpenNote={onOpenNote} onSetCompleted={onSetCompleted} />);
  }

  private completionHandler(state: CurrentTasksState): SetCompleted | undefined {
    if (this.completionInFlight || !isKindReady(state)) return;
    const { document } = state;
    const { format, period } = document;
    if (format !== TASKS_FORMAT.properties || !period) return;

    return async (task, completed) => {
      if (this.completionInFlight || !this.root) return;
      this.completionInFlight = true;
      this.render(state);
      try {
        await setTaskCompletion(this.app, document, task, completed);
      } catch (error) {
        if (error instanceof TaskCompletionError) {
          new Notice(error.message);
        } else {
          console.error(completionLog, error);
          new Notice(completionFailed);
        }
      } finally {
        this.completionInFlight = false;
        if (this.root) await this.refresh();
      }
    };
  }
}

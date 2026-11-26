import { ItemView, Notice } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import {
  CURRENT_TASKS_STATE,
  CurrentTasks,
  isKindReady,
  type CurrentTasksState,
} from "./CurrentTasks";
import { ERROR_COPY } from "./current-tasks-view.constants";
import { CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW } from "./current-tasks.constants";
import {
  moveCurrentTask,
  openLinkedNote,
  readCurrentTasks,
  setTaskCompletion,
  watchCurrentTasks,
} from "./obsidian-current-tasks";
import type { SetCompleted } from "./task-completion";
import { isEditableList, TaskEditError } from "./task-edit";
import type { MoveTask } from "./task-move";

const { loading, error: errorState, ready } = CURRENT_TASKS_STATE;
const {
  sourceMissing, sourceUnreadable, noteOpenFailed, readLog, openLog,
  completionLog, completionFailed, moveLog, moveFailed,
} = ERROR_COPY;

type TaskEditHandlers = { onSetCompleted?: SetCompleted; onMoveTask?: MoveTask };

export class CurrentTasksView extends ItemView {
  navigation = true;

  private root?: Root;
  private stopWatching?: () => void;
  private relatedPaths = new Set<string>();
  private revision = 0;
  private editInFlight = false;

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

    const { onSetCompleted, onMoveTask } = this.taskEditHandlers(state);
    this.root?.render(
      <CurrentTasks
        title={CURRENT_TASKS_TITLE}
        state={state}
        onOpenNote={onOpenNote}
        onSetCompleted={onSetCompleted}
        onMoveTask={onMoveTask}
      />,
    );
  }

  private taskEditHandlers(state: CurrentTasksState): TaskEditHandlers {
    if (this.editInFlight || !isKindReady(state)) return {};
    const { document } = state;
    if (!isEditableList(document)) return {};

    return {
      onSetCompleted: (task, completed) => this.runTaskEdit(
        state, () => setTaskCompletion(this.app, document, task, completed), completionLog, completionFailed,
      ),
      onMoveTask: (task) => this.runTaskEdit(
        state, () => moveCurrentTask(this.app, document, task), moveLog, moveFailed,
      ),
    };
  }

  private async runTaskEdit(state: CurrentTasksState, edit: () => Promise<void>, log: string, message: string) {
    if (this.editInFlight || !this.root) return;
    this.editInFlight = true;
    this.render(state);
    try {
      await edit();
    } catch (error) {
      if (error instanceof TaskEditError) {
        new Notice(error.message);
      } else {
        console.error(log, error);
        new Notice(message);
      }
    } finally {
      this.editInFlight = false;
      if (this.root) await this.refresh();
    }
  }
}

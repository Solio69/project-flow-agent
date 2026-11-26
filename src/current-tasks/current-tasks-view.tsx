import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import {
  CURRENT_TASKS_STATE,
  CurrentTasks,
  isKindReady,
  type CurrentTasksState,
} from "./CurrentTasks";
import type { CompletedVisibility } from "./completed-visibility";
import { ERROR_COPY } from "./current-tasks-view.constants";
import { CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW } from "./current-tasks.constants";
import {
  createCurrentTask,
  moveCurrentTask,
  openCurrentTasksSource,
  openLinkedNote,
  readCurrentTasks,
  renameCurrentTask,
  reorderCurrentTask,
  setTaskCompletion,
  transferCurrentTask,
  watchCurrentTasks,
} from "./obsidian-current-tasks";
import type { SetCompleted } from "./task-completion";
import { PartialTaskCreation, TASK_CREATE_COPY, type CreateTask, type CreateTaskResult } from "./task-create";
import { isEditableList, TaskEditError } from "./task-edit";
import type { MoveTask } from "./task-move";
import { RenameTaskSourceChanged, TASK_RENAME_COPY, type RenameTask, type RenameTaskResult } from "./task-rename";
import { PartialTaskTransfer, TASK_TRANSFER_COPY, type TransferTask, type TransferTaskResult } from "./task-transfer";
import type { ReorderTask } from "./task-reorder";

const { loading, error: errorState, ready } = CURRENT_TASKS_STATE;
const {
  sourceMissing, sourceUnreadable, noteOpenFailed, readLog, openLog,
  completionLog, completionFailed, moveLog, moveFailed, reorderLog, reorderFailed, createLog, renameLog, transferLog,
} = ERROR_COPY;
const { failed: createFailed, busy } = TASK_CREATE_COPY;
const { failed: renameFailed } = TASK_RENAME_COPY;
const { failed: transferFailed } = TASK_TRANSFER_COPY;

type TaskEditHandlers = {
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTask;
  onReorderTask?: ReorderTask;
  onCreateTask?: CreateTask;
  onRenameTask?: RenameTask;
  onTransferTask?: TransferTask;
};

export class CurrentTasksView extends ItemView {
  navigation = true;

  private root?: Root;
  private stopWatching?: () => void;
  private relatedPaths = new Set<string>();
  private revision = 0;
  private editInFlight = false;

  constructor(leaf: WorkspaceLeaf, private readonly completedVisibility: CompletedVisibility) {
    super(leaf);
  }

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
      if (!this.editInFlight) void this.refresh();
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
      await this.openNote(() => openLinkedNote(this.app, this.leaf, sourcePath, link, forceNewTab));
    };
    const onOpenSource = async () => {
      if (!isKindReady(state)) return;
      const { sourcePath } = state.document;
      await this.openNote(() => openCurrentTasksSource(this.app, sourcePath));
    };

    this.root?.render(
      <CurrentTasks
        title={CURRENT_TASKS_TITLE}
        state={state}
        completedVisibility={this.completedVisibility}
        onOpenNote={onOpenNote}
        onOpenSource={onOpenSource}
        {...this.taskEditHandlers(state)}
      />,
    );
  }

  private async openNote(open: () => Promise<void>) {
    try {
      await open();
    } catch (error) {
      console.error(openLog, error);
      new Notice(noteOpenFailed);
    }
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
      onReorderTask: (task, destinationLine) => this.runTaskEdit(
        state, () => reorderCurrentTask(this.app, document, task, destinationLine), reorderLog, reorderFailed,
      ),
      onCreateTask: async (request) => {
        const result = await this.withTaskEdit<CreateTaskResult>(state, async () => {
          try {
            const taskPath = await createCurrentTask(this.app, document, request);
            return { ok: true, taskPath };
          } catch (error) {
            if (error instanceof PartialTaskCreation)
              return { ok: false, message: error.message, pending: error.receipt };
            if (error instanceof TaskEditError)
              return { ok: false, message: error.message, pending: request.pending };
            console.error(createLog, error);
            return { ok: false, message: createFailed, pending: request.pending };
          }
        });
        return result ?? { ok: false, message: busy, pending: request.pending };
      },
      onRenameTask: async (request) => {
        const result = await this.withTaskEdit<RenameTaskResult>(state, async () => {
          try {
            const taskPath = await renameCurrentTask(this.app, document, request);
            return { ok: true, taskPath };
          } catch (error) {
            if (error instanceof RenameTaskSourceChanged)
              return { ok: false, message: error.message, latestSourceMarkdown: error.sourceMarkdown };
            if (error instanceof TaskEditError) return { ok: false, message: error.message };
            console.error(renameLog, error);
            return { ok: false, message: renameFailed };
          }
        });
        return result ?? { ok: false, message: busy };
      },
      onTransferTask: async (request) => {
        const result = await this.withTaskEdit<TransferTaskResult>(state, async () => {
          try {
            const taskPath = await transferCurrentTask(this.app, document, request);
            return { ok: true, taskPath };
          } catch (error) {
            if (error instanceof PartialTaskTransfer)
              return { ok: false, message: error.message, pending: error.receipt };
            if (error instanceof TaskEditError)
              return { ok: false, message: error.message, pending: request.pending };
            console.error(transferLog, error);
            return { ok: false, message: transferFailed, pending: request.pending };
          }
        });
        return result ?? { ok: false, message: busy, pending: request.pending };
      },
    };
  }

  private async runTaskEdit(state: CurrentTasksState, edit: () => Promise<void>, log: string, message: string) {
    await this.withTaskEdit(state, async () => {
      try {
        await edit();
      } catch (error) {
        if (error instanceof TaskEditError) {
          new Notice(error.message);
        } else {
          console.error(log, error);
          new Notice(message);
        }
      }
    });
  }

  private async withTaskEdit<T>(state: CurrentTasksState, edit: () => Promise<T>) {
    if (this.editInFlight || !this.root) return;
    this.editInFlight = true;
    this.revision++;
    this.render(state);
    try {
      return await edit();
    } finally {
      this.editInFlight = false;
      if (this.root) await this.refresh();
    }
  }
}

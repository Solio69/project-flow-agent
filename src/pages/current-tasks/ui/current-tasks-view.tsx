import { ItemView, Notice, type WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { SPACE } from "../../../shared/lib";
import { CurrentTasks } from "./CurrentTasks";
import type { CompletedVisibility } from "../model/completed-visibility";
import { ERROR_COPY } from "./current-tasks-view.constants";
import { CURRENT_TASKS_TITLE, CURRENT_TASKS_VIEW } from "../model/current-tasks.constants";
import {
  archiveCurrentTask,
  changeTaskPeriod,
  copyTaskPath,
  createCurrentTask,
  duplicateCurrentTask,
  moveCurrentTask,
  openCurrentTasksSource,
  openLinkedNote,
  readCurrentTasks,
  renameCurrentTask,
  reorderCurrentTask,
  setTaskCompletion,
  transferCurrentTask,
  watchCurrentTasks,
} from "../api";
import { PartialTaskArchive, TASK_ARCHIVE_COPY, type ArchiveTask, type ArchiveTaskResult } from "../model/task-archive";
import type { SetCompleted } from "../model/task-completion";
import { PartialTaskCreation, TASK_CREATE_COPY, type CreateTask, type CreatedTaskReceipt, type CreateTaskResult } from "../model/task-create";
import { DUPLICATE_TASK_COPY, type DuplicateTask } from "../model/task-duplicate";
import { isEditableList, TaskEditError } from "../model/task-edit";
import type { MoveTask } from "../model/task-move";
import { NOTE_PATH_COPY, type CopyTaskPath } from "../model/task-note-path";
import { PERIOD_WRITE_COPY, type ChangePeriod, type PeriodChangeResult } from "../model/task-period";
import { RenameTaskSourceChanged, TASK_RENAME_COPY, type RenameTask, type RenameTaskResult } from "../model/task-rename";
import { PartialTaskTransfer, TASK_TRANSFER_COPY, type TransferTask, type TransferTaskResult } from "../model/task-transfer";
import type { ReorderTask } from "../model/task-reorder";
import { isKindReady, type CurrentTasksState } from "../model/view-state";
import { CURRENT_TASKS_STATE } from "../model/view-state.constants";

const { loading, error: errorState, ready } = CURRENT_TASKS_STATE;
const {
  sourceMissing, sourceUnreadable, noteOpenFailed, readLog, openLog, periodLog, copyPathLog, duplicateLog,
  completionLog, completionFailed, moveLog, moveFailed, reorderLog, reorderFailed, createLog, renameLog, transferLog, archiveLog,
} = ERROR_COPY;
const { failed: createFailed, busy } = TASK_CREATE_COPY;
const { failed: renameFailed } = TASK_RENAME_COPY;
const { failed: transferFailed } = TASK_TRANSFER_COPY;
const { failed: archiveFailed } = TASK_ARCHIVE_COPY;
const { failed: periodFailed, staleDraft } = PERIOD_WRITE_COPY;
const { success: copiedPath, failed: copyPathFailed } = NOTE_PATH_COPY;
const { success: duplicated, retry: retryDuplicate, failed: duplicateFailed } = DUPLICATE_TASK_COPY;

type TaskEditHandlers = {
  onChangePeriod?: ChangePeriod;
  onSetCompleted?: SetCompleted;
  onMoveTask?: MoveTask;
  onReorderTask?: ReorderTask;
  onCreateTask?: CreateTask;
  onRenameTask?: RenameTask;
  onTransferTask?: TransferTask;
  onArchiveTask?: ArchiveTask;
  onDuplicateTask?: DuplicateTask;
};

export class CurrentTasksView extends ItemView {
  navigation = true;

  private root?: Root;
  private stopWatching?: () => void;
  private relatedPaths = new Set<string>();
  private revision = 0;
  private isEditInFlight = false;
  private readonly pendingDuplicates = new Map<string, CreatedTaskReceipt>();

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
      if (!this.isEditInFlight) void this.refresh();
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
    const onCopyTaskPath: CopyTaskPath = async (task, clipboard) => {
      if (!isKindReady(state)) return;
      const { document: { sourcePath } } = state;
      try {
        await copyTaskPath(this.app, sourcePath, task, clipboard);
        new Notice(copiedPath);
      } catch (error) {
        if (error instanceof TaskEditError) {
          new Notice(error.message);
        } else {
          console.error(copyPathLog, error);
          new Notice(copyPathFailed);
        }
      }
    };

    this.root?.render(
      <CurrentTasks
        title={CURRENT_TASKS_TITLE}
        state={state}
        completedVisibility={this.completedVisibility}
        onOpenNote={onOpenNote}
        onOpenSource={onOpenSource}
        onCopyTaskPath={onCopyTaskPath}
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
    if (this.isEditInFlight || !isKindReady(state)) return {};
    const { document } = state;
    const { isPeriodEditable, sourcePath, sourceMarkdown } = document;
    const onChangePeriod: ChangePeriod | undefined = isPeriodEditable ? async (period, expectedSource) => {
      if (expectedSource) {
        const { sourcePath: expectedPath, sourceMarkdown: expectedMarkdown } = expectedSource;
        if (expectedPath !== sourcePath || expectedMarkdown !== sourceMarkdown)
          return { ok: false, message: staleDraft };
      }
      const result = await this.withTaskEdit<PeriodChangeResult>(state, async () => {
        try {
          await changeTaskPeriod(this.app, document, period);
          return { ok: true };
        } catch (error) {
          if (error instanceof TaskEditError) return { ok: false, message: error.message };
          console.error(periodLog, error);
          return { ok: false, message: periodFailed };
        }
      });
      return result ?? { ok: false, message: busy };
    } : undefined;
    if (!isEditableList(document)) return { onChangePeriod };

    return {
      onChangePeriod,
      onSetCompleted: (task, completed) => this.runTaskEdit(
        state, () => setTaskCompletion(this.app, document, task, completed), completionLog, completionFailed,
      ),
      onMoveTask: (task) => this.runTaskEdit(
        state, () => moveCurrentTask(this.app, document, task), moveLog, moveFailed,
      ),
      onReorderTask: (task, destinationLine) => this.runTaskEdit(
        state, () => reorderCurrentTask(this.app, document, task, destinationLine), reorderLog, reorderFailed,
      ),
      onDuplicateTask: (task) => this.withTaskEdit(state, async () => {
        const { id } = task;
        const pending = this.pendingDuplicates.get(id);
        try {
          const path = await duplicateCurrentTask(this.app, document, task, pending);
          this.pendingDuplicates.delete(id);
          new Notice(duplicated);
          return path;
        } catch (error) {
          if (error instanceof PartialTaskCreation) {
            this.pendingDuplicates.set(id, error.receipt);
            new Notice(`${error.message}${SPACE}${retryDuplicate}`);
          } else if (error instanceof TaskEditError) {
            new Notice(error.message);
          } else {
            console.error(duplicateLog, error);
            new Notice(duplicateFailed);
          }
        }
      }),
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
      onArchiveTask: async (request) => {
        const result = await this.withTaskEdit<ArchiveTaskResult>(state, async () => {
          try {
            const taskPath = await archiveCurrentTask(this.app, document, request);
            return { ok: true, taskPath };
          } catch (error) {
            if (error instanceof PartialTaskArchive)
              return { ok: false, message: error.message, pending: error.receipt };
            if (error instanceof TaskEditError)
              return { ok: false, message: error.message, pending: request.pending };
            console.error(archiveLog, error);
            return { ok: false, message: archiveFailed, pending: request.pending };
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
    if (this.isEditInFlight || !this.root) return;
    this.isEditInFlight = true;
    this.revision++;
    this.render(state);
    try {
      return await edit();
    } finally {
      this.isEditInFlight = false;
      if (this.root) await this.refresh();
    }
  }
}

import type { App } from "obsidian";
import type { TasksSnapshot } from "../model/linked-tasks";
import { TASK_CREATE_COPY } from "../model/task-create";
import { TASK_EDIT_COPY, TaskEditError } from "../model/task-edit";
import { describeTaskProjects } from "../model/task-projects";
import {
  PartialTaskTransfer, TASK_TRANSFER_COPY, transferListRow, type TransferTaskRequest,
} from "../model/task-transfer";
import { resolveProjectInbox } from "./resolve-project-folder";
import { moveTaskFileAndUpdateList, taskFilePathIn } from "./task-file-move";

const { projectMissing } = TASK_CREATE_COPY;
const { taskChanged } = TASK_EDIT_COPY;
const { failed, sameProject } = TASK_TRANSFER_COPY;

export async function transferCurrentTask(
  app: App,
  snapshot: TasksSnapshot,
  { task, projectPath, pending }: TransferTaskRequest,
) {
  const { groups } = snapshot;
  const { notePath } = task;
  const candidates = describeTaskProjects(groups, notePath);
  if (candidates?.owner.path === projectPath) throw new TaskEditError(sameProject);
  if (!candidates?.destinations.some(({ path }) => projectPath === path)) throw new TaskEditError(projectMissing);

  const { inboxPath, project, source, assertCurrent } = resolveProjectInbox(app, snapshot, projectPath);
  const taskPath = taskFilePathIn(inboxPath, notePath);
  if (pending) {
    const { taskPath: pendingTaskPath, projectPath: pendingProjectPath } = pending;
    if (pendingTaskPath !== taskPath || pendingProjectPath !== projectPath) throw new TaskEditError(taskChanged);
  }

  return moveTaskFileAndUpdateList(app, snapshot, task, {
    taskPath, source, assertCurrent, isListUpdateOnly: Boolean(pending), failedMessage: failed,
    editList: (markdown, row) => transferListRow(markdown, row, project.line),
    partialError: (path) => new PartialTaskTransfer({ taskPath: path, projectPath }),
  });
}

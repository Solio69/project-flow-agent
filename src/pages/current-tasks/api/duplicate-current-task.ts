import type { App } from "obsidian";
import { noteName, VAULT_PATH_SEPARATOR } from "../../../shared/lib/note-path";
import type { TasksSnapshot } from "../model/linked-tasks";
import { TASK_CREATE_COPY, taskFilename, type CreatedTaskReceipt } from "../model/task-create";
import { copyTitle, FIRST_COPY_NUMBER } from "../model/task-duplicate";
import { TASK_EDIT_COPY, TaskEditError, type EditableTask } from "../model/task-edit";
import { describeTaskProjects } from "../model/task-projects";
import { createCurrentTask, createTaskReferenceMatcher, isTaskFilenameOccupied } from "./create-task";
import { resolveProjectInbox } from "./resolve-project-folder";

const { projectMissing, retryChanged } = TASK_CREATE_COPY;
const { taskChanged, duplicateTask } = TASK_EDIT_COPY;

export async function duplicateCurrentTask(app: App, snapshot: TasksSnapshot, task: EditableTask, pending?: CreatedTaskReceipt) {
  const { vault } = app;
  const { groups, sourcePath } = snapshot;
  const { title, id, notePath } = task;
  const rows = groups.flatMap(({ tasks }) => tasks);
  if (!rows.includes(task)) throw new TaskEditError(taskChanged);
  const matching = rows.filter(({ id: rowId, notePath: rowPath }) => rowId === id || rowPath === notePath);
  if (matching.length !== 1) throw new TaskEditError(duplicateTask);
  const owner = describeTaskProjects(groups, notePath)?.owner;
  if (!owner) throw new TaskEditError(projectMissing);
  const { path: projectPath } = owner;
  if (pending) {
    const { path } = pending;
    const pendingTitle = noteName(path);
    if (!pendingTitle) throw new TaskEditError(retryChanged);
    return createCurrentTask(app, snapshot, { title: pendingTitle, projectPath, afterTask: task, pending });
  }

  let base = title;
  try {
    taskFilename(copyTitle(base, FIRST_COPY_NUMBER));
  } catch (error) {
    const filename = noteName(notePath);
    if (!(error instanceof TaskEditError) || !filename) throw error;
    base = filename;
  }

  const { inbox, inboxPath } = resolveProjectInbox(app, snapshot, projectPath);
  for (let number = FIRST_COPY_NUMBER; ; number++) {
    const candidate = copyTitle(base, number);
    const filename = taskFilename(candidate);
    const path = `${inboxPath}${VAULT_PATH_SEPARATOR}${filename}`;
    const matchesCandidate = createTaskReferenceMatcher(app, sourcePath, path, candidate);
    if (rows.some(matchesCandidate) || await isTaskFilenameOccupied(vault, inbox, filename, path)) continue;
    return createCurrentTask(app, snapshot, { title: candidate, projectPath, afterTask: task });
  }
}

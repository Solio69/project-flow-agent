import type { App } from "obsidian";
import type { TasksSnapshot } from "../model/linked-tasks";
import {
  archiveListRow, PartialTaskArchive, PROJECT_ARCHIVE, TASK_ARCHIVE_COPY, type ArchiveTaskRequest,
} from "../model/task-archive";
import { TASK_CREATE_COPY } from "../model/task-create";
import { TASK_EDIT_COPY, TaskEditError } from "../model/task-edit";
import { describeTaskProjects } from "../model/task-projects";
import { resolveProjectFolder } from "./resolve-project-folder";
import { moveTaskFileAndUpdateList, taskFilePathIn } from "./task-file-move";

const { projectMissing } = TASK_CREATE_COPY;
const { taskChanged } = TASK_EDIT_COPY;
const { archiveMissing, failed } = TASK_ARCHIVE_COPY;

export async function archiveCurrentTask(
  app: App,
  snapshot: TasksSnapshot,
  { task, pending }: ArchiveTaskRequest,
) {
  const { notePath } = task;
  const { groups } = snapshot;
  const owner = describeTaskProjects(groups, notePath)?.owner;
  if (!owner) throw new TaskEditError(projectMissing);

  const { path: projectPath } = owner;
  const { folderPath, source, assertCurrent } = resolveProjectFolder(app, snapshot, projectPath, PROJECT_ARCHIVE, archiveMissing);
  const taskPath = taskFilePathIn(folderPath, notePath);
  if (pending && pending.taskPath !== taskPath) throw new TaskEditError(taskChanged);

  return moveTaskFileAndUpdateList(app, snapshot, task, {
    taskPath, source, assertCurrent, isListUpdateOnly: Boolean(pending) || notePath === taskPath,
    isMissingRowAllowed: true, failedMessage: failed, editList: archiveListRow,
    partialError: (path) => new PartialTaskArchive({ taskPath: path }),
  });
}

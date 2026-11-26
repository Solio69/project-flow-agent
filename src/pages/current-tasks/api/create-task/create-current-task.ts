import type { App } from "obsidian";
import {
  appendProjectTask, newTaskNote, PartialTaskCreation, TASK_CREATE_COPY, type CreateTaskRequest,
} from "../../model/task-create";
import { TASK_EDIT_COPY, TaskEditError } from "../../model/task-edit";
import { readTaskId } from "../task-note-id";
import type { TasksSnapshot } from "../../model/linked-tasks";
import { resolveCreationTarget } from "./creation-target";
import { createTaskReferenceMatcher, saveTaskReference } from "./task-reference";

const { failed: creationFailed, occupiedPath, retryChanged } = TASK_CREATE_COPY;
const { conflict, duplicateTask } = TASK_EDIT_COPY;

export async function createCurrentTask(app: App, snapshot: TasksSnapshot, request: CreateTaskRequest) {
  const { vault } = app;
  const { sourcePath, sourceMarkdown, groups } = snapshot;
  const { title, pending } = request;
  const target = resolveCreationTarget(app, snapshot, request);
  const { assertCurrent, filename, inbox, path, project, source } = target;
  const { line } = project;
  if (await vault.read(source) !== sourceMarkdown) throw new TaskEditError(conflict);
  assertCurrent();

  const matchesTask = createTaskReferenceMatcher(app, sourcePath, path, title);
  const rows = groups.flatMap((group) => group.tasks.filter(matchesTask).map((task) => ({ group, task })));
  const [existing] = rows;
  const matchingCount = rows.length;
  if (pending) {
    const { path: pendingPath, id } = pending;
    const found = vault.getFileByPath(path);
    if (pendingPath !== path || !found || await readTaskId(vault, found) !== id)
      throw new TaskEditError(retryChanged);
    if (matchingCount === 1 && existing.group === project && existing.task.notePath === path) {
      assertCurrent();
      return path;
    }
  } else {
    const filenameKey = filename.toLowerCase();
    const nameInUse = inbox.children.some(({ name }) => name.toLowerCase() === filenameKey);
    if (vault.getAbstractFileByPath(path) || nameInUse) throw new TaskEditError(occupiedPath);
  }
  if (matchingCount > 0) throw new TaskEditError(duplicateTask);

  const nextMarkdown = appendProjectTask(sourceMarkdown, line, path);
  let receipt = pending;
  try {
    if (!receipt) {
      const { id, markdown } = newTaskNote();
      await vault.create(path, markdown);
      receipt = { id, path };
    }

    await saveTaskReference(vault, target, receipt, {
      sourceMarkdown,
      nextMarkdown,
      hasDuplicateReference: () => groups.some(({ tasks }) => tasks.some(matchesTask)),
    });
    return path;
  } catch (error) {
    if (!receipt) throw error;
    const cause = error instanceof TaskEditError ? error.message : creationFailed;
    throw new PartialTaskCreation(receipt, cause);
  }
}

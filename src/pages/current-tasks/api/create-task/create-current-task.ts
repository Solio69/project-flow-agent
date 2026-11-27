import type { App } from "obsidian";
import { resolveLink } from "../../../../shared/api/obsidian";
import {
  appendProjectTask, insertCopyAfterTask, newTaskNote, PartialTaskCreation, TASK_CREATE_COPY, type CreateTaskRequest,
} from "../../model/task-create";
import { TASK_EDIT_COPY, TaskEditError, type EditableTask } from "../../model/task-edit";
import { verifyTaskNote } from "../task-note-id";
import type { TasksSnapshot } from "../../model/linked-tasks";
import { isTaskFilenameOccupied, resolveCreationTarget } from "./creation-target";
import { createTaskReferenceMatcher, saveTaskReference } from "./task-reference";

const { failed: creationFailed, occupiedPath, retryChanged } = TASK_CREATE_COPY;
const { conflict, duplicateTask, taskChanged } = TASK_EDIT_COPY;

async function verifyCopySource(app: App, sourcePath: string, { notePath, link, id }: EditableTask) {
  const { vault } = app;
  const { file, assertUnchanged } = await verifyTaskNote(vault, notePath, id, taskChanged);

  return () => {
    assertUnchanged();
    const { file: linked } = resolveLink(app, sourcePath, link);
    if (linked !== file) throw new TaskEditError(taskChanged);
  };
}

export async function createCurrentTask(app: App, snapshot: TasksSnapshot, request: CreateTaskRequest) {
  const { vault } = app;
  const { sourcePath, sourceMarkdown, groups } = snapshot;
  const { title, pending, afterTask } = request;
  const target = resolveCreationTarget(app, snapshot, request);
  const { assertCurrent, filename, inbox, path, project, source } = target;
  const { line } = project;
  const destination = afterTask ? groups.find(({ tasks }) => tasks.includes(afterTask)) : project;
  if (!destination) throw new TaskEditError(conflict);
  const assertCopySource = afterTask ? await verifyCopySource(app, sourcePath, afterTask) : undefined;

  const assertTarget = () => {
    assertCurrent();
    assertCopySource?.();
  };

  if (pending && pending.path !== path) throw new TaskEditError(retryChanged);
  const verifiedCopy = pending ? await verifyTaskNote(vault, path, pending.id, retryChanged) : undefined;
  const isFilenameOccupied = !pending && await isTaskFilenameOccupied(vault, inbox, filename, path);
  const { stat: { mtime: sourceMtime, size: sourceSize } } = source;
  const currentSource = await vault.read(source);
  assertTarget();
  const { stat: { mtime: actualSourceMtime, size: actualSourceSize } } = source;
  const isSameSourceVersion = sourceMtime === actualSourceMtime && sourceSize === actualSourceSize;
  if (currentSource !== sourceMarkdown || !isSameSourceVersion) throw new TaskEditError(conflict);
  verifiedCopy?.assertUnchanged();

  const matchesTask = createTaskReferenceMatcher(app, sourcePath, path, title);
  const rows = groups.flatMap((group) => group.tasks.filter(matchesTask).map((task) => ({ group, task })));
  const [existing] = rows;
  const matchingCount = rows.length;
  const isExistingCopyLinked = matchingCount === 1 && existing.group === destination && existing.task.notePath === path;
  if (pending && isExistingCopyLinked) return path;
  if (isFilenameOccupied) throw new TaskEditError(occupiedPath);
  if (matchingCount > 0) throw new TaskEditError(duplicateTask);

  const nextMarkdown = afterTask
    ? insertCopyAfterTask(sourceMarkdown, afterTask, path)
    : appendProjectTask(sourceMarkdown, line, path);
  let receipt = pending;
  try {
    if (!receipt) {
      assertTarget();
      const { id, markdown } = newTaskNote();
      await vault.create(path, markdown);
      receipt = { id, path };
    }

    await saveTaskReference(vault, { ...target, assertCurrent: assertTarget }, receipt, {
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

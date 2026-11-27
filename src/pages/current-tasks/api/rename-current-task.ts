import type { App } from "obsidian";
import {
  MARKDOWN_EXTENSION_PATTERN,
  VAULT_PATH_SEPARATOR,
  vaultParentPath,
} from "../../../shared/lib/note-path";
import { resolveLink } from "../../../shared/api/obsidian";
import { TASK_CREATE_COPY, taskFilename } from "../model/task-create";
import { assertWritableGroup, readEditableList, TASK_EDIT_COPY, TaskEditError } from "../model/task-edit";
import { RenameTaskSourceChanged, TASK_RENAME_COPY, type RenameTaskRequest } from "../model/task-rename";
import { assertCurrentSource, requireSource } from "./source-note";
import { readTaskId } from "./task-note-id";
import type { TasksSnapshot } from "../model/linked-tasks";

const { duplicateTask, taskChanged } = TASK_EDIT_COPY;
const { occupiedPath } = TASK_CREATE_COPY;
const { caseOnly, failed, linksIncomplete } = TASK_RENAME_COPY;

export async function renameCurrentTask(
  app: App,
  { sourcePath, sourceMarkdown, groups }: TasksSnapshot,
  { task: { id, notePath }, title, sourceMarkdown: confirmedSource }: RenameTaskRequest,
) {
  if (confirmedSource !== sourceMarkdown) throw new RenameTaskSourceChanged(sourceMarkdown);

  const { vault, fileManager } = app;
  const source = requireSource(app, sourcePath);
  const matchingRows = groups.flatMap((group) => group.tasks
    .filter((row) => row.notePath === notePath || row.id === id)
    .map((row) => ({ group, row })));
  if (matchingRows.length > 1) throw new TaskEditError(duplicateTask);

  const [match] = matchingRows;
  const file = vault.getFileByPath(notePath);
  if (!match || !file || !MARKDOWN_EXTENSION_PATTERN.test(notePath)) throw new TaskEditError(taskChanged);
  const { group, row: { link, id: rowId, notePath: rowPath } } = match;
  if (!link || rowId !== id || rowPath !== notePath || resolveLink(app, sourcePath, link).file !== file)
    throw new TaskEditError(taskChanged);
  const { diagnostics } = readEditableList(sourceMarkdown);
  assertWritableGroup(group, diagnostics);

  const filename = taskFilename(title);
  const parent = vaultParentPath(notePath);
  const destination = parent ? `${parent}${VAULT_PATH_SEPARATOR}${filename}` : filename;
  const isSamePath = destination === notePath;
  if (!isSamePath && destination.toLowerCase() === notePath.toLowerCase()) throw new TaskEditError(caseOnly);

  const { stat: { mtime, size } } = file;
  const { stat: { mtime: sourceMtime, size: sourceSize } } = source;
  const [currentSource, savedId, isDestinationOccupied] = await Promise.all([
    vault.read(source),
    readTaskId(vault, file),
    isSamePath ? false : vault.adapter.exists(destination, false),
  ]);
  assertCurrentSource(app, source, sourcePath);
  if (currentSource !== sourceMarkdown) throw new RenameTaskSourceChanged(currentSource);
  const { stat: { mtime: currentSourceMtime, size: currentSourceSize } } = source;
  if (currentSourceMtime !== sourceMtime || currentSourceSize !== sourceSize)
    throw new RenameTaskSourceChanged(await vault.read(source));
  const { path: currentPath, stat: { mtime: currentMtime, size: currentSize } } = file;
  if (savedId !== id || currentPath !== notePath || currentMtime !== mtime || currentSize !== size ||
      vault.getFileByPath(notePath) !== file || resolveLink(app, sourcePath, link).file !== file)
    throw new TaskEditError(taskChanged);
  if (isSamePath) return notePath;
  if (isDestinationOccupied || vault.getAbstractFileByPath(destination)) throw new TaskEditError(occupiedPath);

  try {
    await fileManager.renameFile(file, destination);
  } catch (error) {
    if (file.path === destination && vault.getFileByPath(destination) === file)
      throw new TaskEditError(linksIncomplete(destination));
    throw error;
  }
  if (file.path !== destination || vault.getFileByPath(destination) !== file) throw new TaskEditError(failed);
  return destination;
}

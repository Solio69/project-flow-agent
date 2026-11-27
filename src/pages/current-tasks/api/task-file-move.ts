import type { App, TFile } from "obsidian";
import { resolveLink } from "../../../shared/api/obsidian";
import { EMPTY_STRING } from "../../../shared/lib";
import {
  LINK_FRAGMENT_PREFIX, MARKDOWN_EXTENSION_PATTERN, VAULT_PATH_SEPARATOR,
} from "../../../shared/lib/note-path";
import { TASK_CREATE_COPY } from "../model/task-create";
import {
  readEditableList, rewriteTaskLink, TASK_EDIT_COPY, TaskEditError, type EditableTask, type TaskRow,
} from "../model/task-edit";
import type { TasksSnapshot } from "../model/linked-tasks";
import { readTaskId } from "./task-note-id";

const { conflict, duplicateTask, taskChanged } = TASK_EDIT_COPY;
const { occupiedPath } = TASK_CREATE_COPY;

type FileMovePlan = {
  taskPath: string;
  source: TFile;
  assertCurrent: () => void;
  isListUpdateOnly: boolean;
  isMissingRowAllowed?: boolean;
  editList: (markdown: string, task: TaskRow) => string;
  failedMessage: string;
  partialError: (taskPath: string) => TaskEditError;
};

export function taskFilePathIn(folderPath: string, notePath: string) {
  const name = notePath.slice(notePath.lastIndexOf(VAULT_PATH_SEPARATOR) + VAULT_PATH_SEPARATOR.length);
  return `${folderPath}${VAULT_PATH_SEPARATOR}${name}`;
}

function isLinkToFile(link: string, path: string) {
  const [target] = link.split(LINK_FRAGMENT_PREFIX, 1);
  return target.replace(MARKDOWN_EXTENSION_PATTERN, EMPTY_STRING) ===
    path.replace(MARKDOWN_EXTENSION_PATTERN, EMPTY_STRING);
}

function isExpectedTaskLink(link: string, originalLink: string, path: string) {
  return link === originalLink || isLinkToFile(link, path);
}

function verifyListAfterFileMove(
  app: App,
  sourcePath: string,
  current: string,
  original: TaskRow,
  file: TFile,
  { before, rewritten }: { before: string; rewritten: string },
) {
  const { line, link: originalLink } = original;
  const { path } = file;
  const isListChanged = current !== before;
  const link = isListChanged
    ? readEditableList(current).groups.flatMap(({ tasks }) => tasks).find(({ line: rowLine }) => rowLine === line)?.link
    : originalLink;
  if (!link) throw new TaskEditError(conflict);
  const { file: linked } = resolveLink(app, sourcePath, link);
  const isLinkedToAnotherFile = Boolean(linked) && linked !== file;
  const isUnexpectedUnresolvedLink = !linked && !isExpectedTaskLink(link, originalLink, path);
  if (isLinkedToAnotherFile || isUnexpectedUnresolvedLink) throw new TaskEditError(conflict);
  if (isListChanged && rewriteTaskLink(current, { line, link }, path).markdown !== rewritten)
    throw new TaskEditError(conflict);
}

export async function moveTaskFileAndUpdateList(
  app: App,
  { sourcePath, sourceMarkdown, groups }: TasksSnapshot,
  { id, notePath, link: originalLink }: EditableTask,
  { taskPath, source, assertCurrent, isListUpdateOnly, isMissingRowAllowed = false, editList, failedMessage, partialError }: FileMovePlan,
) {
  const { vault, fileManager } = app;
  const currentPath = isListUpdateOnly ? taskPath : notePath;
  const file = vault.getFileByPath(currentPath);
  if (!file || !MARKDOWN_EXTENSION_PATTERN.test(currentPath)) throw new TaskEditError(taskChanged);
  const rows = groups.flatMap(({ tasks }) => tasks).filter(({ id: rowId, notePath: rowPath, link }) => {
    const isKnownRow = rowId === id || rowPath === currentPath;
    const isExpectedLinkAfterMove = isListUpdateOnly && Boolean(link && isExpectedTaskLink(link, originalLink, taskPath));
    return isKnownRow || isExpectedLinkAfterMove;
  });
  const [selected, duplicate] = rows;
  if (duplicate) throw new TaskEditError(duplicateTask);
  const row = selected?.link ? { line: selected.line, link: selected.link } : undefined;
  const isMissingRowAccepted = isListUpdateOnly && isMissingRowAllowed;
  if (!row && !isMissingRowAccepted) throw new TaskEditError(taskChanged);

  const { stat: { mtime, size } } = file;
  if (await readTaskId(vault, file) !== id) throw new TaskEditError(taskChanged);
  if (!isListUpdateOnly && await vault.adapter.exists(taskPath, false)) throw new TaskEditError(occupiedPath);
  if (await vault.read(source) !== sourceMarkdown) throw new TaskEditError(conflict);
  assertCurrent();
  const { path: verifiedPath, stat: { mtime: verifiedMtime, size: verifiedSize } } = file;
  if (verifiedPath !== currentPath || vault.getFileByPath(currentPath) !== file ||
      verifiedMtime !== mtime || verifiedSize !== size)
    throw new TaskEditError(taskChanged);
  if (!row) return taskPath;

  const { link } = row;
  const { file: linked } = resolveLink(app, sourcePath, link);
  const isExpectedUnresolvedLink = isListUpdateOnly && !linked && isExpectedTaskLink(link, originalLink, taskPath);
  if (linked !== file && !isExpectedUnresolvedLink) throw new TaskEditError(taskChanged);
  if (!isListUpdateOnly && vault.getAbstractFileByPath(taskPath)) throw new TaskEditError(occupiedPath);
  const prepared = rewriteTaskLink(sourceMarkdown, row, taskPath);
  const nextMarkdown = editList(prepared.markdown, prepared.task);
  const currentList = { before: sourceMarkdown, rewritten: prepared.markdown };
  const isAtDestination = () => file.path === taskPath && vault.getFileByPath(taskPath) === file;

  try {
    if (!isListUpdateOnly) await fileManager.renameFile(file, taskPath);
    if (!isAtDestination()) throw new TaskEditError(failedMessage);
    const { stat: { mtime: movedMtime, size: movedSize } } = file;
    if (await readTaskId(vault, file) !== id) throw new TaskEditError(taskChanged);

    const saved = await vault.process(source, (current) => {
      assertCurrent();
      const { stat: { mtime: currentMtime, size: currentSize } } = file;
      if (!isAtDestination() || currentMtime !== movedMtime || currentSize !== movedSize)
        throw new TaskEditError(taskChanged);
      verifyListAfterFileMove(app, sourcePath, current, row, file, currentList);
      return nextMarkdown;
    });
    if (saved !== nextMarkdown) throw new TaskEditError(conflict);
    return taskPath;
  } catch (error) {
    if (isAtDestination()) throw partialError(taskPath);
    throw error;
  }
}

import type { App, TFile } from "obsidian";
import { EMPTY_STRING } from "../../../shared/lib";
import { MARKDOWN_EXTENSION_PATTERN, VAULT_PATH_SEPARATOR } from "../../../shared/lib/note-path";
import { resolveLink } from "../../../shared/api/obsidian";
import { TASK_CREATE_COPY } from "../model/task-create";
import { readEditableList, TASK_EDIT_COPY, TaskEditError, type TaskRow } from "../model/task-edit";
import {
  PartialTaskTransfer, rewriteTransferLink, taskTransferProjects, TASK_TRANSFER_COPY, transferListRow,
  type TransferTaskRequest,
} from "../model/task-transfer";
import { resolveProjectInbox } from "./project-inbox";
import { readTaskId } from "./task-note-id";
import type { TasksSnapshot } from "../model/linked-tasks";

const { conflict, duplicateTask, taskChanged } = TASK_EDIT_COPY;
const { occupiedPath, projectMissing } = TASK_CREATE_COPY;
const { failed, sameProject } = TASK_TRANSFER_COPY;

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
  const changed = current !== before;
  const link = changed
    ? readEditableList(current).groups.flatMap(({ tasks }) => tasks).find(({ line: rowLine }) => rowLine === line)?.link
    : originalLink;
  if (!link) throw new TaskEditError(conflict);
  const { file: linked, path: target } = resolveLink(app, sourcePath, link);
  const namesFile = target.replace(MARKDOWN_EXTENSION_PATTERN, EMPTY_STRING) ===
    path.replace(MARKDOWN_EXTENSION_PATTERN, EMPTY_STRING);
  const pointsToAnotherFile = Boolean(linked) && linked !== file;
  const unexpectedUnresolvedLink = !linked && link !== originalLink && !namesFile;
  if (pointsToAnotherFile || unexpectedUnresolvedLink) throw new TaskEditError(conflict);
  if (changed && rewriteTransferLink(current, { line, link }, path).markdown !== rewritten)
    throw new TaskEditError(conflict);
}

export async function transferCurrentTask(
  app: App,
  snapshot: TasksSnapshot,
  { task: { id, notePath, link: originalLink }, projectPath, pending }: TransferTaskRequest,
) {
  const { vault, fileManager } = app;
  const { sourcePath, sourceMarkdown, groups } = snapshot;
  const candidates = taskTransferProjects(groups, notePath);
  if (candidates?.owner.path === projectPath) throw new TaskEditError(sameProject);
  if (!candidates?.destinations.some(({ path }) => projectPath === path)) throw new TaskEditError(projectMissing);

  const { inboxPath, project, source, assertCurrent } = resolveProjectInbox(app, snapshot, projectPath);
  const name = notePath.slice(notePath.lastIndexOf(VAULT_PATH_SEPARATOR) + VAULT_PATH_SEPARATOR.length);
  const taskPath = inboxPath + VAULT_PATH_SEPARATOR + name;
  if (pending) {
    const { taskPath: pendingTaskPath, projectPath: pendingProjectPath } = pending;
    if (pendingTaskPath !== taskPath || pendingProjectPath !== projectPath) throw new TaskEditError(taskChanged);
  }

  const currentPath = pending ? taskPath : notePath;
  const file = vault.getFileByPath(currentPath);
  if (!file || !MARKDOWN_EXTENSION_PATTERN.test(currentPath)) throw new TaskEditError(taskChanged);
  const rows = groups.flatMap(({ tasks }) => tasks).filter(({ id: rowId, notePath: rowPath, link }) =>
    rowId === id || rowPath === currentPath || (pending && !rowPath && link === originalLink));
  const [selected, duplicate] = rows;
  if (duplicate) throw new TaskEditError(duplicateTask);
  const link = selected?.link;
  if (!link) throw new TaskEditError(taskChanged);
  const { file: linked } = resolveLink(app, sourcePath, link);
  const canUseOriginalLink = pending && !linked && link === originalLink;
  if (linked !== file && !canUseOriginalLink) throw new TaskEditError(taskChanged);

  const row = { line: selected.line, link };
  const prepared = rewriteTransferLink(sourceMarkdown, row, taskPath);
  const currentList = { before: sourceMarkdown, rewritten: prepared.markdown };
  const nextMarkdown = transferListRow(prepared.markdown, prepared.task, project.line);
  const { stat: { mtime, size } } = file;
  if (await readTaskId(vault, file) !== id) throw new TaskEditError(taskChanged);
  if (!pending && await vault.adapter.exists(taskPath, false)) throw new TaskEditError(occupiedPath);
  if (await vault.read(source) !== sourceMarkdown) throw new TaskEditError(conflict);
  assertCurrent();
  const { path: verifiedPath, stat: { mtime: verifiedMtime, size: verifiedSize } } = file;
  if (verifiedPath !== currentPath || vault.getFileByPath(currentPath) !== file ||
      verifiedMtime !== mtime || verifiedSize !== size)
    throw new TaskEditError(taskChanged);
  if (!pending && resolveLink(app, sourcePath, link).file !== file) throw new TaskEditError(taskChanged);
  if (!pending && vault.getAbstractFileByPath(taskPath)) throw new TaskEditError(occupiedPath);

  try {
    if (!pending) await fileManager.renameFile(file, taskPath);
    if (file.path !== taskPath || vault.getFileByPath(taskPath) !== file) throw new TaskEditError(failed);
    const { stat: { mtime: movedMtime, size: movedSize } } = file;
    if (await readTaskId(vault, file) !== id) throw new TaskEditError(taskChanged);

    const saved = await vault.process(source, (current) => {
      assertCurrent();
      const { path, stat: { mtime: currentMtime, size: currentSize } } = file;
      if (path !== taskPath || vault.getFileByPath(taskPath) !== file ||
          currentMtime !== movedMtime || currentSize !== movedSize)
        throw new TaskEditError(taskChanged);
      verifyListAfterFileMove(app, sourcePath, current, row, file, currentList);
      return nextMarkdown;
    });
    if (saved !== nextMarkdown) throw new TaskEditError(conflict);
    return taskPath;
  } catch (error) {
    if (file.path === taskPath && vault.getFileByPath(taskPath) === file)
      throw new PartialTaskTransfer({ taskPath, projectPath });
    throw error;
  }
}

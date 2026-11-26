import type { App, Vault } from "obsidian";
import { EMPTY_STRING } from "../../../constants/text";
import { MARKDOWN_EXTENSION_PATTERN } from "../../../obsidian/constants";
import { resolveLink } from "../../../obsidian/resolve-link";
import { TASK_CREATE_COPY, type CreatedTaskReceipt } from "../../task-create";
import { TASK_EDIT_COPY, TaskEditError } from "../../task-edit";
import { readTaskId } from "../task-note-id";
import type { LinkedTask } from "../types";
import type { CreationTarget } from "./creation-target";

const { retryChanged } = TASK_CREATE_COPY;
const { conflict, duplicateTask } = TASK_EDIT_COPY;

type TaskReferenceEdit = {
  sourceMarkdown: string;
  nextMarkdown: string;
  hasDuplicateReference: () => boolean;
};

function taskLinkKey(path: string) {
  return path.replace(MARKDOWN_EXTENSION_PATTERN, EMPTY_STRING).toLowerCase();
}

export function createTaskReferenceMatcher(app: App, sourcePath: string, path: string, title: string) {
  const pathKey = taskLinkKey(path);
  const titleKey = title.toLowerCase();

  return ({ link }: LinkedTask) => {
    if (!link) return false;
    const { file, path: target } = resolveLink(app, sourcePath, link);
    if (file) return file.path === path;
    const targetKey = taskLinkKey(target);
    return targetKey === pathKey || targetKey === titleKey;
  };
}

export async function saveTaskReference(
  vault: Vault,
  { source, assertCurrent }: CreationTarget,
  { path, id }: CreatedTaskReceipt,
  { sourceMarkdown, nextMarkdown, hasDuplicateReference }: TaskReferenceEdit,
) {
  const task = vault.getFileByPath(path);
  if (!task) throw new TaskEditError(retryChanged);
  const { stat: { mtime, size } } = task;
  if (await readTaskId(vault, task) !== id) throw new TaskEditError(retryChanged);

  const saved = await vault.process(source, (current) => {
    assertCurrent();
    const { stat: { mtime: actualMtime, size: actualSize } } = task;
    if (vault.getFileByPath(path) !== task || mtime !== actualMtime || size !== actualSize)
      throw new TaskEditError(retryChanged);
    if (current === nextMarkdown) return current;
    if (current !== sourceMarkdown) throw new TaskEditError(conflict);
    if (hasDuplicateReference()) throw new TaskEditError(duplicateTask);
    return nextMarkdown;
  });
  if (saved !== nextMarkdown) throw new TaskEditError(conflict);
}

import { FileSystemAdapter, type App } from "obsidian";
import { resolveLink } from "../../../shared/api/obsidian";
import { isTaskNotePath, NOTE_PATH_COPY, type TaskNoteReference, type TextClipboard } from "../model/task-note-path";
import { TaskEditError } from "../model/task-edit";

const { changed, failed, unsupported } = NOTE_PATH_COPY;

export async function copyTaskPath(app: App, sourcePath: string, { link, notePath }: TaskNoteReference, clipboard?: TextClipboard) {
  if (!link || !notePath) throw new TaskEditError(changed);
  if (!isTaskNotePath(notePath)) throw new TaskEditError(unsupported);
  const { vault } = app;
  const { adapter } = vault;
  const { file } = resolveLink(app, sourcePath, link);
  if (!file || file.path !== notePath || vault.getFileByPath(notePath) !== file)
    throw new TaskEditError(changed);
  if (!clipboard || !(adapter instanceof FileSystemAdapter)) throw new TaskEditError(failed);
  await clipboard.writeText(adapter.getFullPath(notePath));
}

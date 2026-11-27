import { MARKDOWN_EXTENSION_PATTERN } from "../../../../shared/lib/note-path";

export { NOTE_PATH_COPY, NOTE_PATH_ICON } from "./constants";
export type TaskNoteReference = { link?: string; notePath?: string };
export type TextClipboard = { writeText: (value: string) => Promise<void> };
export type CopyTaskPath = (task: TaskNoteReference, clipboard?: TextClipboard) => Promise<void>;

export function isTaskNotePath(path?: string): path is string {
  return path !== undefined && MARKDOWN_EXTENSION_PATTERN.test(path);
}

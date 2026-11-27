import { EMPTY_STRING } from "../../../../shared/lib";
import { MARKDOWN_EXTENSION, MARKDOWN_EXTENSION_PATTERN } from "../../../../shared/lib/note-path";
import { TASK_ID_FIELD, TASK_ID_PREFIX } from "../current-tasks.constants";
import { FRONTMATTER_DELIMITER } from "../parse-current-tasks.constants";
import {
  assertFreeTaskGap, assertTaskLinkPath, assertWritableGroup, findTaskGroup, markdownEndBoundary, PRESERVED_LINE_ENDING,
  readEditableList, rowPartIndex, SECTION_GAP_OPTIONS, TaskEditError, type EditableTask, type TaskRow,
} from "../task-edit";
import { isTodayGroup } from "../task-group";
import type { CurrentTaskGroup } from "../types";
import {
  DEFAULT_LINE_ENDING, FILENAME_DOT, INVALID_TITLE_CHARACTERS,
  NEW_TASK_ROW_PREFIX, NEW_TASK_ROW_SUFFIX, RESERVED_FILENAME, TASK_CREATE_COPY,
  TASK_TITLE_LIMIT, UUID_SEPARATOR, YAML_PROPERTY_SEPARATOR,
} from "./constants";

const { emptyTitle, invalidTitle, projectMissing, partial } = TASK_CREATE_COPY;

export type CreatedTaskReceipt = { path: string; id: string };
export type CreateTaskRequest = { title: string; projectPath: string; pending?: CreatedTaskReceipt; afterTask?: EditableTask };
export type CreateTaskResult = { ok: true; taskPath: string } | { ok: false; message: string; pending?: CreatedTaskReceipt };
export type CreateTask = (request: CreateTaskRequest) => Promise<CreateTaskResult>;

export class PartialTaskCreation extends TaskEditError {
  constructor(readonly receipt: CreatedTaskReceipt, cause: string) {
    super(partial(receipt.path, cause));
  }
}

export function taskFilename(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) throw new TaskEditError(emptyTitle);

  const invalid = trimmed !== title || title.length > TASK_TITLE_LIMIT || title.startsWith(FILENAME_DOT) ||
    title.endsWith(FILENAME_DOT) || MARKDOWN_EXTENSION_PATTERN.test(title) ||
    INVALID_TITLE_CHARACTERS.test(title) || RESERVED_FILENAME.test(title);
  if (invalid) throw new TaskEditError(invalidTitle);
  return `${title}${MARKDOWN_EXTENSION}`;
}

export function newTaskNote() {
  const id = `${TASK_ID_PREFIX}${globalThis.crypto.randomUUID().replaceAll(UUID_SEPARATOR, EMPTY_STRING)}`;
  const property = `${TASK_ID_FIELD}${YAML_PROPERTY_SEPARATOR}${id}`;
  const markdown = [FRONTMATTER_DELIMITER, property, FRONTMATTER_DELIMITER, EMPTY_STRING].join(DEFAULT_LINE_ENDING);
  return { id, markdown };
}

export function appendProjectTask(markdown: string, headingLine: number, path: string) {
  const { groups, diagnostics } = readEditableList(markdown);
  const group = groups.find(({ line }) => line === headingLine);
  if (!group || isTodayGroup(group)) throw new TaskEditError(projectMissing);
  assertWritableGroup(group, diagnostics);

  const { tasks } = group;
  let anchor = headingLine;
  for (const { line, completed } of tasks) {
    if (!completed) anchor = line;
  }
  return insertTaskRow(markdown, group, anchor, path);
}

export function insertCopyAfterTask(markdown: string, task: TaskRow, path: string) {
  const { groups, diagnostics } = readEditableList(markdown);
  const group = findTaskGroup(groups, task);
  assertWritableGroup(group, diagnostics);
  const { line } = task;
  return insertTaskRow(markdown, group, line, path);
}

function insertTaskRow(markdown: string, group: CurrentTaskGroup, anchor: number, path: string) {
  assertTaskLinkPath(path);
  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const { tasks, nextHeadingLine = markdownEndBoundary(parts) } = group;
  const next = tasks.find(({ line }) => line > anchor);
  assertFreeTaskGap(parts, anchor, next?.line ?? nextHeadingLine, next ? undefined : SECTION_GAP_OPTIONS);

  const index = rowPartIndex(anchor) + 1;
  const lineEnding = parts[index] ?? parts[index - 2] ?? DEFAULT_LINE_ENDING;
  const row = `${NEW_TASK_ROW_PREFIX}${path}${NEW_TASK_ROW_SUFFIX}`;
  parts.splice(index, 0, lineEnding, row);
  return parts.join(EMPTY_STRING);
}

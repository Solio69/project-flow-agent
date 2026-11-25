import { TASKS_FORMAT } from "../current-tasks.constants";
import { parseCurrentTasks, type CurrentTask } from "../parse-current-tasks";
import { TASK_PATTERN, UNCHECKED_MARK } from "../parse-current-tasks.constants";
import { CHECKBOX_START, CHECKED_MARK, COPY, PRESERVED_LINE_ENDING } from "./constants";

const { invalidList, conflict, ambiguousGroup } = COPY;

type CompletionIdentity = { id: string; link: string; notePath: string };
export type CompletionTarget = CurrentTask & CompletionIdentity;
export type SetCompleted = (task: CompletionTarget, completed: boolean) => Promise<void>;

export class TaskCompletionError extends Error {}

export function isCompletionTarget(task: CurrentTask & Partial<CompletionIdentity>): task is CompletionTarget {
  const { id, link, notePath } = task;
  return Boolean(id && link && notePath);
}

export function updateCompletionMark(markdown: string, target: Pick<CompletionTarget, "line" | "link">, completed: boolean) {
  const { line, link } = target;
  const { format, period, groups, diagnostics } = parseCurrentTasks(markdown);
  if (format !== TASKS_FORMAT.properties || !period) throw new TaskCompletionError(invalidList);

  const group = groups.find(({ tasks }) => tasks.some((task) => task.line === line && task.link === link));
  if (!group) throw new TaskCompletionError(conflict);

  const { line: groupLine, nextHeadingLine = Infinity } = group;
  const hasAmbiguousRow = diagnostics.some(({ line: problemLine }) =>
    problemLine !== undefined && problemLine > groupLine && problemLine < nextHeadingLine);
  if (hasAmbiguousRow) throw new TaskCompletionError(ambiguousGroup);

  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const rowIndex = (line - 1) * 2;
  const row = parts[rowIndex];
  const match = row && TASK_PATTERN.exec(row.trimEnd());
  if (!match) throw new TaskCompletionError(conflict);

  const [, previousMark] = match;
  if ((previousMark !== UNCHECKED_MARK) === completed) return markdown;

  const markIndex = row.indexOf(CHECKBOX_START) + CHECKBOX_START.length;
  const mark = completed ? CHECKED_MARK : UNCHECKED_MARK;
  parts[rowIndex] = row.slice(0, markIndex) + mark + row.slice(markIndex + mark.length);
  return parts.join("");
}

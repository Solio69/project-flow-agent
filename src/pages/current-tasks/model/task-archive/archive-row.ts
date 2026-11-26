import { EMPTY_STRING } from "../../../../shared/lib";
import {
  assertFreeTaskGap, assertWritableGroup, findTaskGroup, markdownEndBoundary, PRESERVED_LINE_ENDING,
  readEditableList, rowPartIndex, SECTION_GAP_OPTIONS, type TaskRow,
} from "../task-edit";

export function archiveListRow(markdown: string, task: TaskRow) {
  const { groups, diagnostics } = readEditableList(markdown);
  const group = findTaskGroup(groups, task);
  assertWritableGroup(group, diagnostics);

  const { line } = task;
  const { tasks, line: headingLine, nextHeadingLine } = group;
  const selected = tasks.findIndex(({ line: row }) => row === line);
  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const before = tasks[selected - 1]?.line ?? headingLine;
  const after = tasks[selected + 1]?.line ?? nextHeadingLine ?? markdownEndBoundary(parts);
  assertFreeTaskGap(parts, before, line, SECTION_GAP_OPTIONS);
  assertFreeTaskGap(parts, line, after, SECTION_GAP_OPTIONS);

  const index = rowPartIndex(line);
  const removalIndex = index === parts.length - 1 ? index - 1 : index;
  parts.splice(removalIndex, 2);
  return parts.join(EMPTY_STRING);
}

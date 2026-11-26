import { EMPTY_STRING } from "../../constants/text";
import { LINK_FRAGMENT_PREFIX } from "../../obsidian/constants";
import {
  TASK_LINKS_PATTERN,
  WIKI_LINK_ALIAS_SEPARATOR,
  WIKI_LINK_DELIMITERS,
} from "../parse-current-tasks.constants";
import {
  assertTaskLinkPath,
  assertWritableGroup,
  findTaskGroup,
  PRESERVED_LINE_ENDING,
  readEditableList,
  rowPartIndex,
  TASK_EDIT_COPY,
  TaskEditError,
  type TaskRow,
} from "../task-edit";
import { isTodayGroup } from "../task-group";
import { moveTaskRow } from "../task-move";

const { conflict } = TASK_EDIT_COPY;
const [openLink, closeLink] = WIKI_LINK_DELIMITERS;

export function rewriteTransferLink(
  markdown: string,
  { line, link }: TaskRow,
  path: string,
) {
  assertTaskLinkPath(path);
  const parts = markdown.split(PRESERVED_LINE_ENDING);
  const index = rowPartIndex(line);
  const row = parts[index];
  const [match, extra] = Array.from(row?.matchAll(TASK_LINKS_PATTERN) ?? []);
  if (!match || extra) throw new TaskEditError(conflict);
  const [raw, content] = match;
  const [target] = content.split(WIKI_LINK_ALIAS_SEPARATOR, 1);
  if (target.trim() !== link) throw new TaskEditError(conflict);
  const fragmentPosition = link.indexOf(LINK_FRAGMENT_PREFIX);
  const address =
    fragmentPosition === -1 ? path : path + link.slice(fragmentPosition);
  const updated = content.replace(link, () => address);
  parts[index] = row.replace(raw, () => openLink + updated + closeLink);
  return { markdown: parts.join(EMPTY_STRING), task: { line, link: address } };
}

export function transferListRow(
  markdown: string,
  task: TaskRow,
  destinationLine: number,
) {
  const { groups, diagnostics } = readEditableList(markdown);
  const origin = findTaskGroup(groups, task);
  if (isTodayGroup(origin) || origin.line === destinationLine) {
    assertWritableGroup(origin, diagnostics);
    return markdown;
  }
  const destination = groups.find(({ line }) => line === destinationLine);
  const selected = origin.tasks.find(({ line }) => line === task.line);
  if (!destination || !selected) throw new TaskEditError(conflict);
  const { tasks, line: headingLine } = destination;
  const { completed } = selected;
  let afterLine = headingLine;
  for (const { line, completed: done } of tasks) {
    if (completed || !done) afterLine = line;
  }
  return moveTaskRow(
    markdown,
    task,
    { headingLine, afterLine },
    { allowCompleted: true },
  );
}

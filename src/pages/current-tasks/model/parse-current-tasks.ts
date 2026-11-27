import { EMPTY_STRING } from "../../../shared/lib";
import { noteName } from "../../../shared/lib/note-path";
import { TASK_GROUP_KIND, TASKS_FORMAT } from "./current-tasks.constants";
import {
  DIAGNOSTIC_COPY,
  FENCE_PATTERN,
  HEADING_PATTERN,
  HORIZONTAL_RULE_PATTERN,
  LEGACY_DATE_RANGE_PATTERN,
  LEGACY_PERIOD_HEADING_PATTERN,
  MARKDOWN_BOM,
  PERIOD_FIELD,
  PROJECT_HEADING_MARKER,
  PROJECT_LINK_PATTERN,
  TASK_LINKS_PATTERN,
  TASK_PATTERN,
  TODAY_HEADING,
  TRAILING_HEADING_MARKERS_PATTERN,
  UNCHECKED_MARK,
  WIKI_LINK_ALIAS_SEPARATOR,
  WIKI_LINK_DELIMITERS,
} from "./parse-current-tasks.constants";
import { periodDateSchema, readPeriodProperties, writablePeriodProperties } from "./period-properties";
import type {
  ActionDiagnostic, CurrentTask, CurrentTaskGroup, CurrentTasksDocument, TaskPeriod, TasksFormat,
} from "./types";

const {
  invalidPeriodDate, reversedPeriod,
  missingLegacyDates, invalidTask, ambiguousTaskLink, expectedTaskLink, invalidProjectHeading,
} = DIAGNOSTIC_COPY;

type SourceLine = { line: number; text: string };

function hasWikiLinkDelimiter(text: string): boolean {
  return WIKI_LINK_DELIMITERS.some((delimiter) => text.includes(delimiter));
}

function* markdownLines(lines: string[], start: number): Generator<SourceLine> {
  let fence: string | undefined;
  let comment = false;
  for (let index = start; index < lines.length; index++) {
    const text = lines[index];
    const [, marker, rest] = FENCE_PATTERN.exec(text) ?? [];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length && !rest.trim()) {
        fence = undefined;
      }
      continue;
    }
    if (comment || text.trimStart().startsWith("<!--")) {
      comment = !text.includes("-->");
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    yield { line: index + 1, text };
  }
}

function validatePeriod(
  start: SourceLine | undefined,
  end: SourceLine | undefined,
  diagnostics: ActionDiagnostic[],
): TaskPeriod | undefined {
  function validated(field: SourceLine | undefined, label: string) {
    const result = periodDateSchema.safeParse(field?.text);
    if (result.success) return result.data;
    diagnostics.push({ line: field?.line, message: invalidPeriodDate(label) });
  }

  const from = validated(start, "дату начала");
  const to = validated(end, "дату окончания");
  if (!from || !to) return;
  if (from > to) {
    diagnostics.push({ line: end?.line, message: reversedPeriod });
    return;
  }
  return { start: from, end: to };
}

function readLegacyPeriod(lines: SourceLine[], diagnostics: ActionDiagnostic[]) {
  let source: SourceLine | undefined;
  for (const { line, text } of lines) {
    const match = LEGACY_PERIOD_HEADING_PATTERN.exec(text.trim());
    if (match) {
      source = { line, text: match[1] };
      break;
    }
  }
  const dates = source?.text.match(LEGACY_DATE_RANGE_PATTERN);
  if (!source || !dates) {
    diagnostics.push({ line: source?.line, message: missingLegacyDates });
    return;
  }
  const { line } = source;
  const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = dates;
  return validatePeriod(
    { line, text: [startYear, startMonth, startDay].join("-") },
    { line, text: [endYear, endMonth, endDay].join("-") },
    diagnostics,
  );
}

function wikiLink(contents: string) {
  const [target, alias] = contents.split(WIKI_LINK_ALIAS_SEPARATOR, 2);
  const link = target.trim();
  if (!link) return;
  const filename = noteName(link);
  return { link, title: alias?.trim() || filename || link };
}

function readTask(
  { line, text: sourceText }: SourceLine,
  format: TasksFormat,
  diagnostics: ActionDiagnostic[],
): CurrentTask | undefined {
  const row = TASK_PATTERN.exec(sourceText.trimEnd());
  if (!row) {
    diagnostics.push({ line, message: invalidTask });
    return;
  }

  const [, mark, text] = row;
  const task: CurrentTask = { line, title: text, completed: mark !== UNCHECKED_MARK };
  const links = Array.from(text.matchAll(TASK_LINKS_PATTERN));
  const [firstLink] = links;
  const [rawLink, linkContents] = firstLink ?? [];
  const note = rawLink && wikiLink(linkContents);
  const remainder = rawLink ? text.replace(rawLink, "") : text;
  if (links.length > 1 || (rawLink && !note) || hasWikiLinkDelimiter(remainder)) {
    diagnostics.push({ line, message: ambiguousTaskLink });
    return task;
  }
  if (format === TASKS_FORMAT.properties && rawLink !== text) {
    diagnostics.push({ line, message: expectedTaskLink });
  }
  if (rawLink && note) {
    task.title = text.replace(rawLink, () => note.title);
    task.link = note.link;
  }
  return task;
}

export function parseCurrentTasks(markdown: string): CurrentTasksDocument {
  const lines = markdown.replace(MARKDOWN_BOM, EMPTY_STRING).split(/\r\n?|\n/);
  const diagnostics: ActionDiagnostic[] = [];
  const properties = readPeriodProperties(lines, diagnostics);
  const { fields, bodyStart, hasDuplicatePeriodFields } = properties;
  const writable = writablePeriodProperties(properties);
  const { start, end } = writable ?? {};
  const isPeriodEditable = Boolean(writable);
  const isPeriodEmpty = isPeriodEditable && !start?.text && !end?.text;
  const body = Array.from(markdownLines(lines, bodyStart));
  const format = fields.size ? TASKS_FORMAT.properties : TASKS_FORMAT.legacy;
  let period: TaskPeriod | undefined;
  if (format === TASKS_FORMAT.legacy) period = readLegacyPeriod(body, diagnostics);
  else if (!isPeriodEmpty)
    period = validatePeriod(fields.get(PERIOD_FIELD.start), fields.get(PERIOD_FIELD.end), diagnostics);

  const groups: CurrentTaskGroup[] = [];
  let group: CurrentTaskGroup | undefined;
  for (const source of body) {
    const { line, text: sourceText } = source;
    const text = sourceText.trim();
    const heading = HEADING_PATTERN.exec(sourceText);
    if (heading) {
      const [, marker, headingText] = heading;
      if (group) group.nextHeadingLine = line;
      group = undefined;
      if (marker !== PROJECT_HEADING_MARKER) continue;
      const label = headingText.replace(TRAILING_HEADING_MARKERS_PATTERN, "").trim();
      const projectLink = PROJECT_LINK_PATTERN.exec(label);
      const project = projectLink && wikiLink(projectLink[1]);
      const isToday = label === TODAY_HEADING;
      const kind = isToday ? TASK_GROUP_KIND.today : TASK_GROUP_KIND.project;
      if (isToday || project) {
        group = { kind, line, title: project?.title ?? label, link: project?.link, tasks: [] };
        groups.push(group);
      } else if (hasWikiLinkDelimiter(label)) {
        diagnostics.push({ line, message: invalidProjectHeading });
      }
      continue;
    }
    if (!group || !text || HORIZONTAL_RULE_PATTERN.test(text)) continue;
    const task = readTask(source, format, diagnostics);
    if (task) group.tasks.push(task);
  }
  return { format, period, hasDuplicatePeriodFields, isPeriodEmpty, isPeriodEditable, groups, diagnostics };
}

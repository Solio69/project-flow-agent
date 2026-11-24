import { iso } from "zod/mini";
import { ACTION_GROUP_KIND, ACTIONS_FORMAT } from "./current-actions.constants";
import {
  DIAGNOSTIC_COPY,
  FENCE_PATTERN,
  FRONTMATTER_DELIMITER,
  FRONTMATTER_FIELD_PATTERN,
  HEADING_PATTERN,
  HORIZONTAL_RULE_PATTERN,
  INLINE_COMMENT_PATTERN,
  LEGACY_DATE_RANGE_PATTERN,
  LEGACY_PERIOD_HEADING_PATTERN,
  PERIOD_FIELD,
  PROJECT_HEADING_MARKER,
  PROJECT_LINK_PATTERN,
  QUOTED_VALUE_PATTERN,
  TASK_LINKS_PATTERN,
  TASK_PATTERN,
  TODAY_HEADING,
  TRAILING_HEADING_MARKERS_PATTERN,
  UNCHECKED_MARK,
  WIKI_LINK_DELIMITERS,
} from "./parse-current-actions.constants";

const dateSchema = iso.date();
const {
  unclosedFrontmatter, duplicatePeriodField, invalidPeriodDate, reversedPeriod,
  missingLegacyDates, invalidTask, ambiguousTaskLink, expectedTaskLink, invalidProjectHeading,
} = DIAGNOSTIC_COPY;

export interface ActionDiagnostic {
  line?: number;
  message: string;
}

export interface CurrentAction {
  line: number;
  title: string;
  completed: boolean;
  link?: string;
}

export interface CurrentActionGroup {
  kind: (typeof ACTION_GROUP_KIND)[keyof typeof ACTION_GROUP_KIND];
  line: number;
  title: string;
  link?: string;
  tasks: CurrentAction[];
}

export interface CurrentActionsDocument {
  format: (typeof ACTIONS_FORMAT)[keyof typeof ACTIONS_FORMAT];
  period?: { start: string; end: string };
  groups: CurrentActionGroup[];
  diagnostics: ActionDiagnostic[];
}

type PeriodKey = (typeof PERIOD_FIELD)[keyof typeof PERIOD_FIELD];
type SourceLine = { line: number; text: string };

function isFrontmatterDelimiter(line: string): boolean {
  return line.trim() === FRONTMATTER_DELIMITER;
}

function hasWikiLinkDelimiter(text: string): boolean {
  return WIKI_LINK_DELIMITERS.some((delimiter) => text.includes(delimiter));
}

function readFrontmatter(lines: string[], diagnostics: ActionDiagnostic[]) {
  const fields = new Map<PeriodKey, SourceLine>();
  if (!isFrontmatterDelimiter(lines[0])) return { fields, bodyStart: 0 };

  const end = lines.findIndex((line, index) => index > 0 && isFrontmatterDelimiter(line));
  if (end === -1) {
    diagnostics.push({ line: 1, message: unclosedFrontmatter });
    return { fields, bodyStart: 1 };
  }

  for (let index = 1; index < end; index++) {
    const match = FRONTMATTER_FIELD_PATTERN.exec(lines[index]);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (key !== PERIOD_FIELD.start && key !== PERIOD_FIELD.end) continue;
    const line = index + 1;
    if (fields.has(key)) {
      diagnostics.push({ line, message: duplicatePeriodField });
      continue;
    }
    const value = rawValue.replace(INLINE_COMMENT_PATTERN, "").trim();
    const quoted = QUOTED_VALUE_PATTERN.exec(value);
    fields.set(key, { line, text: quoted?.[2] ?? value });
  }

  return { fields, bodyStart: end + 1 };
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
): CurrentActionsDocument["period"] {
  function validated(field: SourceLine | undefined, label: string) {
    const result = dateSchema.safeParse(field?.text);
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
  const [target, alias] = contents.split("|", 2);
  const link = target.trim();
  if (!link) return;
  const filename = link.split("#")[0].split("/").pop()?.replace(/\.md$/i, "");
  return { link, title: alias?.trim() || filename || link };
}

function readTask(
  { line, text: sourceText }: SourceLine,
  format: CurrentActionsDocument["format"],
  diagnostics: ActionDiagnostic[],
): CurrentAction | undefined {
  const row = TASK_PATTERN.exec(sourceText.trimEnd());
  if (!row) {
    diagnostics.push({ line, message: invalidTask });
    return;
  }

  const [, mark, text] = row;
  const task: CurrentAction = { line, title: text, completed: mark !== UNCHECKED_MARK };
  const links = Array.from(text.matchAll(TASK_LINKS_PATTERN));
  const [firstLink] = links;
  const [rawLink, linkContents] = firstLink ?? [];
  const note = rawLink && wikiLink(linkContents);
  const remainder = rawLink ? text.replace(rawLink, "") : text;
  if (links.length > 1 || (rawLink && !note) || hasWikiLinkDelimiter(remainder)) {
    diagnostics.push({ line, message: ambiguousTaskLink });
    return task;
  }
  if (format === ACTIONS_FORMAT.properties && rawLink !== text) {
    diagnostics.push({ line, message: expectedTaskLink });
  }
  if (rawLink && note) {
    task.title = text.replace(rawLink, () => note.title);
    task.link = note.link;
  }
  return task;
}

export function parseCurrentActions(markdown: string): CurrentActionsDocument {
  const lines = markdown.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  const diagnostics: ActionDiagnostic[] = [];
  const { fields, bodyStart } = readFrontmatter(lines, diagnostics);
  const body = Array.from(markdownLines(lines, bodyStart));
  const format = fields.size ? ACTIONS_FORMAT.properties : ACTIONS_FORMAT.legacy;
  const period = format === ACTIONS_FORMAT.properties
    ? validatePeriod(fields.get(PERIOD_FIELD.start), fields.get(PERIOD_FIELD.end), diagnostics)
    : readLegacyPeriod(body, diagnostics);

  const groups: CurrentActionGroup[] = [];
  let group: CurrentActionGroup | undefined;
  for (const source of body) {
    const { line, text: sourceText } = source;
    const text = sourceText.trim();
    const heading = HEADING_PATTERN.exec(sourceText);
    if (heading) {
      const [, marker, headingText] = heading;
      group = undefined;
      if (marker !== PROJECT_HEADING_MARKER) continue;
      const label = headingText.replace(TRAILING_HEADING_MARKERS_PATTERN, "").trim();
      const projectLink = PROJECT_LINK_PATTERN.exec(label);
      const project = projectLink && wikiLink(projectLink[1]);
      const isToday = label === TODAY_HEADING;
      const kind = isToday ? ACTION_GROUP_KIND.today : ACTION_GROUP_KIND.project;
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
  return { format, period, groups, diagnostics };
}

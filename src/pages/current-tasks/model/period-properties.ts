import { iso } from "zod/mini";
import { EMPTY_STRING, LABEL_COLON, SPACE } from "../../../shared/lib";
import {
  COMMENT_MARK, DATE_SHAPED_VALUE, DIAGNOSTIC_COPY, FRONTMATTER_DELIMITER,
  FRONTMATTER_FIELD_PATTERN, INLINE_COMMENT_PATTERN, MARKDOWN_BOM, PERIOD_FIELD,
  QUOTED_VALUE_PATTERN, YAML_SEQUENCE_ITEM,
} from "./parse-current-tasks.constants";
import type { ActionDiagnostic } from "./types";

const { unclosedFrontmatter, duplicatePeriodField } = DIAGNOSTIC_COPY;
const { start: startKey, end: endKey } = PERIOD_FIELD;
export const periodDateSchema = iso.date();

type PeriodKey = typeof startKey | typeof endKey;
type PeriodProperty = { line: number; text: string; isScalar: boolean; withValue: (value?: string) => string };

function isFrontmatterDelimiter(line: string) {
  return line.trimEnd() === FRONTMATTER_DELIMITER;
}

function periodProperty(key: string, gap: string, raw: string, line: number): PeriodProperty {
  const isCommentOnly = raw.startsWith(COMMENT_MARK);
  const comment = isCommentOnly
    ? gap + raw
    : raw.match(INLINE_COMMENT_PATTERN)?.[0] ?? EMPTY_STRING;
  const scalar = isCommentOnly ? EMPTY_STRING : raw.slice(0, raw.length - comment.length);
  const value = scalar.trim();
  const [, quote = EMPTY_STRING, quotedValue] = QUOTED_VALUE_PATTERN.exec(value) ?? [];
  const trailing = scalar.slice(scalar.trimEnd().length);
  const prefix = key + LABEL_COLON;
  const text = quotedValue ?? value;

  return {
    line, text, isScalar: !text || DATE_SHAPED_VALUE.test(text),
    withValue: (next) => next === undefined
      ? prefix + comment
      : prefix + (gap || SPACE) + quote + next + quote + trailing + comment,
  };
}

export function readPeriodProperties(lines: readonly string[], diagnostics: ActionDiagnostic[] = []) {
  const fields = new Map<PeriodKey, PeriodProperty>();
  let hasDuplicatePeriodFields = false;
  const [firstLine = EMPTY_STRING] = lines;
  if (!isFrontmatterDelimiter(firstLine.replace(MARKDOWN_BOM, EMPTY_STRING)))
    return { fields, bodyStart: 0, hasDuplicatePeriodFields };

  const end = lines.findIndex((line, index) => index > 0 && isFrontmatterDelimiter(line));
  if (end === -1) {
    diagnostics.push({ line: 1, message: unclosedFrontmatter });
    return { fields, bodyStart: 1, hasDuplicatePeriodFields };
  }

  let previousPeriodField: PeriodProperty | undefined;
  for (let index = 1; index < end; index++) {
    const source = lines[index];
    const trimmed = source.trimStart();
    if (!trimmed || trimmed.startsWith(COMMENT_MARK)) continue;
    if (source !== trimmed || YAML_SEQUENCE_ITEM.test(source)) {
      if (previousPeriodField) previousPeriodField.isScalar = false;
      continue;
    }
    previousPeriodField = undefined;
    const [, rawKey, gap, raw] = FRONTMATTER_FIELD_PATTERN.exec(source) ?? [];
    const keyText = rawKey?.trimEnd();
    const key = keyText && (QUOTED_VALUE_PATTERN.exec(keyText)?.[2] ?? keyText);
    if (key !== startKey && key !== endKey) continue;
    const line = index + 1;
    if (fields.has(key)) {
      hasDuplicatePeriodFields = true;
      diagnostics.push({ line, message: duplicatePeriodField });
    } else {
      previousPeriodField = periodProperty(rawKey, gap, raw, line);
      fields.set(key, previousPeriodField);
    }
  }

  return { fields, bodyStart: end + 1, hasDuplicatePeriodFields };
}

export function writablePeriodProperties({ fields, hasDuplicatePeriodFields }: ReturnType<typeof readPeriodProperties>) {
  const start = fields.get(startKey);
  const end = fields.get(endKey);
  if (hasDuplicatePeriodFields || !start || !end) return;
  if (start.isScalar && end.isScalar) return { start, end };
}

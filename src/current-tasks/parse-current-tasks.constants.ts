export const PERIOD_FIELD = { start: "period_start", end: "period_end" } as const;
export const FRONTMATTER_DELIMITER = "---";
export const PROJECT_HEADING_MARKER = "##";
export const TODAY_HEADING = "Сегодня";
export const UNCHECKED_MARK = " ";
export const WIKI_LINK_DELIMITERS = ["[[", "]]"];

export const FRONTMATTER_FIELD_PATTERN = /^([^:]+):[ \t]*(.*)$/;
export const INLINE_COMMENT_PATTERN = /[ \t]+#.*$/;
export const QUOTED_VALUE_PATTERN = /^(["'])(.*)\1$/;
export const FENCE_PATTERN = /^ {0,3}(\x60{3,}|~{3,})(.*)$/;
export const LEGACY_PERIOD_HEADING_PATTERN = /^\*\*Период планирования\*\*:\s*(.*)$/i;
export const LEGACY_DATE_RANGE_PATTERN = /^(\d{2})\.(\d{2})\.(\d{4})\s*[-–—]\s*(\d{2})\.(\d{2})\.(\d{4})$/;
export const TASK_PATTERN = /^-[ \t]+\[([ xX])\][ \t]+(\S.*)$/;
export const HEADING_PATTERN = /^ {0,3}(#{1,6})[ \t]+(.+)$/;
export const TRAILING_HEADING_MARKERS_PATTERN = /[ \t]+#+[ \t]*$/;
export const HORIZONTAL_RULE_PATTERN = /^(?:-{3,}|\*{3,}|_{3,})$/;
const WIKI_LINK_PATTERN = /\[\[([^[\]]+)\]\]/;
export const TASK_LINKS_PATTERN = new RegExp(WIKI_LINK_PATTERN.source, "g");
export const PROJECT_LINK_PATTERN = new RegExp("^" + WIKI_LINK_PATTERN.source + "$");
export const DIAGNOSTIC_COPY = {
  unclosedFrontmatter: "Блок свойств не закрыт.",
  duplicatePeriodField: "Свойство периода повторяется.",
  invalidPeriodDate: (label: string) => "Не удалось прочитать " + label + " периода.",
  reversedPeriod: "Дата окончания раньше даты начала периода.",
  missingLegacyDates: "Ожидались две даты в строке «Период планирования».",
  invalidTask: "Строка не похожа на задачу с галочкой.",
  ambiguousTaskLink: "Не удалось однозначно прочитать ссылку задачи.",
  expectedTaskLink: "Ожидалась одна ссылка на файл задачи.",
  invalidProjectHeading: "Не удалось прочитать заголовок проекта.",
};

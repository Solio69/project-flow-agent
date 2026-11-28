import { createTaskCase, renameTaskCase } from "./scaffold-data.mjs";

export const legacyPeriodHeading = "**Период планирования**: 23.11.2026 - 29.11.2026";

export const legacyTasks = [
  legacyPeriodHeading,
  "## [[Мастерская]]",
  "- [ ] Проверить [[Черновик]]",
].join("\n");

export const propertyTasks = [
  "---",
  "period_start: 2026-11-23",
  "period_end: 2026-11-29",
  "---",
  "## Сегодня",
  "- [x] [[Мастерская/project inbox/Черновик]]",
  "- [ ] [[Пропавшая заметка]]",
  "## [[Мастерская/Мастерская|Творчество]]",
  "## [[Пропавший проект]]",
].join("\n");

export const obsoleteTasks = [legacyPeriodHeading, "## [[Старое чтение]]"].join("\n");

const completionHeader = "\uFEFF---\r\nperiod_start: 2026-11-23\r\nperiod_end: 2026-11-29\r\nnote: 'Текст [ ]'\r\n---\r\n";
const projectHeading = "## [[Мастерская]]";
const todayHeading = "## Сегодня";
const { oldLink, oldTitle, newLink } = renameTaskCase;
const draftWikiLink = `[[${oldLink}|${oldTitle}]]`;
const shortDraftRow = `- [ ] [[${oldTitle}]]`;
const ambiguousTaskRow = "- [ ] Ссылка [[A]] и [[B]]";
const completionRow = (mark) => `-\t[${mark}]  ${draftWikiLink}  `;
const afterCompletion = "\n\n# Другая часть\n- [ ] Другая запись\n";

export const completionCases = [
  { unchecked: `${completionHeader}${todayHeading}\r\n${completionRow(" ")}\r\n${projectHeading}${afterCompletion}`,
    checked: `${completionHeader}${todayHeading}\r\n${completionRow("x")}\r\n${projectHeading}${afterCompletion}` },
  { unchecked: `${completionHeader}${projectHeading}\r\n${completionRow(" ")}${afterCompletion}`,
    checked: `${completionHeader}${projectHeading}\r\n${completionRow("x")}${afterCompletion}` },
];

const periodBody = completionCases[0].unchecked.slice(completionHeader.length);
const periodHeader = (start, end) =>
  `\uFEFF---\r\nperiod_start: ${start}# начало\r\nperiod_end:${end}\r\nnote: 'Текст [ ]'\r\n---\r\n`;

export const periodChange = {
  initial: `${periodHeader("'2026-11-23' ", " 2026-11-29")}${periodBody}`,
  next: { start: "2026-11-30", end: "2026-12-01" },
  saved: `${periodHeader("'2026-11-30' ", " 2026-12-01")}${periodBody}`,
  crossYear: { start: "2026-11-01", end: "2027-01-31" },
  crossYearSaved: `${periodHeader("'2026-11-01' ", " 2027-01-31")}${periodBody}`,
  crossYearLabel: /01\.11\.2026 — 31\.01\.2027/,
  empty: `${periodHeader("", "")}${periodBody}`,
  checked: `${periodHeader("", "")}${completionCases[0].checked.slice(completionHeader.length)}`,
  invalid: { start: "2026-02-29", end: "2026-03-01" },
  reversed: { start: "2026-12-01", end: "2026-11-30" },
};

export const readOnlyPeriodCases = [
  legacyTasks,
  periodChange.initial.replace("period_end: 2026-11-29", "period_end:\r\n  day: 29"),
  periodChange.initial.replace("period_end: 2026-11-29", "period_end:\r\n- 2026-11-29"),
  periodChange.initial.replace("period_end: 2026-11-29", "period_end: 2026-11-29\r\n'period_end': 2026-11-28"),
];

const periodNoteProperty = "note: 'Текст [ ]'";
const periodNoteBlock = "note: |\r\n  ---\r\n  Продолжение свойства";
const periodEndProperty = "\r\nperiod_end:";
const beforePeriodEnd = (markdown) => markdown
  .replace(periodEndProperty, `\r\n${periodNoteBlock}${periodEndProperty}`)
  .replace(`\r\n${periodNoteProperty}`, "");
const periodWithTrailingBlock = periodChange.initial.replace(periodNoteProperty, periodNoteBlock);
const periodClosingLine = "\r\n---\r\n";

export const periodWithYamlBlock = {
  initial: beforePeriodEnd(periodChange.initial),
  saved: beforePeriodEnd(periodChange.saved),
  duplicate: periodWithTrailingBlock.replace(periodClosingLine, `\r\nperiod_end: 2026-11-28${periodClosingLine}`),
  unclosed: periodWithTrailingBlock.replace(periodClosingLine, "\r\n"),
};

export const renameWithoutAliasCases = completionCases.map(({ checked }) => {
  const before = checked.replace(draftWikiLink, `[[${oldLink}]]`);
  return { before, after: before.replace(oldLink, newLink) };
});

const draftAlias = "Черновик для редактора";
const draftPrefix = "Доработать";
const aliasedDraftWikiLink = `[[${oldLink}|${draftAlias}]]`;
const aliasedDraftMarkdown = completionCases[0].unchecked.replace(draftWikiLink, aliasedDraftWikiLink);
export const renameWithAlias = {
  before: aliasedDraftMarkdown,
  after: aliasedDraftMarkdown.replace(oldLink, newLink),
  title: draftAlias,
};
export const taskWithTitlePrefix = {
  markdown: aliasedDraftMarkdown.replace(aliasedDraftWikiLink, `${draftPrefix} ${aliasedDraftWikiLink}`),
  title: `${draftPrefix} ${draftAlias}`,
};

export const ambiguousCompletion = `${completionHeader}${projectHeading}\r\n${completionRow(" ")}\r\n${ambiguousTaskRow}${afterCompletion}`;
export const duplicatedCompletion = `${completionHeader}${todayHeading}\r\n${completionRow(" ")}\r\n${projectHeading}\r\n${completionRow(" ")}${afterCompletion}`;
export const externalListEdit = "\n\n## Наброски\nТекст сохранён извне\n";

const brokenNextHeading = "\r\n## [[Оборванный заголовок";
const completionList = `${completionHeader}${projectHeading}\r\n`;

export const completionBeforeBrokenHeading = {
  unchecked: `${completionList}${completionRow(" ")}${brokenNextHeading}${afterCompletion}`,
  checked: `${completionList}${completionRow("x")}${brokenNextHeading}${afterCompletion}`,
};
export const completionWithTwoTasks = `${completionList}${completionRow(" ")}\r\n- [ ] [[Вторая задача]]`;
const secondCompletionRow = (mark) => `- [${mark}] [[Вторая задача]]`;
const previouslyCompleted = "- [x] [[Готовая задача]]";
const remainingActive = "- [ ] [[Другая активная задача]]";
const taskAnnotation = "\r\n<!-- Пояснение к предыдущей задаче -->\r\n";
export const completionAcrossAnnotation = `${completionList}${completionRow(" ")}${taskAnnotation}${secondCompletionRow(" ")}`;
export const completionAlongsideAnnotation = `${completionList}${completionRow(" ")}${taskAnnotation}${secondCompletionRow("x")}`;
export const completedBeforeAnnotation = `${completionList}${completionRow("x")}\r\n${secondCompletionRow("x")}${taskAnnotation}${previouslyCompleted}`;
export const completionWithOneActiveTask = `${completionList}${completionRow(" ")}\r\n${previouslyCompleted}`;
const completionOrderStates = [
  [completionRow(" "), previouslyCompleted, secondCompletionRow(" "), remainingActive],
  [secondCompletionRow(" "), remainingActive, completionRow("x"), previouslyCompleted],
  [remainingActive, secondCompletionRow("x"), completionRow("x"), previouslyCompleted],
  [remainingActive, secondCompletionRow(" "), completionRow("x"), previouslyCompleted],
];
export const completionOrderCases = [todayHeading, projectHeading].map((heading) =>
  completionOrderStates.map((rows) => `${completionHeader}${heading}\r\n${rows.join("\r\n")}${afterCompletion}`),
);
export const completionWithShortLink = `${completionList}${shortDraftRow}`;
const blogHeading = "## [[Блог/Блог|Контент]]";
const editorialHeading = "## [[Блог/Блог|Редакция]]";
const activeBlogRow = "- [ ] [[Блог/Черновик блога]]";
const blogPanelsIntro = `${completionHeader}${[
  todayHeading,
  activeBlogRow,
].join("\r\n")}`;
export const aliasedBlogTasks = `${blogPanelsIntro}\r\n${blogHeading}`;
export const repeatedBlogPanels = `${aliasedBlogTasks}\r\n${editorialHeading}`;
export const reorderedBlogPanels = `${blogPanelsIntro}\r\n${editorialHeading}\r\n${blogHeading}`;

const draftRow = completionRow(" ");
const moveRow = secondCompletionRow(" ");
const commentForNextTask = "\r\n<!-- Пояснение к следующей задаче -->\r\n";
const reorderOtherGroup = `\r\n${blogHeading}\r\n${activeBlogRow}${afterCompletion}`;
export const reorderCases = [todayHeading, projectHeading].map((heading) => {
  const group = `${completionHeader}${heading}\r\n`;
  return {
    initial: `${group}${[draftRow, previouslyCompleted, moveRow, remainingActive].join("\r\n")}${reorderOtherGroup}`,
    reordered: `${group}${[moveRow, previouslyCompleted, remainingActive, draftRow].join("\r\n")}${reorderOtherGroup}`,
    annotated: `${group}${draftRow}${taskAnnotation}${moveRow}${reorderOtherGroup}`,
  };
});
const reorderGroup = `${completionHeader}${todayHeading}`;
const reorderRows = [draftRow, moveRow].join("\r\n");
export const reorderWithEdgeText = [
  { title: "перед первой задачей", markdown: `${reorderGroup}${commentForNextTask}${reorderRows}${reorderOtherGroup}` },
  { title: "после последней задачи", markdown: `${reorderGroup}\r\n${reorderRows}${taskAnnotation}${reorderOtherGroup}` },
];
const reorderWithinEdges = (middle) => `${reorderGroup}${commentForNextTask}${[draftRow, ...middle, previouslyCompleted].join("\r\n")}${taskAnnotation}${reorderOtherGroup}`;
export const reorderInsideEdgeText = {
  initial: reorderWithinEdges([moveRow, remainingActive]),
  reordered: reorderWithinEdges([remainingActive, moveRow]),
};
const moveDocument = (todayRows, projectRows) => `${completionHeader}${[
  todayHeading, ...todayRows, projectHeading, ...projectRows, blogHeading,
].join("\r\n")}${afterCompletion}`;
const emptyTodayMove = [todayHeading, projectHeading, moveRow];
export const transferTaskCases = [
  { markdown: moveDocument([draftRow], [moveRow]), today: true, completed: false, updateLinks: true },
  { markdown: moveDocument([], [draftRow]), today: false, completed: false, updateLinks: false },
  { markdown: moveDocument([], [completionRow("x")]), today: false, completed: true, updateLinks: true },
];
export const transferWithShortLink = moveDocument([shortDraftRow], []);
export const transferWithAmbiguousToday = moveDocument([draftRow, ambiguousTaskRow], []);
const duplicatePath = (number = "") => `Мастерская/project inbox/${draftAlias} (копия${number}).md`;
const sourceDuplicateRow = `- [ ] [[${oldLink}|${draftAlias}]]`;
const duplicateRow = (number) => `- [ ] [[${duplicatePath(number)}]]`;
export const duplicateCases = {
  today: moveDocument([sourceDuplicateRow], [moveRow]),
  todaySaved: moveDocument([sourceDuplicateRow, duplicateRow()], [moveRow]),
  project: moveDocument([], [sourceDuplicateRow.replace("[ ]", "[x]")]),
  projectSaved: moveDocument([], [sourceDuplicateRow.replace("[ ]", "[x]"), duplicateRow()]),
  occupied: duplicatePath(),
  next: duplicatePath(" 2"),
  savedAfterRetry: moveDocument([sourceDuplicateRow, duplicateRow(" 2")], [moveRow]),
};
export const archiveTaskCases = [
  { markdown: moveDocument([draftRow], [moveRow]), after: moveDocument([], [moveRow]), today: true, completed: false },
  { markdown: moveDocument([], [draftRow, moveRow]), after: moveDocument([], [moveRow]), today: false, completed: false },
  { markdown: moveDocument([completionRow("x")], [moveRow]), after: moveDocument([], [moveRow]), today: true, completed: true },
  { markdown: moveDocument([], [moveRow, completionRow("x")]), after: moveDocument([], [moveRow]), today: false, completed: true },
];

export const createTaskMarkdown = `${completionHeader}${[
  todayHeading, projectHeading, draftRow, previouslyCompleted, blogHeading,
].join("\r\n")}${afterCompletion}`;

export const danglingCreateTaskMarkdown = createTaskMarkdown.replace(
  previouslyCompleted, createTaskCase.danglingLink,
);
export const danglingHeadingTaskMarkdown = createTaskMarkdown.replace(previouslyCompleted, createTaskCase.danglingHeadingLink);
export const createTaskAlreadyToday = createTaskMarkdown.replace(todayHeading, `${todayHeading}\r\n${createTaskCase.row}`);

export const moveCases = [
  {
    initial: moveDocument([draftRow, activeBlogRow, previouslyCompleted], [remainingActive, moveRow]),
    moved: moveDocument([draftRow, moveRow, activeBlogRow, previouslyCompleted], [remainingActive]),
    returned: moveDocument([draftRow, activeBlogRow, previouslyCompleted], [moveRow, remainingActive]),
  },
  {
    initial: moveDocument([activeBlogRow, previouslyCompleted], [moveRow]),
    moved: moveDocument([activeBlogRow, moveRow, previouslyCompleted], []),
    returned: moveDocument([activeBlogRow, previouslyCompleted], [moveRow]),
  },
  {
    initial: `${completionHeader}${emptyTodayMove.join("\r\n")}`,
    moved: `${completionHeader}${[todayHeading, moveRow, projectHeading].join("\r\n")}`,
    returned: `${completionHeader}${emptyTodayMove.join("\r\n")}`,
  },
];

export const completedMove = moveDocument([], [secondCompletionRow("x")]);
export const ambiguousMoveCases = {
  duplicate: moveDocument([moveRow], [moveRow]),
  annotation: moveDocument([], [`${moveRow}${taskAnnotation}${remainingActive}`]),
  todayHeading: moveDocument([todayHeading], [moveRow]),
};

export const moveAfterComment = moveDocument([], [`${remainingActive}${commentForNextTask}${moveRow}`]);
export const moveWithDuplicatePeriod = moveCases[0].initial.replace(
  "period_end:",
  "period_start: 2026-11-24\r\nperiod_end:",
);

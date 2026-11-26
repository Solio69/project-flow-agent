import { createTaskCase } from "./scaffold-data.mjs";

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
const completionRow = (mark) => `-\t[${mark}]  [[Мастерская/project inbox/Черновик|Черновик]]  `;
const afterCompletion = "\n\n# Другая часть\n- [ ] Другая запись\n";

export const completionCases = [
  { unchecked: completionHeader + todayHeading + "\r\n" + completionRow(" ") + "\r\n" + projectHeading + afterCompletion,
    checked: completionHeader + todayHeading + "\r\n" + completionRow("x") + "\r\n" + projectHeading + afterCompletion },
  { unchecked: completionHeader + projectHeading + "\r\n" + completionRow(" ") + afterCompletion,
    checked: completionHeader + projectHeading + "\r\n" + completionRow("x") + afterCompletion },
];

export const ambiguousCompletion = completionHeader + projectHeading + "\r\n" + completionRow(" ")
  + "\r\n- [ ] Ссылка [[A]] и [[B]]" + afterCompletion;
export const duplicatedCompletion = completionHeader + todayHeading + "\r\n" + completionRow(" ") + "\r\n"
  + projectHeading + "\r\n" + completionRow(" ") + afterCompletion;
export const externalListEdit = "\n\n## Наброски\nТекст сохранён извне\n";

const brokenNextHeading = "\r\n## [[Оборванный заголовок";
const completionList = completionHeader + projectHeading + "\r\n";

export const completionBeforeBrokenHeading = {
  unchecked: completionList + completionRow(" ") + brokenNextHeading + afterCompletion,
  checked: completionList + completionRow("x") + brokenNextHeading + afterCompletion,
};
export const completionWithTwoTasks = completionList + completionRow(" ") + "\r\n- [ ] [[Вторая задача]]";
const secondCompletionRow = (mark) => `- [${mark}] [[Вторая задача]]`;
const previouslyCompleted = "- [x] [[Готовая задача]]";
const remainingActive = "- [ ] [[Другая активная задача]]";
const taskAnnotation = "\r\n<!-- Пояснение к предыдущей задаче -->\r\n";
export const completionAcrossAnnotation = completionList + completionRow(" ") + taskAnnotation + secondCompletionRow(" ");
export const completionAlongsideAnnotation = completionList + completionRow(" ") + taskAnnotation + secondCompletionRow("x");
export const completedBeforeAnnotation = completionList + completionRow("x") + "\r\n"
  + secondCompletionRow("x") + taskAnnotation + previouslyCompleted;
export const completionWithOneActiveTask = completionList + completionRow(" ") + "\r\n" + previouslyCompleted;
const completionOrderStates = [
  [completionRow(" "), previouslyCompleted, secondCompletionRow(" "), remainingActive],
  [secondCompletionRow(" "), remainingActive, completionRow("x"), previouslyCompleted],
  [remainingActive, secondCompletionRow("x"), completionRow("x"), previouslyCompleted],
  [remainingActive, secondCompletionRow(" "), completionRow("x"), previouslyCompleted],
];
export const completionOrderCases = [todayHeading, projectHeading].map((heading) =>
  completionOrderStates.map((rows) => completionHeader + heading + "\r\n" + rows.join("\r\n") + afterCompletion),
);
export const completionWithShortLink = completionList + "- [ ] [[Черновик]]";
export const aliasedBlogTasks = completionHeader + [
  todayHeading,
  "- [ ] [[Блог/Черновик блога]]",
  "## [[Блог/Блог|Контент]]",
].join("\r\n");

const blogHeading = "## [[Блог/Блог|Контент]]";
const activeBlogRow = "- [ ] [[Блог/Черновик блога]]";
const draftRow = completionRow(" ");
const moveRow = secondCompletionRow(" ");
const commentForNextTask = "\r\n<!-- Пояснение к следующей задаче -->\r\n";
const reorderOtherGroup = "\r\n" + blogHeading + "\r\n" + activeBlogRow + afterCompletion;
export const reorderCases = [todayHeading, projectHeading].map((heading) => {
  const group = completionHeader + heading + "\r\n";
  return {
    initial: group + [draftRow, previouslyCompleted, moveRow, remainingActive].join("\r\n") + reorderOtherGroup,
    reordered: group + [moveRow, previouslyCompleted, remainingActive, draftRow].join("\r\n") + reorderOtherGroup,
    annotated: group + draftRow + taskAnnotation + moveRow + reorderOtherGroup,
  };
});
const reorderGroup = completionHeader + todayHeading;
const reorderRows = [draftRow, moveRow].join("\r\n");
export const reorderWithEdgeText = [
  { title: "перед первой задачей", markdown: reorderGroup + commentForNextTask + reorderRows + reorderOtherGroup },
  { title: "после последней задачи", markdown: reorderGroup + "\r\n" + reorderRows + taskAnnotation + reorderOtherGroup },
];
const reorderWithinEdges = (middle) => reorderGroup + commentForNextTask
  + [draftRow, ...middle, previouslyCompleted].join("\r\n") + taskAnnotation + reorderOtherGroup;
export const reorderInsideEdgeText = {
  initial: reorderWithinEdges([moveRow, remainingActive]),
  reordered: reorderWithinEdges([remainingActive, moveRow]),
};
const moveDocument = (todayRows, projectRows) => completionHeader + [
  todayHeading, ...todayRows, projectHeading, ...projectRows, blogHeading,
].join("\r\n") + afterCompletion;
const emptyTodayMove = [todayHeading, projectHeading, moveRow];

export const createTaskMarkdown = completionHeader + [
  todayHeading, projectHeading, draftRow, previouslyCompleted, blogHeading,
].join("\r\n") + afterCompletion;

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
    initial: completionHeader + emptyTodayMove.join("\r\n"),
    moved: completionHeader + [todayHeading, moveRow, projectHeading].join("\r\n"),
    returned: completionHeader + emptyTodayMove.join("\r\n"),
  },
];

export const completedMove = moveDocument([], [secondCompletionRow("x")]);
export const ambiguousMoveCases = {
  duplicate: moveDocument([moveRow], [moveRow]),
  annotation: moveDocument([], [moveRow + taskAnnotation + remainingActive]),
  todayHeading: moveDocument([todayHeading], [moveRow]),
};

export const moveAfterComment = moveDocument([], [remainingActive + commentForNextTask + moveRow]);
export const moveWithDuplicatePeriod = moveCases[0].initial.replace(
  "period_end:",
  "period_start: 2026-11-24\r\nperiod_end:",
);

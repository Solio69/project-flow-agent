import { legacyPeriodHeading } from "./current-tasks-markdown.mjs";

const noDiagnostics = [];
const legacyProjects = ["Проект Б", "Проект А"];

export const legacyFormat = {
  markdown: [
    `﻿${legacyPeriodHeading}`,
    "**Заметка**: обычный текст", "",
    "## [[Проект Б]]", "- [ ] Прочитать [[Черновик|версию]]", "- [X] Проверить результат",
    "", "---", "", "## [[Проект А]]",
    "- [x] [[Проект А/project inbox/Подготовить отчёт.md]]",
  ].join("\r\n"),
  expected: {
    format: "legacy",
    period: { start: "2026-11-23", end: "2026-11-29" },
    groupTitles: legacyProjects,
    groupLinks: legacyProjects,
    tasks: [
      ["Прочитать версию", false, "Черновик"],
      ["Проверить результат", true, undefined],
      ["Подготовить отчёт", true, "Проект А/project inbox/Подготовить отчёт.md"],
    ],
    diagnostics: noDiagnostics,
  },
};

export const propertiesFormat = {
  markdown: [
    "---", "period_start: '2028-02-28'", "period_end: 2028-02-29", "---", "",
    "## Сегодня", "- [ ] [[Проекты/Проект А/project inbox/Проверка]]",
    "## [[Проект А]]", "- [x] [[Проекты/Проект А/project inbox/Подготовка]]",
  ].join("\n"),
  expected: {
    format: "properties",
    period: { start: "2028-02-28", end: "2028-02-29" },
    groups: [["today", "Сегодня"], ["project", "Проект А"]],
    diagnostics: noDiagnostics,
  },
};

export const malformedActions = {
  markdown: [
    "---", "period_start: 2026-02-30", "period_end: 2026-03-02", "---",
    "## [[Проект]]", "- [ ] Задача без точной ссылки",
    "```md", "- [ ] [[Пример в блоке кода]]", "```",
    "- [x] [[Реальная задача]]", "## Пояснения", "- [ ] [[Чужой список]]",
  ].join("\n"),
  expected: {
    period: undefined,
    diagnosticLines: [2, 6],
    taskTitles: ["Задача без точной ссылки", "Реальная задача"],
  },
};

export const reversedPeriod = {
  markdown: "**Период планирования**: 29.11.2026 — 23.11.2026\n## [[Проект]]",
  expected: { period: undefined, diagnosticLine: 1, diagnosticMessage: /дат[аы]|период/i },
};

export const brokenProjectHeading = {
  markdown: [
    legacyPeriodHeading,
    "## [[Без окончания",
    "- [ ] [[Задача без однозначного проекта]]",
    "## [[Другой проект]]",
    "- [ ] [[Разобрать задачу]]",
  ].join("\n"),
  expected: { diagnosticLines: [2], groupTitles: ["Другой проект"] },
};

export const aliasedProjectHeading = {
  markdown: [legacyPeriodHeading, "## [[Мастерская/Мастерская|Творчество]]"].join("\n"),
  expected: { title: "Творчество", link: "Мастерская/Мастерская" },
};

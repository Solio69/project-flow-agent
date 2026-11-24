export const legacyPeriodHeading = "**Период планирования**: 23.11.2026 - 29.11.2026";

export const legacyActions = [
  legacyPeriodHeading,
  "## [[Мастерская]]",
  "- [ ] Проверить [[Черновик]]",
].join("\n");

export const propertyActions = [
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

export const obsoleteActions = [legacyPeriodHeading, "## [[Старое чтение]]"].join("\n");

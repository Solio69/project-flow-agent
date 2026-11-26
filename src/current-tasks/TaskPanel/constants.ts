import { SPACE } from "../../constants/text";

export const COPY = {
  emptyToday: "На сегодня пока нет задач",
  emptyProject: "На этот период задач нет",
  allTasksCompleted: "Все задачи выполнены",
  collapse: "Свернуть список проекта",
  expand: "Развернуть список проекта",
  create: "Новая задача",
  archive: "Архивировать проект",
};

export const ICONS = { chevron: "chevron-right", add: "plus", archive: "trash-2", folder: "folder" } as const;
export const MIN_TASKS_FOR_GRIP = 2;
export const ENABLED_TASK_CONTROL = "input:enabled";
export const QUOTED_TITLE_PREFIX = SPACE + "«";
export const QUOTED_TITLE_SUFFIX = "»";

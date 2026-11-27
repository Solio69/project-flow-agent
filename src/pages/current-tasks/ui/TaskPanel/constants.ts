import { SPACE } from "../../../../shared/lib";

export const COPY = {
  emptyToday: "На сегодня пока нет задач",
  emptyProject: "На этот период задач нет",
  allTasksCompleted: "Все задачи выполнены",
  collapse: "Свернуть список проекта",
  expand: "Развернуть список проекта",
  archive: "Архивировать проект",
};

export const ICONS = { chevron: "chevron-right", archive: "trash-2" } as const;
export const MIN_TASKS_FOR_GRIP = 2;
export const ENABLED_TASK_CONTROL = "input:enabled";
export const QUOTED_TITLE_PREFIX = `${SPACE}«`;
export const QUOTED_TITLE_SUFFIX = "»";

export const TASK_REORDER = {
  row: ".pfa-task[data-completed='false']",
  handle: "button.pfa-task-grip",
  otherControl: "button, input, label",
  listDragging: "is-reordering",
  gap: "pfa-drag-gap",
  ghost: "pfa-drag-ghost",
  mouse: "mouse",
  touch: "touch",
  primaryButton: 0,
  activationDistance: 4,
  overlap: 0.3,
} as const;

export const CSS_PIXEL = "px";
export const CSS_TRANSLATE_Y_START = "translateY(";
export const CSS_FUNCTION_END = ")";

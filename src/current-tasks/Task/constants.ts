import { KEYBOARD_KEY } from "../../constants/keyboard";
import { SPACE } from "../../constants/text";

export const COPY = {
  checkbox: "Выполнено",
  moveToToday: "Добавить в «Сегодня»",
  returnToProject: "Вернуть в список проекта",
  actions: "Действия",
  reorder: "Изменить порядок",
  reorderHint: "Перетащите задачу или используйте стрелки вверх и вниз",
};

const { arrowUp, arrowDown } = KEYBOARD_KEY;
export const REORDER_KEY_SHORTCUTS = [arrowUp, arrowDown].join(SPACE);
export const OMIT_FROM_TAB_ORDER = -1;

export const ICONS = { check: "check", grip: "grip-vertical", up: "arrow-up", down: "arrow-down", menu: "ellipsis" } as const;

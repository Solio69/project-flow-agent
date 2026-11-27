export const DUPLICATE_TASK_COPY = {
  action: "Дублировать задачу",
  success: "Копия задачи создана.",
  failed: "Не удалось создать копию задачи.",
  retry: "Нажмите «Дублировать задачу» ещё раз, чтобы добавить уже созданный файл.",
} as const;

export const DUPLICATE_TASK_ICON = "copy-plus";
export const EXISTING_COPY_SUFFIX = / \(копия(?: \d+)?\)$/u;
export const FIRST_COPY_NUMBER = 1;
export const FIRST_COPY = " (копия)";
export const NUMBERED_COPY = (number: number) => ` (копия ${number})`;

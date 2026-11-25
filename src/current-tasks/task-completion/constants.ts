export const COPY = {
  invalidList: "Галочки доступны только в списке с корректным периодом и новым форматом.",
  taskChanged: "Файл или ID задачи изменился. Список обновится, затем повторите действие.",
  conflict: "Заметка изменилась. Список обновится, затем повторите действие.",
  ambiguousGroup: "Неоднозначная запись в списке. Исправьте отмеченные строки в заметке.",
  interleavedText: (line: number) => `Обнаружен текст между задачами на строке ${line}. Изменение отменено.`,
  duplicateTask: "Задача или её ID повторяется. Исправьте дубли в списке.",
} as const;

export const CHECKED_MARK = "x";
export const CHECKBOX_START = "[";
export const PRESERVED_LINE_ENDING = /(\r\n|\n|\r)/;

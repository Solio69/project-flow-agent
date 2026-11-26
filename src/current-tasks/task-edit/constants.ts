export const TASK_EDIT_COPY = {
  invalidList: "Для изменения задач укажите корректные даты начала и окончания периода без повторов.",
  taskChanged: "Файл или ID задачи изменился. Список обновится, затем повторите действие.",
  conflict: "Заметка изменилась. Список обновится, затем повторите действие.",
  ambiguousGroup: "Неоднозначная запись в списке. Исправьте отмеченные строки в заметке.",
  interleavedText: (line: number) => `Обнаружен текст между задачами на строке ${line}. Изменение отменено.`,
  duplicateTask: "Задача или её ID повторяется. Исправьте дубли в списке.",
} as const;

export const PRESERVED_LINE_ENDING = /(\r\n|\n|\r)/;
export const SECTION_GAP_OPTIONS = { allowSectionSeparator: true } as const;

const taskId = "tsk_example";

export const taskNoteMarkdown = `---\nid: ${taskId}\n---\n`;
export const differentTaskNoteMarkdown = "---\nid: tsk_replaced\n---\n";

export const completionReviewNotes = {
  second: { path: "Мастерская/project inbox/Вторая задача.md", link: "Вторая задача" },
  replacement: { path: "Мастерская/Черновик.md" },
  blog: { path: "Блог/Блог.md", link: "Блог/Блог" },
  blogTask: { path: "Блог/Черновик блога.md", link: "Блог/Черновик блога" },
};

export const aliasedBlogExpected = {
  panel: /data-project-tone="blog"[^>]+aria-label="Контент"/,
  todayPrefix: /class="pfa-project-emoji"[^>]*>📝<\/span><strong class="pfa-task-project">Контент:/,
};

export const completionFeedback = {
  checked: /<input(?=[^>]*type="checkbox")(?=[^>]*checked="")(?=[^>]*aria-label="Выполнено: Черновик")/,
  disabled: /<input(?=[^>]*type="checkbox")(?=[^>]*disabled="")/,
  ambiguous: /Неоднозначная запись/,
  conflict: /заметка изменилась/i,
  duplicate: /повторяется/i,
  taskChanged: /Файл или ID задачи изменился/i,
};

export const sourceNotePaths = {
  legacy: "Текущие действия.md",
  renamed: "Текущие задачи.md",
};

export const tasksDesign = {
  period: /23–29 ноября/,
  emptyToday: /На сегодня пока нет задач/,
  todayPanel: 'data-section="today"',
  projectPanel: 'data-section="project"',
  disclosure: /aria-expanded="true"/,
  history: /<button(?=[^>]*disabled="")(?=[^>]*aria-label="Перенести выполненные в историю")[^>]*>/,
};

export const currentTasksExpected = {
  viewTitle: "Текущие задачи",
  viewHeading: /<h2>Текущие задачи<\/h2>/,
  legacyTask: /Проверить Черновик/,
  legacyProject: /<h3><a [^>]+>Мастерская<\/a><\/h3>/,
  todayGroup: /Сегодня/,
  missingNote: /Пропавшая заметка/,
  obsoleteGroup: /Старое чтение/,
  taskId,
  projectAlias: "Творчество",
  projectLink: /<h3><a [^>]+>Творчество<\/a><\/h3>/,
  missingProject: /<h3>Пропавший проект<\/h3>/,
  missingSource: /не найдена в этом хранилище/,
  noteOpenFailed: "Не удалось открыть связанную заметку.",
};

export const projectLinkCase = {
  note: { title: "Мастерская", link: "Мастерская/Мастерская", notePath: "Мастерская/Мастерская.md" },
  middleButton: 1,
  rightButton: 2,
};

const buildScript = "esbuild.config.mjs";
const manifestFile = "manifest.json";

export const watchFixture = {
  buildScript,
  scriptFiles: ["src", buildScript, "esbuild.constants.mjs", "tsconfig.json", manifestFile],
  environmentFile: ".env.local",
  environmentVariable: "PFA_OBSIDIAN_VAULT",
  explicitWatchOption: "--watch",
  configuredWatchOption: "--watch-obsidian",
  obsidianDirectory: ".obsidian",
  expectedConfigDirectory: /\.obsidian/,
  pluginsDirectory: "plugins",
  pluginId: "project-flow-agent",
  markerFile: ".hotreload",
  scriptFile: "main.js",
  manifestFile,
  styleFile: "styles.css",
  expectedViewType: /project-flow-agent-current-actions/,
  expectedThemeVariable: /--text-muted/,
  originalHeading: "<h2>{title}</h2>",
  probe: "pfa-watch-probe",
  componentPath: ["src", "current-tasks", "CurrentTasks", "CurrentTasks.tsx"],
};

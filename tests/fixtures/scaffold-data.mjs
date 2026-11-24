const taskId = "tsk_example";

export const taskNoteMarkdown = `---\nid: ${taskId}\n---\n`;

export const sourceNotePaths = {
  legacy: "Текущие действия.md",
  renamed: "Текущие задачи.md",
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

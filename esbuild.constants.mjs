export const CURRENT_DIRECTORY = ".";
export const DEFAULT_OUTPUT_DIRECTORY = "dist";
export const OBSIDIAN_CONFIG_DIRECTORY = ".obsidian";
export const OBSIDIAN_PLUGINS_DIRECTORY = "plugins";
export const OBSIDIAN_VAULT_ENV = "PFA_OBSIDIAN_VAULT";
export const UTF8_ENCODING = "utf8";
export const MISSING_PATH_ERROR_CODES = ["ENOENT", "ENOTDIR"];
export const WATCH_OPTION = "--watch";
export const WATCH_OBSIDIAN_OPTION = "--watch-obsidian";

export const ENTRY_POINTS = {
  main: "src/main.ts",
  styles: "src/styles.css",
  manifest: "manifest.json",
};
export const JSON_EXTENSION = ".json";
export const COPY_LOADER = "copy";
export const BUILD_FORMAT = "cjs";
export const BUILD_TARGET = "es2021";
export const EXTERNAL_MODULES = ["obsidian"];
export const INLINE_SOURCEMAP = "inline";
export const BUILD_LOG_LEVEL = "info";

export const HOT_RELOAD = {
  pluginName: "hot-reload-marker",
  markerFile: ".hotreload",
  markerContents: "",
  appendOptions: { flag: "a" },
};

export const ERROR_MESSAGES = {
  invalidArguments: "Использование: npm run build, npm run dev -- [путь к хранилищу] или npm run dev:obsidian",
  missingVaultPath: `Укажи путь к хранилищу Obsidian в ${OBSIDIAN_VAULT_ENV} в файле .env.local.`,
  missingConfigDirectory: (configDir) =>
    `В указанном хранилище отсутствует папка ${OBSIDIAN_CONFIG_DIRECTORY}: ${configDir}`,
};

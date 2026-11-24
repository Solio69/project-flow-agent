import { readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";
import {
  BUILD_FORMAT,
  BUILD_LOG_LEVEL,
  BUILD_TARGET,
  COPY_LOADER,
  CURRENT_DIRECTORY,
  DEFAULT_OUTPUT_DIRECTORY,
  ENTRY_POINTS,
  ERROR_MESSAGES,
  EXTERNAL_MODULES,
  HOT_RELOAD,
  INLINE_SOURCEMAP,
  JSON_EXTENSION,
  MISSING_PATH_ERROR_CODES,
  OBSIDIAN_CONFIG_DIRECTORY,
  OBSIDIAN_PLUGINS_DIRECTORY,
  OBSIDIAN_VAULT_ENV,
  UTF8_ENCODING,
  WATCH_OBSIDIAN_OPTION,
  WATCH_OPTION,
} from "./esbuild.constants.mjs";

const { manifest } = ENTRY_POINTS;
const { invalidArguments, missingVaultPath, missingConfigDirectory } = ERROR_MESSAGES;
const { pluginName, markerFile, markerContents, appendOptions } = HOT_RELOAD;

const projectDir = fileURLToPath(new URL(CURRENT_DIRECTORY, import.meta.url));
const [mode, explicitVaultPath, ...extraArguments] = process.argv.slice(2);
const watchObsidian = mode === WATCH_OBSIDIAN_OPTION;
const watch = mode === WATCH_OPTION || watchObsidian;

if ((mode && !watch) || extraArguments.length || (watchObsidian && explicitVaultPath !== undefined)) {
  throw new Error(invalidArguments);
}

const vaultPath = watchObsidian ? process.env[OBSIDIAN_VAULT_ENV]?.trim() : explicitVaultPath;
if (watchObsidian && !vaultPath) {
  throw new Error(missingVaultPath);
}

let outdir = join(projectDir, DEFAULT_OUTPUT_DIRECTORY);
if (vaultPath) {
  const configDir = resolve(vaultPath, OBSIDIAN_CONFIG_DIRECTORY);
  const config = await stat(configDir).catch((error) => {
    const { code } = error;
    if (MISSING_PATH_ERROR_CODES.includes(code)) return undefined;
    throw error;
  });
  if (!config?.isDirectory()) {
    throw new Error(missingConfigDirectory(configDir));
  }
  const { id } = JSON.parse(await readFile(join(projectDir, manifest), UTF8_ENCODING));
  outdir = join(configDir, OBSIDIAN_PLUGINS_DIRECTORY, id);
}

let hotReloadReady = false;
const hotReloadMarker = {
  name: pluginName,
  setup(buildContext) {
    buildContext.onEnd(async ({ errors }) => {
      if (errors.length || hotReloadReady) return;
      await writeFile(join(outdir, markerFile), markerContents, appendOptions);
      hotReloadReady = true;
    });
  },
};

const options = {
  absWorkingDir: projectDir,
  entryPoints: ENTRY_POINTS,
  loader: { [JSON_EXTENSION]: COPY_LOADER },
  outdir,
  bundle: true,
  format: BUILD_FORMAT,
  target: BUILD_TARGET,
  external: EXTERNAL_MODULES,
  minify: !watch,
  sourcemap: watch ? INLINE_SOURCEMAP : false,
  logLevel: BUILD_LOG_LEVEL,
  plugins: vaultPath ? [hotReloadMarker] : [],
};

if (watch) {
  const dev = await context(options);
  await dev.watch();
} else {
  await build(options);
}

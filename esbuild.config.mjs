import { stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, context } from "esbuild";

const projectDir = fileURLToPath(new URL(".", import.meta.url));
const [mode, explicitVaultPath, ...extraArguments] = process.argv.slice(2);
const watchObsidian = mode === "--watch-obsidian";
const watch = mode === "--watch" || watchObsidian;

if ((mode && !watch) || extraArguments.length || (watchObsidian && explicitVaultPath !== undefined)) {
  throw new Error("Использование: npm run build, npm run dev -- [путь к хранилищу] или npm run dev:obsidian");
}

const vaultPath = watchObsidian ? process.env.PFA_OBSIDIAN_VAULT?.trim() : explicitVaultPath;
if (watchObsidian && !vaultPath) {
  throw new Error("Укажи путь к хранилищу Obsidian в PFA_OBSIDIAN_VAULT в файле .env.local.");
}

let outdir = join(projectDir, "dist");
if (vaultPath) {
  const configDir = resolve(vaultPath, ".obsidian");
  const config = await stat(configDir).catch((error) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return undefined;
    throw error;
  });
  if (!config?.isDirectory()) {
    throw new Error(`В указанном хранилище отсутствует папка .obsidian: ${configDir}`);
  }
  outdir = join(configDir, "plugins", "project-flow-agent");
}

let hotReloadReady = false;
const hotReloadMarker = {
  name: "hot-reload-marker",
  setup(buildContext) {
    buildContext.onEnd(async ({ errors }) => {
      if (errors.length || hotReloadReady) return;
      await writeFile(join(outdir, ".hotreload"), "", { flag: "a" });
      hotReloadReady = true;
    });
  },
};

const options = {
  absWorkingDir: projectDir,
  entryPoints: {
    main: "src/main.ts",
    styles: "src/styles.css",
    manifest: "manifest.json",
  },
  loader: { ".json": "copy" },
  outdir,
  bundle: true,
  format: "cjs",
  target: "es2021",
  external: ["obsidian"],
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
  plugins: vaultPath ? [hotReloadMarker] : [],
};

if (watch) {
  const dev = await context(options);
  await dev.watch();
} else {
  await build(options);
}

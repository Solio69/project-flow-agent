import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { build } from "esbuild";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const project = fileURLToPath(new URL("../", import.meta.url));
const config = join(project, "esbuild.config.mjs");

async function removeFixture(directory, parent = tmpdir()) {
  const resolved = await realpath(directory);
  assert.equal(dirname(resolved), await realpath(parent));
  await rm(resolved, { recursive: true, force: true });
}

async function waitForBuild(child, ready) {
  const deadline = Date.now() + 10000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
    if (await ready()) return true;
    await setTimeout(50);
  }
  return false;
}

test("кнопка открывает, повторно активирует и позволяет переоткрыть вкладку", async () => {
  const { outputFiles: [bundle] } = await build({
    absWorkingDir: project,
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "cjs",
    external: ["obsidian", "react", "react-dom"],
    write: false,
  });

  let ribbonClick;
  const views = new Map();
  const leaves = [];
  const mounts = [];
  const notices = [];
  let failNextOpen = false;
  let activeLeaf;

  class Plugin {
    constructor(app) {
      this.app = app;
    }

    registerView(type, makeView) {
      views.set(type, makeView);
    }

    addRibbonIcon(_icon, title, onClick) {
      assert.equal(title, "Текущие действия");
      ribbonClick = onClick;
    }
  }

  class ItemView {
    contentEl = {};
  }

  class Notice {
    constructor(message) {
      notices.push(message);
    }
  }

  const workspace = {
    getLeavesOfType(type) {
      return leaves.filter((leaf) => leaf.view?.getViewType() === type);
    },
    getLeaf(kind) {
      assert.equal(kind, "tab");
      const leaf = {
        async setViewState({ type }) {
          await Promise.resolve();
          if (failNextOpen) {
            failNextOpen = false;
            throw new Error("Вкладка недоступна");
          }
          this.view = views.get(type)(this);
          await this.view.onOpen();
        },
        detach() {
          leaves.splice(leaves.indexOf(this), 1);
        },
      };
      leaves.push(leaf);
      return leaf;
    },
    async revealLeaf(leaf) {
      activeLeaf = leaf;
    },
  };

  const module = { exports: {} };
  runInNewContext(bundle.text, {
    module,
    exports: module.exports,
    console: { error() {} },
    require(name) {
      if (name === "obsidian") return { Plugin, ItemView, Notice };
      if (name === "react-dom/client") {
        return {
          createRoot() {
            const mount = {
              render(element) {
                this.markup = renderToStaticMarkup(element);
              },
              unmount() {
                this.closed = true;
              },
            };
            mounts.push(mount);
            return mount;
          },
        };
      }
      return require(name);
    },
  });

  const plugin = new module.exports.default({ workspace });
  await plugin.onload?.();
  assert.equal(views.size, 1, "плагин регистрирует тип вкладки");
  assert.equal(typeof ribbonClick, "function", "плагин регистрирует кнопку");

  await Promise.all([ribbonClick(), ribbonClick()]);
  assert.equal(leaves.length, 1, "быстрые повторные нажатия открывают одну вкладку");
  assert.equal(activeLeaf, leaves[0]);
  assert.equal(activeLeaf.view.getDisplayText(), "Текущие действия");
  assert.match(mounts[0].markup, /<h2>Текущие действия<\/h2>/);

  await ribbonClick();
  assert.equal(leaves.length, 1, "открытая вкладка используется повторно");

  await activeLeaf.view.onClose();
  leaves.pop();
  assert.equal(mounts[0].closed, true);
  await ribbonClick();
  assert.equal(mounts.length, 2);

  await activeLeaf.view.onClose();
  leaves.pop();
  failNextOpen = true;
  await ribbonClick();
  assert.equal(notices.length, 1);
  assert.equal(leaves.length, 0, "после ошибки не остаётся пустая вкладка");
  await ribbonClick();
  assert.equal(mounts.length, 3, "после ошибки можно открыть вкладку повторно");
});

test("режим VS Code читает локальный путь и пересобирает React после правки", async (t) => {
  const fixtureParent = join(project, "node_modules");
  const fixture = await mkdtemp(join(fixtureParent, ".pfa-watch-"));
  const vault = join(fixture, "vault");
  let child;
  let closed;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) child.kill();
    await closed;
    await removeFixture(fixture, fixtureParent);
  });

  await mkdir(join(vault, ".obsidian"), { recursive: true });
  for (const path of ["src", "esbuild.config.mjs", "tsconfig.json", "manifest.json"]) {
    await cp(join(project, path), join(fixture, path), { recursive: true });
  }
  await writeFile(join(fixture, ".env.local"), `PFA_OBSIDIAN_VAULT='${vault}'\n`);
  const env = { ...process.env };
  delete env.PFA_OBSIDIAN_VAULT;
  child = spawn(
    process.execPath,
    ["--env-file=.env.local", join(fixture, "esbuild.config.mjs"), "--watch-obsidian"],
    { cwd: fixture, env, timeout: 24000, stdio: ["ignore", "ignore", "pipe"] },
  );
  let errors = "";
  child.stderr.setEncoding("utf8").on("data", (text) => {
    errors += text;
  });
  closed = once(child, "close");

  const output = join(vault, ".obsidian", "plugins", "project-flow-agent");
  const marker = join(output, ".hotreload");
  const ready = await waitForBuild(child, () => existsSync(marker));
  assert.ok(ready, `после сборки должен появиться .hotreload\n${errors}`);
  const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
  const pkg = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  assert.equal(manifest.id, "project-flow-agent");
  assert.equal(manifest.version, pkg.version);
  const bundle = join(output, "main.js");
  assert.match(await readFile(bundle, "utf8"), /project-flow-agent-current-actions/);
  assert.match(await readFile(join(output, "styles.css"), "utf8"), /--text-muted/);

  const component = join(fixture, "src", "current-actions", "CurrentActions.tsx");
  const before = await readFile(component, "utf8");
  const after = before.replace("Каркас плагина загружен.", "pfa-watch-probe");
  assert.notEqual(after, before, "пробная правка меняет JSX");
  await writeFile(component, after);
  const rebuilt = await waitForBuild(child, async () =>
    (await readFile(bundle, "utf8")).includes("pfa-watch-probe"),
  );
  assert.ok(rebuilt, `новый текст должен появиться в main.js\n${errors}`);
});

test("watch отклоняет путь без конфигурации Obsidian", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "pfa-invalid-"));
  t.after(() => removeFixture(directory));
  const result = spawnSync(process.execPath, [config, "--watch", directory], {
    cwd: project,
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\.obsidian/);
  assert.equal(existsSync(join(directory, ".obsidian")), false);
});

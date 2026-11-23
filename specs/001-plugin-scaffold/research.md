# Технические решения

- `ItemView` с корнем React. Obsidian управляет вкладкой, а React отвечает за содержимое. Для открытия кнопка использует `Workspace.getLeaf("tab")`, а при повторном вызове активирует существующую вкладку.
- Сборка esbuild выпускает `main.js` в CommonJS. Obsidian загружает плагин по манифесту. Watch пишет одну и ту же группу артефактов в `dist/` или в каталог указанного хранилища. Hot Reload следит за установленной сборкой.
- Узкий автоматический тест исполняет вход плагина с имитацией Workspace. Он проверяет поведение, которое можно воспроизвести вне десктопного приложения. Проверка интерфейса в реальной вкладке остаётся отдельной.

[Сборка плагина Obsidian](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin) · [React в плагине](https://docs.obsidian.md/Plugins/Getting%20started/Use%20React%20in%20your%20plugin) · [Hot Reload](https://github.com/pjeby/hot-reload)

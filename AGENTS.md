# Coding workflow

These rules apply to development tasks in this repository. Follow the current user request, `.specify/memory/constitution.md`, and any more specific project rules.

Перед написанием или ревью кода прочитай [кодстайл проекта](docs/code-style.md).
Он применяется к TypeScript, React, тестам и скриптам сборки.

## Language

- Reply in the language the user used to address you, unless they explicitly request another language.
- Write new or updated project documentation in that same language. Preserve required Spec Kit filenames, IDs, markers, and command syntax. Translate explanatory prose and headings where doing so keeps the required structure intact.
- If the user has not explicitly chosen a documentation language and the request mixes languages, gives too little natural-language context, or conflicts with the language already used in project documentation, ask which language to use before writing. Do not silently switch a project's documentation language.

## Before every task

1. Start grooming with `$speckit-grooming-prepare`. For follow-up review fixes within the same task, a short pass is enough: check the feedback, scope, and acceptance criteria. Do not invent missing requirements.
2. During grooming, inspect only relevant context and do not change code or documents. For material decisions, explain viable options, differences, benefits, risks, and a recommendation. Clarify open questions.
3. Present a short agreed task summary in chat: result, boundaries, approach, and acceptance criteria. Wait for explicit agreement to that scope. Silence is not agreement.
4. After agreement, prepare `spec.md` with `$speckit-specify`, then use applicable `$speckit-clarify`, `$speckit-plan`, `$speckit-checklist`, `$speckit-tasks`, analysis, and implementation. No repeated approval is required between these stages. The agreed `spec.md` becomes the durable task statement; do not create a separate grooming file.

## Before coding

- Run `$speckit-analyze` after `tasks.md`. This pass only reads artifacts and outputs a full report. **In a separate action after that pass**, save the full report without shortening it to the task's `analysis.md`. Do not claim the standard analyze command wrote the file itself.
- Resolve blocking technical inconsistencies within the agreed scope, rerun analysis, and update `analysis.md`. Discuss a new material decision about behavior, data, security, or scope with the user before the affected implementation.
- If the constitution still contains template placeholders, agree and complete it with `$speckit-constitution` before the first task. Do not invent project rules.

## Implementation and TDD

- Apply Red → Green → Refactor to every new or changed testable behavior: write and run an automated test that fails because the behavior is missing or wrong, make the smallest production change and pass the test, then refactor if useful and rerun affected tests. An environment, import, or installation error does not count as Red.
- For documentation, configuration, or other changes without testable behavior, define an appropriate check in `plan.md`. Do not write an artificial test that mirrors the implementation.
- Stay within the agreed scope. Use the repository's actual stack, commands, and conventions. Discuss a concrete need before installing dependencies or changing external systems.
- При реализации или изменении React-интерфейса используй [$senior-frontend](.agents/skills/senior-frontend/SKILL.md). Проверяй согласованные сценарии во вкладке Obsidian.
- Record executed commands and outcomes in the task's `verification.md` as Passed, Failed, Blocked, or NotRun. Do not report an unperformed check as successful.
- Перед передачей результата сверяй изменения с рабочей спецификацией и [кодстайлом](docs/code-style.md). Для итогового ревью изменений кода используй [$code-reviewer](.agents/skills/code-reviewer/SKILL.md). Проверь также, что в diff только изменения по задаче и в нём нет секретов.
- Когда пользователь даёт правку по коду, обнови применимую проверку в [code-reviewer](.agents/skills/code-reviewer/SKILL.md) по его замечанию.

## Git и полномочия агента

- Следуй разделу [«Работа с Git»](.specify/memory/constitution.md#работа-с-git). Для каждой новой фичи сверь пункт «Карты проекта», текущую ветку и ветку, указанную пользователем.
- Spec Kit ведёт спецификацию в `specs/`, а её каталог записывает в `.specify/feature.json`. Git-расширение и Git-хуки Spec Kit для работы с фичей не используются.
- Локальный коммит и push выполняются по явному поручению пользователя. Сообщение коммита дословно совпадает с видимым заголовком рабочего `spec.md`. На удалённом репозитории разрешены чтение и обычный push в указанную ветку. Pull request создаёт пользователь.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

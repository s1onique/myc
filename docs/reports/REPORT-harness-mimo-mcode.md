# Харненсы mcode (MiniMax Code) и mimo (MiMo Code) в wire и ростере

Датировка: 2026-10-04. Машина: macOS (darwin/arm64), установлены
`mcode 0.6.2` (`@minimax-ai/code`, `~/.minimax-code`) и `mimo 0.1.15`
(`@mimo-ai/cli`, bun global). Всё ниже установлено чтением бинариев,
исходников и документации плюс живыми прогонами — не догадкой по именам.

## 1. Что сделано

Список харнессов (`packages/swarm/src/harness.ts`) расширен с
`claude, codex, opencode, kimi` до `…, mcode, mimo`, CHECK схемы роя
расширен миграцией `010-harness-mcode-mimo` (перестройка четырёх таблиц по
образцу 008 с колонками миграции 009), `myc wire` получил `planMcode` и
`planMimo`. Подробности фактов — ниже, они же продублированы в докстроках
`planMcode`/`planMimo` (wire.ts) и `MCODE_EVENTS`/`mimoPlugin`
(hooks/templates.ts).

## 2. mimo (MiMo Code, @mimo-ai/cli 0.1.15)

Источники: документация `mimo.xiaomi.com/mimocode` (skills, config-files,
config-overrides, mcp-servers), исходники `XiaomiMiMo/MiMo-Code` на теге
`v0.1.15` (`packages/opencode/src/skill/index.ts`, `config/paths.ts`,
`config/plugin.ts` — mimo это форк opencode), бинарь
`@mimo-ai/mimocode-darwin-arm64` и живые прогоны в изолированном
temp-проекте.

Что он читает:

- **Скиллы проекта** — `.mimocode/skills/<имя>/SKILL.md` (и
  `.mimocode/skill/`), глубина любая; фронтматтер `name` + `description`
  (общий с Claude Code формат — подходит общий `skillMd()`). Проверено:
  `mimo debug skill` в temp-проекте выдал файл из `.mimocode/skills/`.
  Внешние брендовые каталоги (`.claude`, `.codex`, `.opencode`) у mimo
  ВЫКЛЮЧЕНЫ по умолчанию (`MIMOCODE_ENABLE_*_SKILLS`), свой — включён,
  поэтому скилл кладём только в `.mimocode/`.
- **Конфиг проекта** — `.mimocode/mimocode.json`: маркер в нём появился в
  `mimo debug config` и вытеснил корневой `mimocode.json` (точное место
  проектного конфига называет и встроенная скилл-документация mimo).
- **MCP** — ключ `mcp` в формате opencode:
  `{type: "local", command: ["myc", "mcp", "--profile", "agent"], enabled: true}`.
- **Хуки** — плагин `.mimocode/plugin/myc.ts`, автозагрузка
  `{plugin,plugins}/*.{ts,js}` из каталогов конфига (ConfigPlugin.load;
  проверено: `mimo debug config` показал файл из `.mimocode/plugin/` в
  resolved `plugin[]`). Шина событий — одна в один с opencode:
  `experimental.chat.system.transform` (prime в системный промпт),
  `experimental.session.compacting` + `session.compacted` (absorb, два
  обработчика со страховкой), `tool.execute.after` (post-edit),
  `client.session.messages` (стенограмма) — все пять есть в бинаре 0.1.15,
  `appendContext` отсутствует (0), как у opencode. Поэтому плагин —
  переиспользованное тело `opencodeFamilyPlugin` с агентом `mimo`.
- **Строка статуса** — конфиг-ключа нет; замечаем вслух, как у opencode.

Чего wire НЕ делает для mimo: пользовательский слой (`--scope user`) — как
у kimi/codex, только проектный слой; `MIMOCODE_ENABLE_*` флаги не нужны —
свой каталог включён по умолчанию.

## 3. mcode (MiniMax Code, @minimax-ai/code 0.6.2)

Источники: бинарь `~/.minimax-code/releases/0.6.2/lib` (chunks, grep по
строкам), README/CHANGELOG пакета, `mcode --help`, `mcode plugin marketplace list`.

Что он читает:

- **Скиллы проекта** — walkUp от каталога сессии ищет `.minimax/skills`
  (priority 65), `.claude/skills` (60), `.agents/skills`; внешние
  источники включены по умолчанию (`external.enabled: true, walkUp: true`
  в дефолтах `lr`). Пользовательские — `~/.minimax/skills`. СВОЙ каталог
  проекта — `.minimax/skills`; `.claude/skills` чужой не занимаем.
- **MCP** — только корневой `.mcp.json` сессии (CHANGELOG: «Automatically
  load project MCP servers from .mcp.json»). Форма: разборчик `Oae`
  принимает и `{"mcpServers": {...}}`, и голую карту; верхние ключи файла —
  `$schema`/`mcpServers`, ключи записи — `type/command/args/env/cwd`.
  Это тот же файл, что у Claude Code и Kimi, — в plan он входит через
  общий `planRootMcp`, который планирует файл ровно один раз за прогон
  (два действия на один путь дали бы двойную запись в журнале).
- **Хуки — только пользовательские плагины.** Регистр возможностей бинаря:
  `hooks: {status: "retired", reason: "Standalone user hooks are no longer
  supported. Custom hooks belong to Plugins."}`. Проектных плагинов нет:
  `scanLocalPackages()` сканирует единственный каталог
  `join(dataDir, "plugins")` = `~/.minimax/plugins`
  (MINIMAX_DATA_DIR ?? `~/.minimax`; symlink `~/.mavis`). Виды манифестов:
  `plugin.json` (свой), `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`;
  хуки CLAUDE-формы лежат в `hooks/hooks.json` (defaultPath загрузчика).
  События (`npe`): SessionStart, SessionEnd, UserPromptSubmit, PreToolUse,
  PermissionRequest, PostToolUse, Stop, SubagentStart, SubagentStop,
  PreCompact, PostCompact. Из них wire ставит ДВА — session-start и
  pre-compact, — потому что post-edit без подтверждённой формы tool_input
  mcode не ставится (правило codex/kimi: хук, который не сработает, хуже
  отсутствующего).
- **Контракт вывода** (функции `BJe`/`LJe`, sourceFormat CLAUDE):
  - SessionStart принимает `hookSpecificOutput`, и additionalContext
    разбирается той же логикой, что у Claude Code, — helper заворачивает
    вывод prime именно туда (как codexHelper).
  - PreCompact принимает только `continue/stopReason/suppressOutput/
    systemMessage/terminalSequence + decision/reason` — канала для
    контекста НЕТ, а неразобранный JSON идёт в разбор решений перед
    сжатием (`decision.continue`). Поэтому helper молча отбрасывает stdout
    absorb-session: эпизод уже записан самим absorb (побочный эффект),
    спасательный пакет контекст mcode всё равно не примет.
  - Вход: для CLAUDE-формы исполнитель требует `transcriptPath` (проверка
    `FSn`), PreCompact обязателен `trigger`; поля приходят в snake_case
    (`session_id`, `transcript_path`, `cwd`, `trigger`) — аргументы helper'а
    написаны под эту схему.
  - Таймаут в записи хука — секунды (как у Claude Code и Kimi).
- **Строка статуса** — не найдена; замечаем вслух.

Чего wire НЕ делает для mcode и почему: хуки не ставятся сами — плагин
пользовательский, а wire по D10 пишет только внутрь проекта. Как у Kimi,
ставится исполняемая половина (`.minimax/myc-hooks.mjs`) и печатаются
готовые два файла плагина с инструкцией (`plan.notes`). Каталог
`~/.minimax/plugins` сканируется при старте (`scanLocalPackages`), отдельная
команда установки не нужна; активация валидного плагина с хуками происходит
при сканировании (`enabledPlugins.push` при поддерживаемой способности).

## 4. Приёмка: живые прогоны

- `mimo debug skill` в изолированном temp-проекте: файл из
  `.mimocode/skills/`, `.mimocode/skill/` и `.agents/skills/` попал в
  выдачу (с запуском из подкаталога; сам прогон `debug skill` показывает
  проектные скиллы нестабильно — гонка отображения каталога, но не
  обнаружения: источник подтверждает оба).
- `mimo debug config` в temp-проекте: маркер из `.mimocode/mimocode.json`
  в резолвленном конфиге; `mcp.myc` в том виде, в каком его пишет plan
  (совпадает с уже живущим в конфиге пользователя записями opencode-формы).
- `mimo debug config`: файл из `.mimocode/plugin/zz-probe.ts` оказался в
  resolved `plugin[]` — автозагрузка подтверждена.
- `mcode plugin marketplace list` → `local directory ~/.minimax/plugins`
  — локальный маркетплейс ровно каталог, который сканирует scanLocalPackages.
- `mcode --help` / `mcode plugin add --help` / README: проектный MCP —
  `.mcp.json`, хук-плагины управляются через `mcode plugin`.

## 5. Сторожи и мутации

- `harness.wiring.test.ts`: три половины (текст/ wire / ростер) зелёные —
  каждый из шести харнессов даёт непустой план и проходит
  `model add --harness`; новая миграция 010 внесена в MAY_ENUMERATE.
- `roster.test.ts`: «CHECK схемы принимает ровно HARNESSES» (прямые INSERT
  mcode/mimo), накат идемпотентен (версия 10 в списке), новый describe
  «миграция 10» — база версии 9 с данными в колонках 009
  (predicted_class/scope_source/git_base) переживает перестройку на своих
  позициях, `_pre10` не остаётся, ghost-харнесс отвергается CHECK.
- `english-output.zone-b`: исключения — `opencodeFamilyPlugin` (вместо
  opencodePlugin, тело переехало) и `mcodeHelper`; `mimoPlugin`-обёртка
  литералов с кириллицей не содержит.
- `english-output.zone-a`: SQL миграции 010 — исключение рядом с 008.
- `advised-commands`: два ложных срабатывания от моих же текстов
  (`description: "myc hooks …"` читался как команда `myc hooks`; backtick
  в докстроке planMcode паровался с дальним и захватывал прозу «myc does»)
  — тексты переписаны, а не занесены в KNOWN_MISSING: советов не появилось.
- `counters.test.ts`: `mcodeHelper` и `mimoPlugin` в списке шаблонов,
  объявляющих `MYC_HOOK`/`MYC_HOOK_AGENT`.
- `wire.test.ts`: два новых describe (mimo — 5 тестов, mcode — 6), включая
  round-trip unwire (пустой `.mimocode`/`.minimax` исчезает) и единственную
  запись `.mcp.json` в журнале при `--agents claude,mcode`.
- Мутации (ручные, до правки): убрана строка из HARNESSES → roster-половина
  сторожа красная; убрана миграция 010 → «CHECK принимает ровно» красная;
  убран `$schema`-strip в unwire → тест пустого каталога красный (это и
  было поймано первым прогоном).

## 6. Что осталось / за границей

- **Падение `wire-user.statusline.test.ts` «перенос совпадает с
  установленным кодом orca» — существовало ДО правок** (проверено на HEAD
  через `git stash`): внешние чанки `/Applications/Orca.app` сменились,
  classifier-тест сравнивает с установленным кодом orca. К этой задаче не
  относится.
- **E2E-установка mcode-плагина в `~/.minimax/plugins` не выполнялась** —
  запись вне проекта (D10) и не согласовалась с окружением. Форма файлов
  (`.claude-plugin/plugin.json` + `hooks/hooks.json`, CLAUDE-формат,
  defaultPath) выведена из загрузчика бинаря; первый живой прогон хуков
  mcode зафиксирует отдельно.
- **Спасательный пакет на PreCompact mcode не доходит** — свойство харнесса
  (нет канала контекста у PreCompact), helper пишет эпизод, а пакет
  отбрасывает; у Claude это работает иначе, и сравнивать их нельзя.
- Пользовательский слой (`--scope user`) для mimo/mcode не делался —
  USER_LAYERS остался `{claude, opencode}`, отказ wire-user на новых
  именах общий («not implemented in the user layer»).
- Сайт: строка features `integrations` в `site/measurements.json`
  обновлён; `tests`-снимок и `site/data.js` пересобираются ритуалом
  релиза (см. шапку `site/build.ts`).

## 7. Изменённые файлы

Новые:

- `packages/swarm/src/migrations/010-harness-mcode-mimo.ts`
- `docs/reports/REPORT-harness-mimo-mcode.md` (этот файл)

Правлены:

- `packages/swarm/src/harness.ts` — две строки в HARNESSES
- `packages/swarm/src/migrations/index.ts` — регистрация 010
- `packages/swarm/src/roster.test.ts` — версия 10 + describe «миграция 10»
- `packages/cli/src/commands/wire.ts` — planRootMcp, planMimo, planMcode,
  PLANNERS, MIMOCODE_SCHEMA, unwire-strip `$schema` mimocode, summary
- `packages/cli/src/hooks/templates.ts` — `opencodeFamilyPlugin` +
  `mimoPlugin`, `MCODE_EVENTS`, `mcodeHelper`, `mcodeHookCommand`,
  `mcodePluginFiles`
- `packages/cli/src/harness.wiring.test.ts` — MAY_ENUMERATE += 010
- `packages/cli/src/english-output.zone-a.test.ts` — SQL 010
- `packages/cli/src/english-output.zone-b.test.ts` — opencodeFamilyPlugin,
  mcodeHelper
- `packages/cli/src/advised-commands.test.ts` — не менялся (тексты
  переписаны в wire.ts/templates.ts)
- `packages/cli/src/hooks/counters.test.ts` — mcode/mimo в списке шаблонов
- `packages/cli/src/commands/wire.test.ts` — describe mimo/mcode + статус-
  строка для новых
- `README.md` — строка wire
- `docs/design/03-interfaces-and-integration.md` — таблица хуков и список
  обнаружения wire
- `site/measurements.json` — features/integrations

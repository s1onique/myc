import type { SwarmMigration } from "./types.ts";

/**
 * Харненсы `mcode` (MiniMax Code) и `mimo` (MiMo Code) в CHECK схемы.
 *
 * Тот же ход, что в 008, и ровно по той же причине: домен чинится строкой
 * в ../harness.ts, а CHECK в тексте применённых миграций 1 и 3 заморожен
 * чек-суммой (schema.ts) — правка задним числом роняет каждую существующую
 * базу с `schema.checksum`. Значит таблицы ПЕРЕСТРАИВАЮТСЯ, как в 008, и
 * миграция 008 здесь повторена дословно с тремя отличиями:
 *
 *   1. HARNESS_CHECK расширен именами mcode и mimo;
 *   2. суффикс временных таблиц — `_pre10`, а не `_pre8`;
 *   3. CREATE каждой таблицы включает колонки, добавленные миграцией 009:
 *      `swarm_attempt.predicted_class` и `swarm_attempt.scope_source`
 *      (физический порядок — в конце, как их добавляло ADD COLUMN),
 *      `swarm_attempt_run.git_base`. Сам 009 предупредил об этом
 *      («следующая перестройка таблиц обязана перечислить и эти колонки»),
 *      и `INSERT … SELECT *` это чувствует: копия идёт позиция в позицию,
 *      колонка в колонку.
 *
 * Порядок операторов и барьеры FK — см. докстроку 008: четыре RENAME →
 * четыре CREATE → четыре INSERT от родителя к ребёнку → четыре DROP от
 * ребёнка к родителю → три CREATE INDEX (индексы уезжают вместе со своими
 * таблицами и гибнут на DROP). Всё — один накат в одной транзакции,
 * половины состояния не бывает.
 *
 * Один оператор на элемент массива (сторож roster.test.ts).
 */
const HARNESS_CHECK =
  "CHECK (harness IN ('claude','codex','opencode','kimi','mcode','mimo'))";

const SQL: readonly string[] = [
  `ALTER TABLE swarm_model RENAME TO swarm_model_pre10`,
  `ALTER TABLE swarm_model_price RENAME TO swarm_model_price_pre10`,
  `ALTER TABLE swarm_attempt RENAME TO swarm_attempt_pre10`,
  `ALTER TABLE swarm_attempt_run RENAME TO swarm_attempt_run_pre10`,

  `CREATE TABLE swarm_model (
  model_id        TEXT PRIMARY KEY,       -- "anthropic/claude-sonnet-5" — всегда с провайдером
  family          TEXT NOT NULL,          -- "claude-sonnet", "glm" — для наследования приоров между версиями
  version         TEXT NOT NULL DEFAULT '', -- "5" или "5.4", пустая строка = не указана
  parent_model_id TEXT,                   -- предыдущая версия семейства
  harness         TEXT NOT NULL ${HARNESS_CHECK},
  effort          TEXT NOT NULL DEFAULT 'medium' CHECK (effort IN ('low','medium','high')),
  tokens_per_sec  REAL NOT NULL DEFAULT 60,
  strengths       TEXT NOT NULL DEFAULT '[]', -- JSON string[] классов задач, наполняет W11
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,       -- unix ms
  updated_at      INTEGER NOT NULL        -- unix ms
)`,

  `CREATE TABLE swarm_model_price (
  model_id        TEXT NOT NULL REFERENCES swarm_model(model_id),
  valid_from      INTEGER NOT NULL,       -- unix ms, с какого момента цена действует
  usd_per_m_in    REAL NOT NULL CHECK (usd_per_m_in >= 0),  -- $ за 1M входных токенов
  usd_per_m_out   REAL NOT NULL CHECK (usd_per_m_out >= 0), -- $ за 1M выходных
  usd_per_m_cache_read  REAL NOT NULL DEFAULT 0,
  usd_per_m_cache_write REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (model_id, valid_from)
) WITHOUT ROWID`,

  `CREATE TABLE swarm_attempt (
  attempt_id      TEXT PRIMARY KEY,       -- "att_" + 12 hex
  task_id         TEXT NOT NULL,          -- id узла задачи L1
  model_id        TEXT NOT NULL REFERENCES swarm_model(model_id),
  effort          TEXT NOT NULL DEFAULT 'medium' CHECK (effort IN ('low','medium','high')),
  harness         TEXT NOT NULL ${HARNESS_CHECK},
  actor           TEXT NOT NULL DEFAULT '', -- кто исполнял: терминал/агент/человек
  task_class      TEXT NOT NULL,          -- intent:scope, ключ вопроса «на каком классе»
  class_source    TEXT NOT NULL DEFAULT 'derived'
                  CHECK (class_source IN ('derived','declared')),
  started_at      INTEGER NOT NULL,       -- unix ms
  finished_at     INTEGER,                -- NULL = попытка открыта
  verdict         TEXT CHECK (verdict IN ('accepted','rework','rejected')),
  caveats         TEXT NOT NULL DEFAULT '[]', -- JSON string[] оговорок приёмки
  retries         INTEGER NOT NULL DEFAULT 0, -- кругов доработки до приёмки
  tokens_in       INTEGER NOT NULL DEFAULT 0,
  tokens_out      INTEGER NOT NULL DEFAULT 0,
  tokens_cache_read  INTEGER NOT NULL DEFAULT 0,
  tokens_cache_write INTEGER NOT NULL DEFAULT 0,
  cost_usd        REAL,                   -- заморожен на finish, не пересчитывается
  price_valid_from INTEGER,               -- строка swarm_model_price, по которой считали
  cost_basis      TEXT CHECK (cost_basis IN ('priced','no_price','no_tokens')),
  source          TEXT NOT NULL DEFAULT 'cli', -- cli | close | backfill
  note            TEXT,
  predicted_class TEXT,                   -- 009: предсказание роутера на старте
  scope_source    TEXT                    -- 009: чем решён scope ключа task_class
                  CHECK (scope_source IN ('touched','anchors','text','none'))
)`,

  `CREATE TABLE swarm_attempt_run (
  attempt_id      TEXT PRIMARY KEY REFERENCES swarm_attempt(attempt_id),
  session_id      TEXT,                   -- uuid стенограммы харнесса
  session_source  TEXT NOT NULL DEFAULT 'none'
                  CHECK (session_source IN ('env','flag','search','none')),
  transcript_path TEXT,                   -- файл стенограммы, если известен точно
  dispatch_id     TEXT,                   -- ctx_* оркестратора
  dispatch_source TEXT NOT NULL DEFAULT 'none'
                  CHECK (dispatch_source IN ('env','flag','lookup','none')),
  run_id          TEXT,                   -- run_* оркестратора
  terminal        TEXT,                   -- term_*: ключ соединения с оркестратором
  pane_key        TEXT,                   -- <tab>:<leaf>, ключ к pid у оркестратора
  agent_pid       INTEGER,                -- pid процесса агента
  pid_source      TEXT NOT NULL DEFAULT 'none'
                  CHECK (pid_source IN ('env','flag','none')),
  harness_build   TEXT,                   -- версия харнесса, как он себя назвал
  proc_state      TEXT NOT NULL DEFAULT 'unknown'
                  CHECK (proc_state IN ('running','exited','unknown')),
  proc_checked_at INTEGER,                -- когда последний раз смотрели на pid
  proc_exited_at  INTEGER,                -- когда впервые увидели, что pid мёртв
  git_head        TEXT,                   -- HEAD на момент старта: база для diff
  files_touched   TEXT,                   -- JSON string[] на finish
  recorded_at     INTEGER NOT NULL,
  git_base        TEXT                    -- 009: JSON-снимок рабочих деревьев на старте
)`,

  `INSERT INTO swarm_model SELECT * FROM swarm_model_pre10`,
  `INSERT INTO swarm_model_price SELECT * FROM swarm_model_price_pre10`,
  `INSERT INTO swarm_attempt SELECT * FROM swarm_attempt_pre10`,
  `INSERT INTO swarm_attempt_run SELECT * FROM swarm_attempt_run_pre10`,

  `DROP TABLE swarm_attempt_run_pre10`,
  `DROP TABLE swarm_attempt_pre10`,
  `DROP TABLE swarm_model_price_pre10`,
  `DROP TABLE swarm_model_pre10`,

  `CREATE INDEX swarm_attempt_task ON swarm_attempt (task_id, started_at DESC)`,
  `CREATE INDEX swarm_attempt_arm
  ON swarm_attempt (task_class, model_id, effort, finished_at)`,
  `CREATE INDEX swarm_attempt_run_session
  ON swarm_attempt_run (session_id)
  WHERE session_id IS NOT NULL`,
];

export const migration010HarnessMcodeMimo: SwarmMigration = {
  version: 10,
  name: "harness_mcode_mimo",
  sql: SQL,
  objects: [
    "swarm_model",
    "swarm_model_price",
    "swarm_attempt",
    "swarm_attempt_run",
    "swarm_attempt_task",
    "swarm_attempt_arm",
    "swarm_attempt_run_session",
  ],
};

# MYC-RECON01 — as-built architecture of our myc fork and the ClineMM integration seam

> **Scope.** A behavioral and code-grounded map of the forked `myc` repository at
> `/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc`, to be the input for
> the first ClineMM → myc pilot. Every claim is tagged with one of
> **SHIPPED_AND_PROVEN**, **SHIPPED_NOT_PROVEN**, **DESIGN_ONLY**, **ABSENT**,
> or **DEFECT**, and the file/line where it came from. No production behavior is
> changed here.
>
> **Why this exists.** Upstream docs (`docs/design/`) are written as the source
> of truth, but they describe a moving target: many decisions (`S41`, `S58`,
> `S59`, `D8`, `D10`) are referenced from dozens of places, and several
> capabilities exist as design + tests rather than as a shipped CLI feature.
> The pilot below depends on knowing what is *actually* there.

## 0. What we did NOT find in this environment

These are the things the question assumes exist and we need to flag right away,
because the next phase cannot run without them:

- **No ClineMM checkout.** `find /Volumes/UserData/Users/chistyakov/Projects/SPbNIX -maxdepth 4 -name 'ClineMM*'` returns nothing.
  ClineMM lives outside this scan root (likely the upstream Cline fork), and
  this recon could not open it. **ABSENT** from the local environment for the
  integration seam. The seam itself is *defined* by upstream Cline plugin docs
  the user pasted in; we describe it here without opening the fork.

- **No Factory checkout.** Same search, nothing. The two-project dogfood
  described in MYC-DOGFOOD01 cannot start until at least one of {ClineMM,
  Factory} is reachable. **ABSENT** locally.

- **No `myc` binary on `$PATH`.** `which myc` exits 1. The fork ships a build
  step (`bun run build` -> `dist/myc`), but it has not been built here. The
  pilot needs `./dist/myc` or `bun install -g` first.

- **A symlink exists for `k9b`**, but it points outside the scan root and is
  not opened here:
  `lrwxr-xr-x ... /Volumes/UserData/Users/chistyakov/Projects/SPbNIX/k9b -> /Users/chistyakov/Projects/SPbNIX/k9b`.

The rest of this report is about the myc fork itself.

## 1. Version and shape

| Item | Value | Evidence |
|---|---|---|
| CLI_VERSION | `0.3.14` | `packages/cli/src/index.ts:22` |
| Engine | Bun >= 1.3.0, pinned in `package.json` | `package.json` -> `engines.bun` |
| SQLite requirement | >= 3.44.0 (3.51.2 still works with a `WARN degraded.sqlite_old`); macOS ships its own `vendor/sqlite/libmyc-sqlite3.dylib` 3.53.4 | `README.md:33-45`, `scripts/build-sqlite.ts` |
| Workspaces | Bun monorepo, `packages/*` | `package.json:workspaces` |
| Public surface (`@aistastudio/myc` 0.3.14) | npm tgz 5.06 MB compressed, 16 files | `README.md:54` |
| Self-hosting | `dist/myc` (single binary), built by `bun run build`; smoke-tests background work before replacing itself | `scripts/build.ts`, `AGENTS.md` |
| Test invocation | `bun test`; full suite is heavy | `AGENTS.md`, `package.json` |
| Self-mutation guard | working `.myc/` lives in the repo itself; schema migrations are NEVER run against a working DB without the release that carries them | `AGENTS.md` (Working databases), `packages/cli/src/commands/init.ts` |

**Status.** **SHIPPED_AND_PROVEN** for the version string and the build
recipe; the binary itself is **SHIPPED_NOT_PROVEN** for this environment
(nothing built).


## 2. Storage / authority

### 2.1 The two physical locations

```text
project  : <repo>/.myc/                  (project tier, S41)
            ├── workspace.toml           (committed: slug, bootstrap budget)
            ├── .gitignore               (committed: ignores db, projections, state.json, hooks.json,
            │                             wire.json, bootstrap.cache.json, anchor-dirty.log)
            ├── graph/                   (oplog: committed per upstream; the canonical mutation log)
            ├── myc.db   myc.db-wal ...   (NOT committed)
            ├── projections/             (NOT committed: derived view of the graph)
            ├── state.json               (NOT committed: local state)
            ├── hooks.json               (NOT committed: hook counters)
            ├── wire.json                (NOT committed: what wire wrote)
            ├── bootstrap.cache.json     (NOT committed)
            └── anchor-dirty.log         (NOT committed)

personal : ~/.myc/   (or $MYC_HOME/.myc, default = homedir)
            └── mirror of the same layout, slug PERSONAL_SLUG
```

**Evidence.**

- `.gitignore` ignores `myc.db`, `myc.db-wal`, `myc.db-shm`, `myc.db-journal`,
  `projections/`, `state.json`, `hooks.json`, `wire.json`,
  `bootstrap.cache.json`, `anchor-dirty.log` (project-local copy). Source:
  `/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc/.myc/.gitignore`.
- `.myc/.gitignore` is itself committed and says so explicitly: "оплог,
  meta.json, .gitattributes и workspace.toml коммитятся как есть; myc.db,
  … игнорируются".
- Repo-level `.gitignore` additionally ignores `.myc/wire.json`,
  `.myc/hooks.json`, `.myc/bootstrap.cache.json`, `.myc/projections/`,
  and `.claude/`. (Repo root `.gitignore`.)
- Personal home is `~/.myc` by default; overridable with `MYC_HOME`. Source:
  `packages/cli/src/commands/wsfind.ts` (`return process.env.MYC_HOME ?? homedir()`),
  `packages/cli/src/commands/store.ts` `personalHome()`.
- This very repo's `.myc/` is initialized: it has `workspace.toml`
  (`slug = "memory"`, `[bootstrap] budget = 3000`) and `.gitignore`, but no
  `myc.db` (unbuilt). The repo therefore commits its identity (slug, budget)
  while keeping the database strictly local.

**Status.** **SHIPPED_AND_PROVEN.** This matches the design (`docs/design/01-core-data-model.md`,
S42, S60) but is verified against the actual gitignore in this checkout.

### 2.2 Three independent memory axes

The design says memory is shaped by three orthogonal axes. They are
implemented and tested:

| Axis | Decision | Where it lives | How it's enforced |
|---|---|---|---|
| **Tier** (S41) | `project` (`.myc/myc.db`) vs `personal` (`~/.myc/myc.db`) | separate physical DBs; rows carry `scope` = slug | Two stores; `openWorkspaceAt` / `openPersonalStore`; project and personal rows are merged in `bootstrap` blocks with the personal row shadowed by a matching project row. Tests: `bootstrap.test.ts` ("личный ярус помечается @personal и вытесняется проектным по ключу"). |
| **Reach** (S58) | `session` \| `project`; `unknown` if not determined | `attrs.reach`, `attrs.session_id`, `attrs.episode_id` | Index `ix_nodes_prime_reach` (migration 006) supplies `json_extract` from the index; SQL predicate `reachPredicate` in `core/reach.ts` is the same string used in `prime`. Filter runs in source, before LIMIT. Footer in `prime` reports "session ...", "X from other sessions hidden", "Y reach unknown". |
| **Repo** (S59) | `""` (root/ecosystem-wide) \| `"<repo-name>"`; `absent` if `attrs.repo` is missing | `attrs.repo` | Index `ix_nodes_ready_repo` (migration 007); `repoPredicate` keeps `IS NULL` distinct from `= ''`. `repo --repo <name>` and `prime --repo` filter here; footer reports `repo_unknown` and `repo_foreign` separately. |

**Evidence.**

- `packages/core/src/reach.ts` (file header, lines 1-40) defines the rules.
- `packages/core/src/repo.ts` (file header, lines 1-54) defines the repo rules
  and explicitly warns against collapsing the three axes into one.
- `packages/cli/src/commands/prime.ts` (file header, lines 1-60) and the
  body around line 850-890 read both reach and repo scopes, filter `nodes`
  with both predicates, and print separate counters in the footer.
- `packages/cli/src/commands/reach.test.ts`, `repo.test.ts`,
  `prime.reach-latency.test.ts`, `prime.repo-latency.test.ts` exist and run.

**Status.** **SHIPPED_AND_PROVEN.**

### 2.3 Reach discovery - session id sources

`SESSION_ENV_KEYS = ["MYC_SESSION_ID", "CLAUDE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"]`.

- The third key is **required for Claude Code 2.1.x** because that release moved
  the env var to `CLAUDE_CODE_SESSION_ID`. Source: `packages/core/src/reach.ts:59-67`.
- If none is set, the new fact is recorded with `reach` *unset* (becomes
  `unknown`), and `myc remember` warns: "охват не определён - `session_id`
  не задан".
- `myc prime` prints `session not specified` in its footer instead of staying
  silent - this is exactly the loud-degradation rule (И2).

**ClineMM consequence.** Without an explicit ClineMM -> myc session-id
injection, every note ClineMM records via the MCP server would land as
`reach = unknown` and therefore *visible* from `prime` of any session -
exactly the leak S58 was written to prevent.

**Status.** **SHIPPED_AND_PROVEN** for the env-var list and the warning;
**SHIPPED_NOT_PROVEN** for any of the four agents actually populating it
from the host (we did not exercise a live hook here).

### 2.4 Repo discovery

`deriveRepo(wsDir, startDir, isRepo)` (`packages/core/src/repo.ts:186-211`)
walks from `startDir` upward: it stops at the workspace dir, takes the
first path segment as a candidate repo name, and accepts it iff
`isRepo(<wsDir>/<head>)` is true (i.e. that segment is a registered
sub-repository). Otherwise the node is "common" (`repo: ""`).

**ClineMM consequence.** `myc mcp` launched with `cwd = /Users/.../ClineMM`
records the fact under `repo: ""` (single-repo workspace). If ClineMM is
later treated as part of an ecosystem (Factory, k9b, ...), we would need a
`myc_link` (or equivalent) to register the nested repos before `myc init`
runs in the parent. **DESIGN_ONLY**: the multi-repo `myc_link` flow is
referenced in `docs/design/01-core-data-model.md` and tested in
`federation.multirepo.test.ts`, but it is not a `myc` subcommand we could
find. See §10 below.


### 2.5 Supersession / retraction / pending-review authority

- `myc_update` is a single tool for every task-state change, including
  `close, reopen, reject` which require a `--reason`. Source:
  `packages/mcp/src/tools.ts:75-90` (excerpted in the read).
- `close`, `reopen` and `reject` are explicit, reason-bearing actions; this is
  the closest thing to supersession authority shipped.
- `pending_review` is an explicit state, surfaced via `myc_ready{review:true}`
  and `myc_update` confirm/reject. Source: `packages/mcp/src/tools.ts:65-70`,
  `packages/retrieval/src/review.ts`, tests `pending-review.test.ts`,
  `review.test.ts`.
- The oplog is the source of truth: `.myc/graph/` is committed; `myc.db` is a
  projection. Source: `.myc/.gitignore` + `docs/design/01-core-data-model.md`.

**Status.** **SHIPPED_AND_PROVEN** for the close/reopen/reject contract;
**DESIGN_ONLY** for full multi-actor authority (the
`docs/design/04-swarm-learning-and-routing.md` specifies actor + provenance
but the only enforcement today is "close requires reason").

### 2.6 Concurrency / WAL

- `wal_autocheckpoint = 0` on the project DB; the SQLite runtime is wrapped in
  a `WalGuard`. Source: `packages/store-sqlite/src/runtime.ts`, mentioned by
  `packages/cli/src/commands/store.parity.test.ts:215-220` ("wal_autocheckpoint=0
  требует WalGuard, mmap 256 МБ на ...").
- Background jobs (`jobs` table) and oplog checkpoint worker both run as
  separate processes / threads, fed by a queue with a single-process lock.
- `query.queue.db` is its own base, separate from `myc.db`, for `myc run`.

**Status.** **SHIPPED_AND_PROVEN** for the design; we did not stress it.

### 2.7 Worktree handling

`packages/mcp/src/workspace.ts:43-68` (worktree detection by `.git` file
contents) and `packages/cli/src/commands/wsfind.ts` (its CLI twin; parity
test `mcp-workspace.parity.test.ts` enforces the same algorithm). Submodule
support is partial: "submodule (`.git/modules/<name>`) — нет". Source:
`packages/mcp/src/workspace.ts:62-66`.

**Status.** **SHIPPED_AND_PROVEN** for `git worktree`; **DEFECT (known)**
for submodules.

### 2.8 Nested repositories / ecosystem

Same module as §2.7. The decision: first `.myc/myc.db` walking up from
`startDir`; the home directory (`$MYC_HOME` or `~`) is checked only as the
starting point - its `.myc/` is the personal tier, not a project workspace.
This is enforced by the `climb` boundary check (`packages/mcp/src/workspace.ts:26-40`).

**Status.** **SHIPPED_AND_PROVEN.**

### 2.9 Secret redaction

`packages/core/src/secrets.ts`, plus `packages/code-intel/src/secret-paths.ts`
for path-based detection. Tests: `secrets.test.ts`,
`secret-paths.test.ts`. The redact is applied at the oplog/retrieval
boundary.

**Status.** **SHIPPED_AND_PROVEN** at the code-intel level (paths); we did
not exercise end-to-end retrieval redaction here.

## 3. MCP surface (what the binary actually exposes)

### 3.1 Tool profiles

`McpProfile = "agent" | "leader" | "full"`. Only `agent` is implemented:

```ts
// packages/mcp/src/tools.ts:347-353
export function toolsForProfile(profile: McpProfile): readonly McpToolDef[] {
  if (profile !== "agent") {
    throw new Error(`profile '${profile}' is not implemented yet (myc-zdk); available: agent`);
  }
  return AGENT_TOOLS;
}
```

`AGENT_TOOLS` is `[...WORK_TOOLS, ...CODE_TOOLS]` = 7 work + 6 code = **13 tools**.
The two non-implemented profiles are tracked as task `myc-zdk`.

**Status.** **SHIPPED_AND_PROVEN** for `agent`; **DESIGN_ONLY** for
`leader`/`full`.

### 3.2 The `agent` profile - inventory

| Tool | Intent | Notes |
|---|---|---|
| `myc_prime` | Session start packet | Replaces reading the README, plans, task history. Call once at start and again right after compaction. Has `--budget` (default 2000 chars). |
| `myc_ready` | What you can take | `claim:true` atomically takes the top one and returns its full context. With `review:true` returns compaction candidates awaiting confirm/reject. |
| `myc_update` | Every task-state change | `claim, release, close, reopen, assign, priority, note, extend` and confirm/reject of compaction candidates. `close, reopen, reject` require a reason. |
| `myc_recall` | Hybrid (lexical + vector) search | Honors `session` and `repo` filters. |
| `myc_remember` | Record a fact/decision | Defaults to session reach; `--reach project` for project-wide. `--global` writes to personal tier; if personal doesn't exist, fails with hint `myc init --global`. Hot-path budget 5 ms. |
| `myc_show` | One node's whole story | Merges edges, anchors, supersession. |
| `myc_search` / `myc_code_search` / `myc_code_symbol` / `myc_callers` / `myc_skeleton` / `myc_code_map` / `myc_code_grep` | Code surface | Six tools. `code_map` = orientation; `code_search`, `code_symbol` = find; `skeleton` = API of one file; `callers` = blast radius; `code_grep` = all occurrences. |

Tool descriptions and `inputSchema` definitions are in
`packages/mcp/src/tools.ts`. Their token cost is budgeted (`tokens.ts`) and
checked by a test. Source: `packages/mcp/src/index.ts:6-13`,
`packages/mcp/src/tokens.ts` (`AGENT_PROFILE_TOKEN_BUDGET`,
`DESCRIPTION_TOKEN_BUDGET`).

**Status.** **SHIPPED_AND_PROVEN.** All 13 tools are registered with input
schemas and are dispatched via `createDispatcher` (re-uses the same
`myc` CLI in-process so MCP and CLI can never disagree).

### 3.2.1 Per-call session identity in the MCP envelope — **NOT PRESENT**

Verified by reading every `inputSchema` in `packages/mcp/src/tools.ts:32-354`:

- `myc_prime` (lines 33-47): properties = `{ budget, ws }`. **No `session`.**
- `myc_recall` (lines 122-146): properties = `{ query, n, budget, kind, layer, tag, since, anchor, mode, ws }`. **No `session`.**
- `myc_remember` (lines 148-167): properties = `{ text, tag, anchor, layer, source, absorb, ws }`. **No `session`.**
- Every tool declares `additionalProperties: false`, so a client cannot smuggle
  `session` through an unrecognized key — the server would reject it.

The session key is resolved by `resolveSession(explicit, env)`
(`packages/core/src/reach.ts:171-182`) which walks `SESSION_ENV_KEYS`
(`["MYC_SESSION_ID", "CLAUDE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"]`,
`reach.ts:59-67`) and falls back to `process.env`. That env is the env of the
**MCP server process**, captured once at start-up.

**Consequence for a user-level MCP server** (the only kind Cline's
`~/.cline/mcp.json` spawns): if the host does not export one of the three keys
into the server's process env, every tool call that ends up writing a node —
`myc_remember`, every `myc_update` mutation, `myc_link` — sees `session = ""`
and lands the node as `reach: unknown`. The fix is **not** in the schema
today.

This is **SHIPPED_AND_PROVEN** as the absence of a per-call session argument
in the MCP envelope. It is the central seam the next ACT must qualify, and is
recorded here so that earlier-draft sentences claiming "the agent can pass
`--session` through `arguments`" do not survive into the next milestone.
See §8.5 for the corrected view of MYC-CLINEMM01.

### 3.3 Server protocol and discovery

- `MCP_PROTOCOL_VERSION = "2025-06-18"`. Source: `packages/mcp/src/server.ts:17`.
- Zero external dependencies: `@modelcontextprotocol/*` is intentionally NOT
  pulled in. The 7-handshake is implemented inline. Source:
  `packages/mcp/src/server.ts:1-11`.
- `myc mcp` opens the SQLite DB itself (`openMcpStore(ws.wsDir, ...)`) so it
  does not round-trip through `run()`. Source:
  `packages/mcp/src/command.ts:243-264`.
- `myc mcp` accepts `-C/--db` from the parent; the prefix is forwarded to
  every tool call so the project is consistent.
- No-workspace behavior: `myc mcp` prints "no myc workspace at ... — 0 tools,
  stdio" to **stderr** (logs are allowed there) and serves an empty tool list
  so the host shows a "broken" MCP server rather than silently dropping
  every call. Source: `packages/mcp/src/command.ts:206-224`.

### 3.4 Per-project MCP configuration that exists today

In this fork's own checkout:

- `.mcp.json`: `command = "./dist/myc"`, `args = ["mcp", "--profile", "agent"]`.
- `.opencode/`: a plugin (file present), and `opencode.json` declares the same
  MCP server.
- `.codex/`: `config.toml`, `hooks.json`, `myc-hooks.mjs` - i.e. Codex is
  fully wired here.
- `.kimi-code/`: present (Kimi wiring).
- `.claude/`: NOT present. Claude Code wiring is opt-in (and `.claude/` is
  in the repo's `.gitignore`, exactly per upstream's per-machine rule).

**Status.** **SHIPPED_AND_PROVEN** for Claude/Codex/opencode/Kimi;
**ABSENT** for Cline (and any other agent).


## 4. Lifecycle semantics

### 4.1 The four hook events (today)

`HookEvent = "session-start" | "pre-compact" | "post-edit" | "stop"`,
mapped to Claude Code's `SessionStart | PreCompact | PostToolUse | Stop`.
Source: `packages/cli/src/hooks/templates.ts:15-92`.

| Event | Claude event | Command | What it does |
|---|---|---|---|
| `session-start` | `SessionStart` | `prime --budget 2000 --format agent --session <sid>` | Injects the project context packet into the new session. |
| `pre-compact` | `PreCompact` | `absorb-session --reason <auto\|manual> --transcript <path> --budget 1200\|2000 --agent claude --session <sid>` | Persists the about-to-be-lost transcript into the oplog as `episode_id`-bearing session notes. Manual trigger gets a larger budget. |
| `post-edit` | `PostToolUse` | `anchor touch <file>` | Re-anchors the touched file in the code graph. |
| `stop` | `Stop` | `close-session --transcript <path>` | Marks the session closed (consumed transcript, final flush of pending jobs). |

The helper guarantees: zero failure of the agent session (every error path
exits 0 with empty stdout). Source: `templates.ts:117-164` (helper text).

### 4.2 Which agents have this lifecycle today?

`HARNESSES = ["claude", "codex", "opencode", "kimi"]` as const
(`packages/swarm/src/harness.ts:30`). Adding a new harness requires BOTH a
line there AND a migration expanding the `swarm_model.harness /
swarm_attempt.harness` CHECK constraint. A test
(`packages/cli/src/harness.wiring.test.ts`) grep-protects the list from
silent divergence.

- **Claude Code**: hooks via `.claude/settings.json` (project) and
  `~/.claude/settings.json` (user). Statusline passthrough. Permission
  rules installed as a structured list (NOT a single `Bash(myc:*)` - that
  bypass was rejected because `myc run -- X` lets `X` be anything and
  Claude Code matches the rule against the whole command text). Source:
  `packages/cli/src/commands/wire.ts` (file header and the permissions
  plan), `packages/cli/src/statusline-passthrough.ts`,
  `packages/cli/src/hooks/queue-hook.ts`.
- **Codex**: `.codex/config.toml` (MCP between markers) + `.codex/hooks.json`
  + `.codex/myc-hooks.mjs`. `notify` was REMOVED from Codex's block - its
  payload has no transcript or compaction event, so it produced `empty`
  responses that `myc doctor` reported as healthy while doing nothing.
  Source: `wire.ts:959-1004`.
- **opencode**: plugin installed as `.opencode/plugin/myc.js` (project) and
  `~/.config/opencode/plugin/myc.js` (user). Source: `hooks/templates.ts`
  `opencodePlugin`, `opencodeUserPlugin`.
- **Kimi**: hooks in `~/.kimi/hooks.toml` ONLY (user layer - Kimi has no
  project-layer hooks). Source: `hooks/templates.ts` `kimiHooksToml`.
- **Cline**: **ABSENT**. No entry in `HARNESSES`, no plan in `wire.ts`,
  no helper template. Any Cline integration today would be a user-local
  MCP server definition + zero lifecycle hooks.

**Status.** **SHIPPED_AND_PROVEN** for the four agents; **ABSENT** for
Cline and every other agent.

### 4.3 The MCP-server side of "session begins / ends / compacts"

The MCP server speaks the host's session lifecycle indirectly:

- `initialize` returns serverInfo, protocol version `2025-06-18`, and
  `instructions` built from a fresh `bootstrap` snapshot.
- After `initialize`, the host sends `notifications/initialized` (a
  notification that gets no reply) and `tools/list` / `tools/call`.
- There is NO event for compaction in MCP - the only lifecycle signal from
  the host is `initialize` itself. The host must use a SEPARATE channel
  (filesystem hook, PreCompact hook, SDK plugin) to trigger absorb.

**Cline consequence.** If ClineMM can only be wired via the user-level
`~/.cline/mcp.json` (the configuration authority for the **Cline CLI**
that the user pasted in; the Cline IDE extension uses its own MCP
settings JSON), then **all four lifecycle events must come from Cline's
plugin/SDK API**, not from MCP. The MCP server will not know when context
compaction happens. That means the ClineMM integration plugin has to
trigger `myc prime` (beforeRun) AND `myc absorb-session` (PreCompact or
post-compaction) AND `myc close-session` (afterRun) via its own lifecycle
hooks - not via MCP.

**Status.** **SHIPPED_AND_PROVEN** for the MCP lifecycle; **ABSENT** for
any Cline-specific hooks.

## 5. Build, test, and pack

| Step | Command | Notes |
|---|---|---|
| Install | `bun install` | Required >= 1.3.0. |
| Test | `bun test` | Heavy; AGENTS.md says to run as `myc run -- bun test`. |
| Typecheck | `bun run typecheck` | |
| Build | `bun run build` -> `dist/myc` | Smoke-tests background work before replacing. |
| Pack | `bun run pack:npm` -> `dist/aistastudio-myc-<version>.tgz` | macOS needs `bun scripts/build-sqlite.ts` first. |

**Status.** **SHIPPED_AND_PROVEN.**

## 6. Existing reports in `docs/reports/` that bear on this

Read, not re-derived:

- `REPORT-harness-kimi-codex.md` - the canonical evidence for why a single
  harness list lives in `packages/swarm/src/harness.ts` and why `wire` and
  the roster both read it. Two lists diverged silently in the past; that
  test (`harness.wiring.test.ts`) prevents it from happening again.
- `REPORT-doctor-ryk2t5pft1mh.md` - `myc doctor` itself, the three
  sections (`--schema`, `--recount`, `--hooks`), and the loud-degradation
  rule (И2). This is the diagnostic tool we'll lean on for the pilot.
- `REPORT-coldstart-s63.md` - cold-start budgets (per `00-brief.md §3`).
- `REPORT-digest-cache.md` - why digest cache invalidates on `oplog.seq`.

## 7. Design vs shipped - the gap matrix

The design docs are intentionally ahead of the code; the table below lists
the **most important** gaps we saw while reading.

| Topic | Documented in | Actually shipped? | Evidence |
|---|---|---|---|
| Multi-actor authority | `04-swarm-learning-and-routing.md` (roster, harness, attempt) | Partially - only `harness` is enforced, actor is recorded | `packages/swarm/src/harness.ts`; `actor` is stored in nodes but not used for permission |
| SurrealDB backend | `ARCHITECTURE.md` (storage domain contract) | ABSENT | No `packages/store-surrealdb`; only `store-sqlite` and `store-postgres` |
| Federation across project tiers | `01-core-data-model.md` | Partially - project+personal merge only | `bootstrap.ts` mergeBlocks; no cross-repo federation shipped beyond a test (`federation.multirepo.test.ts`) |
| Leader / full MCP profiles | `03-interfaces-and-integration.md` | ABSENT | `tools.ts:347-353` throws for non-agent |
| Cline (and any non-Claude/Codex/opencode/Kimi) harness | everywhere | ABSENT | No entry in `HARNESSES` |
| PreCompact hook (filesystem variant) for Cline | (upstream note in the user's question) | ABSENT in myc - and upstream Cline's own filesystem hook is still "coming soon" per the user's note | not testable here |
| Personal tier creation | `01-core-data-model.md` | SHIPPED - `myc init --global` | `packages/cli/src/commands/init.ts` (`createPersonalWorkspace`) and `store.ts` (`openPersonalStore`) |
| Reach (S58) and Repo (S59) axes | `01-core-data-model.md` | SHIPPED + TESTED | `packages/core/src/reach.ts`, `repo.ts`; reach / repo test families |
| Per-call `session` argument on agent-profile MCP tools | (none — design assumes env injection only) | **SHIPPED_AND_PROVEN ABSENT** | Every `inputSchema` in `packages/mcp/src/tools.ts:32-354` declares `additionalProperties: false` and lists only `budget`/`ws` (prime), `{query,n,budget,kind,layer,tag,since,anchor,mode,ws}` (recall), `{text,tag,anchor,layer,source,absorb,ws}` (remember), `{ids,depth,source,fields,ws}` (show), `{from,type,to,...}` (link). Identity is resolved from `process.env` once at server start via `resolveSession()` (`packages/core/src/reach.ts:171-182`). |


## 8. ClineMM integration proposal - minimal MCP pilot

Given the gap matrix, the right first move is the smallest possible ClineMM
change that exercises myc through MCP, with **no** modification to myc
itself.

### 8.1 The minimal seam

```jsonc
// ~/.cline/mcp.json (per upstream Cline docs the user pasted)
{
  "mcpServers": {
    "myc": {
      "command": "<absolute path to dist/myc, or `myc` if globally installed>",
      "args": ["mcp", "--profile", "agent"]
    }
  }
}
```

Why this is enough to start:

- `myc mcp` does project discovery by `cwd` of the spawned process, which is
  the agent's working directory. In Cline that is the project root, so it
  will find `.myc/myc.db` by walking up.
- The **same `command` + `args` definition** is portable across hosts: Cline
  CLI, Cline IDE extension, Claude Code, opencode, Kimi, Codex. What is
  *not* portable is the **configuration file authority**: the Cline CLI
  uses `~/.cline/mcp.json`, the Cline IDE extension uses its own MCP
  settings JSON, Claude Code uses `~/.claude.json` (or project-local
  `.mcp.json`), and so on. CLINEMM01 Phase 4 must qualify these separately
  for the actual ClineMM build; do not assume `~/.cline/mcp.json` is
  authoritative everywhere.
- One project, one `myc init`. To roll out across repos, run `myc init`
  in each; nothing else.

### 8.2 What this gets us (and what it does NOT)

Gets us:

- `myc_prime` at session start (callable by the agent's "before run"
  instruction).
- `myc_ready`, `myc_update`, `myc_recall`, `myc_remember`, `myc_show`.
- All six code-intel tools (`myc_code_*`).

Does NOT get us:

- Automatic `myc prime` on every Cline turn (ClineMM is on the hook to call
  it, or its plugin does).
- Automatic compaction persistence - there is no MCP event for compaction,
  so we either (a) use Cline's plugin API to call `myc absorb-session`
  before compaction, or (b) accept that compaction survival is the user's
  job until the lifecycle plugin lands.
- **Session-id injection — and this is the part an earlier draft got wrong.**
  See §3.2.1: none of the current `myc_*` schemas accept a `session`
  argument (`additionalProperties: false` on every tool). The session key
  is resolved from the MCP server's own `process.env` at start-up, not per
  call. So "the ClineMM plugin must pass `--session` on each tool call" is
  not something the current MCP surface supports; the actual fix is either
  (a) have Cline export one of `MYC_SESSION_ID | CLAUDE_SESSION_ID |
  CLAUDE_CODE_SESSION_ID` into the MCP server's process env at start time,
  or (b) add a per-call `session` argument to the relevant MCP tool
  schemas, or (c) run a per-task MCP server. Until one of those lands,
  every write through a user-level MCP server lands as `reach: unknown`.

### 8.3 Two-repo dogfood targets

The question lists ClineMM and Factory. Neither is in the local scan
root. **ABSENT** locally. When available:

- ClineMM is a large evolving TS repository - exercises agent
  self-development.
- Factory is long-horizon work - exercises memory accumulation over
  sessions, and is where an evaluator (MemLab) can be set up.

For each:

```bash
cd <repo>
myc init                 # one-time; slug, .myc/workspace.toml, myc.db
myc doctor               # confirm: schema 1, embeddings WARN until models fetch
myc code fetch           # grammars for the repo's languages
myc models fetch         # semantic recall
```

Then, **manually**, for the first real task:

```text
session start   ->  myc_prime
before decision ->  myc_recall
after conclusion->  myc_remember
session end     ->  (eventually close-session, but only if the plugin calls it)
```

No `myc wire` for ClineMM yet - `wire` does not know Cline. The
global `~/.cline/mcp.json` IS the wire.

### 8.4 When to modify ClineMM (the actual integration plugin)

Only after MYC-CLINEMM01 PASSes (session-identity qualification green), and
*never* in a way that contradicts §3.2.1. At that point:

- A small ClineMM plugin that, on `beforeRun`, calls `myc_prime` and
  injects its result as the first user-context block.
- Session identity propagation using whatever transport MYC-CLINEMM01
  qualified (per-task MCP process, additive `session` MCP argument, or a
  Cline-side bridge that wraps `myc` CLI with `MYC_SESSION_ID` set per
  call). The lifecycle plugin **must not assume** the existing MCP tool
  envelope accepts a per-call session argument — none of the current
  `myc_*` schemas do, and every one of them declares
  `additionalProperties: false`. Upstream Cline docs explicitly state a
  single host process can run multiple sessions concurrently, so a
  process-level env var (`MYC_SESSION_ID` set once at MCP server start)
  is **not** sufficient on its own and must be combined with one of the
  per-session mechanisms above.
- A `compaction boundary` hook that calls `myc absorb-session` against
  Cline's canonical persisted transcript (full-fidelity; compaction state
  is kept separately by Cline). This is the single most important piece
  — without it, S58 reach semantics become decorative.
- An `afterRun` hook that calls `myc close-session` to finalize the
  session's pending jobs.

We do NOT add lifecycle logic to myc — we only consume the existing tools,
subject to the qualified transport from CLINEMM01.

### 8.5 What should go into MYC-CLINEMM01/02 milestones

The plan below replaces the earlier, over-optimistic version. The earlier
version assumed "the ClineMM plugin can pass `--session` on each tool call";
§3.2.1 shows the current MCP surface cannot do that. So the next ACT's job is
**not** "can Cline see 13 MCP tools?" — it is **"can myc through MCP preserve
S58 session isolation for every memory write, given that the schema has no
per-call session argument?"**. A pilot that ships "13 tools visible" but lands
writes as `reach: unknown` is **TRANSPORT_ONLY_NOT_SAFE_FOR_MEMORY_WRITES**
and does **not** count as PASS.

- **MYC-CLINEMM01** — ClineMM MCP transport + session-identity qualification.
  - **Primary question.** Can myc's existing agent-profile MCP tools be
    reached from ClineMM while preserving S58 session isolation for every
    memory write?
  - **Hard invariant.** For two concurrent Cline sessions A and B:
    `write(A)` must persist `session_id=A`; `write(B)` must persist
    `session_id=B`; `prime(A)` must hide B's session-reach notes and
    vice versa; a project-reach sentinel must remain visible to both.
  - **Stop conditions** (report, do not paper over): ClineMM has no
    stable session identifier; one long-lived MCP process cannot
    receive per-call session identity; existing `myc_*` MCP tools
    cannot safely attribute writes; fixing it requires changing myc's
    memory semantics.
  - **Phase 0 — baseline.** Capture ClineMM HEAD, `git status --short`,
    root gate, version, host under qualification (CLI vs. VS Code
    extension vs. both), existing MCP config authority, existing
    plugin/runtime architecture, existing session identity representation.
    No production edits before baseline evidence.
  - **Phase 1 — confirm Cline session identity** (do not infer from
    upstream docs alone). Canonical session/task identifier, lifetime,
    match to `ctx.session.sessionId` semantics, concurrency, resume,
    whether one MCP server process serves one or many sessions.
  - **Phase 2 — confirm myc MCP write semantics.** For every
    write-capable agent-profile tool (`myc_remember`, `myc_update`,
    `myc_link`, the `claim`/`review` mutations of `myc_ready`): is
    `session_id` an explicit MCP argument? Is `reach` accepted? Is
    identity resolved at MCP server start-up or per call? What happens
    with no identity? Produce the answer `CAN_EXISTING_MCP_CALL_CARRY_SESSION_ID
    = true|false` with code evidence.
  - **Phase 3 — choose the smallest safe transport.** In order:
    A. existing MCP tool argument (already shown absent in §3.2.1);
    B. ClineMM MCP invocation decoration (likely blocked by
       `additionalProperties: false`);
    C. per-session MCP process env (`MYC_SESSION_ID` at start);
    D. ClineMM-side wrapper/bridge;
    E. minimal additive myc MCP schema change.
    Choose the earliest option that is correct. Document rejected
    options and why. **Do not choose E merely because it is convenient.**
  - **Phase 4 — MCP config authority.** Qualify separately: CLI
    `~/.cline/mcp.json`, VS Code extension MCP settings, workspace-local
    configuration. **Do not assume CLI = extension.** Use temporary
    isolated config / home directories for qualification; never write
    user-global config from automated tests.
  - **Phase 5 — build myc.** `bun --version`, `bun install`,
    `bun run typecheck`, `bun run build`, `./dist/myc --version`. No
    global install until the local artifact passes qualification.
  - **Phase 6 — black-box MCP pilot** in a temporary isolated git repo:
    `myc init`; `myc doctor`; start `dist/myc mcp` through the exact
    mechanism ClineMM will use; verify MCP initialize, agent profile
    tool set, `myc_prime`, `myc_recall`, `myc_remember`, no-workspace
    loud behavior, stderr does not corrupt stdout, project discovery
    uses the intended workspace.
  - **Phase 7 — session isolation red test.** Two sessions A and B,
    one sentinel each, both session reach. A's prime must hide B and
    vice versa. A project sentinel must be visible to both. If either
    session write lands as `reach: unknown`, `VERDICT = FAIL_SESSION_ID_PROPAGATION`.
  - **Phase 8 — concurrent session test.** Interleave writes from A
    and B; persisted attribution must stay correct. Any solution that
    uses a process-global mutable env var is rejected.
  - **Phase 9 — no-lifecycle boundary.** Explicitly enumerate what this
    ACT does **not** ship: no automatic prime, no transcript absorb, no
    compaction capture, no close-session, no post-edit anchor refresh.
    Those are MYC-CLINEMM02, not defects.
  - **Phase 10 — Cline integration** (only after black-box tests pass).
    Minimum ClineMM-side code; configuration/plugin/bridge; no myc
    semantic changes; no duplicated MCP implementation. Feature-detect
    absence of myc; degrade loudly without breaking ClineMM.
  - **Phase 11 — tests.** Deterministic, no external network:
    MCP config generation/parsing, session-id propagation, concurrent
    isolation, missing myc binary, non-myc workspace, malformed MCP
    response, process exit/restart.
  - **Phase 12 — report** at `docs/reports/REPORT-MYC-CLINEMM01.md`
    with the required verdict fields:
    `MCP_TRANSPORT`, `SESSION_ID_SOURCE`, `SESSION_ID_PROPAGATION`,
    `CONCURRENT_SESSION_ISOLATION`, `CLINE_CLI_CONFIG_AUTHORITY`,
    `CLINE_IDE_CONFIG_AUTHORITY`, `MYC_PRODUCTION_CHANGE_REQUIRED`,
    `READY_FOR_CLINEMM02`. PASS requires **all** of: agent profile
    reachable; per-session identity preserved; two-session isolation
    proven; project reach proven; no production myc change unless
    demonstrated necessary; baseline/root gates green. A pilot where
    MCP works but session isolation is not proven is
    `TRANSPORT_ONLY_NOT_SAFE_FOR_MEMORY_WRITES`, not PASS.

- **MYC-CLINEMM02** — ClineMM lifecycle plugin (depends on CLINEMM01 PASS).
  - beforeRun: `myc_prime` + session-id injection (whatever transport
    CLINEMM01 picked).
  - **Compaction story uses Cline's canonical persisted transcript**
    rather than racing the (still "coming soon") filesystem `PreCompact`
    hook. Cline's plugin seam (`beforeRun / afterRun / beforeTool /
    afterTool / onEvent`, with `ctx.session.sessionId`) is enough: the
    transcript is full-fidelity while compaction state lives separately,
    so `myc absorb-session` can run against the canonical transcript
    after each compaction without losing context.
  - afterRun: `myc close-session` to finalize pending jobs.
  - Anchor refresh on `Write | Edit | MultiEdit | NotebookEdit`.

## 9. Roadmap positions (re-affirmed)

The proposed order holds against what we verified:

```text
MYC-RECON01   (this report)            --- DONE in this PR.
MYC-CLINEMM01   minimal MCP pilot       --- next, no code change to myc.
MYC-CLINEMM02   lifecycle integration   --- only after 01 is stable.
MYC-DOGFOOD01   two-repo qualification  --- needs ClineMM + Factory in PATH.
MYC-SCOPE01     project/session/personal isolation matrix
MYC-AUTH01      actor + provenance + promotion authority
MYC-SOL01       Codex/Sol reviewer integration
MYC-BACKEND01   storage-domain contract (the contract that lets store-postgres
                and a future store-surrealdb be swapped in)
MYC-SURREAL01   experimental SurrealDB backend  --- only after BACKEND01.
```

The SurrealDB line deliberately stays last - the storage backend is
*behind* the architecture contract (MYC-BACKEND01), and we have no
evidence in this recon that the contract has actually been frozen.
Today's `packages/store-postgres/` exists; `packages/store-surrealdb/`
does not.

## 10. Open questions for the user before MYC-CLINEMM01 starts

The original five were updated by upstream Cline plugin docs the user
pasted in. The recon now resolves two of them; the remaining open
questions are tighter:

**Resolved (downgraded from "open question" to "Phase 1 evidence"):**

- (was Q4) Cline plugin API exposes `ctx.session.sessionId`, so a session
  identifier does exist. Phase 1 of MYC-CLINEMM01 must still confirm the
  same is true in *this* ClineMM fork — upstream docs are necessary but
  not sufficient.
- (was Q5) Cline plugin seam exposes
  `beforeRun / afterRun / beforeTool / afterTool / onEvent`, with
  `beforeRun` receiving session metadata. CLINEMM02 can target the plugin
  API rather than the filesystem `PreCompact` hook (still "coming soon"
  upstream).

**Still open:**

1. **Where is the ClineMM checkout?** `find ... -maxdepth 4 -name 'ClineMM*'`
   in this environment returns nothing. We need a path or a remote URL.
2. **Which host is ClineMM?** CLI only, VS Code extension only, or both?
   This drives the MCP config authority (CLI uses `~/.cline/mcp.json`;
   the IDE extension uses its own MCP settings JSON). CLINEMM01 must
   qualify them separately, not assume they are the same.
3. **Where is the Factory checkout?** Same situation as ClineMM.
4. **Is `myc` already installed globally (`which myc`)?** No in this env.
   If not, the pilot starts with `bun install -g ./packages/cli` after a
   build, or `./dist/myc` as the absolute path in the user MCP config.
5. **What is the actual per-session transport Cline will give the MCP
   server?** This is the central unresolved seam the recon surfaced
   (§3.2.1, §8.2). Three plausible answers:
   (a) Cline exports one of `MYC_SESSION_ID | CLAUDE_SESSION_ID |
       CLAUDE_CODE_SESSION_ID` into the server's process env at start;
   (b) CLINEMM01 needs an additive `session` argument in the MCP tool
       schemas;
   (c) CLINEMM01 spawns a per-task MCP server.
   The qualification result (Phase 3) decides which one we adopt, and
   whether MYC-CLINEMM01 demands a myc production change.

Once 1-3 are answered, MYC-CLINEMM01 can start. Question 5 is what
MYC-CLINEMM01 *itself* answers.

## 11. Classification summary

A one-shot table for every claim above.

| Topic | Classification |
|---|---|
| CLI version 0.3.14, Bun engine, SQLite 3.44+ | SHIPPED_AND_PROVEN |
| `dist/myc` exists, built by `bun run build` | SHIPPED_AND_PROVEN (script) / SHIPPED_NOT_PROVEN (artifact in this env) |
| Two tiers: project `.myc/` + personal `~/.myc/` | SHIPPED_AND_PROVEN |
| `.gitignore` rules for `.myc/` (what is/isn't committed) | SHIPPED_AND_PROVEN |
| Three memory axes (S41/S58/S59) | SHIPPED_AND_PROVEN |
| Reach session discovery env vars | SHIPPED_AND_PROVEN |
| Repo discovery via first sub-repo segment | SHIPPED_AND_PROVEN |
| `HARNESSES = [claude, codex, opencode, kimi]` | SHIPPED_AND_PROVEN |
| Lifecycle hooks for those 4 agents | SHIPPED_AND_PROVEN |
| MCP tool surface: 13 agent-profile tools registered | SHIPPED_AND_PROVEN |
| MCP schemas carry a per-call `session` argument | SHIPPED_AND_PROVEN ABSENT (§3.2.1) — identity is resolved from MCP server `process.env` at start-up via `resolveSession()` |
| Cline as an agent | ABSENT |
| `myc wire` for Cline | ABSENT |
| Lifecycle hooks for Cline | ABSENT |
| Submodule discovery | DEFECT (known; documented) |
| Multi-actor authority, actor permissions | DESIGN_ONLY |
| `leader` / `full` MCP profiles | DESIGN_ONLY (task `myc-zdk`) |
| SurrealDB backend | DESIGN_ONLY (no package exists) |
| Federation across project tiers (multi-repo) | DESIGN_ONLY (test exists, not a shipped flow) |
| Secret redaction at retrieval | SHIPPED_NOT_PROVEN in this env (code present, untested) |
| Cold-start budgets | SHIPPED_AND_PROVEN (bench artefacts, no live measurement here) |
| The four-repo ecosystem (ClineMM, Factory, k9b, InDeep, granelle_ai, AURA) | ABSENT in this scan (k9b only as a broken symlink to outside) |

- end of RECON01 -

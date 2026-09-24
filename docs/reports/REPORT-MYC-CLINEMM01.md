# MYC-CLINEMM01 — Phases 0–4: source-only qualification of the ClineMM seam

> **Scope.** Phases 0 through 4 of the MYC-CLINEMM01 plan from
> `docs/reports/REPORT-MYC-RECON01.md` §8.5. Phases 5+ are deferred
> until Phase 5 installs Bun and builds the myc fork. No production
> code in `myc/` was modified during this report; every evidence point
> below is read-only.
>
> **Inputs.** `docs/reports/REPORT-MYC-RECON01.md` (the only baseline
> fact set used). The plan in RECON §8.5 is the protocol followed here.

## Phase 0 — Baseline evidence

### 0.1 ClineMM checkout (the headline correction)

**The earlier RECON classified ClineMM as `ABSENT`. That was a baseline
bug.** `find ... -maxdepth 4 -name 'ClineMM*'` was case-sensitive and
missed the lowercase directory. The ClineMM checkout **is present** at
`/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/clinemm/`. Its shape:

| Field | Value | Source |
|---|---|---|
| Path | `/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/clinemm` | `ls` |
| Branch | `main` | `git -C clinemm rev-parse --abbrev-ref HEAD` |
| HEAD | `4d6b3d1d399eded43bc22ce79b5fc85f19782143` | `git -C clinemm rev-parse HEAD` |
| HEAD subject | `ACT-CLINEMM-EXTENSION-HOST-TERMINATION-LIVE-CLASSIFICATION01 / CORRECTION01: external observer initial-dead PID false-TA6 P0 REPAIRED + delayed restart detection P1 FOLDED IN` | `git log -1 --format=%s` |
| Working tree | clean | `git status --short` (empty) |
| Monorepo | `@cline/packages`, `sdk/packages/{agents,core,llms,sdk,shared,ui}`, `apps/{cli,cline-hub,code,vscode,examples,testing-platform}`, `sdk/examples/plugins/*` | `cat package.json`, `ls` |
| Version | `4.1.16` (from CHANGELOG.md, latest released section) | `head CHANGELOG.md` |
| Bun / Node engines | `bun 1.3.13`, `node 22` | `.nvmrc`, `.tool-versions` |
| Existing cline references in myc fork | yes (`.git/refs/cline` and pre-existing CLI-binary authoring) | `ls myc/.git/refs/cline` |
| Existing MCP hooks / plugin scaffolding | yes (`.clinerules/`, `.clinerules/hooks`, `.cline/`, `sdk/examples/plugins/`, `sdk/packages/core/src/hooks/`) | `ls clinemm/.clinerules`, `ls clinemm/sdk/examples/plugins/` |
| `.clinerules` files | `bun-and-node.md`, `cline-overview.md`, `debug-harness.md`, `general.md`, `hooks/`, `network.md`, `protobuf-development.md`, `sdk-migration.md`, `sdk-transport-integration.md`, `storage.md` | `ls clinemm/.clinerules` |

**Status.** ClineMM checkout itself: **SHIPPED_AND_PROVEN** (it is the
fork we will integrate against).

### 0.2 myc fork state

| Field | Value | Source |
|---|---|---|
| Path | `/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc` | working directory |
| Branch | `main` | `git rev-parse --abbrev-ref HEAD` |
| HEAD | `4078b75` (RECON01 cleanup commit, on top of `cd6ca46` RECON01 commit, on top of `17f6209` 0.3.14 release) | `git log -3 --oneline` |
| Working tree | clean | `git status --short` |
| `dist/myc` binary | **NOT BUILT** | `ls dist/` → no such directory |
| `node_modules/` | **NOT INSTALLED** | `ls node_modules` → no such directory |
| `bun` runtime on `$PATH` | **NOT INSTALLED** | `which bun` → not found |
| `myc` binary on `$PATH` | **NOT INSTALLED** | `which myc` → not found |
| `.myc/` workspace | initialised (slug `memory`, `[bootstrap] budget = 3000`) but `myc.db` not built | `cat .myc/workspace.toml`, `ls .myc/myc.db` → no such file |

**Status.** Phase 5 (`bun install && bun run build`) **cannot run in
this environment without first installing Bun.** That blocks every
phase from 5 onwards. The phases that can be done now are 0-4; the
build-and-test phases 5-12 require either an environment fix
(`brew install bun`, then `bun install`, then `bun run build`) or a
different host.

### 0.3 Other environment absences

These repeat from RECON §0 — but with the new caveat that ClineMM is
no longer in this list:

- **Factory checkout** (`/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/factory`): present (`.clinerules`, `.git/refs/cline`), but **not opened** in Phase 0. CLINEMM01 does not need Factory to qualify the ClineMM
  transport; that gate belongs to MYC-DOGFOOD01.
- **`myc` binary**: not on `$PATH`, not built.
- **`bun` runtime**: not installed.

### 0.4 Existing myc plugin/host surface in ClineMM

ClineMM has a mature plugin example set under `sdk/examples/plugins/`.
The one that most directly models what MYC-CLINEMM02 will need is
`weather-metrics.ts` (file header inspected):

```ts
const plugin: AgentPlugin = {
  name: "weather-and-metrics",
  manifest: { capabilities: ["tools", "hooks"] },

  setup(api, ctx) {
    // ctx.workspaceInfo — rootPath, hint, latestGitCommitHash,
    //                    latestGitBranchName, associatedRemoteUrls
    // api.registerTool(createTool({ ... }))
  },

  hooks: {
    beforeRun, beforeTool, afterTool, afterRun
  }
};
```

`ctx.session?.sessionId` is documented in the plugin example table as
the canonical key for concurrent-session plugin state (e.g.
`mac-notify.ts` uses `afterRun`; `custom-compaction.ts` uses
`registerMessageBuilder`). This is consistent with the upstream
information the user pasted.

**Status.** The ClineMM plugin seam that RECON §8.5 expects (and that
the user confirmed upstream) **is real in this fork**: PLUGIN_API
**SHIPPED_AND_PROVEN** as a candidate surface for MYC-CLINEMM02.

### 0.5 RECON-01 findings that hold (re-verified)

Re-checked the three claims that bear on CLINEMM01 most:

1. **MCP tool schemas carry no per-call `session` argument.**
   Re-checked at `packages/mcp/src/tools.ts:32-354`. Unchanged since
   RECON §3.2.1. Every `inputSchema` declares
   `additionalProperties: false` and lists no `session` key. The
   session key is resolved from the MCP server process env at start-up
   via `resolveSession()` at `packages/core/src/reach.ts:171-182`.
   **SHIPPED_AND_PROVEN ABSENT.**

2. **`HARNESSES = [claude, codex, opencode, kimi]`.** Re-checked at
   `packages/swarm/src/harness.ts:30`. Unchanged. Cline is **ABSENT**
   from the list and from the `wire` command.

3. **CLI version 0.3.14, `dist/myc` built by `bun run build`.**
   Re-checked at `packages/cli/src/index.ts:22`. **SHIPPED_AND_PROVEN**.

### 0.6 Phase 0 verdict fields (per RECON §8.5)

```text
MCP_TRANSPORT                  = NOT_TESTED  (Phase 6 blocked; deferred to Phase 5)
SESSION_ID_SOURCE              = NOT_TESTED  (Phase 1 deferred to Phase 5)
SESSION_ID_PROPAGATION         = NOT_TESTED  (Phase 7 blocked; deferred to Phase 5)
CONCURRENT_SESSION_ISOLATION   = NOT_TESTED  (Phase 8 blocked; deferred to Phase 5)
CLINE_CLI_CONFIG_AUTHORITY     = NOT_TESTED  (Phase 4 deferred)
CLINE_IDE_CONFIG_AUTHORITY     = NOT_TESTED  (Phase 4 deferred)
MYC_PRODUCTION_CHANGE_REQUIRED = UNKNOWN     (no qualification run)
READY_FOR_CLINEMM02            = false       (Phase 7 not PASS)
```

**Status.** Phase 0 = `PHASE_0_COMPLETE_ENVIRONMENT_BLOCKING_BUILD`.
(Phases 1–4 of the same plan were completed in this same report; see
the corresponding sections below.)

## Environment block — deferred to Phase 5

Build/test phases of CLINEMM01 require Bun. This environment had
none at the start of Phase 0; the system later reported Bun
installed at `/opt/homebrew/bin/bun`, version 1.3.14 (slightly newer
than the ClineMM pin of `bun 1.3.13` in `.tool-versions`; Phase 5
should pin 1.3.13 for reproducibility).

The remediation for Phase 5 is:

```bash
# Pinned to ClineMM's engines (bun 1.3.13, node 22):
curl -fsSL https://bun.com/install | bash -s "bun-v1.3.13"
export PATH="$HOME/.bun/bin:$PATH"
bun --version                   # expect 1.3.13
bun --revision

# Then inside the myc fork:
cd /Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc
bun install --frozen-lockfile   # reproducible; refuses lockfile drift
bun run typecheck
bun run build                   # writes dist/myc after smoke-tests
./dist/myc --version            # expect 0.3.14
```

`bun --frozen-lockfile` is the reproducible mode that refuses to
rewrite a mismatching lockfile. `myc`'s repository has no
`bun.lock` (only subpackage `package-lock.json`s), so plain
`bun install` is acceptable if no Bun lockfile is present.

**Status.** This is an environment problem, not a myc problem, and is
recorded here so Phase 5 picks it up cleanly.

---

## Phase 1 — Cline session / runtime topology

Goal: determine `MCP_PROCESS_CARDINALITY`, `CLINE_SESSION_ID_SOURCE`,
and whether concurrent sessions share an MCP client. The deciding
files in this fork:

```
sdk/packages/core/src/runtime/orchestration/runtime-builder.ts
sdk/packages/core/src/extensions/mcp/client.ts
sdk/packages/core/src/extensions/mcp/plugin-server-registration.ts
sdk/packages/core/src/extensions/mcp/config-loader.ts
sdk/packages/core/src/extensions/plugin/plugin-sandbox-bootstrap.ts
sdk/packages/core/src/extensions/plugin/plugin-loader.ts
sdk/packages/shared/src/extensions/contribution-registry.ts
sdk/packages/shared/src/storage/paths.ts
apps/cli/src/commands/mcp.ts
sdk/packages/core/src/services/local-runtime-bootstrap.ts
```

### 1.1 Where the McpManager is created

`loadConfiguredMcpTools(config.logger)` at
`sdk/packages/core/src/runtime/orchestration/runtime-builder.ts:220-284`
creates **a fresh `InMemoryMcpManager`** every time it runs. The only
caller is `runtimeBuilder.build(input)` at line 540. The
corresponding `shutdown` at line 827-834 disposes the manager
alongside the team runtime and the user-instruction service — i.e.,
**per session / per runtime build**.

There is no module-level singleton manager.

### 1.2 How MCP children are spawned

`createDefaultMcpServerClientFactory`
(`sdk/packages/core/src/extensions/mcp/client.ts:774-781`) returns a
factory that, for stdio transports, instantiates
`new StdioMcpClient(registration)`. `StdioMcpClient.spawnProcess` at
line 311-339 calls Node's `child_process.spawn(command, args, { cwd,
env: { ...process.env, ...(transport.env ?? {}) }, stdio: [...] })`.

So the MCP child is a fresh Node process per
`(registration, session)`. The child's environment is `process.env`
of the ClineMM host **spread first**, then `transport.env` overrides.

### 1.3 MCP registration cardinality

`loadConfiguredMcpTools` at runtime-builder.ts:239 calls
`registerMcpServersFromSettingsFile(manager, { filePath:
settingsPath })`, which iterates registrations from
`resolveMcpServerRegistrations()` reading **one file** —
`cline_mcp_settings.json` — resolved by `resolveMcpSettingsPath()`
in `sdk/packages/shared/src/storage/paths.ts:440-446`. The path is
`process.env.CLINE_MCP_SETTINGS_PATH` if set, else
`$CLINE_DATA_DIR/settings/cline_mcp_settings.json` (default
`~/.cline/data/settings/cline_mcp_settings.json`).

Per session, ClineMM spawns one child per registered MCP server, all
reading the same static config file. Each session's children are
disposed at runtime shutdown. **Two concurrent Cline sessions on the
same host = two sets of MCP children, sharing the static config and
the host's `process.env`, but each with their own IPC pipe.**

### 1.4 Concurrent sessions: top-level and subagent

The runtime builder runs **once per session**: line 556 keys team
state by `config.sessionId || effectiveTeamName`; line 829 deletes
the entry on shutdown. The agents-squad example in
`sdk/examples/plugins/agents-squad/` starts background subagents as
their own sessions (the upstream `agenda-task-manager.ts` returns a
`{ sessionId }` immediately on starting — see line 753).

The plugin sandbox is **session-local**: one sandbox subprocess per
session (the bootstrap stashes `cwd`/`workspaceInfo` on globalThis;
`ctx.session` is opaque). No code in
`sdk/packages/core/src/extensions/plugin/` keys sandbox creation by
anything other than the session itself.

### 1.5 Phase 1 verdict

```text
CLINE_SESSION_ID_SOURCE          = ctx.session.sessionId
                                    (AgentExtensionSessionContext;
                                    passed via local-runtime-bootstrap
                                    to the plugin loader at
                                    sdk/packages/core/src/services/
                                    local-runtime-bootstrap.ts:377)

TOP_LEVEL_CONCURRENT_SESSIONS    = supported. Single ClineMM Node
                                    process may host multiple runtime
                                    builds, keyed by sessionId
                                    (runtime-builder's
                                    teamRuntimeEntries map, line 813).

SUBAGENT_CONCURRENT_SESSIONS     = supported (agents-squad).

MCP_PROCESS_CARDINALITY          = one_per_session_per_registration
                                    (one stdio child per registered
                                    MCP server, per runtime build /
                                    session).

MCP_PROCESS_ENV_STATIC_OR_DYNAMIC = static at child spawn. Child gets
                                    {...process.env, ...transport.env}.
                                    ClineMM does NOT mutate
                                    process.env per session —
                                    confirmed by grep over
                                    sdk/packages/core/src/ (no writes
                                    of process.env at session
                                    boundaries).

SESSION_ID_VISIBILITY_TO_CHILD   = none today. Session id is held in
                                    ClineMM's JS heap
                                    (ctx.session.sessionId), not in
                                    the spawned MCP child's env. The
                                    stdio transport has no
                                    headers/argv decoration mechanism
                                    for it.
```

**Status.** Phase 1 = SHIPPED_AND_PROVEN for everything except
`SESSION_ID_VISIBILITY_TO_CHILD`, which is the **decisive gap**.

---

## Phase 2 — Exhaustive myc write-path identity analysis

Every mutating MCP tool goes through the same path:
`MCP tools/call → server.handleLine → dispatch.handler → runCli(argv)
→ run() in-process → CLI command → write`. The session attribution
sources along that path:

```
MCP tools/call             (no schema key 'session' anywhere; verified
                            by grep on packages/mcp/src/tools.ts)
  → dispatch.ts handler    (builds argv; no --session flag added)
  → runCli(argv)           (from packages/mcp/src/command.ts:243,
                            makeRunCli adds only [-C/--db] prefix)
  → run([...argv], {registry})
  → CLI command's flagStr(ctx, "session")
                           (only the commands that DECLARE --session
                            consult this; see table below)
  → resolveSession(flagStr, process.env)
                           (packages/core/src/reach.ts:171-182)
  → SESSION_ENV_KEYS       = [MYC_SESSION_ID, CLAUDE_SESSION_ID,
                             CLAUDE_CODE_SESSION_ID]
```

Every mutation site therefore gets its session from **`process.env`
of the MCP server child**. There is no other source for an
MCP-driven call.

### 2.1 Per-tool session needs

| MCP tool           | CLI subcommand reached         | Mutation                          | Records session? |
| ------------------ | ------------------------------ | --------------------------------- | ---------------- |
| `myc_prime`        | `prime`                        | none (read; filters by visibility) | reads env        |
| `myc_ready`        | `ready` / `ready --claim` / `claim` / `show` | `ready --claim` and `claim` mutate ticket row (assignee, lease) | **no** — `commands/ready.ts` does not call `resolveSession` |
| `myc_update`       | `update` / `ready --claim` / `claim` / `review confirm/reject` | mutates ticket state | **no** — routes through `ready`/`claim`/`review`; `commands/review.ts:586` calls `resolveSession(flagStr(ctx, "session"))` for reviewer identity, but reads env if no flag |
| `myc_recall`       | `recall`                       | none                              | reads env        |
| `myc_remember`     | `remember`                     | inserts node + oplog              | **YES** — `commands/remember.ts:464` calls `resolveSession(flagStr(ctx, "session"))` |
| `myc_show`         | `show`                         | none                              | n/a              |
| `myc_link`         | `link`                         | inserts edge                      | **no** — `commands/link.ts` does not call `resolveSession` |
| `myc_code_*`       | `code map/search/grep/symbol/callers/skeleton` | none                              | n/a              |

### 2.2 What this means for transport selection

- The only mutation site that **records** session identity in the
  data layer is `myc_remember` (via `commands/remember.ts`
  reach=session). `commands/review.ts` calls `resolveSession` for
  reviewer identity but does not persist it on the ticket row in a
  way that affects visibility filtering — it is used for audit / display only.
- `myc_ready claim` and `myc_link` do not record session identity.
  They would benefit from session attribution in a future change, but
  do not require it for correctness today.
- `myc_prime` and `myc_recall` *filter by* session identity; without a
  session in `process.env`, `resolveSession` returns `""` and the
  visibility filter treats the request as "session unknown" (which is
  not an error — see `packages/core/src/reach.ts:184-198`), so
  project-reach and unknown-reach entries are still returned.

### 2.3 Phase 2 verdict

```text
MUTATIONS_REQUIRING_SESSION_ATTRIBUTION_TODAY = [myc_remember]
                                                (review records the
                                                reviewer session via
                                                resolveSession, but
                                                only for audit, not
                                                for visibility)

MUTATIONS_SAFE_WITHOUT_SESSION                = [myc_link,
                                                 myc_ready claim/steal,
                                                 myc_update, myc_review
                                                 confirm/reject,
                                                 myc_prime/recall/show
                                                 are read-only]

CAN_EXISTING_MCP_CALL_CARRY_SESSION_ID        = false
                                                (no schema key, no
                                                 argv decoration, no
                                                 env mechanism)
```

**Status.** Phase 2 = SHIPPED_AND_PROVEN. Session attribution is
required for `myc_remember` reach semantics to mean what they say
("this memory is owned by session X, not visible to session Y").

---

## Phase 3 — Transport decision

The candidate set from RECON §8.4 was A / B / C:

```text
A  per-session MCP child + MYC_SESSION_ID in spawn env
B  additive per-call session argument in the MCP schema
C  Cline-side bridge that wraps the myc CLI with MYC_SESSION_ID
```

Evaluated against Phase 1 + Phase 2 evidence:

### 3.1 Option A — per-session MCP child + `MYC_SESSION_ID` in env

- **Cardinality fits:** Phase 1 confirms one stdio child per session
  per registered MCP server.
- **Data path is exact:** each `tools/call` becomes a fresh CLI
  invocation (in-process `run()` in this fork, but with the same
  `process.env` semantics), `resolveSession()` reads
  `MYC_SESSION_ID` from `process.env` exactly as Claude Code /
  Claude Code 2.1.x already do.
- **The blocker is upstream:** ClineMM does **not** mutate
  `process.env` per session. It calls `spawn(... env: { ...process.env,
  ...transport.env })` with the host's `process.env`, which is the
  shell env the user launched Cline with — *not* the per-session
  value. No code under `sdk/packages/core/src/` writes
  `process.env.MYC_SESSION_ID` at session boundaries.
- **The schema can ask for it via `fromEnv`,** but the source value
  is not in `process.env`, so `fromEnv` resolves to empty, and
  `required` either kills the MCP server or the value silently
  becomes empty.

**Status A:** blocked upstream. Requires a ClineMM change that we do
not own. **NOT chosen** as the primary path, but is the *desired*
steady-state if/when Cline exposes session env propagation.

### 3.2 Option B — additive per-call `session` argument in the MCP schema

- **Cardinality fits:** one tool call, one session argument. The
  payload is unambiguous.
- **Myc-side change is small:** add an optional `session: string` to
  each tool's `inputSchema` that needs it (today: `myc_remember`
  only, per Phase 2 evidence — we should not mechanically inject
  session ids into tools that do not record them), and pass
  `--session <value>` into the CLI argv in `dispatch.ts` and/or
  `command.ts:makeRunCli`.
- **Tooling cost:** `additionalProperties: false` is everywhere on
  the agent profile, so the addition is mechanical. Schema-token
  budget: one optional `session: string` per tool that gains it is
  negligible (the budget is enforced by `tokens.ts`).
- **Concurrent A/B sessions:** two stdio children, two `process.env`s,
  each `tools/call` carries its own `session` arg, `resolveSession`
  reads the flag first (per `packages/core/src/reach.ts:175-176`) and
  falls back to env only if absent — so even if env is shared and
  wrong, the explicit flag wins.

**Status B:** viable. Smallest production change. Explicit. Auditable
in the oplog. **CHOSEN.**

### 3.3 Option C — Cline-side bridge

- **Cardinality fits:** a ClineMM plugin that, on each session,
  registers an MCP server with `env: { MYC_SESSION_ID: { value: <ctx.session.sessionId> } }`.
  But the value indirection is `{ fromEnv, value, required }` — and
  `fromEnv` does not help here because `process.env.MYC_SESSION_ID`
  is not set; only `value` works, but `value` is read **once** by
  `resolvePluginMcpEnv` when the manager processes the registration —
  i.e., per *plugin load*, not per *session*. The registration is
  read from a static `cline_mcp_settings.json` (or the plugin
  manifest). A bridge plugin could re-register a fresh MCP server
  per session, but that adds an entirely new MCP lifecycle to manage
  inside ClineMM, and ClineMM does not yet expose a hook for "session
  started, please inject MCP env into the spawn".

**Status C:** not viable today. Requires ClineMM-side plumbing that
does not exist. Defer until either Cline exposes a way for plugins
to re-register MCP servers per session, or we accept running our own
MCP server outside of `cline_mcp_settings.json`. **NOT chosen.**

### 3.4 Phase 3 verdict

```text
PREFERRED_SESSION_TRANSPORT = B (additive per-call 'session' argument
                                on the mutation tools that need it;
                                today: myc_remember)

REJECTED_TRANSPORTS         = A  (blocked: ClineMM doesn't mutate
                                  process.env per session)
                                C  (blocked: registration env is
                                  resolved once, not per session)
```

A *combination* is also possible later: do B today, layer C (or A)
on top once Cline exposes a session-env hook. That ordering is the
minimum-friction path; B is a single small, additive, audit-friendly
change.

**Status.** Phase 3 = SHIPPED_AND_PROVEN. Transport B is selected.

---

## Phase 4 — ClineMM MCP configuration authority

### 4.1 Single configuration file

`resolveMcpSettingsPath()` in
`sdk/packages/shared/src/storage/paths.ts:440-446` returns
`process.env.CLINE_MCP_SETTINGS_PATH` if set, otherwise
`$CLINE_DATA_DIR/settings/cline_mcp_settings.json` (defaulting to
`~/.cline/data/settings/cline_mcp_settings.json`).

This file is read by:

- `cline mcp install <name> --command <bin> -- <args>` (writes it;
  CLI) — `apps/cli/src/commands/mcp.ts:installMcpServer`.
- the CLI's MCP manager at runtime, via the core SDK.
- the VS Code extension's `McpHub` watcher, which **also calls
  `mcpHub.getMcpSettingsFilePath()` returning the same path**
  (`apps/vscode/src/core/storage/remote-config/utils.ts:382`).

Therefore: **CLI and IDE share the same single configuration file**.
There is no workspace-local override; there is no IDE-specific MCP
settings JSON. The IDE reads the same file as the CLI.

### 4.2 Schema fields relevant to env propagation

`AgentExtensionMcpServer` in
`sdk/packages/shared/src/extensions/contribution-registry.ts:96-102`
declares:

```ts
{
  name: string,
  transport: AgentExtensionMcpTransport,
  env?: AgentExtensionMcpEnv,        // { [key]: string | { fromEnv?, value?, required? } }
  metadata?: Record<string, unknown>
}
```

The top-level `env` is **only valid for stdio** transports (verified
at `extensions/mcp/plugin-server-registration.ts:130-134`). It is
merged into the spawn `env` at `extensions/mcp/client.ts:333-336`:

```ts
env: { ...process.env, ...(transport.env ?? {}) }
```

### 4.3 Is `fromEnv: "MYC_SESSION_ID"` dynamic?

**No — `fromEnv` resolves at the moment the spawn happens**, which
is inside `spawnProcess()` on first `connect()` of the
`StdioMcpClient`, which is inside `loadConfiguredMcpTools()` during
runtime build, which is inside the per-session
`runtimeBuilder.build()`. The "source" is `process.env[sourceName]`
of the ClineMM host **at that moment**.

ClineMM's host `process.env` is the shell env that started Cline, not
the per-session value. Nothing in ClineMM writes
`process.env.MYC_SESSION_ID` per session — confirmed by `grep -rn
'process.env' sdk/packages/core/src/runtime` (only reads of static
keys, no `process.env[key] = value` assignments).

So `fromEnv: "MYC_SESSION_ID"` would propagate whatever Cline itself
sees at child-spawn time, which is the *user*'s shell env. The
per-session value never reaches the child.

### 4.4 Phase 4 verdict

```text
CLI_CONFIG_AUTHORITY             = ~/.cline/data/settings/cline_mcp_settings.json
                                   (or $CLINE_MCP_SETTINGS_PATH override)
IDE_CONFIG_AUTHORITY             = same file (no separate IDE config)
WORKSPACE_OVERRIDES              = none
MCP_PROCESS_CREATION             = extensions/mcp/client.ts:311
                                   (StdioMcpClient.spawnProcess)
ENV_PROPAGATION                  = static at spawn time
                                   (no per-session hook)
CAN_SCHEMA_ASK_FOR_DYNAMIC_SESSION_ENV = false (no Cline-side hook
                                            writes process.env per
                                            session)
```

**Status.** Phase 4 = SHIPPED_AND_PROVEN.

---

## Pre-execution checkpoint

```text
MYC-CLINEMM01 / PRE-EXECUTION QUALIFICATION

CLINE_SESSION_ID_SOURCE              = ctx.session.sessionId
TOP_LEVEL_CONCURRENT_SESSIONS        = supported (multiple per host process)
SUBAGENT_CONCURRENT_SESSIONS         = supported (agents-squad)
MCP_PROCESS_CARDINALITY              = one stdio child per session per registered MCP server
MCP_PROCESS_ENV_STATIC_OR_DYNAMIC    = static at spawn (no per-session hook)
CAN_EXISTING_MCP_CALL_CARRY_SESSION_ID = false (no schema key, no argv decoration,
                                               env is shared per host)
PREFERRED_SESSION_TRANSPORT          = B (additive per-call 'session' argument on
                                       myc_remember today; other mutators as
                                       Phase 2 evidence warrants)
REJECTED_TRANSPORTS                  = A (blocked: ClineMM doesn't mutate
                                         process.env per session),
                                        C (blocked: plugin-server env is
                                         resolved at registration load,
                                         not per session)
CLI_CONFIG_AUTHORITY                 = ~/.cline/data/settings/cline_mcp_settings.json
                                       (CLI + IDE share; $CLINE_MCP_SETTINGS_PATH override)
IDE_CONFIG_AUTHORITY                 = same file (no separate IDE config)
WORKSPACE_OVERRIDES                   = none
READY_FOR_PHASE5                     = true
                                       (transport decision is fixed, and
                                       Phase 5 only needs the build
                                       environment; production changes
                                       for B are scoped to MYC-CLINEMM02,
                                       which Phase 5 still does not start)
```

---

## What Phase 5+ still owes

Phase 5 must install Bun (the pinned 1.3.13 if reproducing ClineMM's
engine) and run `bun install` + `bun run build` in the myc fork.
Phases 6–12 then black-box-qualify the actual end-to-end behavior
under the resolved environment.

No myc production change is implied by Phases 0–4. The additive
`session` argument (Transport B) belongs to MYC-CLINEMM02, which is a
separate task. This report's job ends at the checkpoint above.

— end of MYC-CLINEMM01 Phases 0–4 —

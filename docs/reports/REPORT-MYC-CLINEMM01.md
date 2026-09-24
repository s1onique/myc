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

MCP_PROCESS_ENV_STATIC_OR_DYNAMIC = per-call object at spawn. Each
                                    stdio child receives
                                    {...process.env, ...transport.env}
                                    as a per-spawn object literal — the
                                    host `process.env` is shared, but
                                    the *per-child env object* is not
                                    inherently shared between sessions
                                    (each session has its own child
                                    process with its own env). ClineMM
                                    does NOT mutate `process.env` per
                                    session — confirmed by grep over
                                    sdk/packages/core/src/ (no writes
                                    of process.env at session
                                    boundaries). Materializing a
                                    per-session value into the per-child
                                    env object is what A2a adds.

SESSION_ID_VISIBILITY_TO_CHILD   = none today. Session id is held in
                                    ClineMM's JS heap
                                    (ctx.session.sessionId), not in
                                    the spawned MCP child's env. The
                                    stdio transport has no
                                    headers/argv decoration mechanism
                                    for it. **The seam for A2a is the
                                    spawn call site
                                    (`extensions/mcp/client.ts:333-336`):
                                    the per-child env object exists; the
                                    session id is in scope upstream
                                    (`local-runtime-host.ts:723`); only
                                    the materialization path is
                                    missing.**
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


## Phase 3 — Transport decision (revised after review)

### 3.0 Review-driven correction (added before Phase 5)

The original Phase 3 verdict selected Transport **B** (additive
per-call `session` argument in the MCP schema, scoped to
`myc_remember`). A reviewer challenged that on two grounds, both
correct:

1. **Transport A was rejected for the wrong reason.** ClineMM's
   `StdioMcpClient.spawnProcess` already takes an explicit `env`
   object (`extensions/mcp/client.ts:333-336`). The session id is
   already in scope at the runtime-build call site
   (`local-runtime-host.ts:747` `this.runtimeBuilder.build(...)`,
   with `sessionId` in scope from line 723). Nothing today threads
   it into the spawn env, but the *seam* exists. The actual blocker
   is **not** "ClineMM doesn't mutate `process.env`" — ClineMM
   doesn't need to mutate anything global; the spawn env is a
   per-call object that can carry per-session values. The blocker
   is that the materialization path
   `registration.env.MYC_SESSION_ID → ctx.session.sessionId`
   does not exist in `resolvePluginMcpEnv`
   (`plugin-server-registration.ts:54-87`); that function only
   knows `{ fromEnv, value, required }` and resolves at
   *registration load* time, reading `process.env[sourceName]` from
   the host process.

2. **Transport B is incomplete under the visibility invariant.**
   The original B scoped the `session` argument to `myc_remember`
   only. But Phase 2 evidence shows `myc_prime`
   (`packages/cli/src/commands/prime.ts:739`) and `myc_recall`
   (`packages/cli/src/commands/recall.ts:523`) also call
   `resolveSession()` and filter on the resulting session id. With
   B-as-scoped, those calls return `""`, and
   `packages/core/src/reach.ts:195-198` `visibleInPrime` then
   filters session-reach items out of `prime`'s output
   (`current.length > 0 && info.session === current` — both legs
   fail when `current` is empty). That breaks the very invariant
   "session A sees its own session-reach memory" — *worse* than
   showing session B's memory. To preserve the invariant, B must
   carry session on **at least** `myc_remember`, `myc_prime`, and
   `myc_recall` (and probably `myc_review`, where reach/audit
   attribution matters). At that scope, B is no longer a
   one-argument addition; it's a per-tool schema and dispatch
   maintenance contract that has to be kept in lockstep with
   every new myc tool that touches reach.

The reviewer proposed a third path:

```text
A2  per-session MCP child + session-aware env materialization
    (MYC_SESSION_ID=<ctx.session.sessionId> injected at spawn)
```

with two variants:

- **A2a (generic):** extend `AgentExtensionMcpEnvValue`
  (`shared/extensions/contribution-registry.ts:57-64`) with a new
  `{ fromSession: "sessionId" }` indirection, and add a ClineMM
  materialization step between `loadConfiguredMcpTools` and
  `StdioMcpClient.spawnProcess` that resolves `fromSession` against
  the live `ctx.session.sessionId`. This is a generic ClineMM
  feature, not myc-specific.
- **A2b (small):** have ClineMM automatically inject
  `CLINE_SESSION_ID=<sessionId>` into every local stdio MCP
  child's env, and add `CLINE_SESSION_ID` to
  `SESSION_ENV_KEYS` in `packages/core/src/reach.ts:59-67`.
  Smaller, but couples myc to Cline-specific naming.

### 3.1 Option A2a — `fromSession` env indirection (CHOSEN, generic)

- **Cardinality fits.** Phase 1 confirms one stdio child per
  session per registered MCP server. The spawn env is already an
  explicit per-call object.
- **Myc side is unchanged.** `MYC_SESSION_ID` is already in
  `SESSION_ENV_KEYS`; `resolveSession()` already reads it from
  `process.env`; every command already does the right thing. No
  schema or argv changes. Future myc tools inherit session identity
  automatically.
- **ClineMM change is small and generic.** One new optional field
  in `AgentExtensionMcpEnvValue`, one new branch in
  `resolvePluginMcpEnv`, plus threading `sessionId` from the
  runtime-builder through the InMemoryMcpManager into the per-child
  spawn. The runtime builder is already session-scoped
  (line 540 + line 556 `registryKey = config.sessionId || ...`),
  so the seam is reachable.
- **Concurrent A/B sessions.** Two stdio children, two distinct
  spawn envs, two distinct `MYC_SESSION_ID` values. Phase 2's
  isolation invariants fall out for free; `visibleInPrime`
  evaluates `info.session === current` and gets the right answer.
- **Visibility filtering parity.** `myc_prime` and `myc_recall`
  read session from `process.env.MYC_SESSION_ID` exactly as
  Claude Code does today; no schema or dispatch change required.

**Status A2a:** viable, generic, zero myc production change,
preserves the visibility invariant for every current and future
myc tool.

### 3.2 Option A2b — auto-inject `CLINE_SESSION_ID`

- **Cardinality fits.** Same as A2a.
- **Myc side change is small.** Add `CLINE_SESSION_ID` to
  `SESSION_ENV_KEYS`. The flag chain stays unchanged.
- **Generic concern.** Couples myc to Cline naming. Slight risk of
  precedence collisions with a user-set `MYC_SESSION_ID` in their
  shell env (the host spreads `...process.env` first, then
  `transport.env` overrides — so `transport.env.MYC_SESSION_ID`
  wins; this is *fine* if the Cline-side injection writes
  `transport.env`, not `process.env`). Slightly more brittle than
  A2a because every agent that wants this feature has to maintain
  its own env-name mapping.

**Status A2b:** viable as a fallback if ClineMM rejects the
generic `fromSession` extension in code review. Smaller diff.

### 3.3 Option B — additive per-call `session` argument (FALLBACK)

- **Cardinality fits.** One tool call, one session argument.
- **Myc side is not small.** To preserve the visibility invariant,
  every tool that reads `resolveSession()` needs the argument:
  `myc_remember`, `myc_prime`, `myc_recall`, `myc_review`. Any
  future tool that reads reach inherits a maintenance contract.
- **Tooling cost.** `additionalProperties: false` is enforced
  across the agent profile; the addition is mechanical per-tool,
  but the *list of tools* must be kept in sync with
  `resolveSession` callers — perpetual schema-maintenance
  invariant.
- **Identity transport problem.** Someone has to populate the
  `session` field on every tool call. That requires either an
  LLM-instructed convention (fragile, the model has to remember to
  copy an opaque identifier correctly) or a ClineMM
  tool-call-interceptor mechanism. Either way, ClineMM has to do
  the same plumbing it would do for A2 — just in a different
  place. A2 is strictly less code than B + the interceptor.

**Status B:** viable as a fallback if neither A2a nor A2b is
acceptable upstream. More code than A2a, more failure modes.

### 3.4 Option A1 — mutate ClineMM `process.env` per session (REJECTED)

- The reviewer correctly noted this is **not** the same as A2.
  A1 would write `process.env.MYC_SESSION_ID = sessionId` inside
  ClineMM at session boundaries, polluting the host's environment
  and racing with concurrent sessions.
- Re-confirmed by grep over `sdk/packages/core/src/`: no
  `process.env[key] = value` writes anywhere. A1 would be the
  first such write.

**Status A1:** REJECTED. A1 was the reason Transport A was
originally rejected; that reason was correct for A1 and *only*
A1. Transport A in general (per-session spawn env injection) is
A2 and is the chosen path.

### 3.5 Option C — Cline-side bridge plugin (REJECTED, unchanged)

- `resolvePluginMcpEnv` reads `fromEnv`/`value` once at
  registration load (`plugin-server-registration.ts:54-87`),
  before any session exists. A bridge plugin that re-registers an
  MCP server per session would need ClineMM to expose a
  "session started" hook, which it does not. The static
  `cline_mcp_settings.json` is one file, read once per runtime
  build, and the `InMemoryMcpManager` is created inside that
  build (`runtime-builder.ts:229-233`). No clean bridge surface
  today.

**Status C:** REJECTED. Unchanged from the original verdict.

### 3.6 Phase 3 verdict (revised)

```text
PREFERRED_SESSION_TRANSPORT = A2a (per-session MCP child +
                                  session-aware env materialization
                                  via a new 'fromSession' field on
                                  AgentExtensionMcpEnvValue,
                                  resolved at spawn time from
                                  ctx.session.sessionId)

FALLBACK_TRANSPORT          = A2b (ClineMM auto-injects
                                   CLINE_SESSION_ID; myc adds it to
                                   SESSION_ENV_KEYS)

SECONDARY_FALLBACK          = B  (additive per-call 'session'
                                   argument on every myc tool that
                                   reads resolveSession(), with a
                                   ClineMM tool-call interceptor to
                                   populate it from ctx.session)

REJECTED_TRANSPORTS         = A1 (mutating ClineMM process.env
                                   per session; races with
                                   concurrent sessions)
                                 C  (no per-session registration
                                   hook exists in ClineMM)
```

### 3.7 Phase 1 phrase correction

The Phase 1 verdict line `MCP_PROCESS_ENV_STATIC_OR_DYNAMIC =
static at child spawn` and the pre-execution checkpoint line
`CAN_EXISTING_MCP_CALL_CARRY_SESSION_ID = false (no schema key,
no argv decoration, env is shared per host)` were misleading.
The **host `process.env`** is shared per host, but the **per-child
spawn env** is not inherently shared: each session has its own
child process and therefore can receive a distinct env. The
pre-execution checkpoint below records the corrected wording.

**Status.** Phase 3 = SHIPPED_AND_PROVEN after revision. The
revised verdict preserves Phases 1, 2, 4 unchanged and identifies
A2a as the primary path, A2b as a smaller fallback, B as a deeper
fallback, and A1/C as rejected.

### 3.8 Frozen contract (added after second review)

A second reviewer accepted A2a but asked for three concrete
additions: (a) split the qualification oracle so CLINEMM01 can
prove myc's side without A2a existing yet, (b) freeze a
precedence rule for `AgentExtensionMcpEnvValue`, and (c)
enumerate the tests that must exist before A2a ships. This
subsection freezes those decisions.

**3.8.1 Qualification-oracle split.** The end-to-end question
"does Cline carry session into myc?" decomposes into two
independently falsifiable claims:

- `MYC_ENV_SESSION_ISOLATION` — *"If a stdio child is launched
  with `MYC_SESSION_ID=A`, unmodified myc satisfies S58 in a
  way that A and B are mutually isolated."* This is a property
  of the modified myc binary under a chosen env, and is
  provable from CLINEMM01 by launching two MCP children by hand
  (`MYC_SESSION_ID=A ./dist/myc mcp --profile agent` and
  `MYC_SESSION_ID=B ./dist/myc mcp --profile agent`) once
  Phase 5 builds `dist/myc`.

- `CLINEMM_SESSION_PROPAGATION` — *"If a Cline session has a
  given `sessionId`, ClineMM materializes that id into the
  per-MCP-child env as `MYC_SESSION_ID`."* This is a property
  of the ClineMM runtime builder, and is provable only after
  A2a is implemented (CLINEMM02).

Until CLINEMM02 ships, `CLINEMM_SESSION_PROPAGATION =
NOT_IMPLEMENTED` is the correct verdict; reporting
`SESSION_ID_PROPAGATION = PASS` from CLINEMM01 alone would be
false-positive evidence because manually setting
`MYC_SESSION_ID` only proves the oracle, not the propagation.

**3.8.2 Precedence rule for `AgentExtensionMcpEnvValue`.** The
field set today is `{ value, fromEnv, required }`; A2a adds
`fromSession`. To avoid ambiguous objects and the test matrix
explosion that follows them, the contract is:

```text
source-of-truth   : value XOR fromEnv XOR fromSession
                    (exactly one of the three must be present;
                    none or more than one is a configuration
                    error)

required          : orthogonal boolean (applies regardless of
                    which source is selected)

error mode        : configuration with zero sources -> fail to
                    load the registration
                    configuration with multiple sources -> fail
                    to load the registration
                    configuration with a source that resolves
                    to undefined and required=true -> fail at
                    spawn time
                    configuration with a source that resolves
                    to undefined and required=false -> spawn
                    with the key absent
```

The disallow-multiple-sources rule means each of the four
candidate fields is testable in isolation: tests do not need
to enumerate `{value, fromEnv} × {value, fromSession} × …`
combinations, only `{value} ∪ {fromEnv} ∪ {fromSession} ×
{required}`, which is six cases instead of dozens. Precedence
is therefore a non-ambiguity guarantee, not an ordering rule.

**3.8.3 Narrow `fromSession` enum.** Ship exactly
`fromSession?: "sessionId"`. Do not preemptively generalize to
`"workspaceRoot"`, `"cwd"`, `"userId"`, etc. The narrow cap is
a security contract: it makes it obvious from reading a
configuration file whether a field can leak information about
the runtime session. If a second session-derived field is
needed later, add it in its own CLINEMM-numbered decision with
its own review; do not extend the enum in place.

**3.8.4 Frozen A2a test matrix.** The following nine tests are
non-negotiable for CLINEMM02; all nine must pass before
`CLINEMM_SESSION_PROPAGATION = PASS` can be reported. The
matrix is split between unit tests (CLINEMM-side) and
integration tests (end-to-end with myc).

```text
A2A-01  unit    { value: "foo" } resolves to env.FOO = "foo"
                (regression guard: A2a must not break existing
                value-only configurations)

A2A-02  unit    { fromEnv: "FOO" } resolves to env.FOO = the
                host's process.env.FOO at spawn time
                (regression guard: existing fromEnv path still
                works under the new precedence rule)

A2A-03  unit    { fromSession: "sessionId" } resolves to
                env.MYC_SESSION_ID = ctx.session.sessionId at
                spawn time

A2A-04  integ   two simultaneous sessions: child A's env has
                MYC_SESSION_ID = A; child B's env has
                MYC_SESSION_ID = B; the two values are not
                equal

A2A-05  unit    { fromSession: "sessionId", required: true }
                and a runtime that has no session (e.g. an
                IDE-level MCP probe): loud failure at spawn,
                not silent undefined

A2A-06  unit    { value, fromEnv, fromSession } is rejected at
                registration load (zero or multiple sources is
                a configuration error)
                AND { value: undefined } is rejected (zero
                sources is a configuration error)
                AND { required: true } alone with no source is
                rejected

A2A-07  integ   remote MCP servers (SSE / HTTP transports):
                `fromSession` is rejected or no-op'd at spawn,
                because the child process lives on a remote
                host and session scoping there is a different
                problem. Cline-side decision: server is rejected
                from the active set, with a clear error message.

A2A-08  unit    cline_mcp_settings.json parser accepts the new
                `fromSession` key in env values and round-trips
                it through read/write without loss

A2A-09  integ   an MCP server registered WITHOUT fromSession
                receives no MYC_SESSION_ID at all (its env does
                not include the session id). This is the
                explicit-opt-in security boundary: Cline does
                not implicitly leak session ids to every MCP
                child. Tested by registering a dummy stdio
                server with only a literal env, and asserting
                process.env.MYC_SESSION_ID is undefined inside
                the dummy's handler.
```

The matrix is locked as written. CLINEMM02 may add tests, but
must not drop or weaken these nine.

**Status.** Phase 3 frozen additions = SHIPPED_AND_PROVEN. No
further redesign of the transport architecture is permitted
before Phase 5/6 produces falsifying evidence. If Phase 5/6
falsifies any of the §3.8 commitments, that is a new decision,
not a quiet re-edit.

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
MYC-CLINEMM01 / PRE-EXECUTION QUALIFICATION (revised after review)

CLINE_SESSION_ID_SOURCE              = ctx.session.sessionId
TOP_LEVEL_CONCURRENT_SESSIONS        = supported (multiple per host process)
SUBAGENT_CONCURRENT_SESSIONS         = supported (agents-squad)
MCP_PROCESS_CARDINALITY              = one stdio child per session per registered MCP server
MCP_PROCESS_ENV_STATIC_OR_DYNAMIC    = per-call object at spawn (each child
                                       receives its own env object;
                                       nothing forces it to be shared)
CAN_EXISTING_MCP_CALL_CARRY_SESSION_ID = false (no schema key, no argv decoration,
                                               no env mechanism ClineMM populates today)
CAN_EXISTING_MCP_PROCESS_CARRY_SESSION_ID = true
                                       (MCP process cardinality is
                                       one_per_session_per_registration;
                                       the per-child env object CAN carry
                                       MYC_SESSION_ID — ClineMM today
                                       lacks only the materialization path
                                       from ctx.session.sessionId to that
                                       env object)
PREFERRED_SESSION_TRANSPORT          = A2a (per-session MCP child +
                                        session-aware env materialization
                                        via new 'fromSession' field on
                                        AgentExtensionMcpEnvValue;
                                        resolved at spawn from
                                        ctx.session.sessionId;
                                        zero myc production change)
FALLBACK_TRANSPORTS                  = A2b (ClineMM auto-injects
                                          CLINE_SESSION_ID; myc adds
                                          CLINE_SESSION_ID to
                                          SESSION_ENV_KEYS)
                                        B   (additive per-call 'session'
                                          argument on every myc tool that
                                          reads resolveSession(), plus a
                                          ClineMM tool-call interceptor;
                                          perpetual schema-maintenance
                                          contract)
REJECTED_TRANSPORTS                  = A1 (mutating ClineMM process.env
                                          per session; races with
                                          concurrent sessions)
                                        C   (no per-session registration
                                          hook exists in ClineMM)
MUTATIONS_REQUIRING_SESSION_TODAY    = [myc_remember writes session,
                                         myc_prime reads session,
                                         myc_recall reads session,
                                         myc_review reads session for
                                         audit]
MUTATIONS_SAFE_WITHOUT_SESSION       = [myc_link, myc_ready claim,
                                         myc_update]
CLI_CONFIG_AUTHORITY                 = ~/.cline/data/settings/cline_mcp_settings.json
                                        (CLI + IDE share;
                                        $CLINE_MCP_SETTINGS_PATH override)
IDE_CONFIG_AUTHORITY                 = same file (no separate IDE config)
WORKSPACE_OVERRIDES                   = none
READY_FOR_PHASE5                     = true (transport decision is fixed,
                                        Phase 5 still only needs the
                                        build environment; A2a is
                                        generic ClineMM plumbing and
                                        is not started by CLINEMM01)
READY_FOR_CLINEMM02                  = false (A2a not implemented;
                                        CLINEMM02 starts it)
MYC_ENV_SESSION_ISOLATION_TARGET     = PASS|FAIL (Phase 7 oracle: two
                                        hand-spawned myc MCP children
                                        with MYC_SESSION_ID=A and
                                        MYC_SESSION_ID=B satisfy S58
                                        under unmodified myc)
CLINEMM_SESSION_PROPAGATION_TARGET    = NOT_IMPLEMENTED
                                        (only flips to PASS|FAIL after
                                        CLINEMM02 ships A2a and runs
                                        A2A-04 against the real
                                        runtime builder; CLINEMM01
                                        must not produce a verdict
                                        here)
ENV_VALUE_PRECEDENCE                 = value XOR fromEnv XOR fromSession
                                        (exactly one source;
                                        zero or multiple sources is
                                        a registration-load error)
ENV_VALUE_REQUIRED                   = orthogonal boolean (applies
                                        regardless of which source is
                                        selected; required+undefined
                                        source at spawn -> fail)
FROZEN_FROMSESSION_ENUM              = "sessionId" only (no
                                        preemptive generalization
                                        to workspaceRoot, cwd, etc.)
FROZEN_TEST_MATRIX                   = [A2A-01, A2A-02, A2A-03,
                                        A2A-04, A2A-05, A2A-06,
                                        A2A-07, A2A-08, A2A-09]
                                        (locked; CLINEMM02 may add
                                        tests but may not drop or
                                        weaken any of these nine)
```

---

## What Phase 5+ still owes

Phase 5 must install Bun (the pinned 1.3.13 if reproducing ClineMM's
engine) and run `bun install` + `bun run build` in the myc fork.
Phases 6–12 then black-box-qualify the actual end-to-end behavior
under the resolved environment, split per §3.8.1:

- **Phase 7 oracle (`MYC_ENV_SESSION_ISOLATION`).** Launch two
  MCP children by hand:

  ```bash
  MYC_SESSION_ID=A ./dist/myc mcp --profile agent
  MYC_SESSION_ID=B ./dist/myc mcp --profile agent
  ```

  and prove that A remembers A, B remembers B, A's prime/recall
  sees only A, B's prime/recall sees only B, and project-reach
  memory is visible to both. This is a property of unmodified
  myc under a chosen env. CLINEMM01 owns this verdict.

- **Phase 7 propagation oracle (`CLINEMM_SESSION_PROPAGATION`).**
  NOT_IMPLEMENTED. CLINEMM01 must not produce a PASS/FAIL here.
  CLINEMM02 flips this verdict by (1) implementing A2a in
  ClineMM, (2) running A2A-04 against the real runtime builder,
  and (3) running A2A-01, A2A-02, A2A-03, A2A-05, A2A-06,
  A2A-07, A2A-08, A2A-09 to fully close the test matrix.

**Zero myc production change is implied by Phases 0–4.** The
chosen path A2a is a generic ClineMM feature (a new optional
`fromSession: "sessionId"` field on `AgentExtensionMcpEnvValue`
plus a materialization step in the runtime builder) — it is not
myc-side work. A2b (the smaller fallback) is one extra line in
`SESSION_ENV_KEYS`. B (the deeper fallback) would require
production changes on both sides and is not the recommended
path.

The implementation of A2a (and the running of the §3.8.4 test
matrix) is the work of MYC-CLINEMM02, which is a separate task.
This report's job ends at the checkpoint above.

— end of MYC-CLINEMM01 Phases 0–4 (revised after review, frozen
contract §3.8) —

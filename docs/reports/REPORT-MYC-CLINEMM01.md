# MYC-CLINEMM01 — Phase 0 baseline: ClineMM checkout exists, environment not buildable yet

> **Scope.** Phase 0 of MYC-CLINEMM01 only. No production edits to myc; no
> edits to ClineMM. The remaining eleven phases are blocked by the
> environment, not by Phase 0 evidence, and their findings are recorded as
> **STOP_AND_RECORD** (not as "started" or "PASS").
>
> **Inputs.** `docs/reports/REPORT-MYC-RECON01.md` (the only baseline fact
> set used). The plan in RECON §8.5 is the protocol followed here.

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
MCP_TRANSPORT                  = NOT_TESTED  (Phase 6 blocked by bun absence)
SESSION_ID_SOURCE              = NOT_TESTED  (Phase 1 not yet started)
SESSION_ID_PROPAGATION         = NOT_TESTED  (Phase 7 blocked)
CONCURRENT_SESSION_ISOLATION   = NOT_TESTED  (Phase 8 blocked)
CLINE_CLI_CONFIG_AUTHORITY     = NOT_TESTED  (Phase 4 not yet started)
CLINE_IDE_CONFIG_AUTHORITY     = NOT_TESTED  (Phase 4 not yet started)
MYC_PRODUCTION_CHANGE_REQUIRED = UNKNOWN     (no qualification run)
READY_FOR_CLINEMM02            = false       (Phase 7 not PASS)
```

**Status.** Phase 0 = `PHASE_0_COMPLETE_ENVIRONMENT_BLOCKING_BUILD`.

## Environment block (the one thing Phase 0 surfaces that RECON01 missed)

The build/test phases of CLINEMM01 require Bun. This environment has
none. The remediation is mechanical:

```bash
# Option A: homebrew install (matches the bun 1.3.13/.nvmrc node 22 baseline)
brew install oven-sh/bun/bun
export PATH="$HOME/.bun/bin:$PATH"

# Then inside the myc fork:
cd /Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc
bun install                    # ~30 s
bun run typecheck              # ~10 s
bun run build                  # writes dist/myc after smoke-tests
./dist/myc --version           # expect 0.3.14
```

`brew` itself was not exercised in this report either; Phase 5 should
verify the toolchain end-to-end before any CLINEMM01 phase that depends
on it.

**Status.** This is an environment problem, not a myc problem, and is
recorded here so the next session picks it up cleanly.

## STOP_AND_RECORD

Phase 0 produced real evidence (ClineMM exists, RECON01 facts
re-verify, plugin API confirmed in fork) and a real environment block
(no Bun, no `dist/myc`). It did **not** start Phases 1-12 — those
remain in the §8.5 plan, untouched, to be picked up after the build
environment is in place.

This report deliberately does **not** carry any verdict beyond
"Phase 0 complete; environment blocks build". Any verdict in
`MCP_TRANSPORT`, `SESSION_ID_PROPAGATION`, or
`CONCURRENT_SESSION_ISOLATION` would be invented.

— end of MYC-CLINEMM01 Phase 0 —

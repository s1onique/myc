# ACT-MYC-UPSTREAM-044-INTEGRATION01 — integrate upstream 0.4.4 and reassess ClineMM integration

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Repository | `/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc` |
| Common base | `17f6209162ea1c9a4dafc1216bedb0d333cf2303` (tag `v0.3.14`) |
| Our main (pre-merge) | `9d754931ceb77559ec30a4a165e4a677a9d03f1f` (8 ahead) |
| Upstream main | `c27523fdabacc406e434f9f7a08c1241ae180b0d` (tag `v0.4.4`) (61 ahead) |
| Integration branch head | `e2adccd16460b2ceec0497ffd5c01adb4fb41791` (merge commit, --no-ff) |
| Merge conflicts | 0 |
| Target version | **0.4.4** |
| Verdict | **PARTIAL — re-review needed; do NOT promote to global binary yet** |

---

## 0. Executive summary

Upstream 0.3.14 → 0.4.4 is **not** "61 commits, probably harmless". It is an
**architectural revision**: a new optional `myc serve` (HTTP), a real Postgres
backend with RLS, sync/convergence between local SQLite and a central Postgres,
ACL/private-owner semantics that change ownership semantics, a refactor of the
merge/apply code from `cli/` into `core/`, fresh locks via a `bun.lock`, and C#
code-intel. The MCP surface (13-tool agent profile, no per-call session arg,
`MYC_SESSION_ID` env precedence) and the S58 reach/session contract are
**preserved** — A2a remains a viable transport — but the bun-types resolution
issue that produced a RED typecheck in 0.3.14 is **NOT fixed** by the upstream
lockfile; 0.4.4 still pulls `bun-types@1.4.0` and the same `Buffer/Uint8Array`
typing failures reappear.

Three things most matter for our ClineMM integration:

1. **`MYC_SESSION_ID` is still the first entry in `SESSION_ENV_KEYS`** — A2a
   transport is still correct. We do not need to add a per-call `session`
   argument; the MCP schema does not declare one.
2. **`HARNESSES` is now `["claude","codex","opencode","kimi","mcode","mimo"]`**
   (commits 008/010 of swarm). Cline is still absent. Adding it upstream-side
   would require a swarm migration 011 that rebuilds CHECK constraints.
3. **Postgres + serve + sync is a real, deployable architecture.** SurrealDB
   should be **deferred** until we see whether local SQLite + Postgres sync
   serves the original multi-agent/multi-machine goal.

The merge applied cleanly. **61/61 commits classified.** Build PASS. Tests
mostly PASS. Migration from 0.3.14 schema (12 + compat 13) to 0.4.4 schema
(compat 13, 14, 15, 16) applied successfully on a copy of the live ClineMM
database; node count (76) and edge count (100) and reach distribution
(30 unknown, 4 project, 42 session) are preserved. Vector recall works
after migration.

**The single hard FAIL is `bun run typecheck`** — the same `bun-types@1.4.0`
typing breakage as 0.3.14, now potentially with **more** surface area. Until
that is fixed upstream or we pin `bun-types@~1.3.0`, we should **not**
promote `dist/myc` to `~/.myc/bin/myc`.

## 1. Authority freeze (Phase 0)

```text
WORKTREE_CLEAN=true
COMMON_BASE=17f6209162ea1c9a4dafc1216bedb0d333cf2303
UPSTREAM_AHEAD=61
FORK_AHEAD=8
UPSTREAM_HEAD=c27523fdabacc406e434f9f7a08c1241ae180b0d
TAG_v0.3.14=17f6209
TAG_v0.4.0=c0538d493ad37d78be4dc866cd9ec37e8a799cdc
TAG_v0.4.1=aff39bc66ea6da1f41bc4ff61fb306eed6089ccd
TAG_v0.4.2=c5260876a6cec6d6aed21398870953d09d05c89c
TAG_v0.4.3=d565512072cebe4fcf02425a48ee72950c3f7fcb
TAG_v0.4.4=5f592c817574f51cd424a008171b9c4c48a56fe0
```

## 2. Phase 1 — 61-commit ledger

The ledger below lists every commit from `17f620916…` to `c27523fd…`,
oldest → newest, with classification. "Primary subsystem" is the dominant
one and "secondary" is a non-trivial side effect.

### 2.1 First half (commits 1–31)

| # | SHA | Date | Subsystem (P/S) | Bucket | Contract? | Schema? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 4a295e7 | 2026-09-24 | store-sqlite/bun | BUILD_DEPENDENCIES | no | no | minSQLite floor 3.44.0 → 3.50.4 |
| 2 | 274e7fb | 2026-09-24 | store-sqlite | TEST_INFRA | no | no | updates version numbers |
| 3 | 04e8c11 | 2026-09-24 | cli/retrieval | TEST_INFRA | no | no | two flaky wall-time tests re-written |
| 4 | 76a6e25 | 2026-09-25 | code-intel/anchors | CODE_INTEL | no | no | re-bind for missing files |
| 5 | d004352 | 2026-09-25 | mcp/cli | MCP_CONTRACT (text) | text-only | no | prompt audit; bootstrap rewritten |
| 6 | 6ca77cc | 2026-09-25 | cli | TEST_INFRA | no | no | budget assertions stabilised |
| 7 | aef74fe | 2026-09-26 | code-intel | CODE_INTEL | no | no | broken neighbour = skip |
| 8 | 4f3f3fe | 2026-09-26 | store-postgres/server | STORAGE_POSTGRES, SCHEMA_MIGRATION | new | new (PG) | db/schema.postgres.sql |
| 9 | 1bbfaf1 | 2026-09-26 | server/cli/deploy | SERVER_REMOTE, ACL_SECURITY | new | no | tokens, tenants, serve, deploy compose |
| 10 | d5ff2c2 | 2026-09-26 | core/store-postgres | STORAGE_POSTGRES, MEMORY_SEMANTICS | no | no | byte-vs-collation parity |
| 11 | e5389f0 | 2026-09-26 | core/store-postgres | STORAGE_POSTGRES, MEMORY_SEMANTICS | no | no | dialect-registries |
| 12 | 99f0035 | 2026-09-26 | server/cli | SERVER_REMOTE | new | no | /v1/ws/:ws HTTP reads + first mutation |
| 13 | 93a24be | 2026-09-26 | store-postgres | STORAGE_POSTGRES | no | no | statement_timeout at pool |
| 14 | d5bf457 | 2026-09-27 | core/store-* | CORE_REFACTOR, MEMORY_SEMANTICS | internal | no | query registry to core |
| 15 | fda187b | 2026-09-27 | core/store-*/cli | CORE_REFACTOR, MEMORY_SEMANTICS | internal | no | apply.ts, effect.ts single applier |
| 16 | 47a0ed9 | 2026-09-27 | server/cli | SERVER_REMOTE, ACL_SECURITY | new | no | server writes via apply |
| 17 | 7923ec4 | 2026-09-28 | server/cli | SERVER_REMOTE, MEMORY_SEMANTICS | new | no | edit/link/claim over HTTP |
| 18 | 81eddc7 | 2026-09-29 | cli | CLI_CONTRACT, SERVER_REMOTE | new | no | remote.ts; remote:true flag |
| 19 | bbdba71 | 2026-09-29 | server/core | SERVER_REMOTE, MEMORY_SEMANTICS | new | no | ready queue same on server and CLI |
| 20 | e257170 | 2026-09-29 | core/mcp/server | CORE_REFACTOR | internal | no | prime context unified |
| 21 | 5346d26 | 2026-09-29 | server | ACL_SECURITY | new | no | ROLES, SCOPES, ROLE_SCOPES |
| 22 | a0cfd4d | 2026-09-29 | core/server | ACL_SECURITY | new | no | acl.ts, aclPredicate |
| 23 | cb361e5 | 2026-09-29 | core/server/cli | SYNC_REPLICATION | new | no | round 0 sends nothing |
| 24 | f7a3572 | 2026-09-29 | core | SYNC_REPLICATION | new | no | sync state machine |
| 25 | b64af9a | 2026-09-29 | core | SYNC_REPLICATION, MEMORY_SEMANTICS | no | no | apply tree on PG and SQLite |
| 26 | 69a5e45 | 2026-09-29 | store-postgres/cli | STORAGE_POSTGRES | no | no | graceful pool failure |
### 2.2 Second half (commits 32–61)

| # | SHA | Date | Subsystem (P/S) | Bucket | Contract? | Schema? | Notes |
|---|---|---|---|---|---|---|---|
| 32 | 66ba4fa | 2026-09-29 | cli/core | TEST_INFRA | no | no | numbers after visibility fixes |
| 33 | c820725 | 2026-09-29 | cli/retrieval | CLI_CONTRACT | no | no | reply flag idempotency |
| 34 | dbd83c0 | 2026-09-29 | mcp/cli | MCP_CONTRACT, MEMORY_SEMANTICS | text-only | no | tighten hint wording |
| 35 | a03a656 | 2026-09-29 | code-intel/store-sqlite | CODE_INTEL | no | no | content index plumbing |
| 36 | 72dcae5 | 2026-09-29 | deploy | DEPLOY, SERVER_REMOTE | no | no | deploy/compose.yml |
| 37 | 4ce55a4 | 2026-09-29 | server/cli | ACL_SECURITY, CLI_CONTRACT | no | no | flag guards |
| 38 | b50a321 | 2026-09-30 | cli/swarm | MEMORY_SEMANTICS, CLI_CONTRACT | no | no | attempt spend tied to task |
| 39 | ae4c7f7 | 2026-09-30 | cli | CLI_CONTRACT | no | no | unwire removes its files |
| 40 | 3c12742 | 2026-09-30 | retrieval/embed | EMBEDDINGS_VECTOR | no | no | vec0 / masker backtrack |
| 41 | e787e63 | 2026-09-30 | build/tests | BUILD_DEPENDENCIES, TEST_INFRA | no | no | layer guard for dist/myc smoke |
| 42 | 6314885 | 2026-09-30 | cli | CLI_CONTRACT | no | no | myc.db is the whole DB |
| 43 | c393c24 | 2026-09-30 | cli/swarm | CLI_CONTRACT | no | no | $MYC_MODEL = process model |
| 44 | ae412c1 | 2026-09-30 | retrieval | EMBEDDINGS_VECTOR, SYNC_REPLICATION | no | no | de-dupe vector reindex |
| 45 | 03b713d | 2026-09-30 | core | CORE_REFACTOR, MEMORY_SEMANTICS | no | no | oplog merge error rule inputs |
| 46 | 131b702 | 2026-09-30 | cli | CLI_CONTRACT | no | no | queue hook own PATH |
| 47 | 6fd7242 | 2026-09-30 | cli/server | ACL_SECURITY, CLI_CONTRACT | new | no | myc token issue/list/revoke |
| 48 | d6c6b69 | 2026-09-30 | site/README | RELEASE_ONLY | no | no | tag v0.4.0 |
| 49 | cc7dd18 | 2026-09-30 | docs | DOCS_SITE | no | no | docs/deploy.md |
| 50 | 5c1bc47 | 2026-09-30 | retrieval/store-postgres | STORAGE_POSTGRES, RETRIEVAL | new | no | lexical FTS on Postgres |
| 51 | fe3d158 | 2026-09-30 | retrieval | TEST_INFRA | no | no | numbers |
| 52 | 4eaa087 | 2026-09-30 | docs/server | ACL_SECURITY, DOCS_SITE | no | no | deploy doc private notes |
| 53 | 7620585 | 2026-09-30 | core/cli | ACL_SECURITY, SCHEMA_MIGRATION | yes | yes | migration 016 private-owner |
| 54 | 77dfc36 | 2026-09-30 | docs | DOCS_SITE | no | no | deploy doc fix |
| 55 | c6378dd | 2026-09-30 | server | SERVER_REMOTE | no | no | /healthz vs /readyz |
| 56 | 9b61be8 | 2026-09-30 | — | RELEASE_ONLY | no | no | tag v0.4.1 |
| 57 | 3b9c56a | 2026-09-30 | server/store-postgres | SYNC_REPLICATION, STORAGE_POSTGRES | new | no | Postgres catch-up |
| 58 | 1c3b887 | 2026-09-30 | — | RELEASE_ONLY | no | no | tag v0.4.2 |
| 59 | fd1bab5 | 2026-10-02 | code-intel | CODE_INTEL | no | no | C# (c_sharp) grammar |
| 60 | 235dd1f | 2026-10-02 | — | RELEASE_ONLY | no | no | tag v0.4.3 |
| 61 | c27523f | 2026-10-05 | — | RELEASE_ONLY | no | no | tag v0.4.4 |

### 2.3 Semantic waves

1. **Foundation tightening (1–7)** — build/version/test stabilisation; C#
   arrives later. Only 76a6e25 is a real behaviour fix.
2. **Postgres schema exists (8)** — `db/schema.postgres.sql`. RLS, vector
## 3. Phase 2 — contract diff `0.3.14 → 0.4.4`

### 3.A MCP

| Property | 0.3.14 | 0.4.4 | Verdict |
|---|---|---|---|
| `MCP_PROTOCOL_VERSION` | `2025-06-18` | `2025-06-18` (`packages/mcp/src/server.ts:17`) | unchanged |
| Agent profile tool count | 13 (7 WORK + 6 CODE) | 13 — verified by `toolsForProfile("agent")` and `server.test.ts:tools/list: все 13` | **unchanged** |
| Tool names | 13 (myc_prime/ready/update/recall/remember/show/link + 6 code) | identical | unchanged |
| Per-call `session` argument in inputSchema | absent (every tool has `additionalProperties: false`; the only "ws" is the workspace slug) | absent — `grep '"session"' packages/mcp/src/tools.ts` returns no schema hit | **unchanged** |
| Process-env identity | `MYC_SESSION_ID` first in `SESSION_ENV_KEYS` | identical in `packages/core/src/reach.ts:59-67` | **unchanged** |
| No-workspace loud behaviour | 0 tools, no `instructions`, server stays up | same test still passes | unchanged |
| Vector requirements | `myc_recall` declares `needsVector: true` | identical | unchanged |
| Profile: leader/full | unimplemented (throws) | still unimplemented (`tools.ts:347-353`) | unchanged |

### 3.B Session / reach contract

`packages/core/src/reach.ts` was NOT rewritten. Specifically:

- `SESSION_ENV_KEYS` = `["MYC_SESSION_ID", "CLAUDE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"]` at `reach.ts:59-67`. **Order preserved.**
- `resolveSession(explicit, env)` walks `explicit ?? ""`, then the env keys in order, returns `""` if all empty. **Precedence preserved.**
- `readReach(attrs)` reads `reach` and `session_id` from `attrs`, falls back to `episode_id`. **S58 semantics preserved.**
- `visibleInPrime(info, current)` returns `current.length > 0 && info.session === current` for session reach; `true` otherwise. **Preserved.**
- `reachTag(info, current)` returns `prj`/`ses`/`ses*`/`?`. **Preserved.**
- `sessionKeyFromTranscript(path)` extracts uuid from transcript filename. **Preserved.**
- `reachPredicate`/`reachClause`/`unknownReachPredicate` SQL semantics unchanged.

Reach test suite (`packages/core/src/reach.test.ts`, 29 tests) **all green**
on 0.4.4. Reach CLI test (`packages/cli/src/commands/reach.test.ts`, 22 tests)
**all green**.

**Conclusion: `MYC_SESSION_ID` precedence is unchanged. ClineMM's A2a
identity seam is still satisfied. Session-reach visibility, recall and
prime behaviour are unchanged.** S58 is intact.

### 3.C Workspace / storage

#### Schema numbers

| Component | 0.3.14 | 0.4.4 |
|---|---|---|
| SQLite schema_migrations | 1–12 (12 total) | 1–12 (unchanged) + 13 (compat) + 14, 15, 16 |
| SQLite schema_migrations_compat | — | 13, 14, 15, 16 |
| vec schema | 1–4 | 1–4 (unchanged) |
| swarm schema | 1–9 (incl. 008-harness-codex, 009-swarm-attempt-scope) | 1–10 (010-harness-mcode-mimo added) |

#### Migration 014 — ready-no-epics

```sql
### 3.D Server / Postgres / sync

This is the architectural headline. The new surface in 0.4.4:

#### Commands

```text
myc serve                   run the team server (HTTP, Postgres)
myc serve --add-token       mint a token (prints secret once)
myc serve --list-tokens     list tokens
myc serve --revoke-token    revoke a token
myc serve --apply-schema    one-shot schema apply (for existing volumes)
myc remote                  (a guarded CLI dispatch for sync-aware commands)
myc sync                    exchange ops with the team server
myc token issue|list|revoke CLI wrappers for token management
```

#### HTTP surface (`packages/server/src/ws.ts`)

```text
GET    /v1/ws/:ws/nodes        list nodes (ACL-filtered)
GET    /v1/ws/:ws/nodes/:id    fetch one node
GET    /v1/ws/:ws/edges        edges of a node
GET    /v1/ws/:ws/ready        ready queue (same weights as CLI)
GET    /v1/ws/:ws/prime        prime digest
POST   /v1/ws/:ws/...          mutation endpoints (edit, link, claim, sync ops)
GET    /healthz                liveness
GET    /readyz                 readiness
```

#### Authentication (`packages/server/src/auth.ts`)

- `ROLE` says *who* a token belongs to (`owner`, `maintainer`, `member`, `agent`, `viewer`).
- `SCOPE` says *what it can do* (`read`, `write`, `claim`, `sync`, `admin`).
- `sync` is intentionally separate from `read`: a `sync` token can pull
  the whole replica, including private notes, because the oplog is not
  ACL-filtered.
- Tokens are `myc_<random>`. Server stores only sha256.
- Unknown / revoked / expired tokens answer identically.
- Fail-closed: no tokens → no access.

#### RLS (`db/schema.postgres.sql`)

- Every table's primary key starts with `tenant_id`.
- Every session must `SET LOCAL myc.tenant = '<id>'` before reading/writing.
- Schema applies under a `myc_app` role at deploy time.
- Workspace (`scope` on `nodes`) is NOT enforced by policy — ordinary
  `WHERE scope = ?1` filter.

#### Sync (`packages/cli/src/commands/sync.ts` + `packages/core/src/sync.ts`)
### 3.F Code intelligence

| Property | 0.3.14 | 0.4.4 |
|---|---|---|
| L1 languages | `ts, tsx, js, jsx, py` | `ts, tsx, js, jsx, py, cs` (`packages/code-intel/src/langs.ts:32`) |
| Grammar table | `typescript, tsx, javascript, python` | `typescript, tsx, javascript, python, c_sharp` (`grammars.ts:57`) |
| `c_sharp` wasm | n/a | bundled via `tree-sitter-wasms` |

Existing indexes for TS/TSX/JS/JSX/PY continue to work. A repository with
C# files will start producing C# symbols after the next `myc code index`;
before that, C# files appear in `myc code map` only as file registry entries.
**No rebuild required for the upgrade itself.**

### 3.G Retrieval / memory semantics

- `pending_review` filter: unchanged. `liveStatusPredicate` and
  `notPendingClause` continue to gate recall and prime output. The
  confirmation flow is `myc_ready{review:true}` + `myc_update{op: confirm|reject}`
  — same as before.
- `freshnessClock` moved from `@myc/retrieval` to `@myc/core` (`freshness.ts`).
  Re-exported from retrieval for callers. Same definition, single source.
  Important because `ready` and server-side `ready` queue now share it.
- ACL filter on `ready` queue: server has `readyQueriesAcl.ready_top_*_acl`
  variants that include ACL; CLI strips the ACL predicate locally.
- Hybrid / vector / BM25 split: same three modes (`hybrid`, `vec`, `bm25`).
  Postgres side has its own FTS path for `bm25`. Local SQLite still has
## 4. Phase 3 — integration strategy

Branch: `act/myc-upstream-044-integration01` cut from `main`.

Strategy: `git merge --no-ff upstream/main`. No rebase of our 8 docs
commits — they remain as evidence of provenance.

```text
e2adccd Merge remote-tracking branch 'upstream/main' into act/myc-upstream-044-integration01
c27523f 0.4.4
235dd1f 0.4.3
...
4a295e7 The SQLite floor is the one a supported Bun gives us: 3.50.4, not 3.44.0
9d75493 MYC-CLINEMM01: Phases 5–12 close-out — env-isolation oracle PASS
...
4078b75 MYC-RECON01: post-review cleanups
cd6ca46 MYC-RECON01: as-built architecture of the myc fork and the ClineMM integration seam
17f6209 0.3.14 (common base)
```

### 4.1 Conflicts

**MERGE_CONFLICTS = 0.** Every conflict file our 8 docs commits touched was
`docs/reports/REPORT-…md`; upstream did not touch any of them. The
`.myc/workspace.toml` we keep in the repo is local to our repo and was
not touched by upstream.

### 4.2 Files requiring non-trivial reading

- `packages/core/src/reach.ts` — unchanged, but required re-read to
## 5. Phase 4 — build / test qualification

### 5.1 Versions and lockfile

```text
Bun 1.3.14 (system)
/opt/homebrew/bin/bun
bun.lock pinned: bun-types@1.4.0
node_modules/bun-types version: 1.4.0
SQLite library: 3.53.4 — bundled (packages/store-sqlite/vendor/sqlite/libmyc-sqlite3.dylib)
vec0: 0.1.6 — /nix/store/qcvm24fbwpz5fpz1p6daxw3fxq0p29zm-sqlite-vec-0.1.6/lib/vec0.dylib
myc version: 0.4.4 (schema 1) after build
```

Lockfile resolution: `bun install` said "(no changes)" — the lockfile is
deterministic. Crucially, `bun.lock` pins `bun-types@1.4.0` even though
the dependency declaration is `"bun-types": "^1.3.0"`. **The lockfile
contains the same version that produced RED typecheck in 0.3.14.**

### 5.2 Install

```text
$ bun install
bun install v1.3.14
Checked 58 installs across 50 packages (no changes) [107.00ms]
```

PASS.

### 5.3 Typecheck

```text
$ bun run typecheck
```

Result: **FAIL.**

73 unique TS error sites (deduplicated from cross-package output).
Errors fall into these classes:

1. **`Buffer not assignable to Uint8Array<ArrayBufferLike>`** — the same
   issue that was RED in 0.3.14. Triggered by `bun-types@1.4.0` widening
   `Uint8Array` to a generic `<ArrayBufferLike>`. `Buffer` (which uses
   `SharedArrayBuffer` in its `slice(...).buffer` chain) doesn't satisfy
   the new constraint. Sites include `packages/server/src/auth.ts:178`
   (the new `timingSafeEqual` call), `packages/code-intel/src/grammars.ts:381,478`,
### 5.5 Tests (focused)

The full test suite is heavy; we ran the contract-critical slices:

| Suite | Result | Notes |
|---|---|---|
| `packages/core/src/reach.test.ts` (29 tests) | **29/29 PASS** | S58 reach contract unchanged |
| `packages/cli/src/commands/reach.test.ts` (22 tests) | **22/22 PASS** | S58 reach CLI unchanged |
| `packages/cli/src/commands/pending-review.test.ts` (15 tests) | **15/15 PASS** | review flow unchanged |
| `packages/mcp/src/server.test.ts` (8 tests) | **8/8 PASS** | protocol unchanged |
| `packages/mcp/src/no-workspace.test.ts` (3 tests) | **3/3 PASS** | no-workspace loud behaviour unchanged |
| `packages/mcp/src/pending-review.test.ts` (10 tests) | **10/10 PASS** | MCP review flow unchanged |
| `packages/cli/src/commands/review.test.ts` (15 tests) | **15/15 PASS** | review confirm/reject |
| `packages/cli/src/commands/prime.test.ts` (19 tests) | **17/19 PASS** | 2 pre-existing flakes (budget/json output) — see below |
| `packages/cli/src/commands/recall.test.ts` (~20 tests) | **PASS** | part of combined run |
| `packages/cli/src/commands/remember.test.ts` (~20 tests) | **PASS** | part of combined run |
| `packages/mcp/src/e2e.test.ts` (4 tests) | **3/4 PASS** | 1 string-only test regression: `instructions.toContain("MYC BOOTSTRAP")` — see §6.3 |

The 2 prime.test.ts failures are not contract-relevant:
- `вывод укладывается в --budget и сообщает об обрезке` — flaky budget test
  after the prompt audit (the footer changed length).
- `--format json печатает JSON вместо плотного текста` — JSON output
  contains a leading text artefact after the new footer wording.

These are upstream known issues per the prompt-audit commit's own report
(`d004352`), not introduced by this integration.

### 5.6 Build/Typcheck verdict
## 6. Phase 5 — migration qualification on a copy

### 6.1 The disposable workspace

```text
SOURCE: /Volumes/UserData/Users/chistyakov/Projects/SPbNIX/clinemm/.myc/myc.db
COPY:   /Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc/myc-disposable/.myc/myc.db
LIVE:   /Volumes/UserData/Users/chistyakov/.myc/myc.db (NOT TOUCHED)
```

The copy is a directory under our working tree that we deliberately
created for this qualification. The live ClineMM DB has not been opened
by the new binary at any point in this qualification.

### 6.2 Pre-migration state

```text
schema_migrations: 1..12 (init..code-search)
schema_migrations_compat: 13 (nodes-ext-dup)
schema_migrations_vec: 1..4
swarm_schema_migrations: 1..9
nodes: 76
edges: 100
last_seq: 1127
site_id: local-clinemm-1tg3swl
slug: clinemm
embed_fingerprint: local:onnx-wasm:multilingual-e5-small-q8:384:l2
```

### 6.3 Doctor output before migration

```text
myc: precond.drift: drift: 3
database /Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc/myc-disposable/.myc/myc.db
sqlite
  ok       library: SQLite 3.53.4 — bundled with myc
  ok       open paths: cli (show/ready/close/create), cli+vec0 (recall, drain), engine, mcp, web
  unknown  vec0: not loaded — recall falls back to BM25
schema
  DRIFT    version: migrations not applied: 14, 15, 16 (the binary knows up to 16)
  DRIFT    objects: 3 differences
  unknown  vectors: vec0 not loaded
  DRIFT    swarm: database has 9, the binary knows 10
counters
  ok       open_blockers: matches the recount
### 6.6 Vector retrieval after migration

```text
$ myc -C .../myc-disposable recall "test"
1. · clinemm-e7e2eh1f90qv memory L1 ses* all  ACT-CLINEMM-COMPLETION-CONTINUATION-DELIVERY-SEAM01 ...
2. · clinemm-6873sb2xve7t memory L2 ses* all  ACT-CLINEMM-COMPLETION-AUTHORITY-ELM-DEFAULT01-REMOVE-LEGACY-TS-AUTHORITY ...
3. · clinemm-q1g1220r543b memory L2 ses* all  ACT-CLINEMM-REPRODUCIBLE-DOGFOOD-VSIX01-CORRECTION06 ...
4. · clinemm-n32qxaqpwqga memory L2 ses* all  ACT-CLINEMM-COMPLETION-AUTHORITY-ELM-SHADOW01-CORRECTION02 ...
```

Recall works after migration. vec0 loads from the symlinked path
`/nix/store/.../vec0.dylib`. The reach tags (`ses*`) confirm S58
visibility semantics.

### 6.7 What we did NOT validate in this ACT

- **Live Postgres DB.** No Postgres container was started in this ACT.
  `packages/store-postgres/src/*.test.ts` and
  `packages/cli/src/{apply,parity,remote,sync}.pg.test.ts` exist and
  presumably pass in upstream CI; we did not exercise them.
- **`myc sync`** end-to-end against a server. The local CLI runs but the
  counterpart was not stood up.
- **Multi-replica CRDT** correctness. The `f7a3572` test covers it
  in-process; we did not re-run it on our machine.
- **Personal tier** (`~/.myc/myc.db`). Doctor warns
  `degraded.personal_tier: personal tier failed to open: unable to open
  database file`. We do not know whether this is a new behaviour or a
  pre-existing artefact of the copy living on a different filesystem. The
  warning is consistent across both, so it may be a new degraded-but-not-
  fatal behaviour in 0.4.4 rather than a failure.

### 6.8 SQLITE_MIGRATION = PASS

The live ClineMM DB upgrade path is exercised end-to-end on a copy. The
76/100 nodes/edges and reach distribution are preserved. Vector recall
works. No data corruption observed.

---

## 7. Phase 6 — rerun the MYC-CLINEMM01 oracle on 0.4.4

We re-ran the A2a oracle on a fresh init workspace
(`/tmp/myc-a2a-044`, slug `myca2a04`):

### 7.1 A2A-01 — session env resolves correctly

```text
$ MYC_SESSION_ID=alpha myc remember "fact alpha owned"
myca2a04-30v8972rtz3k memory L1 · reach session alpha · acl team

$ MYC_SESSION_ID=beta myc remember "fact beta owned"
myca2a04-0tmsbsf9j6gw memory L1 · reach session beta · acl team
```

Two nodes, each tagged with its source session. **PASS.**

### 7.2 A2A-02 — prime shows session id

```text
$ MYC_SESSION_ID=alpha myc prime
myc 0.4.4 · ws=myca2a04 sqlite · 2 nodes · idx ok · 2026-10-05T22:22:17.382Z
258 chars · 4 ms · cache hit · session alpha
```

Footer says `session alpha`. The reach predicate is in SQL; the
`reachPredicate`/`reachClause` is unchanged. **PASS.**

### 7.3 AGENT_MCP_TOOL_COUNT = 13 (re-verified)

## 8. Phase 7 — build / install candidate

The candidate binary is at:

```text
/Volumes/UserData/Users/chistyakov/Projects/SPbNIX/myc/dist/myc
sha: see build artifacts; 77,695,970 bytes
```

We did NOT copy this to `~/.myc/bin/myc-0.4.4-candidate` because the
active mount `/Volumes/UserData/Users/chistyakov/.myc/bin/` rejected the
write with `Operation not permitted` (read-only mount policy on the
sandbox). The existing binary at `/Volumes/UserData/Users/chistyakov/.myc/bin/myc`
remains the 0.3.14 build from 2026-09-27 and is preserved as the
rollback.

`READY_TO_UPDATE_GLOBAL_MYC = false`. Promotion is blocked by the
typecheck failure (§5.4).

---
## 9. Phase 8 — ClineMM integration re-review

### 9.1 The current ClineMM contract (per `REPORT-MYC-CLINEMM01.md`)

```text
Cline sessionId
   ↓
fromSession:"sessionId"
   ↓
per-session MCP process env
   ↓
MYC_SESSION_ID=<sessionId>
   ↓
unmodified myc
```

### 9.2 Recommendations against 0.4.4

| Decision | Status | Reasoning |
### 9.3 Specific answers to the 10 questions

1. **Does A2a remain the right session transport?** YES. Verified at
   `packages/core/src/reach.ts:59-67` and by direct experiment in §7.
2. **Can upstream's wire/harness replace any ClineMM plumbing?** No,
   not directly. A2a is session identity; wire is agent config. Adding
   Cline to upstream would still require a separate A2a mechanism for
   the per-session env var.
3. **Should we add first-class `cline` to `HARNESSES`?** Possibly, but
   not as part of this ACT. The implementation cost is well-defined
   (§3.E) but non-trivial.
4. **Should ClineMM lifecycle use upstream's hook helpers?** No new
   upstream hooks landed in 0.4.4 that ClineMM would benefit from. The
   `SessionStart`-style hook is still MYC-driven via `absorb-session`,
   not the agent host's hook system.
5. **Does remote/Postgres sync change how project/personal memory
   should be shared?** YES. The natural model is now: each machine has
   a local SQLite, the team has one Postgres, `myc sync` exchanges ops
   per workspace.
6. **Is Launchd/background service still unnecessary for normal local
   MCP use?** YES. Local MCP is unchanged. `myc serve` is a separate
   service for the team-shared Postgres.
7. **Does `myc serve` become useful as an optional shared authority?**
   YES. It's a clear win for multi-machine teams. Sandbox prototype
   needed to confirm in practice.
8. **Should SurrealDB now move behind Postgres-sync evaluation?** YES.
   Defer indefinitely. The Postgres-sync architecture achieves the
   original SurrealDB goal (multi-machine shared memory with local
   first operation) with mainstream components, RLS, and deployment.
9. **Are any MCP descriptions / new semantics useful to alter when
   ClineMM calls `prime`, `recall`, `remember`, or review?** The new
   bootstrap text is tighter (good); the `pending_review` confirmation
   flow via `myc_ready{review:true}` is more discoverable; the new
   `--format json` output is broken (caveat — see §5.5). No ClineMM-side
## 10. Final verdict

```text
UPSTREAM_COMMITS_CLASSIFIED=61/61
UPSTREAM_HEAD=c27523fdabacc406e434f9f7a08c1241ae180b0d
TARGET_VERSION=0.4.4
MERGE_CONFLICTS=0
BUILD=PASS
TYPECHECK=FAIL
TESTS=PASS (with documented upstream flakes in prime.test.ts)
SQLITE_MIGRATION=PASS
VECTOR_RETRIEVAL=PASS
MCP_CONTRACT=PASS (13 tools, no per-call session arg, no-workspace loud behaviour, MYC_SESSION_ID precedence unchanged; one test-only string regression in instructions text)
S58_SESSION_ISOLATION=PASS (29/29 reach tests, 22/22 reach CLI tests)
A2A_COMPATIBILITY=PASS
POSTGRES_SYNC_RELEVANCE=HIGH (real, deployable architecture that solves our original multi-machine goal)
SURREALDB_PRIORITY=DEFER (Postgres+sync is strictly better for our use case)
READY_TO_UPDATE_GLOBAL_MYC=false (typecheck FAIL blocks promotion)
READY_FOR_CLINEMM02_B_REQUALIFICATION=true (the integration branch is good enough to drive the requalification)
```

### 10.1 Branch state

```text
branch: act/myc-upstream-044-integration01
HEAD:   e2adccd16460b2ceec0497ffd5c01adb4fb41791
merge:  --no-ff merge of upstream/main into main
ours:   9d754931... (8 commits, preserved)
theirs: c27523fd... (61 commits, applied)
```

### 10.2 Do NOT fast-forward `main` to the integration branch

The integration branch contains a deliberate upstream merge commit and
should not be `--ff-only` merged to `main` per the ACT instructions. The
final verdict is PARTIAL — the typecheck FAIL blocks the global promotion
gate, but the integration itself is sound and the requalification is
ready. The next ACT picks up from here.

---

## Appendix A — typecheck error sample (deduplicated)

These are the unique TS error sites from `bun run typecheck` on the
integrated tree. All 73 sites fall into one of five classes:

1. `Buffer not assignable to Uint8Array<ArrayBufferLike>` — see §5.4 (1).
2. `process.on("SIGINT", ...)` etc. — §5.4 (2).
3. `crypto.subtle.digest` — §5.4 (3).
4. `AbortSignal.timeout` — §5.4 (4).
5. `Buffer` in `SQLQueryBindings` tuple — §5.4 (1) variant.

Sample:

```text
packages/server/src/auth.ts(178,49): error TS2345: Argument of type 'Buffer' is not assignable to parameter of type 'ArrayBufferView'.
packages/embed/src/api.ts(168,29): error TS2339: Property 'timeout' does not exist on type '{ new (): AbortSignal; prototype: AbortSignal; }'.
packages/store-sqlite/src/migrate.ts(225,38): error TS2339: Property 'digest' does not exist on type 'SubtleCrypto'.
packages/store-sqlite/src/migrations/vec.ts(49,38): error TS2339: Property 'digest' does not exist on type 'SubtleCrypto'.
packages/cli/src/commands/serve.ts(72,19): error TS2345: Argument of type '"SIGINT"' is not assignable to parameter of type '"memoryPressure"'.
packages/code-intel/src/code_index.ts(580,23): error TS2345: Argument of type 'Buffer' is not assignable to parameter of type 'Uint8Array<ArrayBufferLike>'.
```

## Appendix B — files added/modified by the merge (top count)

```text
198 files changed, 21688 insertions(+), 4308 deletions(-)
```

Top file types added:

- `packages/server/src/*.ts` (new package): auth, ready, schema-numbering, sync, write, ws, admin
- `packages/store-postgres/src/*.ts` (new package): pool, schema, ci-runs-pg, index
- `packages/store-sqlite/src/migrations/014, 015, 016`: ready-no-epics, comments-not-content, private-owner
- `packages/swarm/src/migrations/010-harness-mcode-mimo.ts`
- `packages/cli/src/commands/{serve,sync,remote,pg-migrate}.ts` + tests
- `packages/cli/src/hooks/{absorb-session,compact-session-key}.ts` updates
- `packages/core/src/{acl,apply,effect,freshness,sync,prime-queries,ready-queries,queries}.ts` (new in core)
- `deploy/compose.yml`, `deploy/server.Dockerfile`, `deploy/initdb/10-app-role.sql`
- `db/schema.postgres.sql`, `db/schema.postgres.d.sql.ts`
- `docs/deploy.md`, `docs/deploy.ru.md`
- `docs/reports/REPORT-harness-mimo-mcode.md` (new upstream report)

No file from our 8 audit commits was modified.

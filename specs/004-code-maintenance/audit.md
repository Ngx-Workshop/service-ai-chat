# Code Maintenance audit

Date: 2026-11-22. Baseline HEAD: `4ca2099`. Local Node 24.9.0 / npm 11.6.0;
Docker/CI target Node 22. No parent AGENTS/index exists; local guidance is
self-contained. Existing dirty AGENTS/index and untracked prompt/spec setup are
preserved. No private environment files were read.

## T001 baseline evidence

- `npm test -- --runInBand`: PASS, 8 suites / 31 tests, including real localhost
  HTTP/WebSocket transport with auth/persistence doubles.
- `GENERATE_OPENAPI=true npm run build`: PASS; generated OpenAPI unchanged.
- `eslint '{src,apps,libs,test}/**/*.ts' --no-fix`: FAIL, 13 errors / 1 warning.
  Existing failures: app module async factory (1); CRUD generation stubs (4);
  CRUD error narrowing (2); legacy schema update typing (4); bootstrap cookie
  parser typing (1) and floating promise warning; Swagger error typing (1).
- `prettier --check 'src/**/*.ts' 'test/**/*.ts'`: PASS.
- Tooling formatting check: package/workflow/Prettier config PASS; ESLint config
  has pre-existing formatting drift. Format that configuration only when touched.
- Docker executable exists; daemon/toolchain and install checks still to verify.

## T002 source map and findings

`AppModule` imports explicit chat, legacy CRUD, observability and Mongo modules,
plus intentionally global configuration. No forwardRefs or service locators.
`ChatModule` has private providers and no exports. Both domain modules import the
auth client for their respective guards; this is not duplicate local registration.
Observability owns Terminus liveness and bootstrap HTTP logging.

Chat HTTP controller currently injects repository/tickets and owns title
normalization. Socket transport injects repository/chat/tickets: it validates
frames/UUID DTOs, serializes commands and manages auth, subscriptions, heartbeat,
limits and snapshots. ChatService owns idempotency, history bounds, active runs,
UI action validation and generation; repository owns owner queries and optimistic
revision persistence. Responder owns OpenAI SSE/history/tool rounds, tools own
validated A2UI construction, catalog owns bounded public API reads. Dependencies
are acyclic: transport -> chat -> repository/responder -> tools -> catalog.

Priorities and selected scope:

1. **P1, tooling:** package lacks staged formatting and safe hook lifecycle.
   Docker copies only package manifests before installation. Add pinned local
   hooks, self-contained guarded prepare, consistent generated/output ignores.
2. **P1, logging:** HTTP middleware IDs do not reach domain work; socket IDs have
   no logger context. Chat run persistence catch uses a non-structured message;
   terminal failure and tool fallback lack domain events. Introduce a small
   AsyncLocalStorage helper in existing observability, UUID-only correlation,
   one terminal run outcome, command failures and bounded tool fallback warnings.
   Never expose raw error, user/owner ID, text, ticket, URL or surface.
3. **P2, boundaries:** move title normalization into ChatService and route
   controller/socket reads through that existing use-case provider. Keep
   persistence private to use cases, without adding speculative facade/modules.
4. **P2, baseline:** full lint legacy errors remain separate. CI checks maintained
   chat/observability/test paths; expose a full diagnostic command too. Formatting
   gate covers existing source/test baseline and owned tooling, not all old docs.

Controllers otherwise remain thin: legacy query-string interpretation is
transport logic, not a reason to move it. Services are bounded and cohesive; file
size alone does not justify extraction. Keep module exports empty. Configuration,
auth and schema changes are out of scope.

## Compatibility / constitution

Existing tests cover owner denial, invalid DTOs/IDs, not-found, revision conflict,
idempotency, partial cancellation, provider failure, tool/schema limits and saved
A2UI actions. Add title/list/get/storage-error characterization before moving the
controller delegation. Preserve HTTP metadata/status, socket wire errors, access,
Mongo schema, revision/restart semantics, Promise/RxJS usage and provider limits.
No public contract change: no contract publication/migration required.
All six constitution principles are satisfied by this bounded plan; no deviation.

Local fixtures do not verify Mongo/auth/catalog production or Grafana receipt.
Infrastructure owner nginx-ngx-workshop.io owns Alloy/Grafana credentials and
live checks. No other repository checkout is required.

## Implementation and final evidence

- T003 characterization before refactor: four selected suites / 15 tests PASS,
  including added title normalization/list/get/500 storage response assertions.
- Transport persistence dependencies now delegate through ChatService; no module
  export/import changes were justified. Existing metadata/guards and schemas
  remain unchanged. Final generated OpenAPI has no diff.
- Added UUID-only AsyncLocalStorage propagation, terminal run JSON events,
  safe command failure records and allowlisted tool fallback warnings. Native
  stdout/stderr success/failure JSON and concurrent originating run IDs are tested.
- Pinned Husky 9.1.7/lint-staged 16.2.7; npm-generated lockfile includes their
  dependencies/deduplication and canonicalizes existing ws metadata. Prettier
  remains the installed 3.6.2 satisfying existing ^3.4.2 declaration.
- `npm run test:maintenance -- --installs`: PASS staged-only formatting,
  preserved partial and unrelated unstaged edits, syntax failure blocking a
  disposable commit, unchanged bytes on negative CI formatting check; clean
  developer, CI-flag, no-Git/package-only and production/omit-dev npm ci PASS.
  Fixture-only Git commits never affect this worktree; fixtures are removed.
- Final `npm test -- --runInBand`: PASS, 8 suites / 37 tests, none skipped.
- `npm run lint:check`: PASS maintained chat/observability/test scope.
- `npm run format:check`: PASS source/test plus owned tooling; non-mutating.
- `tsc --noEmit -p tsconfig.json`: PASS.
- `GENERATE_OPENAPI=true npm run build`: PASS; OpenAPI unchanged, so no owned
  contract regeneration/publication necessary.
- `python3 -B -m unittest discover -s scripts -p 'test_*.py'`: PASS, 3 tests.
- `npm run lint:check:all`: same baseline FAIL, 13 errors / 1 warning, no new
  findings. The legacy debt is deliberately not fixed or silently suppressed.
- Required compatibility diff review: no DTO, Mongo schema, route/guard, responder
  protocol, persistence/revision or access-policy change. Touched-file formatting
  only; unrelated initial AGENTS/index/prompt setup is retained.

Docker executable cannot connect to `/var/run/docker.sock`; actual image build
and Node 22/Actions execution are UNVERIFIED. Local package-only npm ci tests the
Docker installation ordering, not an Alpine build. Production/no-dev installation
passes but runtime startup is not claimed: inherited auth-client is still a
devDependency, and the current Docker image intentionally retains devDependencies.
No live Mongo/auth/catalog/Grafana check, commit, push, publish or deployment
was performed. All constitution checks remain satisfied without deviation.

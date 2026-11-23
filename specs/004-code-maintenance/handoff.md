# Handoff: Code Maintenance

Status: Implemented; integration pending · Updated: 2026-11-22
[Spec](spec.md) · [Plan](plan.md) · [Tasks](tasks.md) · [Audit](audit.md)

## Delivered

- Chat HTTP/socket persistence now delegates through existing ChatService.
  Title normalization moved from controller to that service; private module
  providers and acyclic dependency flow remain unchanged.
- Native structured terminal run outcomes, command failures and tool-fallback
  warnings with UUID-only local request/run correlation. Background runs retain
  originating command context, not cancellation/socket lifetime.
- Husky 9.1.7/lint-staged 16.2.7 staged formatting, guarded package-only prepare,
  npm-generated lockfile and generated/output ignores. Non-mutating format and
  maintained lint gates in PR checks and existing publication validation.
- Regression fixtures for real commits in disposable repositories only; the
  working repository has not been committed, pushed, published or deployed.

Routes, DTO/error shapes, owner checks, tickets, schema, run revisions, streaming,
cancellation, startup recovery and A2UI behavior are preserved. Generated OpenAPI
is unchanged. No consumer contract update, migration or coordinated release is
required; no external source was accessed. Initial unrelated setup is preserved.

## Verification

| Command / check                                                       | Actual result                                                                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --runInBand`                                             | PASS, 8 suites / 37 tests; none skipped                                                                                                  |
| `npm run lint:check`                                                  | PASS, chat/observability/test scope                                                                                                      |
| `npm run format:check`                                                | PASS, source/test and owned tooling                                                                                                      |
| `tsc --noEmit -p tsconfig.json`                                       | PASS                                                                                                                                     |
| `GENERATE_OPENAPI=true npm run build`                                 | PASS; generated OpenAPI unchanged                                                                                                        |
| Python runtime unittest discovery                                     | PASS, 3 tests                                                                                                                            |
| `npm run test:maintenance -- --installs`                              | PASS: real staged formatting, partial/unrelated unstaged preservation, hook failure blocks commit, negative check leaves bytes unchanged |
| Clean developer / CI-flag / no-Git package-only / production `npm ci` | PASS in disposable local fixtures                                                                                                        |
| `npm run lint:check:all`                                              | BASELINE FAIL: unchanged 13 errors / 1 warning in legacy CRUD/bootstrap/Swagger                                                          |
| Actual Docker / Node 22 Actions                                       | UNVERIFIED: Docker daemon unavailable; local toolchain is Node 24.9.0 / npm 11.6.0                                                       |
| Live Mongo/auth/catalog/Grafana                                       | NOT RUN; tests use explicit doubles and local sockets                                                                                    |

Native stdout/stderr domain success/failure JSON field placement, canary redaction,
concurrent HTTP/run isolation, invalid-ID filtering, storage failure and
tool-fallback warning are verified. Existing health and HTTP privacy tests pass.
No Grafana token, SDK, collector change or distributed tracing claim was added.

## Remaining risks / ownership

- X001: repository maintainer runs Node 22 PR checks and `docker build` once a
  daemon is available. Package-only install evidence covers lifecycle ordering,
  not the actual Alpine image or remote CI result. Production/no-dev installation
  is verified, not runtime startup: inherited auth-client remains a devDependency
  and the existing Docker image intentionally installs development packages.
- X002: nginx-ngx-workshop.io infrastructure owner verifies domain-event receipt
  in Grafana after separately authorized deployment. Use actual stream labels and
  parsed `message.event`/`message.requestId`/`message.runId` fields; retain host-owned
  ingestion credentials and do not turn IDs into Loki labels. Check failed and
  completed runs, a safe tool fallback and absence of heartbeat access noise.
- Full lint debt remains explicit; maintained lint gates do not certify legacy
  routes/bootstrap. Existing framework exception logging is not redesigned.
- Existing single-instance run/ticket ownership and live A2UI acceptance limits
  in prior feature records remain unchanged.

## Exact next action

Review the local changes and run X001. Do not publish/deploy solely to verify this
task. If deployment is separately authorized, hand X002 to the infrastructure
owner; no frontend/auth/gateway contract change is requested.

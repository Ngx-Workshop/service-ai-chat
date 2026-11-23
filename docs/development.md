# Development and verification

Node 22 is the Docker/CI baseline. Install with npm ci. Runtime requires MONGODB_URI
and AUTH_BASE_URL; PORT defaults to 3012. Existing .env values are not modified.
Optional CHAT_ALLOWED_ORIGINS is a comma-separated list of exact browser origins.

| Purpose                                     | Command                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Run                                         | npm run start:dev                                                                                                                   |
| Build/OpenAPI without infrastructure        | GENERATE_OPENAPI=true npm run build                                                                                                 |
| Generate DTOs                               | npm run contracts:service-ai-chat:gen                                                                                               |
| Compile DTO package                         | npm run contracts:service-ai-chat:build                                                                                             |
| Unit tests without sockets                  | npm test -- --runInBand src/chat/chat.service.spec.ts src/chat/chat-socket.service.spec.ts src/chat/conversation.repository.spec.ts |
| HTTP and real WebSocket integration doubles | npm test -- --runInBand src/chat/chat.integration.spec.ts                                                                           |
| All tests                                   | npm test -- --runInBand                                                                                                             |
| Focused lint                                | ./node_modules/.bin/eslint src/chat --no-fix                                                                                        |

Integration tests use an explicit test-only auth guard and in-memory repository;
they do not verify actual auth or MongoDB. They require localhost listening ports.
The e2e command now runs that same transport suite instead of the stale GET / seed
test. Observability tests also open local ports. Do not report sandbox-blocked
runs as passing. See specs/002-chat-foundation/handoff.md for actual evidence.

ChatResponder streams the OpenAI Responses API. Set OPENAI_API_KEY in private
runtime configuration, CHAT_MODEL (default gpt-6.1-sol), and optionally
CHAT_MAX_OUTPUT_TOKENS (default 4096; range 256–8192). The request has store:false,
a 120 second deadline, and at most 20 messages / 32,000 text characters of context.
Failed/canceled assistant replies are excluded from model context. Completed UI
content and saved feedback contribute bounded model context. A maximum of three
bounded tool calls runs in one tool round, followed by a text-only completion.
Completed provider output, including encrypted reasoning, is replayed in order
within that request only; it is never exposed to clients or persisted in chat.

Contracts are generated from decorators, never edited directly. Actions publishes
0.0.<run number>. The A2UI consumer pins published compatible contracts 0.0.7;
subsequent provider-only fixes retain that wire schema. See the feature handoff
for actual CI and deployment evidence.

ws 8.18.0 and @types/ws 8.18.2 remain pinned. Registry installation succeeded
during maintenance verification; clean install modes passed on local Node 24.9.0 /
npm 11.6.0. Actual Node 22 Docker/Actions verification remains separate.

See docs/architecture.md for route/protocol limits and single-instance constraints.
See docs/observability.md for logs/health. Source/bundle changes are local until
committed and deployed; live Mongo/auth/Nginx acceptance remains separate.

## OpenAI deployment

The Actions workflow passes an optional OPENAI_API_KEY repository/organization secret
and CHAT_MODEL / CHAT_MAX_OUTPUT_TOKENS repository variables. Before replacing the
container, scripts/prepare-ai-runtime.py requires a key, using the explicit secret
or a private existing chat config, then the existing AI Publisher / MCP Gateway
server runtime file. Donor files are never modified or logged. Chat credentials stay
out of source, build arguments and frontend bundles. Root-owned private regular
files are required. All automated tests run before publication/deployment in CI.

The model selects bounded learning tools (plan, practice quiz, workshop search,
workshop outline and published lab preview). LearningToolsService validates typed
arguments; LearningSurface compiles approved A2UI v1.0 components. The browser
executes no model-authored HTML, scripts or arbitrary renderer functions. Full MCP
OAuth integration remains separate; catalog reads use the existing domain APIs.
DOCUMENT_BASE_URL and CODING_LABS_BASE_URL are trusted runtime settings copied,
when available, from the same private existing service configurations. Missing
catalog configuration produces honest tool failure and useful text fallback.

## Maintenance checks and staged formatting

`npm ci` enables Husky for a developer Git checkout. Pre-commit runs local
lint-staged/Prettier on supported staged TS/JS/JSON/Markdown/YAML files only.
lint-staged hides/restores unstaged hunks and stages formatting; do not add
`git add` or `--no-stash` to the hook. Syntax/formatting failures block the commit.
Generated contracts/OpenAPI, lockfile, node_modules, dist, coverage, vendor and
generated Husky internals are ignored. Existing Prettier style is unchanged.

Prepare is self-contained in package.json so Docker's package-only installation
works before source is copied. It skips CI, HUSKY=0, production/no-dev and no-Git
installs; unexpected installer errors fail explicitly. No network fallback runs
on commit. Husky/lint-staged are devDependencies and require Node 22-compatible
tooling (lint-staged requires Node >=20.17).

| Check                        | Command / scope                                                         |
| ---------------------------- | ----------------------------------------------------------------------- |
| Non-mutating formatting      | `npm run format:check`: source/tests and owned JS/JSON/workflow tooling |
| Non-mutating maintained lint | `npm run lint:check`: chat, observability and tests                     |
| Full diagnostic lint         | `npm run lint:check:all`: all application/test TS                       |
| Hook regression fixtures     | `npm run test:maintenance`                                              |
| Clean install fixtures too   | `npm run test:maintenance -- --installs`                                |

Formatting all historical docs/configs is deliberately not a CI requirement.
Staged Markdown/YAML is formatted when committed. Full lint retains 13 errors and
one warning in legacy CRUD, bootstrap/app module and Swagger; it is not a clean
gate. No rules were disabled to hide those failures. PR checks and existing
publication validation run the maintained gates; PR checks also verify hooks.
The full diagnostic command exposes debt outside the maintained scope.

2026-11-22: all 37 Jest tests, three Python tests, TS type-check, infrastructure-free
build/OpenAPI, maintained lint and formatting passed. Disposable Git fixtures
verified partial staging, unrelated unstaged preservation, failed-hook blocking
and a non-mutating negative formatting gate. Clean developer, CI-flag,
Docker-style no-Git/package-only and production/no-dev npm ci passed locally.
These fixtures are removed automatically and do not commit to this repository.
Docker daemon was unavailable, so no actual container build or Node 22 CI execution
is claimed. See the maintenance audit/handoff for exact remaining checks.

# Development and verification

Node 22 is the Docker/CI baseline. Install with npm ci. Runtime requires MONGODB_URI
and AUTH_BASE_URL; PORT defaults to 3012. Existing .env values are not modified.
Optional CHAT_ALLOWED_ORIGINS is a comma-separated list of exact browser origins.

| Purpose | Command |
| --- | --- |
| Run | npm run start:dev |
| Build/OpenAPI without infrastructure | GENERATE_OPENAPI=true npm run build |
| Generate DTOs | npm run contracts:service-ai-chat:gen |
| Compile DTO package | npm run contracts:service-ai-chat:build |
| Unit tests without sockets | npm test -- --runInBand src/chat/chat.service.spec.ts src/chat/chat-socket.service.spec.ts src/chat/conversation.repository.spec.ts |
| HTTP and real WebSocket integration doubles | npm test -- --runInBand src/chat/chat.integration.spec.ts |
| All tests | npm test -- --runInBand |
| Focused lint | ./node_modules/.bin/eslint src/chat --no-fix |

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

ws 8.18.0 and @types/ws 8.18.2 match dependencies already installed in the workspace.
Registry DNS was unavailable; lock entries use their existing registry integrity
metadata. Verify a clean npm ci with CI's Node/npm before release.

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

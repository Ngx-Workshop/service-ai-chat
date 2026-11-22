# Chat foundation handoff

Status: Implemented; integration pending
Spec: [spec.md](spec.md)
Plan: [plan.md](plan.md)
Tasks: [tasks.md](tasks.md)

## Delivered behavior

Angular seed CRUD was replaced with a chat journey at /chat and /chat/hello-world.
It has conversation navigation, a responsive feed/composer, connection and retry
states, scoped drafts, safe retry identity, revision filtering and resubscription.
Text/tool/A2UI parts have extensible contracts; A2UI currently renders a placeholder.

NestJS provides owner-scoped conversation list/create/load, one-use socket tickets,
validated serialized socket commands, idempotent persisted sends, independent run
lifecycle, partial-response cancellation, heartbeat/backpressure and restart cleanup.
The provider deliberately fails with an explicit configuration message; no fake AI
responses or external model calls were introduced. Legacy hello-world and inherited
CRUD endpoints remain compatible. New chat routes require authentication.

## Acceptance and verification evidence

| Check | Result | Evidence and limitation |
| --- | --- | --- |
| Backend focused unit tests | PASS | 3 suites / 7 tests: chat.service, chat-socket.service, conversation.repository; in-memory/model/socket doubles |
| Backend type check | PASS | npx tsc --noEmit -p tsconfig.json, including integration test source |
| Backend focused lint | PASS | eslint src/chat --no-fix |
| Backend build/OpenAPI | PASS | GENERATE_OPENAPI=true npm run build |
| Contracts generation/build | PASS | contracts:service-ai-chat:gen and contracts:service-ai-chat:build |
| Frontend architecture | PASS | npm run check:architecture |
| Frontend source types | PASS | tsc --noEmit --noUnusedLocals --noUnusedParameters -p tsconfig.app.json |
| Frontend spec types | PASS | tsc --noEmit -p tsconfig.spec.json; this does not execute tests |
| Frontend isolated production build | PASS | npm run build -- --output-path dist/chat-verification; license extraction retained |
| HTTP/real socket integration | BLOCKED | localhost listen EPERM; test hook timed out; auth and persistence are explicit test doubles |
| Complete backend suite | BLOCKED | pre-existing observability socket tests also fail listen EPERM |
| ChromeHeadless | BLOCKED | ng test --watch=false --browsers=ChromeHeadless aborted during startup with exit 134, including with NG_BUILD_MAX_WORKERS=1 |
| Live auth/Mongo/Nginx/host | NOT RUN | Service/consumer changes have not been deployed |

Local Node is 24.9.0/npm 11.6.0; Docker/CI target Node 22. Registry DNS is unavailable,
so a clean npm ci under CI's toolchain is pending. ws and @types/ws were copied from
already-installed workspace dependencies solely for local verification; manifest
and lock use their original registry URLs/integrities. Frontend lock changes are
limited to retiring the seed DTO package and installing generated preview contracts.
No secrets or local .env files were read/modified. No source is committed, pushed,
published or deployed by this feature implementation.

## Contract and consumer handoff

Generated @tmdjr/service-ai-chat-contracts 0.0.4-foundation.0 is packaged under the
consumer's vendor/ and installed as a file dependency. This preview is not registry
published. It contains ConversationDto, ChatMessageDto, ChatPartDto, ChatCommandDto,
ChatEventDto, SocketTicketDto, SocketAuthenticateDto and CreateConversationDto.
The consumer checkout builds independently, without reading producer source.

Deploy producer before the consumer uses its new endpoints. Existing Nginx
/api/ai-chat routing already forwards Upgrade and strips /api; no Nginx edit was
needed. CI retains deterministic 0.0.<GitHub run number> publishing. Once published,
replace the consumer preview with the actual published release and remove vendor
preview. No guessed registry version should be installed.

## Remaining work and exact next steps

X001: Publish/deploy the service changes, update consumer to the actual registry
release, and verify real session ownership, Mongo persistence and Nginx upgrades.
X002: Execute browser and HTTP/socket tests outside the restricted sandbox.
Choose/configure a real ChatResponder provider in a subsequent feature; then verify
stream/cancel/reconnect against it. A2UI integration remains a later feature.

One service instance only: distributed run ownership/tickets/pubsub are required
before scaling. Runs survive browser disconnects, not process restarts; interrupted
runs are marked failed at startup. Auth is rechecked at socket renewal (15 minutes).
Full reload preserves server history but not unsent drafts. See architecture.md for
all bounds and failure semantics.

## Context maintenance

README, AGENTS.md, docs/architecture.md, docs/development.md and feature index updated.
Frontend testing/README.md now describes chat tests. Feature records retain design,
tasks and actual verification. Durable constitution/workflow rules are unchanged.

## OpenAI deployment preparation

OpenAI Responses streaming implemented, with 20-message / 32,000-character context,
4096 default output tokens, 120 second timeout, store:false, abort propagation and
sanitized errors. No tool integration is claimed. Twelve focused backend tests,
three private runtime bootstrap tests, TypeScript, focused lint, build/OpenAPI,
workflow YAML parsing and deployment shell syntax checks pass locally. Full network
and browser suites are now mandatory CI gates. The deployment bootstrap can copy
only the OpenAI key from approved private server runtime files; donor files remain
unchanged. Failed startup restores the previous image and environment when available.
User explicitly authorized committing and production deployment. Execution evidence
will be reported from Actions; no successful deployment is implied by this entry.

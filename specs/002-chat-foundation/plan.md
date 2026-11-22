# Implementation plan: Chat foundation
Status: Implemented; integration pending
Spec: [spec.md](spec.md)

## Source baseline
Adopted Angular/NestJS seeds; /hello-world exists, Nginx forwards upgrade headers.
Consumer installed contracts 0.0.3 contain only seed DTOs. Both working trees clean.

## Design and mapping
FR-001: HTTP guard + ownership-scoped Mongo queries; one-use tickets authenticate
sockets with an initial frame, avoiding access credentials in URLs.
FR-002/003: UUID conversation/message/run IDs, optimistic Mongo revision checks,
one active run per conversation, idempotent clientMessageId, persisted snapshots.
FR-004: Runs owned by NestJS, cancellation via AbortController; revisioned full
snapshots recover state rather than claiming event replay. Startup fails abandoned
runs. UI filters stale snapshots per conversation.
FR-005: RxJS connection lifecycle and cleanup; HTTP API → singleton store → scoped
VM → OnPush page/presentation. Forms/drafts remain scoped. Native ws server attached
to Nest HTTP server; this is a transport class, not an HTTP controller concern.
FR-006: DTOs define message parts and socket envelopes in OpenAPI, generated into
contracts. No A2UI dependency yet.

## Constitution check
Own chat data only; no other service collections. Preserve federation compatibility
and hello-world. Generated DTOs remain contract source; guarded new routes.
Stateless HTTP API clients, root stores, scoped VM and inline BEM components.
WebSocket lifecycle state belongs under state rather than stateless HTTP api.

## Delivery and risks
Generate producer contracts, locally package/install the exact generated contract
for consumer verification; do not pretend it is published. The vendored preview keeps consumer CI buildable; switch to the actual npm release
after publication. Existing production is not modified.
One instance only: distributed locks, tickets and pub/sub required before scaling.
No model selected: default provider explicitly fails; streaming tested with a fake.

## Verification
Backend Jest unit + HTTP/socket tests with auth/repository doubles; OpenAPI and
contract generation/build. Frontend architecture, TS, ChromeHeadless tests and
isolated production build. Document absent live Mongo/auth/browser integration.

## Authorized deployment design
Use built-in Node fetch for OpenAI SSE, avoiding another runtime dependency.
Default model gpt-6.1-sol matches the existing Publisher model catalog; optional
CHAT_MODEL and CHAT_MAX_OUTPUT_TOKENS are validated. Context is capped at 20
messages / 32,000 characters; output defaults to 4096 tokens. Stream completion
must be explicit. No MCP tools are claimed or invoked.
OpenAI key comes from a deployment secret or root-private chat/publisher/gateway
runtime file; bootstrap only copies the key and never modifies donor settings.
Tests cover split Unicode/SSE frames, incomplete streams, 429 errors and abort.
MFE deploy now runs on main pushes and runs browser tests before promoting assets.

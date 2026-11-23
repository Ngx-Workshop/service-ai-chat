# AI chat architecture

The service owns authenticated conversations, messages and response runs. The
Angular chat remote owns presentation; auth owns identity; Nginx owns /api routing.

## Source and responsibilities

- src/chat/chat.controller.ts: guarded HTTP metadata and delegation to ChatService
  for conversation use cases, and SocketTicketsService for tickets.
- src/chat/conversation.repository.ts: Mongo persistence, owner-scoped queries,
  optimistic revision checks; collection ai_chat_conversations.
- src/chat/chat.service.ts: conversation list/create/get and title normalization,
  idempotent sends, one active run, partial responses,
  cancellation and restart recovery. Run lifetime is independent of sockets.
- src/chat/chat-responder.ts: replaceable provider. Uses OpenAI Responses API with streaming, bounded history and output tokens,
  cancellation and sanitized failure handling. Missing credentials fail explicitly.
- src/chat/chat-socket.service.ts: ws attached to Nest HTTP server, initial-frame
  ticket auth, command validation/serialization, owner-scoped subscriptions,
  backpressure, payload limit, heartbeat and session renewal.
- src/chat/dto/chat.dto.ts: OpenAPI source for HTTP and WebSocket DTOs.

ChatModule keeps all providers private with no exports. Dependency flow is
controller/socket -> ChatService -> repository/responder -> learning tools ->
public catalog adapter; transport no longer directly accesses persistence.
SocketTicketsService remains a separate transport-auth capability. The existing
global ConfigModule is intentional; no new global module or circular dependency
was added. Observability helpers carry UUID-only local request/run context without
changing DTOs, schemas, snapshots or upstream protocols.

## HTTP and socket contracts

Browser paths start /api/ai-chat; Nginx strips /api and preserves /ai-chat.

| Method | Native path                | Access/result                                             |
| ------ | -------------------------- | --------------------------------------------------------- |
| GET    | /ai-chat/hello-world       | Public inherited diagnostic                               |
| GET    | /ai-chat/auth-test         | Existing RemoteAuthGuard diagnostic                       |
| GET    | /ai-chat/conversations     | Authenticated newest 100 summaries; messages omitted      |
| POST   | /ai-chat/conversations     | Authenticated create; optional title up to 100 characters |
| GET    | /ai-chat/conversations/:id | Owner only; UUID; other owners receive 404                |
| POST   | /ai-chat/socket-ticket     | Authenticated, one-use 30 second ticket                   |
| WSS    | /ai-chat/socket            | Allowed origin and authenticate frame required            |

Sockets exchange JSON directly, without a Socket.IO or Nest event/data envelope.
First frame: {type:"authenticate",ticket}. Success: {type:"ready",userId}.
Commands: subscribe, send_message, cancel_run, ui_action; each includes requestId and
conversationId. UI actions require messageId, surfaceId, uiRevision, actionId,
clientMessageId and bounded values; the server resolves saved actions, checks
ownership and revision, and persists quiz/checklist feedback. Send also requires clientMessageId and text; cancel requires runId.
Replies: snapshot with canonical conversation/revision and optional requestId, or
error with code/message/requestId. Unsolicited snapshots carry streaming updates.
All shapes are exported from @tmdjr/service-ai-chat-contracts. ApiExtraModels
includes socket DTOs even though they are not HTTP request/response routes.

The frontend ignores older revisions and resubscribes after reconnect. This is
snapshot recovery, not durable event replay. A client message ID prevents retries
from creating another run. A Mongo revision mismatch rejects concurrent writes.

## Operational bounds

One instance initially. Tickets and run abort controllers are in memory. Before
horizontal scaling, introduce distributed run ownership, tickets and event delivery;
do not deploy multiple instances against this startup recovery implementation.
Startup marks abandoned streaming messages failed and clears their active run.
Graceful shutdown aborts runs; providers must honor AbortSignal while waiting.

Max input: 8,000 characters. Max response: 100,000. Max 200 messages per conversation;
new sends are rejected after 500,000 stored text and serialized UI characters. Newest 100 conversations
are listed. Socket frame max 32 KiB; queued commands max 16; slow clients close and
recover snapshots. Ping/pong runs every 25 seconds, auth frame timeout 5 seconds,
socket session renews after 15 minutes. Revocation is rechecked on ticket renewal,
not per streamed chunk. No access tokens or tickets appear in socket URLs.

MONGODB_URI and AUTH_BASE_URL retain existing configuration. PORT defaults to 3012.
CHAT_ALLOWED_ORIGINS is optional CSV; defaults to beta/admin production origins and
http://localhost:4201. No wildcard origins. Existing Nginx Upgrade headers suffice;
25 second pings stay within its default read timeout.

The inherited example CRUD routes and collection remain for API compatibility.
They are still unguarded; the new chat routes do not use them. Their retirement
is separate work. OpenAPI generation skips chat database/socket startup only when
GENERATE_OPENAPI=true; never enable that flag at runtime.

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

Generated deployment orchestration is centrally managed by the Node CLI; see [deployment-workflows](deployment-workflows.md).

# service-ai-chat

NestJS chat foundation for NGX Workshop: authenticated conversations, MongoDB
message persistence, WebSocket streaming and cancellation, idempotent retries,
and snapshot recovery. OpenAI Responses API streams text through the chat service with cancellation, bounded
conversation context, a 120 second deadline and store:false.

Use Node 22 and npm ci, configure MONGODB_URI/AUTH_BASE_URL/PORT, then npm run
start:dev. Native HTTP and WebSocket paths start /ai-chat; Nginx exposes them
under /api/ai-chat. The existing hello-world endpoint remains available.

- [Architecture and protocol](docs/architecture.md)
- [Development and verification](docs/development.md)
- [Chat foundation handoff](specs/002-chat-foundation/handoff.md)
- [Observability](docs/observability.md)

One service instance is supported. OpenAI model integration is available; A2UI remains a later feature. Generated
contracts and a matching consumer preview are local; publication/deployment are
separate release steps. Inherited example CRUD remains unguarded for compatibility.

## OpenAI deployment

The Actions workflow passes an optional OPENAI_API_KEY repository/organization secret
and CHAT_MODEL / CHAT_MAX_OUTPUT_TOKENS repository variables. Before replacing the
container, scripts/prepare-ai-runtime.py requires a key, using the explicit secret
or a private existing chat config, then the existing AI Publisher / MCP Gateway
server runtime file. Donor files are never modified or logged. Chat credentials stay
out of source, build arguments and frontend bundles. Root-owned private regular
files are required. All automated tests run before publication/deployment in CI.

Publisher and gateway credentials do not grant chat tool access. This release
streams model text only; MCP calls and A2UI execution remain separate features.

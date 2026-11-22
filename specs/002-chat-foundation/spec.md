# Feature: Chat foundation
Status: Implemented; integration pending
Request: Build foundational chat behavior before A2UI integration.

## Problem and scope
Replace the adopted seed journey with authenticated, persistent chat. Establish
WebSocket transport and typed rendering independently of an AI model provider.
AI model integration, MCP tool execution, A2UI execution and production deployment
are later work. Preserve hello-world URL and public federation exports.

## Functional requirements and acceptance
- FR-001 / AC-001: Authenticated users create/list/load only their conversations;
  anonymous requests and cross-user reads/writes are denied.
- FR-002 / AC-002: An acknowledged send persists a user message and assistant run.
  Repeat client message IDs do not create another run. Empty/oversized input fails.
- FR-003 / AC-003: Render sending/accepted/streaming/completed/failed/canceled
  states; retain a draft on failed or uncertain delivery and offer safe retry.
- FR-004 / AC-004: Cancel a run without removing its partial response. Browser
  disconnect does not cancel generation. Reconnect loads canonical snapshots,
  ignores older revisions, and avoids duplicate or missing text.
- FR-005 / AC-005: Connection status, bounded automatic retry, manual reconnect,
  useful error/empty/loading states, keyboard submission and responsive layout.
- FR-006 / AC-006: Typed text/tool/A2UI message parts establish future extension;
  unsupported parts have an honest fallback and never execute generated code.

## Boundaries and assumptions
HTTP uses /api/ai-chat; Nginx strips /api for native /ai-chat routes.
Existing RemoteAuthGuard establishes user sub. One service instance initially;
in-process run ownership/tickets are not horizontally distributed. A 15 minute
socket session renews through an authenticated one-use HTTP ticket. Default
provider returns a clear configuration error, never fabricated model output.
Conversation history is limited to 200 messages and each message to 100,000
characters; newest 100 conversations are listed. No data migration needed.

## Success criteria
Unit/integration doubles, HTTP/real socket tests, contracts generation, frontend
architecture/type/tests/build pass. Live auth/Mongo/host acceptance is recorded
separately. OnPush, MVVM, scoped typed forms, BEM and reactive cleanup required.

## OpenAI deployment extension

User authorized implementing OpenAI, committing both repositories and deployment.
FR-007 / AC-007: Stream real Responses API text, preserve completed history, abort
on cancellation, and report limits/truncated streams without exposing credentials.
FR-008 / AC-008: Run CI checks before deployment; resolve the OpenAI key privately
from an Actions secret or the existing authorized server runtime configuration.
Deploy the service before the consumer; keep keys off the frontend and source.
The prior model-integration exclusion is superseded by this extension.

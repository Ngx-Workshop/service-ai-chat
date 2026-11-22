# A2UI learning experience
Status: Implemented; authenticated production acceptance pending

## Problem and scope
Replace placeholder interactive parts with real A2UI surfaces in chat. Preserve
text streaming, authenticated ownership, cancellation and reconnect recovery.
FR-001 / AC-001: Model selects useful plans, quizzes, workshop/lab resources;
render actual A2UI wire messages through the official renderer, not a lookalike.
FR-002 / AC-002: Use bounded, approved Text/Column/Card/Button/CheckBox/ChoicePicker
components. No generated HTML/JS, media, remote URLs or renderer functions.
FR-003 / AC-003: Quiz answers and checklist updates persist through an owner-checked
UI action; prompt buttons start normal idempotent chat turns. Feedback is informal
practice, not formal assessment grading or learner eligibility.
FR-004 / AC-004: Workshop and lab cards use published data through existing domain
APIs. Failure is explicit; do not invent catalog IDs or links.
FR-005 / AC-005: Saved surfaces and action feedback recover on reload/reconnect.
Unsupported/malformed legacy payloads have a text fallback. Preserve local input
across unrelated text updates; disable actions while a response is running.
FR-006 / AC-006: Keep Angular/federation 21.1 compatibility, keyboard operation,
responsive theme integration and safe internal navigation.

## Decisions
Official Angular renderer currently requires Angular ^21.2.5; use official Lit
renderer inside an Angular wrapper rather than upgrading shared platform versions.
The service compiles typed domain tool results into A2UI v1.0 messages. No A2A
transport or full MCP OAuth integration is needed; reuse the existing read-only
catalog endpoint contracts without sharing another service's collections.
No assessment submissions, code execution or account mutations are in scope.

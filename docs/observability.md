# Service logging and heartbeat

## Domain events and local correlation

Maintenance adds structured native Logger messages, not a replacement collector:

| Event / context                         | Level and outcome                                         | Safe fields                                                       |
| --------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| chat_run_finished / ChatService         | log: completed/canceled; error: failed/persistence_failed | generated runId, originating requestId when available, durationMs |
| chat_command_failed / ChatSocketService | warn: rejected; error: failed                             | validated requestId when available, durationMs                    |
| learning_tool_failed / ChatResponder    | warn: failed, with explicit model text fallback           | allowlisted tool name, requestId/runId when available, durationMs |

There is one terminal event only after final persistence, or one persistence_failed
event if that write fails. No events per stream delta, item, successful subscribe,
ticket or heartbeat. A tool warning describes recoverable fallback, not a failed
run; the eventual run can complete normally. Unknown socket storage errors retain
their existing sanitized wire code/message while being logged at error level.
Auth failures remain connection closes, without noisy ticket/auth logs.

AsyncLocalStorage propagates generated HTTP IDs and validated socket command UUIDs
into use-case work. HTTP X-Request-ID input is ignored and replaced, even if valid.
Background runs keep their originating command requestId and generated runId after
the command/socket ends; cancellation does not replace that originating identity.
Other startup/background work has no request context. IDs are UUID-only, not user
identifiers. Context is isolated across concurrent requests/runs and not persisted,
added to upstream headers, or shared across services: this is NOT distributed tracing.

Actual native JSON field placement is `level`, `context`, and structured `message`
(plus the existing native metadata). A terminal record excerpt is:

```json
{
  "level": "log",
  "context": "ChatService",
  "message": {
    "event": "chat_run_finished",
    "outcome": "completed",
    "requestId": "00000000-0000-0000-0000-000000000001",
    "runId": "00000000-0000-0000-0000-000000000002",
    "durationMs": 25
  }
}
```

In Grafana Explore, select the service's actual Alloy/Loki stream labels first,
then append this LogQL pipeline (do not assume an unverified label name):

```logql
| json event="message.event", outcome="message.outcome", requestId="message.requestId", runId="message.runId"
| event="chat_run_finished"
| outcome="failed"
```

Filter a known requestId/runId as parsed fields for investigation; never promote
these high-cardinality values to Loki labels. Domain records contain no owner ID,
conversation title/text, generated A2UI, tool arguments, credential, raw URL/error,
body, cookie or ticket. Existing Nest framework exception handling is unchanged;
this maintenance does not claim to sanitize every inherited framework error.

Local verification on 2026-11-22: real native JSON success/failure domain records,
canary redaction, persistence failure, tool fallback, UUID filtering, async
isolation and HTTP/quiet-heartbeat regressions passed (37 total Jest tests).
JSON envelope compatibility is verified locally; actual Alloy/Grafana receipt,
stream labels and live dashboards remain infrastructure-owner acceptance.

## Existing pipeline and heartbeat

This service uses native NestJS 11 `ConsoleLogger` JSON output to stdout/stderr, with `Logger` context for application events. No Angular logger or application-held Grafana credential is used. HTTP logs contain generated request ID, method, route template, status and duration; bodies, cookies, authorization headers, concrete identifiers and query strings are not logged by the middleware. Health polling is excluded from access logs. Avoid embedding secrets or personal search text in domain log messages.

`GET /health` and HEAD return the anonymous operational Terminus heartbeat with `status: ok` and `heartbeat: up`, plus `Cache-Control: no-store`. This is liveness only; it does not claim MongoDB or upstream readiness. Existing business-route authentication remains enforced. The gateway's exact read-only heartbeat is the only exception to its normalized proxy-envelope requirement. The operational endpoint is excluded from business Swagger/contracts where that service generates them.

Docker probes `/health` every 30 seconds. Deployments bound each container's local JSON log files to 10 MiB × 3. Host Alloy discovers active service names and ships logs and private HTTP heartbeat probe metrics to Grafana Cloud stack `ivorytoffee195`. Collector configuration/dashboard lives in infrastructure owner `nginx-ngx-workshop.io/ops/grafana`; its ingestion token remains host-owned, scoped to logs/metrics write, and requires account authorization before activation. No production credential belongs in this repository.

Validation on 2026-11-21: the isolated observability HTTP suite passed (5 scenarios), build passed, Linux-targeted lockfile dry run passed. Guarded services additionally passed the anonymous-heartbeat/protected-business-route HTTP test. Gateway production ingress e2e passed (51 scenarios), including exact-path/method heartbeat boundaries. Gateway and publisher lint passed. Full existing unit suites passed except Backstage's unchanged Octokit ESM test-loader failure, reproduced on its pre-change HEAD. Uploader tests pass under its documented `npm test` command; its 10 optional cases remain skipped. Publisher persistence e2e cases require the isolated Mongo URI and remain skipped when unavailable. These are local checks, not evidence of Grafana ingestion or live deployment.

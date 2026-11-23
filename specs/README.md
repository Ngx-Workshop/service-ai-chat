# Feature specifications

## Next task: Code Maintenance

Status: Implemented; integration pending. Selected on 2026-11-22; local evidence
is recorded in the maintenance audit/handoff. Node 22/container and live Grafana
checks remain explicit external follow-ups.

[Spec](004-code-maintenance/spec.md) · [Plan](004-code-maintenance/plan.md) ·
[Tasks](004-code-maintenance/tasks.md) · [Handoff](004-code-maintenance/handoff.md) ·
[Reusable Copilot prompt](../.github/prompts/code-maintenance.prompt.md)

T001–T010 local work is verified; continue X001/X002 in the task list.
Older unfinished work retains its recorded status below.

Keep implementation context in this repository so future agents can resume work
without the original conversation or other repository checkouts.

Use the [workflow](../.specify/README.md) and its templates. Create a folder such
as `001-document-search/` for actual feature work, then replace the empty index
below with relative links. A feature folder contains `spec.md`, `plan.md`,
`tasks.md`, and `handoff.md`; add supporting research/contracts only when useful.

| Feature                | Status | Spec | Plan | Tasks | Handoff |
| ---------------------- | ------ | ---- | ---- | ----- | ------- | --- |
| No feature records yet | —      | —    | —    | —     | —       | —   |

Keep one row per feature, retain completed records for rationale, and update
status when work changes. Select work from the user's request and this index;
the largest folder number is not automatically the active feature.

- [001-service-observability](001-service-observability/spec.md): Implemented and locally verified; Grafana ingestion authorization pending.

- [002 Chat foundation](002-chat-foundation/spec.md): Deployed; live UI smoke test pending.

- [003 A2UI learning](003-a2ui-learning/spec.md): Implemented; authenticated production acceptance pending.

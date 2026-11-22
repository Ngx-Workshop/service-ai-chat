# Plan: A2UI learning
Spec: [spec.md](spec.md)

Read the local constitution, architecture, development and workflow before edits.
Keep MVVM and federation/public exports intact. Use a restricted official A2UI
catalog with no renderer functions and validate graph/data bounds before mounting.
A message owns its surface; stable IDs/revisions avoid replaying snapshots into an
existing processor. Dispose processors on message removal or conversation change.
Model uses bounded domain function tools; server builders own component structure,
IDs, safe navigation and action definitions. Persist complete surfaces in message
parts. UI action commands validate conversation/message/surface/action identity.
Quiz/progress update the saved data model; follow-up prompts use existing sends.
Catalog client uses trusted server configuration and existing public endpoints,
no user-provided hosts or credentials. Generate producer OpenAPI/contracts, pin
published consumer release before deployment. Verify backend tests, A2UI renderer
and interaction tests, architecture and production builds, CI and live chat.
Dependency preparation uses a read-only feature-branch job with scripts disabled;
no production deployment happens during dependency resolution.

# A2UI learning handoff

Status: Implemented and deployed; production rollout evidence below. Authenticated manual
acceptance remains pending because the automation browser redirects to sign-in.

## Delivered
OpenAPI-derived A2uiSurfaceDto/A2uiActionDto and ui_action command. Bounded server
builders emit A2UI v1.0 basic catalog messages for checklists, practice quizzes,
workshop cards/outlines and lab previews. Model function tools select domain intent;
server code owns graph structure, IDs, navigation, action definitions and limits.
Real catalog data comes from existing domain APIs, never another service's Mongo
collections. Private DOCUMENT_BASE_URL/CODING_LABS_BASE_URL can be copied from
existing approved runtime configurations alongside the provider key.

Owner/message/surface/action identity and surface revisions gate every persisted
quiz/checklist update. Follow-up prompts use saved server prompts and existing
idempotent sends. Full UI/data models persist in message parts and snapshots.
Completed UI content supplies bounded model context. Tool failure produces a
sanitized result for useful text fallback. Completed provider output, including
encrypted reasoning, is replayed in order within the current request only.
Serialized UI counts toward the existing conversation history limit. Socket,
authentication, cancellation and restart recovery retain their existing boundaries.

## Verification and deployment evidence
- fc8b71aa5c0401e761b0eb3c26183011d27f9b0e: core A2UI tools/actions,
  Actions https://github.com/Ngx-Workshop/service-ai-chat/actions/runs/45029948101
  passed 30 Jest tests, 3 Python tests, builds/OpenAPI/contracts, published 0.0.7,
  deployed successfully.
- 9c96798ac27bbdce8d42cbdaefa32ec12c989a46: provider output replay,
  Actions https://github.com/Ngx-Workshop/service-ai-chat/actions/runs/45030265228
  completed successfully, published 0.0.8 and deployed.
- c0d5af21c736e9830c189f33ca269a28709f18e7: persisted UI bounds,
  Actions https://github.com/Ngx-Workshop/service-ai-chat/actions/runs/45030980874
  passed 31 Jest tests across 8 suites and 3 Python runtime tests; OpenAPI/contract
  generation and publication of 0.0.9 succeeded. Production deployment and startup
  health check completed successfully.
- Local focused lint, infrastructure-free build/OpenAPI and contract generation
  passed. Local unit suites passed; actual HTTP/socket tests require listening
  ports denied by the sandbox, and ran successfully in CI.
- Frontend commit ea5224d0add1809a91eded03b6d0b5990ba153bf was deployed after
  12 real ChromeHeadless tests (including official renderer interactions) and
  production build passed. Consumer retains compatible schema version 0.0.7.

## Remaining acceptance and limits
Production browser navigated to chat and redirected to sign-in; no authenticated
live model, Mongo persistence or catalog reachability claim is made. Sign in,
request a plan, save/reload checklist progress, answer/reload a practice quiz,
preview real workshops/labs, follow a prompt action, reconnect and cancel a run.
CI fixtures are not a substitute for these signed-in integration checks.
Full MCP OAuth, formal grading, code execution and account mutations are outside
scope. Credentials never reach browser bundles. Single-instance runtime constraints
from the foundation remain unchanged. Official OpenAI Responses guidance requires
replaying completed reasoning/function output in stateless tool loops:
https://developers.openai.com/api/docs/guides/reasoning

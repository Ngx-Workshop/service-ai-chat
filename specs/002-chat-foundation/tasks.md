# Tasks: Chat foundation
Spec: [spec.md](spec.md)
Plan: [plan.md](plan.md)

- [x] T001 — Implement authenticated persistence, validation and socket transport
  in service-ai-chat/src/chat; verify AC-001/002/004 with Jest unit doubles; real socket integration remains X001.
- [x] T002 — Generate DTO/OpenAPI/contracts, package for local consumer validation.
- [x] T003 — Implement Angular chat api/state/VM/components under features/chat;
  verify AC-003/004/005/006 with architecture/types/build; browser tests implemented but execution blocked (X002).
- [x] T004 — Update architecture/development/readme and record checks in handoff.
- [ ] X001 — Publish producer contracts and update consumer to published version;
  deploy service and verify live auth, Mongo and Nginx WebSocket recovery.

- [ ] X002 — Run ChromeHeadless and real HTTP/WebSocket suites in an environment
  allowing local listening ports; browser runner startup aborted here (134).

- [x] T005 — Implement bounded OpenAI streaming, sanitized failures and five provider tests.
- [x] T006 — Prepare private runtime key bootstrap and pre-deployment CI checks.
- [ ] T007 — Commit/publish backend, observe successful service deployment and contract version.
- [ ] T008 — Pin published consumer contracts, commit/deploy MFE and verify live endpoints.

# CLI notes for reviewers

- The backend’s analysis/completed event is emitted by the caller:
  - Inngest job emits after commit.
  - HTTP path can request the service to emit.
- The CLI is read-only; it only browses results and posts feedback notes.
- Always test the application!

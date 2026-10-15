# Product contract

The first-release contract is [ACCEPTANCE.md](ACCEPTANCE.md).
HTTP authentication, revision approvals, retry identities, payroll source claims,
import preservation and erasure are covered by tests/lanyard.test.mjs.
The command and archive contract is [SEED-COMMAND-CONTRACT.md](SEED-COMMAND-CONTRACT.md).

The public run site is built by `rer build --site`: its homepage opens `/run`,
and `/docs` is rendered from the owner guides and reference Markdown in `docs/`.
The installed `/` remains the shared Lobby. Run-site deployment is disabled
until the repository enables `RUN_SITE_DEPLOY_ENABLED`.

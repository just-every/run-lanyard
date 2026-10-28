# Agent instructions

## Launch for review

When asked to launch, run or review this app, run this from the checkout root
and nothing else:

```sh
rer dev
```

- It installs and sets up a fresh checkout by itself and prints progress; a
  first launch can take several minutes. Give the shell tool at least 10
  minutes. If the tool times out, run the same `rer dev` again: it resumes.
- Never run install, setup, reset or deploy for this, and never ask for an
  email, port, password or answers file.
- Give the owner the `RER_READY` address and the `RER_OPEN` link, and ask
  nothing. `RER_OPEN` is a credential: share it only with the owner, in this
  chat. A seed without dev identity prints `RER_SIGN_IN` (its local outbox)
  instead.
- Stop the app with `rer dev --stop`. If a start is refused, the message names
  the cause and the next command: run that command.

Without `rer` on PATH, install it once with `npx -y @runeditrun/rer cli install`
or the installer script: `curl -fsSL https://runeditrun.com/install.sh | sh`.
For the current shell, run `export PATH="$HOME/.local/bin:$PATH"` after installing.

## Work on Lanyard

Read README.md and ACCEPTANCE.md. This is package mode: use the exact pinned
@runeditrun/rer and its exports. Do not add vendored CLI copies.

For a real owner installation: `rer install`, `rer setup --owner-email EMAIL`,
then `rer dev`. Local email stays in the development outbox. Stop dev before
build, verification or archive transfer. `rer export --output exports/data.rer`
backs up supported data; `rer import --input FILE --yes` requires an empty
destination. `rer reset --yes` removes local data and settings. `rer deploy`
uses the declared owner-account resources; `--dry-run` has no provider effect.

Every private handler checks the current native session, role and ownership.
Agent calls carry the risk classes in CONTRACT.md; the company policy decides
their disposition. Preserve exact revisions and truthful attribution. Hours export once; corrections export signed differences.
Do not change deployment, package, Worker, D1 or edition identities.

Keep modules small and tests through public HTTP or CLI doors. Use
`pnpm run test:lanyard` for the product, `pnpm run typecheck` after a build,
and `rer verify` for the full check. Tests never run during build/deploy.
Use the existing test budget. No mock application code or silent fallbacks.

Before heavy work check `sysctl -n vm.loadavg` on macOS; wait if one-minute load
is over 36. Use nice -n 15 and at most two workers, one heavy job at a time.
Stop only processes you started. Never read ~/.env or print secrets.
Keep research outside this public repository. Run Base's publication scan
on the exact tree before every public push; no exclusions or force pushes.

## Contract documents

CONTRACT.md owns acceptance, status and claims. After every change, regenerate
with the shared generator, then check it; the historical scripts/contract-docs.mjs
command forwards to that generator and validates any touched clause identifiers.
Never hand-resolve generated acceptance, claim or summary rows after a merge.

Lander-Regenerate: node src/base/contract-docs.mjs write
Lander-Regenerate: node scripts/edition-authoring/cli.mjs lock

Run `node src/base/contract-docs.mjs check`, regenerate the edition source lock
last, then run `node scripts/edition-authoring/cli.mjs check`. Retain the current
Base selection. Contract rewrites also run the ID map and coverage commands
against the current main ancestor, preserving that main's newer judgments.

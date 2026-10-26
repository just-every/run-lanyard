<img src="public/brand/mark.svg" width="104" alt="Lanyard: two crew aprons high-fiving">

# Lanyard

The public site is at https://run-lanyard.com.

## Listing intake

| Field | Value | Source |
| --- | --- | --- |
| Listing id | `lanyard` | `seed.json` id |
| Run URL | https://run-lanyard.com/run | This README at the release commit |
| storesFiles | `true` | Attachments in D1 and the `FILES` R2 bucket (`lanyard-files`) |

Logbook attachments use R2 (`src/lanyard/domain/logfiles.ts`); staff-note and
shift-handover attachments use D1 (`src/lanyard/domain/journal.ts` and
`src/lanyard/domain/shiftworkfiles.ts`). The archive policy includes the R2 objects
and D1 file records. The source gallery capture is
[the populated weekly schedule](.github/assets/release/lanyard-roster-1440.png),
captured from `rer dev --demo` with the built-in Tres Hornos Bakery data.


A full crew, paid right. Lanyard is a free, open source alternative to Deputy, When I Work and Homebase for US hourly teams; [CONTRACT.md](CONTRACT.md) is the product it is being built toward and records what ships today. Today it runs one location's weekly schedule, clocking in by phone, approved timesheets and payroll CSV exports. It exports hours to your existing payroll process; it never calculates or pays wages. MIT licensed. [First-release scope](ACCEPTANCE.md).

## Run from a fresh clone

In a terminal, install rer, then start Lanyard. These are the same two lines as the site's [Run page](https://run-lanyard.com/run):

```sh
curl -fsSL https://runeditrun.com/install.sh | sh
rer dev just-every/run-lanyard
```

The installer puts rer in your home folder, with its own Node if you have no Node 22 or later. If its last line puts rer on your PATH, run that line before the second command. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-lanyard` does both steps in one line. To start it again later, run `cd run-lanyard && rer dev`. RER installs pinned dependencies and Node 22.20.0, prepares local D1, and starts the app. First launch can take several minutes. Open the private `RER_OPEN` link printed in the terminal and confirm the owner at **Finish setup**. Keep that link private. `RER_READY` is the ordinary app address. A compatible second `rer dev` reuses the running app. If interrupted, run it again.

For an installation with your own email, run `npx -y @runeditrun/rer install just-every/run-lanyard`, then `rer setup --owner-email you@example.com` and `rer dev` from the checkout. Development email is silently suppressed. Reopen the private `RER_OPEN` link to sign in locally. If another checkout occupies the saved port, choose an available one explicitly, for example `rer dev --port 8899`; RER intentionally refuses to drift to another port. Stop with `rer dev --stop` or Ctrl-C. Never expose the development server publicly.

## Owner guides

The [Lanyard guide](docs/README.md) is built into the public site's `/docs` pages from the same repository Markdown. Start with [getting started](docs/GETTING-STARTED.md), then follow [schedule, call-outs and time off](docs/SCHEDULE.md), [clock and timesheets](docs/TIME.md), and [payroll exports](docs/PAYROLL.md). There are also step-by-step guides for [moving in](docs/MOVE-IN.md) and [backup and restore](docs/BACKUP-RESTORE.md).

## First week

1. **People**: add people with unique email addresses and payroll IDs, activate, then **Invite**. Only the owner grants access. Local invitations are silently suppressed; a deployed installation sends them through its configured mail provider. Invitations establish real sessions. A manager's own hours need another manager or the owner to approve them.
2. **Move in**: paste [Staff CSV v1](docs/STAFF-IMPORT.md), preview, inspect rows, and apply that exact preview. New rows are inactive. Open the journal; undo removes untouched imports and preserves native edits or dependent work. `tests/fixtures/staff.csv` is a synthetic example, not a vendor export.
3. **Schedule**: staff add availability and request time off. Managers decide time off, prepare shifts for a Monday-starting week, review conflicts, then publish. Check the venue time zone in **People** (for example America/Los_Angeles) before publishing the first schedule. Forms and weeks use venue time; stored timestamps and payroll CSV use UTC. The time zone is fixed after the first publication. Ambiguous or missing DST wall times are refused; use a clear boundary. Publication refuses shifts outside availability, approved time off or overlapping shifts. Staff see and confirm only their own published shifts.
4. **Time**: staff clock in and out, entering unpaid break minutes when clocking out. An opened clock queues encrypted clock and break captures through connectivity loss and keeps them across page closure or restart. Reopen the app when connected and retry the original captures; accepted captures cannot duplicate time. Rejected captures remain unresolved for manager review. Managers prepare missed time with a reason, approve hours, or correct the latest approved record. Corrections keep the prior record and need fresh approval.
5. **Payroll**: prepare approved hours, review the exact CSV, and explicitly export. Download and import into payroll once; re-downloads return identical bytes and do not create new batches. Record the provider acknowledgement reference yourself. A correction to exported time carries only the positive or negative difference. This is Lanyard's documented CSV format: map it to your provider before using real data. Lanyard cannot prevent someone uploading a downloaded file twice externally.
6. **Agent access**: the owner creates a revocable, 30-day preparation key. [Agent commands](docs/AGENTS-API.md) prepare work; a native human session approves it. Keep keys out of logs.

## Back up, restore and remove access

Stop the app before CLI data operations. Store exports privately:

```sh
rer dev --stop
rer export --output exports/lanyard.rer
```

Restore into a fresh clone of the same revision, before setup or staff data:

```sh
npx -y @runeditrun/rer install just-every/run-lanyard
cd run-lanyard
rer import --input /private/path/lanyard.rer --yes
rer setup --owner-email original-owner@example.com
rer dev
```

The original owner and staff identities, schedules, hours, payroll files, import originals and journals travel. Sessions, sign-in links, agent keys, credentials and the development outbox do not. Re-enter private configuration and sign in again. Setup must use the archived owner's email. Import rejects damaged archives and populated destinations. After erasure, supply a later archive as the journal: `rer import --input OLD.rer --journal LATER.rer --yes`. A destination or later journal holding the erasure fence refuses the earlier archive. Old offline backups cannot know about later erasure; protect and retire old copies yourself.

Deactivate staff in **People** to revoke app access immediately. Revoke keys in **Agent access**. **Erase unused staff** is limited to a record never invited, imported or used in work; it replaces identity details and fences older backups. Employment history remains retained for used staff. `rer reset --yes` destroys local state and settings; export first if needed.

## Deploy to your Cloudflare account

A provider account and purchased domain are unnecessary locally. Worker, D1 and project identities are declared in `wrangler.jsonc` and `deploy.json`; keep them stable. Real deployment needs your Cloudflare account, a scoped Workers and D1 token, and a verified mail sender. `rer deploy --help` lists options. Supply `MAIL_PROVIDER` (resend or sendgrid) and `MAIL_FROM` (your verified sender), plus private `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `OWNER_EMAIL`, `SESSION_SECRET`, `INSTALLATION_KEY`, `SETUP_TOKEN` and `MAIL_API_KEY` environment variables from your secret manager. Other declared mail transports also require their transport-specific setup. Mail settings are installation inputs, so a fresh clone contains no placeholder sender to replace. Never commit secrets.

```sh
rer deploy --dry-run
rer deploy
```

Dry run validates/builds without provider requests. Real deploy provisions resources, migrates D1, uploads secrets and checks health. Deployment claims the configured owner and retires its setup token. Open the returned origin and sign in by email. A workers.dev address is sufficient; a custom domain is optional. Local tests do not establish real mail delivery or hosted acceptance.

## Develop

`rer dev` also prints `RER_SITE`, the local marketing homepage, `/run` and on-site docs. `rer build --site` writes the checked static site to `dist/site`. Run-site publishing is opt-in through `RUN_SITE_DEPLOY`; its domain declaration remains separate from the installed app.


Package mode pins `@runeditrun/rer` to `0.2.80`, which supplies native hosted demos and silently successful demo invitations and sign-in links. Foundation: `runeditrun/base@3478fc15bb18c2f74def8e8906bd308320c7953b`. [Source reuse](docs/SOURCES.md), [operations](RUN-LOCALLY.md), [agent guide](AGENTS.md).

```sh
pnpm run test:lanyard
pnpm run typecheck
rer verify
```

Tests exercise real D1, native invitations/sessions and HTTP commands. Build/deploy never run tests. GitHub Verify is the full check, one run per push commit.

# Company agent door

Lanyard serves one shared `/mcp` door using Base's agent-door runtime at
`e881e6f66ce7cd737d17dbeb945995aab83c30d8` and the repository’s pinned rer CLI.
It supports MCP 2026-07-28 and 2025-11-25. Discovery and canonical OAuth resource
metadata describe the same registry. Company policy, Pause, named approvals,
reviews and audit are at `/agents`; an agent credential cannot decide for a person.

A paired installation accepts owner-bound Business tokens with explicit consent.
The signed settings roster binds Business subjects to native operator ids. A
matching email never selects an account. Workforce admission and native roles
are re-read; an inactive or unlinked person cannot sponsor. A token whose email
differs from that native person is refused without moving the subject binding.
Business team admin means Business policy editor only through the signed mapping; it does not create
a workforce owner or manager. Current workforce preparation authority belongs to
the native owner. Local preparation keys keep their original reduced authority.

The declared adoption includes tools, policy, Pause, audit, idempotency and resources,
with principal authorization always enforced. Events and subscriptions, multiple
sponsors, outside mail and resource refresh are not claimed as adopted families.
The runtime and manifest declare the same bounded resource surface. Optional
events, prompts and subscriptions are omitted and typed-refused. Existing
native mail, devices, imports, connectors and installation commands keep their
own purposes.

Policy starts unset and refuses effects. Paired policy arrives as signed JWS at
`POST /api/rer/agent-policy`; a standalone owner configures policy through the
person JSON door. There is no policy bypass for legacy keys. An autonomous
company rule permits preparation; Lanyard's native human-only publication,
time approval, payroll export and learning decisions remain separate.

| Tool | Scope | Class | Native clauses |
| --- | --- | --- | --- |
| `lanyard.context.read` | `workforce:read` | standard | AGENT-001 |
| `lanyard.roster.prepare` | `workforce:prepare` | standard | AGENT-001, ROSTER-002, SCHEDULE-001 |
| `lanyard.time.prepare` | `workforce:prepare` | standard | AGENT-001, TIME-002 |
| `lanyard.payroll.prepare` | `workforce:prepare` | standard | AGENT-001, PAYROLL-001 |
| `lanyard.tradeoff.compare` | `comparison.read` | standard | TRADEOFF-001 |
| `lanyard.demand.read` | `comparison.read` | standard | DEMAND-001, LEARN-001 |
| `lanyard.learn.read` | `comparison.read` | standard | LEARN-001, TRADEOFF-001 |
| `lanyard.learn.propose` | `comparison.read` | standard | AGENT-001, LEARN-001, TRADEOFF-001 |

These tools call the existing native services. Standard reflects their actual
internal preparation or reduced read, with no wage movement, external recipient,
access grant or production publication. Classification uses current native
records and proposed items; caller flags cannot lower it. Writes carry a
server-generated summary and the native aggregate revision. Supply
`idempotency_key` on writes and `expected_revision` when pinning the source.
A changed key body conflicts; a stale source refuses. Native commands also
retain the original operation identity, so door recovery cannot duplicate a draft.
No provider cost or spend reservation is registered: spend is explicitly none.
No Undo is offered where the native service has no reversal.

The declared capabilities are tools, policy, pause, audit and idempotency.
Events, resources, prompts and subscriptions are undeclared: discovery omits
them and their public calls return typed `capability_not_declared` refusals.
The eight native resource readers remain internal visibility adapters; the
public resource catalogue and returned resource links are empty. Record access
for this adoption uses the reduced context and consented comparison tools.
Source text is untrusted. Keys, bearer credentials, payroll identifiers, rates,
private contacts and download bytes are not returned.

To let company agents use comparison reads, the owner must separately grant
`comparison.read`, name cafes, consent to aggregate cost disclosure and check
**Also allow signed company agents** in Agent access. Existing grants do not
acquire this permission. Revocation, expiry and owner-version changes remove it.
A Business token cannot borrow a local key's grant, even by naming that key.

Native drafts and activity retain the agent, native sponsor, operation and named
policy approvers; the draft says `<agent> for <person>`. A later native approval
has its human actor. Shared-door records are retained; identities disclosed into
retained door content cannot use unused-person erasure until coordinated
redaction exists. Archives retain custody fences, audit, events and cached
outcomes, while excluding active policy, Business binding, agent registration,
pending approval/review authority and usage. Restore requires fresh pairing and
policy. This is a custody limit, not completed employee-rights fulfillment.

The workforce coordinator reads current source facts, prepares supported
drafts and hands exact revisions to native people. It refuses to invent worked
time or treat a payroll file as proof of wages paid. Learning proposals require
real pre-service forecast history, observed sales and an improved holdout result;
a fresh installation cannot manufacture that history. Prompt retrieval is
undeclared in this CORE adoption.

The proposed broader contract surface is not a grant. Workforce administration,
publication, authoritative approval, payroll transfer, staff contact and erasure
are not agent tools under the currently judged AGENT-001. The conformance
manifest declares only real native preparation and consented reads.

## Compatibility preparation API

The existing endpoints below translate into the same shared door. They require
an adopted policy and respect Pause, current authority, approval and audit.
An `Idempotency-Key` header pins a compatibility mutation. Refusals include a
machine `code`; MCP uses `_meta["com.runeditrun/error"]`.

The owner creates a key in **Agent access** (in the account menu, top right). It expires after 30 days and can be revoked immediately. Keep it in a private `LANYARD_AGENT_TOKEN` environment variable; never log it. `LANYARD_ORIGIN` is the exact app origin.

```sh
curl -H "Authorization: Bearer $LANYARD_AGENT_TOKEN" "$LANYARD_ORIGIN/api/lanyard/agent/context"
curl -H "Authorization: Bearer $LANYARD_AGENT_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @private-command.json "$LANYARD_ORIGIN/api/lanyard/agent/command"
```

Envelope: `{"name":"COMMAND","input":{...}}`.

| Command | Input | Human decision |
| --- | --- | --- |
| `roster.prepare` (a week's schedule) | `week`, the Monday that starts it as YYYY-MM-DD (`2026-10-19` for the week of Oct 19, 2026); `shifts` array of `staffId,start,end,breakMinutes,label` | `roster.publish` with exact `id,revision` |
| `time.prepare` | `staffId,start,end,breakMinutes,reason`; optional `corrects` ID | `time.approve` with exact `id,revision` |
| `payroll.prepare` | optional `ids` array of approved timesheet IDs; omit for all eligible | `payroll.export` with exact `id,revision` |

Timestamps use ISO UTC. Get IDs from context. Responses identify saved drafts and required approvals. Conflicts return 409: refresh context and let a person resolve them. Agents cannot publish, approve, acknowledge, clock, import, grant access, download payroll or erase. Bearer keys do not authenticate human endpoints.

Human screens use `/api/lanyard/state` and `POST /api/lanyard/command` with the same envelope, native cookie and exact Origin. Decisions record actor, revision and time. `/api/lanyard/batches/ID.csv` downloads exported bytes after their SHA-256 integrity check.

## Optional comparison reads

Only the owner can grant `comparison.read` while creating a key, with explicit consent to the warning that repeated aggregate costs can narrow down individual pay. Select named cafes; there is no all-cafes grant. Existing keys and new preparation-only keys gain no comparison access. The existing `agent.create` command accepts `scopes: ["comparison.read"]`, `cafes: ["Ocean Beach"]`, and `comparisonConsent: true` in addition to `label`.

Use `GET /api/lanyard/agent/fairness/compare?week=YYYY-MM-DD&site=CAFE&weeks=8` with the bearer header. This read returns assignments, cohort fairness totals and permitted per-person fairness counts, scheduled and workweek overtime minutes, and alternative-level USD totals. It returns no rates, rate profiles, individual cents, payroll IDs, contact details, qualification evidence, feedback or download files. Extra-hour requests and offers appear only as cohort totals. Erased identities are labelled Former employee.

Each USD value is `{status, cents, reasons}`. `known` is an aggregate total, `small-cell` with null cents withholds a total with fewer than three nonzero employee contributors or a difference with fewer than three changed employees, and `unknown` with null cents retains missing input reasons. No withheld or unknown value is zero. Missing fairness inputs return an explicit unknown comparison rather than inventing alternatives. Scheduled weekly overtime remains an estimate, not payable or statutory overtime.

Each scoped read is recorded in owner activity with key, cafe and week. Revocation, expiry and owner-version changes refuse subsequent reads. Archives and Staff CSV imports never grant scopes. Fairness draft preparation and publication still require a native owner or home-cafe manager session.

## Forecasts and measured learning proposals

Under the same `comparison.read` grant and named cafe limit, use `GET /api/lanyard/agent/demand?site=CAFE&date=YYYY-MM-DD` for forecast versions, hourly role demand and observed demand delta. Missing or incomplete inputs remain explicit. This projection omits raw sales rows, source identifiers, human free-text override reasons, personal attendance and labor cost fields.

Use `GET /api/lanyard/agent/learning/proposals?site=CAFE&weeks=8` to inspect comparable days, excluded/unknown outcomes, the holdout comparison and the evidence digest. Then send `learn.propose` with `site`, `weeks` and that exact `digest` to the agent command endpoint. Changed evidence or assumptions require a fresh read. Recording a proposal never changes an assumption. Its audit identifies the key and role, with the measured reason retained on the proposal. Only a native owner or that cafe's manager approves, declines or reverts; even a scoped key cannot save or override a forecast or decide a proposal. Every scoped read is audited and the live grant is rechecked when recording a proposal.

## Single-cafe partner roster API v1

In **Settings**, the owner creates a **Partner roster API** credential for one
named cafe. Its fixed scope is `roster.prepare` and its version is `v1`; it has
no comparison, time or payroll scope. It expires after 30 days. Copy the token
once into private storage. **Rotate credential** atomically revokes the previous
key and shows a new token once; **Revoke credential** takes effect immediately.
Reloading a creation or rotation response cannot recover the clear token.
Existing agent keys do not authenticate this API, and partner keys cannot
enter legacy agent routes or native human routes.

1. Read `GET /api/lanyard/partner/v1/context` with the partner bearer token.
   The response supplies `contextVersion`, installation `timezone`, the named
   `site`, active cafe staff identifiers and names, availability windows and job
   identifiers. It excludes contact details, rates and payroll identifiers.
2. Send `POST /api/lanyard/partner/v1/roster-drafts` with JSON and an
   `Idempotency-Key` header containing 8 to 100 letters, digits or hyphens.
   The JSON object contains `contextVersion` from that read, a Monday `week`,
   and `shifts` using the existing roster preparation fields documented above.
   Each shift must belong to an active employee whose home cafe is the key's
   cafe; an explicit `site` must match it. This intentionally narrow slice
   grants no shared-staff or delegated multi-site authority.
3. Inspect the returned draft identifier, revision, assigned shifts and
   conflicts. Preparation does not publish. A native human uses the existing
   schedule review and exact-revision `roster.publish` decision separately;
   current qualification, availability, policy and period fences still apply.

A new request requires the current `contextVersion`; changed context returns
409 without writes. A week containing foreign-cafe draft, published or open
rows is refused, even when the request would omit those rows. The partner may
neither replace nor implicitly remove another cafe's assignments.

Replay identities are durably namespaced by credential and API version, with
a SHA-256 digest of the exact request bytes. Identical retries, including
concurrent requests and retries after restart, return the same saved draft
response without another write. Changed bytes, including JSON whitespace,
return 409 for the same identity. A saved response is a receipt for the original
preparation, not a fresh publication or current draft review. Credential scope,
version, named cafe, expiry, owner status and owner version are checked before
returning it; staff who have been deactivated, erased or moved out of scope
cannot be disclosed from an old response. Refresh context and use a new
identity for changed work. Credentials never travel in installation archives;
restoring draft data and replay receipts cannot restore their authority.

This native API establishes no external workflow connection or delivery.
Signed event webhooks, observable provider delivery and reconciliation,
authorized Zapier and Make event-to-draft workflows, and broader versioned
time, coverage and report APIs remain open under LINK-001.

## Current preparation resources

The four preparation tools return usable MCP `resource_link` content. Read a
link with `resources/read` on the same authenticated `/mcp` door. Templates are
listed by `resources/templates/list` for the credential's current scopes:

| Template | Required scope | Current reduced record |
| --- | --- | --- |
| `lanyard://weeks/{week}` | `workforce:read` | Current draft, otherwise published week, with its reduced assigned shifts |
| `lanyard://time/{id}` | `workforce:read` | Current native time record without private review material |
| `lanyard://payroll/{id}` | `workforce:read` | Current native hours batch and reduced source lines |
| `lanyard://learning/{id}` | `comparison.read` | Current proposal identity, revision, status, weeks, change and evaluation |

Weeks, time and payroll reuse the existing native preparation projection.
Learning reuses the existing reduced learning projection and requires the
owner's separately consented named-cafe grant. A Business token additionally
needs company-agent consent; it cannot borrow a local key's private grant.
Every read rechecks sponsor authority, current scope, owner version and, for
learning, current cafe consent. Revocation applies to the next read. Company
policy and Pause also govern reads; held content stays withheld until the
required native decision. Changed sources require fresh preparation review.

Links identify current records, rather than frozen write receipts. A later human
decision is visible on readback, including after restart. Unavailable and missing
records return the same resource refusal. Source text has
`com.runeditrun/untrusted: true` on the returned content. Disclosed staff
references retain the existing agent custody fence against unused-person
erasure. Resources disclose no credentials, contact cards, payroll identifiers,
rates or download bytes. No file template is registered. Other primary record
types, full UI-role parity, grant byte budgets, multi-sponsor and resource-refresh
acceptance remain open; this surface grants no new human decision or reader
role.

## Verification at the current Base pin

Normal `rer verify` runs the production build and declared agent journey,
including the resource checks. The focused command
`node node_modules/@runeditrun/rer/cli/agent-door.mjs .` exercises that same
conformance runner. At the current rer 0.2.98 pin it passes **962/962 points**,
including written-state resource readback for all four preparation commands in
both autonomous and held rounds and the specialist native journey. This focused
result is distinct from the full candidate Verify workflow.

`verification.history` declares a contained, isolated test Worker and two narrow
INSERT statements for native sales and forecast records. It creates 35 dated
sales observations and seven pre-service forecasts, calculated and digested by
Lanyard's native code. It never writes accounts, policy, approval, audit or
protocol receipts and never advances the runtime clock. The autonomous and held
rounds use the same retained history. Between them, the native owner declines
the preceding open proposal through the production person command; the next
proposal still follows the real learning, authority, policy and audit paths.
Regenerate the Worker after changing native calculations with
`node scripts/build-agent-history.mjs`.

The separate native journey uses its own real installation with an explicit UTC
venue timezone. `tests/agent-history.mjs` previews/imports observed sales, saves
a current forecast and proves that saving a completed-day forecast returns HTTP
400 without changing the native revision. Entered sales alone still yield zero
comparable days and no proposal. Distinct time intervals succeed under both
policies; overlaps remain refused. Identity, named exact-summary approval,
attribution, one-effect replay, argument and revision conflicts, Pause and
zero differs_from_policy all pass. Production backdating is unchanged.

Events, prompts and subscriptions remain undeclared and typed-refused.
The four declared preparation resources are exercised in both policy rounds
with independently expected written-state fixtures in `agent-surface.json`.
Multi-sponsor, mail edges, resource refresh, timed and queued lifecycles, dual host
and owner-native administration remain unproved; shared clauses stay PARTIAL.
No provider cost, enforceable spend cap or broader AGENT-001 authority is claimed.

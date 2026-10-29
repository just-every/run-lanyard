# Company agent door

Lanyard serves one shared `/mcp` door using Base's agent-door runtime at
`2135c394939f4a737adabdc8003b0e667b31ac5a` and the released rer 0.2.91 CLI.
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

The declared adoption is CORE: tools, policy, Pause, audit and idempotency,
with principal authorization always enforced. Events/subscriptions, multiple
sponsors, outside mail and resource refresh are not claimed as adopted families.
The runtime declares the same CORE set as the manifest. Optional events,
resources, prompts and subscriptions are omitted and typed-refused. Existing
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

## Verification limits at the current Base pin

Normal `rer verify` runs the production build and the declared journey. The
native journey proves distinct time intervals under autonomous and review
policies, overlapping-time refusal without an effect, and insufficient learning
history remaining unknown without a proposal. It also proves native identity,
exact-summary named approval, replay, conflicts, stale revisions and Pause.

The 0.2.91 phase fixture supplies distinct native time intervals for successive
policy rounds. Learning still requires a supported disposable history/clock
lifecycle so saved forecasts genuinely precede completed service days. Native
insufficient-history refusals remain intact; any conformance failures retain
the normal nonzero exit and PARTIAL contract judgments. Multi-sponsor, mail
edges, resource refresh, timed and queued lifecycles, dual-host operation and
owner-native administration are unproved. No provider cost or spend is claimed.

The measured conformance result is **643/645 points** using
`SEED_VERIFY_SHARD=app pnpm exec rer verify`. Every subset refusal check and the
specialist native journey passes. The former refusal-review mismatch is fixed:
a native refusal opens no review and retains its refused audit. Changed-email
admission is refused with the original native binding unchanged.

The only remaining points are `BASE-AGENT-013.4.autonomous.proposal` and
`BASE-AGENT-013.4.held.proposal`, both returning `native_conflict` without enough
pre-service forecast history. The 0.2.91 hooks expose disposable SELECT state
and the current verifier time; they neither write native history nor advance
the clock. The hosted database boundary refuses history writes with
`hosted_database_invalid`. No production backdate route or test-only authority
is added. This Base history gap retains the ordinary failed verification exit.

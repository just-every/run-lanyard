# Preparation API

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

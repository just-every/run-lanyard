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

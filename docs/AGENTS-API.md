# Preparation API

The owner creates a key in **Agent access**. It expires after 30 days and can be revoked immediately. Keep it in a private `LANYARD_AGENT_TOKEN` environment variable; never log it. `LANYARD_ORIGIN` is the exact app origin.

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

import {h,disclosure,card} from './shared'
const preparation = [
 ['roster.prepare','week: Monday YYYY-MM-DD; shifts: array of {staffId, start, end, breakMinutes, label?, site?}'],
 ['time.prepare','staffId, start, end, breakMinutes, reason; corrects?: approved timesheet ID'],
 ['payroll.prepare','ids?: array of approved, unexported timesheet IDs'],
]
const human = [
 ['settings.save','Owner','timezone: named IANA venue time zone; fixed after the first published week'],
 ['staff.save','Owner','name, email, role (staff or manager), active; payrollId optional until export; position, hourlyRate (dollars) and site (home cafe) optional; id + revision when editing'],
 ['forecast.save','Manager','week: Monday YYYY-MM-DD; site; days: seven whole-dollar sales forecasts, Monday to Sunday; budgetPercent optional'],
 ['staff.invite','Owner','id: active staff ID'],
 ['staff.erase','Owner','id, revision; unused, uninvited manually added staff only'],
 ['availability.save','Staff or manager','start, end; staffId for manager entry; id + revision when editing'],
 ['leave.request','Linked staff','start, end, reason: time off'],
 ['leave.decide','Manager','id, revision, decision (approved or rejected): another person’s time off'],
 ['roster.publish','Manager','id, revision: reviewed draft'],
 ['shift.confirm','Linked staff','id, revision: own published shift'],
 ['shift.callout','Linked staff or manager','id, revision, note?: a published shift that has not ended; offers it to every qualified teammate within overtime'],
 ['cover.respond','Linked staff','id, revision, decision (accepted or declined), note?: an offer made to you'],
 ['cover.approve','Manager','id, revision: an accepted offer; moves the shift to that person'],
 ['clock.in','Linked staff','commandId, capturedAt'],
 ['clock.out','Linked staff','commandId, capturedAt, breakMinutes'],
 ['time.approve','Manager','id, revision; another person’s submitted time'],
 ['payroll.export','Manager','id, revision: reviewed CSV batch'],
 ['payroll.acknowledge','Manager','id, revision, reference: provider acknowledgement'],
 ['import.preview','Owner','csv: exact staff CSV text'],
 ['import.apply','Owner','csv, fingerprint: from exact reviewed preview'],
 ['import.journal / import.resume / import.undo / import.rollback','Owner','jobId'],
 ['agent.create / agent.revoke','Owner','label to create; id to revoke'],
]
export function commandDocs() {
 return card('Agent command API',`<p>Send a bearer credential to <code>GET /api/lanyard/agent/context</code> to read the current snapshot, and <code>POST /api/lanyard/agent/command</code> to prepare drafts. Credentials expire after 30 days and can be revoked below.</p><p>The JSON request contains <code>name</code> and <code>input</code>. Use ISO UTC timestamps including seconds and a trailing Z. Use current IDs from the snapshot. Agents can call these three preparation commands:</p><dl class="command-docs">${preparation.map(([name,fields])=>`<dt><code>${h(name)}</code></dt><dd>${h(fields)}</dd>`).join('')}</dl><pre>{"name":"roster.prepare","input":{"week":"YYYY-MM-DD","shifts":[{"staffId":"STAFF_ID","start":"YYYY-MM-DDT09:00:00Z","end":"YYYY-MM-DDT17:00:00Z","breakMinutes":30}]}}</pre><p>The response includes the prepared record and the exact revision requiring human approval. Preparation does not publish a schedule, approve time or export payroll.</p>${disclosure('Human command reference',`<p>Signed-in people use <code>GET /api/lanyard/state</code> and <code>POST /api/lanyard/command</code>. Human POST requests require the matching application Origin. Managers include the owner. The following commands are unavailable to bearer agents.</p><dl class="command-docs">${human.map(([name,role,fields])=>`<dt><code>${h(name)}</code> · ${h(role)}</dt><dd>${h(fields)}</dd>`).join('')}</dl><p>Clock retries must reuse the original commandId and capturedAt unchanged. Human decisions use the exact reviewed revision; changed records must be reviewed again.</p>`)}`)
}

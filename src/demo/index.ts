import type { Bindings } from '../auth.server'
import { csv } from '../lanyard/domain/payroll'
import { kinds, sha, type Kind, type Row, type State, type Staff } from '../lanyard/domain/model'
import { shortlist } from '../lanyard/domain/cover'
import { addDays, dateKey, day, mondayOf } from '../lanyard/ui/format'
import { team, forecast, email, OCEAN_BEACH, type Shift } from './team'

const TZ = 'America/Los_Angeles'
/** A venue wall time ("2026-10-24", "07:00") as its UTC instant, whatever the daylight-saving offset. */
function wall(date: string, time: string): string {
 const naive = Date.parse(`${date}T${time}:00Z`)
 const offset = (at: number) => Date.parse(new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(at).replace(' ', 'T') + 'Z') - at
 return new Date(naive - offset(naive - offset(naive))).toISOString()
}
const minus = (iso: string, minutes: number) => new Date(Date.parse(iso) - minutes * 60000).toISOString()
const earlier = (a: string, b: string) => a < b ? a : b

/**
 * Tres Hornos Bakery's Ocean Beach cafe in this visit's week, in native records: the published
 * week (confirmed by everyone), Jess's Saturday call-out with the shortlist Lanyard computes,
 * Marisol's decline and Luis's accept awaiting a manager, last week's approved and exported
 * hours, this week's worked time so far, and next week's draft waiting for review.
 */
export async function seedDemo(env: Bindings, { ownerEmail, now }: { ownerEmail: string; now: Date }) {
 const db = env.DB
 const owner = await db.prepare("SELECT id FROM oa_operators WHERE email=? AND role='owner' AND status='active'").bind(ownerEmail).first<{ id: string }>()
 if (!owner) return
 // The featured week is the one whose Saturday call-out is still ahead (this week, or next once Saturday's shift is over).
 const at = now.toISOString(), current = mondayOf(dateKey(now, TZ))
 const week = at > wall(addDays(current, 5), '15:00') ? addDays(current, 7) : current, last = addDays(week, -7), earliest = addDays(week, -14), next = addDays(week, 7)
 const staff: Staff[] = [{ id: 'demo-staff-ana', name: 'Ana Reyes', email: ownerEmail, payroll_id: 'TH-1001', role: 'manager', active: 1, version: 1, erased_at: null, position: null, rate_cents: null, site: null },
  ...team.map((m, i) => ({ id: `demo-staff-${i + 1}`, name: m.name, email: email(m.name), payroll_id: `TH-${1002 + i}`, role: m.role, active: 1, version: 1, erased_at: null, position: m.position, rate_cents: m.rate, site: m.site }))]
 const s = { version: 1, timezone: TZ, staff, claims: [] } as unknown as State
 const records: { kind: Kind; row: Row }[] = []
 const add = (kind: Kind, id: string, data: Record<string, unknown>, revision = 1): Row => { const row = { ...data, id, revision } as Row; records.push({ kind, row }); (s[kind] ??= []).push(row); return row }
 for (const k of kinds) s[k] = []
 const shiftOf = (monday: string, [d, a, b, meal, label, site]: Shift, memberSite: string | null) => {
  const date = addDays(monday, d), start = wall(date, a), end = wall(date, b)
  return { start, end, breakMinutes: meal, minutes: (Date.parse(end) - Date.parse(start)) / 60000 - meal, label, site: site ?? memberSite ?? '' }
 }
 // Availability: each working day (and the days a teammate said they could cover), for last, this and next week.
 team.forEach((m, i) => {
  const days = [...new Set([...m.shifts.map(x => x[0]), ...(m.alsoAvailable ?? [])])]
  for (const monday of [earliest, last, week, next]) for (const d of days) add('availability', `demo-availability-${i}-${monday}-${d}`, { staffId: `demo-staff-${i + 1}`, start: wall(addDays(monday, d), (d === 5 && m.saturday?.[0]) || '05:00'), end: wall(addDays(monday, d), (d === 5 && m.saturday?.[1]) || '21:00') })
 })
 const published = wall(addDays(week, -5), '16:30')
 const rosters = [
  ...[earliest, last].map(monday => add('rosters', `demo-roster-${monday}`, { week: monday, timezone: TZ, status: 'published', preparedBy: owner.id, preparedAt: wall(addDays(monday, -7), '14:12'), publishedBy: owner.id, publishedAt: wall(addDays(monday, -5), '16:30') }, 2)),
  add('rosters', 'demo-roster-this', { week, timezone: TZ, status: 'published', preparedBy: owner.id, preparedAt: wall(addDays(week, -7), '14:12'), publishedBy: owner.id, publishedAt: published }, 2),
  add('rosters', 'demo-roster-next', { week: next, timezone: TZ, status: 'draft', preparedBy: owner.id, preparedAt: minus(at, 25) }, 1),
 ]
 const timesheets: Row[] = []
 team.forEach((m, i) => {
  const staffId = `demo-staff-${i + 1}`
  m.shifts.forEach((spec, n) => {
   for (const r of rosters) {
    const x = shiftOf(r.week, spec, m.site), status = r.status
    add('shifts', `demo-shift-${r.week}-${i}-${n}`, { rosterId: r.id, staffId, ...x, status, ...(status === 'published' ? { confirmedAt: wall(addDays(r.week, -5), '17:05'), confirmedBy: staffId } : {}) }, status === 'published' ? 2 : 1)
    if (status !== 'published' || x.start > at) continue
    // Worked time: phone clocks a few minutes either side of the shift; open while it is still running.
    const clockId = `demo-clock-${r.week}-${i}-${n}`, start = minus(x.start, 3), end = minus(x.end, -2)
    if (end > at) { add('clocks', clockId, { staffId, start, end: null, status: 'open', capturedBy: staffId, receivedAt: start }); continue }
    const id = crypto.randomUUID(), minutes = Math.floor((Date.parse(end) - Date.parse(start)) / 60000) - x.breakMinutes, approved = end < minus(at, 24 * 60)
    timesheets.push(add('timesheets', id, { staffId, start, end, breakMinutes: x.breakMinutes, minutes, status: approved ? 'approved' : 'submitted', reason: 'Phone clock', corrects: null, rootId: id, submittedBy: staffId, submittedAt: end, clockId, ...(approved ? { exportMinutes: minutes, approvedBy: owner.id, approvedAt: minus(end, -12 * 60) } : {}) }, approved ? 2 : 1))
    add('clocks', clockId, { staffId, start, end, status: 'closed', capturedBy: staffId, receivedAt: start, closedReceivedAt: end, timesheetId: id }, 2)
   }
  })
 })
 // Jess's Saturday: called out at 6:12 am that morning (or just now, before then), offered to everyone qualified.
 const jess = `demo-staff-${team.findIndex(m => m.name === 'Jess Morales') + 1}`, saturday = addDays(week, 5)
 const call = s.shifts.find(x => x.staffId === jess && x.rosterId === 'demo-roster-this' && dateKey(x.start, TZ) === saturday)!
 const calledAt = earlier(minus(at, 10), wall(saturday, '06:12')), sameDay = dateKey(calledAt, TZ) === saturday
 const list = shortlist(s, call), offerAt = minus(calledAt, -2)
 Object.assign(call, { revision: 3, callout: { staffId: jess, note: sameDay ? 'I can’t come in this morning.' : 'I can’t make my Saturday shift.', at: calledAt, by: jess, qualified: list.qualified, leftOut: list.leftOut } })
 const answers: Record<string, [string, number, string]> = { 'Luis Ortega': ['accepted', 9, 'I can be there by 7.'], 'Marisol Peña': ['declined', 5, sameDay ? 'No puedo hoy, lo siento.' : 'No puedo el sábado, lo siento.'] }
 for (const f of list.qualified) {
  const answer = answers[staff.find(p => p.id === f.staffId)!.name]
  add('offers', `demo-offer-${f.staffId}`, { shiftId: call.id, staffId: f.staffId, before: f.before, after: f.after, status: answer?.[0] ?? 'sent', sentAt: offerAt, ...(answer ? { note: answer[2], respondedAt: minus(calledAt, -answer[1]) } : {}) }, answer ? 2 : 1)
 }
 // Every seeded week has its sales forecast, so stepping between weeks keeps the labor footer whole.
 for (const monday of [earliest, last, week, next]) add('forecasts', `demo-forecast-ocean-beach-${monday}`, { week: monday, site: OCEAN_BEACH, days: forecast.days, budgetPercent: forecast.budgetPercent, savedBy: owner.id, savedAt: wall(addDays(monday, -4), '17:45') }, 2)
 const priya = `demo-staff-${team.findIndex(m => m.name === 'Priya Desai') + 1}`, hannah = `demo-staff-${team.findIndex(m => m.name === 'Hannah Park') + 1}`
 add('leave', 'demo-leave-priya', { staffId: priya, start: wall(addDays(next, 6), '00:00'), end: wall(addDays(next, 7), '00:00'), reason: 'Family birthday', status: 'pending', requestedBy: priya, requestedAt: minus(at, 180) })
 add('leave', 'demo-leave-hannah', { staffId: hannah, start: wall(addDays(next, 14), '00:00'), end: wall(addDays(next, 16), '00:00'), reason: 'Visiting family in Fresno', status: 'approved', requestedBy: hannah, requestedAt: wall(addDays(week, -6), '10:15'), decidedBy: owner.id, decidedAt: wall(addDays(week, -6), '11:02') }, 2)
 // The earliest week's approved hours went to payroll and the provider acknowledged them.
 const sent = timesheets.filter(t => t.status === 'approved' && dateKey(t.start, TZ) < last)
 if (sent.length) {
  const lines = sent.map(t => ({ timeId: t.id, revision: t.revision, staffId: t.staffId, payrollId: staff.find(p => p.id === t.staffId)!.payroll_id, start: t.start, end: t.end, minutes: t.minutes, corrects: null, rootId: t.rootId })), preview = csv(lines)
  add('batches', crypto.randomUUID(), { status: 'acknowledged', lines, csvPreview: preview, csv: preview, sha256: await sha(preview), preparedBy: owner.id, preparedAt: minus(at, 150), exportedBy: owner.id, exportedAt: minus(at, 120), reference: `Payroll run ${day(earliest)} – ${day(addDays(earliest, 6))}`, acknowledgedBy: owner.id, acknowledgedAt: minus(at, 60) }, 3)
 }
 const sql: D1PreparedStatement[] = [db.prepare('INSERT INTO oa_first_run(singleton,completed_by,completed_at) VALUES(1,?,?) ON CONFLICT DO NOTHING').bind(owner.id, now.getTime()), db.prepare('UPDATE l_meta SET timezone=?,version=version+1 WHERE id=1').bind(TZ)]
 for (const p of staff) sql.push(db.prepare('INSERT INTO l_staff(id,name,email,payroll_id,role,active,version,position,rate_cents,site) VALUES(?,?,?,?,?,1,1,?,?,?) ON CONFLICT DO NOTHING').bind(p.id, p.name, p.email, p.payroll_id, p.role, p.position, p.rate_cents, p.site))
 for (const { kind, row } of records) sql.push(db.prepare('INSERT INTO l_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(kind, row.id, row.revision, JSON.stringify(row)))
 for (const b of s.batches) for (const l of b.lines) sql.push(db.prepare('INSERT INTO l_payroll_claims(time_id,time_revision,batch_id,root_id,minutes) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(l.timeId, l.revision, b.id, l.rootId, l.minutes))
 await db.batch(sql)
}

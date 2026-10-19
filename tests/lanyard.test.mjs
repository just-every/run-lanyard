import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { run, harness } from './harness.mjs'

// A new installation runs on US Pacific time: 7:00 am – 3:00 pm PDT on Mon Oct 12, 2026.
const shift = staffId => ({ staffId, start: '2026-10-12T14:00:00Z', end: '2026-10-12T22:00:00Z', breakMinutes: 30, label: 'Morning service' })
const missed = staffId => ({ ...shift(staffId), label: undefined, reason: 'Forgot clock at opening' })
const timeInput = staffId => { const { label, ...p } = missed(staffId); return p }

test('native access, owner-only grants, staff isolation, CSRF and immediate revocation', () => run(async h => {
  const alex = await h.person('Alex'), sam = await h.person('Sam')
  await h.state('', 401)
  assert.deepEqual((await h.state(alex.cookie)).staff.map(s => s.id), [alex.id])
  await h.cmd('staff.save', { name: 'Bad' }, alex.cookie, 403)
  await h.cmd('time.approve', { id: 'anything', revision: 1 }, sam.cookie, 403)
  await h.cmd('availability.save', { ...shift(alex.id) }, alex.cookie, 400)
  const cross = await h.send('/api/lanyard/command', { name: 'staff.erase', input: { id: alex.id, revision: 1 } }, h.owner, { origin: 'https://evil.example' })
  assert.equal(cross.status, 403)
  await h.cmd('staff.save', { id: alex.id, revision: 1, name: 'Alex', email: alex.email, payrollId: 'ALEX', role: 'staff', active: false })
  await h.state(alex.cookie, 403)
  await h.cmd('staff.erase', { id: sam.id, revision: 1 }, h.owner, 409)
}))

test('availability, approved leave, conflicts, exact roster publication and personal confirmation', () => run(async h => {
  const alex = await h.person('Alex'), manager = await h.person('Priya', 'manager')
  await h.cmd('availability.save', { start: '2026-10-11T23:00:00Z', end: '2026-10-19T00:00:00Z' }, alex.cookie)
  const leave = await h.cmd('leave.request', { start: '2026-10-13T00:00:00Z', end: '2026-10-14T00:00:00Z', reason: 'Family day' }, alex.cookie)
  await h.cmd('leave.decide', { id: leave.id, revision: 1, decision: 'approved' }, alex.cookie, 403)
  await h.cmd('leave.decide', { id: leave.id, revision: 1, decision: 'approved' }, manager.cookie)
  const bad = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [{ ...shift(alex.id), start: '2026-10-13T00:00:00Z', end: '2026-10-13T08:00:00Z' }] })
  assert.ok(bad.conflicts.length)
  await h.cmd('roster.publish', { id: bad.id, revision: bad.revision }, h.owner, 409)
  const good = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [shift(alex.id)] })
  await h.cmd('roster.publish', { id: good.id, revision: bad.revision }, manager.cookie, 409)
  await h.cmd('roster.publish', { id: good.id, revision: good.revision }, manager.cookie)
  await h.cmd('settings.save', { timezone: 'America/Chicago' }, h.owner, 409)
  const visible = (await h.state(alex.cookie)).shifts
  assert.equal(visible.length, 1)
  await h.cmd('shift.confirm', { id: visible[0].id, revision: visible[0].revision }, alex.cookie)
  assert.ok((await h.state()).events.some(e => e.action === 'roster.publish' && e.actorRole === 'manager'))
}))

test('a call-out is offered to qualified teammates within overtime, and a manager approves one accept onto the shift', () => run(async h => {
  const team = { position: 'Baristas and counter', hourlyRate: '19.00', site: 'Ocean Beach' }
  const jess = await h.person('Jess'), luis = await h.person('Luis'), andrea = await h.person('Andrea')
  for (const p of [jess, luis, andrea]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: 'staff', active: true, ...team })
  // Saturday Oct 24, 2026, 7:00 am – 3:00 pm PDT; Andrea already has 36.0 hours that week.
  const sat = { start: '2026-10-24T14:00:00Z', end: '2026-10-24T22:00:00Z', breakMinutes: 30, label: 'Barista' }
  const days = [19, 20, 21, 22].map(d => ({ staffId: andrea.id, start: `2026-10-${d}T14:00:00Z`, end: `2026-10-${d}T23:30:00Z`, breakMinutes: 30 }))
  for (const p of [jess, luis, andrea]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-19T07:00:00Z', end: '2026-10-26T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-19', shifts: [{ staffId: jess.id, ...sat }, ...days] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision })
  const same = x => Date.parse(x.start) === Date.parse(sat.start), called = (await h.state(jess.cookie)).shifts.find(same)
  await h.cmd('shift.callout', { id: called.id, revision: called.revision, note: 'I can’t come in this morning.' }, luis.cookie, 403)
  const { shift, offers } = await h.cmd('shift.callout', { id: called.id, revision: called.revision, note: 'I can’t come in this morning.' }, jess.cookie)
  assert.deepEqual(shift.callout.qualified.map(f => [f.staffId, f.before, f.after]), [[luis.id, 0, 450]])
  assert.deepEqual(shift.callout.leftOut.map(f => [f.staffId, f.reason, f.after]), [[andrea.id, 'overtime', 2610]])
  const offer = (await h.state(luis.cookie)).offers[0]
  assert.equal(offer.id, offers[0].id)
  await h.cmd('cover.approve', { id: offer.id, revision: offer.revision }, h.owner, 409)
  const yes = await h.cmd('cover.respond', { id: offer.id, revision: offer.revision, decision: 'accepted', note: 'I can be there by 7.' }, luis.cookie)
  await h.cmd('cover.approve', { id: yes.id, revision: yes.revision }, jess.cookie, 403)
  const moved = await h.cmd('cover.approve', { id: yes.id, revision: yes.revision })
  assert.equal(moved.staffId, luis.id); assert.equal(moved.callout.coveredBy, luis.id)
  assert.ok(!(await h.state(jess.cookie)).shifts.some(x => x.staffId === jess.id && same(x)))
  await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
  assert.equal((await h.send('/app/schedule?week=2026-10-19&site=Ocean%20Beach', undefined, h.owner)).status, 200)
  const old = await h.send('/app/roster?week=2026-10-19', undefined, h.owner)
  assert.equal(old.status, 301); assert.equal(old.headers.get('location'), '/app/schedule?week=2026-10-19')
}))

test('clock retry commits once and binds capture identity to body and person', () => run(async h => {
  const alex = await h.person('Alex'), sam = await h.person('Sam')
  const input = { commandId: crypto.randomUUID(), capturedAt: '2026-10-12T00:00:00Z' }
  const first = await h.cmd('clock.in', input, alex.cookie)
  assert.deepEqual(await h.cmd('clock.in', input, alex.cookie), first)
  await h.cmd('clock.in', { ...input, capturedAt: '2026-10-12T01:00:00Z' }, alex.cookie, 409)
  await h.cmd('clock.in', input, sam.cookie, 409)
  const out = { commandId: crypto.randomUUID(), capturedAt: '2026-10-12T08:00:00Z', breakMinutes: 30 }
  const stopped = await h.cmd('clock.out', out, alex.cookie)
  assert.deepEqual(await h.cmd('clock.out', out, alex.cookie), stopped)
  assert.equal((await h.state()).timesheets.length, 1)
  assert.equal(stopped.timesheet.minutes, 450)
  await h.cmd('time.approve', { id: stopped.timesheet.id, revision: 1 }, alex.cookie, 403)
  await h.cmd('time.approve', { id: stopped.timesheet.id, revision: 1 })
}))

test('AUDIT-001 and PAYROLL-001: each roster-to-payroll decision keeps actor, role, subject and time; a stale concurrent export leaves no orphan event or claim; payroll claims once with immutable downloads and signed correction delta', () => run(async h => {
  const alex = await h.person('Alex'), manager = await h.person('Priya', 'manager')
  await h.cmd('availability.save', { staffId: alex.id, start: '2026-10-12T07:00:00Z', end: '2026-10-19T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [shift(alex.id)] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, manager.cookie)
  const submitted = await h.cmd('time.prepare', timeInput(alex.id))
  const approved = await h.cmd('time.approve', { id: submitted.id, revision: 1 }, manager.cookie)
  // Two reviewed batches claim the same approved time at once: exactly one commits its claim and event.
  const drafts = [await h.cmd('payroll.prepare', {}), await h.cmd('payroll.prepare', {})]
  const raced = await Promise.all(drafts.map(b => h.send('/api/lanyard/command', { name: 'payroll.export', input: { id: b.id, revision: b.revision } }, h.owner)))
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 409])
  const exported = raced.find(r => r.status === 200).value.result, batch = { id: exported.id }
  assert.deepEqual((await h.db.prepare('SELECT DISTINCT batch_id FROM l_payroll_claims').all()).results.map(r => r.batch_id), [batch.id])
  assert.deepEqual((await h.state()).events.filter(e => e.action === 'payroll.export').map(e => e.entityId), [batch.id])
  assert.equal((await h.state()).batches.find(b => b.id !== batch.id).status, 'draft')
  const path = `/api/lanyard/batches/${batch.id}.csv`
  const a = await h.send(path, undefined, h.owner), b = await h.send(path, undefined, h.owner)
  assert.equal(a.text, b.text); assert.match(a.text, /450,7\.5000/)
  assert.equal((await h.send(path, undefined, alex.cookie)).status, 403)
  await h.cmd('payroll.acknowledge', { id: batch.id, revision: exported.revision, reference: 'Payroll-import-101' })
  const corrected = await h.cmd('time.prepare', { ...timeInput(alex.id), breakMinutes: 45, corrects: approved.id, reason: 'Break correction agreed with Alex' })
  const correction = await h.cmd('time.approve', { id: corrected.id, revision: 1 })
  assert.equal(correction.exportMinutes, -15)
  const adjustment = await h.cmd('payroll.prepare', {}), done = await h.cmd('payroll.export', { id: adjustment.id, revision: 1 })
  assert.match(done.csv, /-15,-0\.2500/)
  assert.equal((await h.send(path, undefined, h.owner)).text, a.text)
  assert.equal((await h.state()).timesheets.find(t => t.id === approved.id).status, 'superseded')
  const events = (await h.state()).events
  for (const [action, role, entityId] of [['roster.publish', 'manager', week.id], ['time.approve', 'manager', approved.id], ['payroll.export', 'owner', batch.id], ['payroll.download', 'owner', batch.id], ['payroll.acknowledge', 'owner', batch.id], ['time.approve', 'owner', corrected.id]])
    assert.ok(events.some(e => e.action === action && e.actorRole === role && e.entityId === entityId && e.actorId && !Number.isNaN(Date.parse(e.at))), `${action} by ${role}`)
  assert.equal(events.find(e => e.action === 'time.approve' && e.entityId === approved.id).actorId, approved.approvedBy)
  // Management activity is role-scoped: staff read none of it.
  assert.deepEqual((await h.state(alex.cookie)).events, [])
  assert.deepEqual((await h.state(manager.cookie)).events.map(e => e.id), events.map(e => e.id))
}))

test('agent prepares drafts but cannot approve through any human or agent door; key revocation is immediate', () => run(async h => {
  const alex = await h.person('Alex'), key = await h.cmd('agent.create', { label: 'Roster assistant' }), headers = { authorization: `Bearer ${key.token}` }
  const agent = (name, input) => h.send('/api/lanyard/agent/command', { name, input }, '', headers)
  const context = await h.send('/api/lanyard/agent/context', undefined, '', headers)
  assert.equal(context.status, 200); assert.equal(context.value.staff[0].email, undefined)
  const draft = await agent('time.prepare', timeInput(alex.id)); assert.equal(draft.status, 200)
  assert.equal((await agent('time.approve', { id: draft.value.result.id, revision: 1 })).status, 403)
  assert.equal((await h.send('/api/lanyard/command', { name: 'time.approve', input: { id: draft.value.result.id, revision: 1 } }, '', headers)).status, 401)
  await h.cmd('time.approve', { id: draft.value.result.id, revision: 1 })
  await h.cmd('agent.revoke', { id: key.id })
  assert.equal((await agent('payroll.prepare', {})).status, 401)
}))

test('staff CSV dry run, exact reviewed apply, original journal, undo and native edit preservation; AUDIT-001 import actions keep actor, role, subject and time', () => run(async h => {
  const csv = await readFile('tests/fixtures/staff.csv', 'utf8')
  const preview = await h.cmd('import.preview', { csv })
  assert.equal((await h.state()).staff.length, 0)
  await h.cmd('import.apply', { csv: csv.replace('Alex', 'Alec'), fingerprint: preview.fingerprint }, h.owner, 409)
  const applied = await h.cmd('import.apply', { csv, fingerprint: preview.fingerprint })
  assert.equal(applied.job.state, 'completed')
  const staff = (await h.state()).staff; assert.ok(staff.length > 0); assert.ok(staff.every(s => !s.active))
  const journal = await h.cmd('import.journal', { jobId: applied.job.id }); assert.ok(journal.originals.length)
  await h.cmd('staff.save', { id: staff[0].id, revision: staff[0].revision, name: 'Edited by owner', email: staff[0].email, payrollId: staff[0].payrollId, role: 'staff', active: false })
  await h.cmd('import.undo', { jobId: applied.job.id })
  const after = (await h.state()).staff; assert.equal(after.length, 1); assert.equal(after[0].name, 'Edited by owner')
  const events = (await h.state()).events, audit = action => events.filter(e => e.action === action && e.actorRole === 'owner' && e.at).map(e => e.entityId).sort()
  assert.deepEqual(audit('import.apply'), staff.map(s => s.id).sort())
  assert.deepEqual(audit('import.undo'), staff.filter(s => s.id !== after[0].id).map(s => s.id))
  await h.cmd('staff.erase', { id: after[0].id, revision: after[0].revision }, h.owner, 409)
}))

test('unused identity erasure removes personal values and fences recreation; used identities remain retained', () => run(async h => {
  const p = { name: 'Never joined', email: 'unused@venue.example', payrollId: 'UNUSED', role: 'staff', active: false }
  const staff = await h.cmd('staff.save', p)
  await h.cmd('staff.erase', { id: staff.id, revision: 1 })
  const s = await h.state(); assert.ok(!JSON.stringify(s).includes(p.email)); assert.ok(!JSON.stringify(s).includes(p.name))
  assert.ok(s.events.some(e => e.action === 'staff.erase' && e.entityId === staff.id && e.actorRole === 'owner' && e.at), 'AUDIT-001 erasure keeps actor, role, subject and time')
  await h.cmd('staff.save', p, h.owner, 409)
  const csv = 'staff_id,name,email,payroll_id\nunused,Unused,unused@venue.example,UNUSED\n'
  const preview = await h.cmd('import.preview', { csv })
  await h.cmd('import.apply', { csv, fingerprint: preview.fingerprint }, h.owner, 409)
}))

// The public state changes at owner claim, before the separate first-run review.
test('installed Lobby follows the durable owner claim before first-run confirmation', async () => {
  const h = await harness({ unclaimed: true })
  try {
    assert.equal((await h.send('/setup/state')).value.state, 'unclaimed')
    const before = await h.send('/')
    assert.equal(before.status, 200)
    assert.equal(before.headers.get('x-rer-document'), 'lobby')
    assert.ok(before.text.includes('href="/setup"'))
    const claimed = await h.send('/auth/bootstrap', { token: h.auth.SETUP_TOKEN, displayName: 'Venue owner' })
    assert.equal(claimed.status, 303)
    assert.equal((await h.send('/setup/state')).value.state, 'claimed')
    const after = await h.send('/')
    assert.match(after.text, /href="\/signin(\?login_hint=[^"]+)?"/)
    assert.equal((await h.send('/setup', undefined, claimed.cookie)).status, 200)
    const confirmed = await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: claimed.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
    assert.equal(confirmed.status, 303)
    assert.equal((await h.send('/setup/state')).value.state, 'claimed')
  } finally { await h.close() }
})

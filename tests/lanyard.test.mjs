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

test('ROSTER-004: staff see their cafe’s published team by name, position and times only; a manager narrows a cafe to own position and hides a person', () => run(async h => {
  const place = (p, site, position) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site, hourlyRate: '21.00' })
  const alex = await h.person('Alex'), sam = await h.person('Sam'), kim = await h.person('Kim'), lee = await h.person('Lee'), manager = await h.person('Priya', 'manager')
  await place(alex, 'Ocean Beach', 'Barista'); await place(sam, 'Ocean Beach', 'Barista'); await place(kim, 'Ocean Beach', 'Kitchen'); await place(lee, 'North Park', 'Barista')
  for (const p of [alex, sam, kim, lee]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-11T23:00:00Z', end: '2026-10-19T00:00:00Z' })
  // Mon Alex, Tue Sam, Wed Kim at Ocean Beach; Mon Lee at North Park. Next week's Sam shift stays a draft.
  const on = (p, d) => ({ ...shift(p.id), start: `2026-10-${d}T14:00:00Z`, end: `2026-10-${d}T22:00:00Z` })
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [on(alex, 12), on(sam, 13), on(kim, 14), on(lee, 12)] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, manager.cookie)
  const draft = await h.cmd('roster.prepare', { week: '2026-10-19', shifts: [on(sam, 20)] })
  const view = async p => { const s = await h.state(p.cookie); return { s, text: JSON.stringify(s), names: s.team.shifts.map(x => x.name) } }
  const before = await view(alex)
  assert.equal(before.s.team.scope, 'site'); assert.deepEqual(before.names, ['Alex', 'Sam', 'Kim'])
  assert.ok(before.s.team.shifts.every(x => Object.keys(x).sort().join() === 'end,name,position,start'))
  assert.deepEqual(before.s.team.shifts.map(x => x.position), ['Barista', 'Barista', 'Kitchen'])
  // Drafts, wages, contact details, who is hidden and another cafe's shifts stay out of the staff state.
  for (const secret of [draft.id, sam.email, kim.email, lee.id, lee.email, 'North Park', 'hourlyRateCents', 'rate_cents']) assert.ok(!before.text.includes(secret), secret)
  assert.deepEqual(before.s.teamviews, [])
  assert.deepEqual((await view(lee)).names, ['Lee'])
  const page = await h.send('/app/schedule?week=2026-10-12', undefined, alex.cookie)
  assert.match(page.text, /Who’s working/); assert.match(page.text, /Kim/); assert.ok(!page.text.includes(lee.email))
  // Staff cannot change it; a manager narrows Ocean Beach to own position and hides Sam through the People form.
  await h.cmd('team.visibility', { site: 'Ocean Beach', scope: 'position' }, alex.cookie, 403)
  const form = await h.mf.dispatchFetch(h.origin + '/app/action?name=team.visibility&returnTo=%2Fapp%2Fpeople', { method: 'POST', headers: { origin: h.origin, cookie: manager.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams([['site', 'Ocean Beach'], ['scope', 'position'], ['hidden', sam.id]]).toString(), redirect: 'manual' })
  assert.equal(form.status, 200); assert.match(await form.text(), /Saved\./)
  const rule = (await h.state(manager.cookie)).teamviews.find(v => v.site === 'Ocean Beach')
  assert.deepEqual([rule.scope, rule.hidden], ['position', [sam.id]])
  await h.cmd('team.visibility', { site: 'Ocean Beach', scope: 'site', revision: rule.revision + 1 }, manager.cookie, 409)
  const people = await h.send('/app/people?site=Ocean%20Beach', undefined, manager.cookie)
  assert.match(people.text, new RegExp(`value="${sam.id}" checked`))
  const after = await view(alex)
  assert.equal(after.s.team.scope, 'position'); assert.deepEqual(after.names, ['Alex'])
  assert.deepEqual((await view(kim)).names, ['Kim'])
  assert.deepEqual((await view(sam)).names, ['Alex'])
  assert.deepEqual((await view(lee)).names, ['Lee'])
}))

test('TIME-008: a manager filters a 60-person week to clean timesheets and approves the shown revisions at once; changed, own, foreign-cafe and unfiltered items are skipped with reasons', () => run(async h => {
  const place = (p, site) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site })
  const clocked = async (p, d) => {
    await h.cmd('clock.in', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T14:00:00Z` }, p.cookie)
    return (await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T22:00:00Z`, breakMinutes: 30 }, p.cookie)).timesheet
  }
  // 60 people: 28 clock on their phones (Base allows 30 invitations per address in 15 minutes); a manager entered the other 32's time.
  const priya = await h.person('Priya', 'manager'), morgan = await h.person('Morgan', 'manager'), lee = await h.person('Lee')
  const team = []; for (let i = 0; i < 25; i++) team.push(await h.person(`Barista${i}`))
  for (const p of [priya, morgan, ...team]) await place(p, 'Ocean Beach')
  await place(lee, 'North Park')
  const entered = []
  for (let i = 0; i < 32; i++) {
    const p = await h.cmd('staff.save', { name: `Counter ${i}`, email: `counter${i}@venue.example`, payrollId: `C${i}`, role: 'staff', active: true, position: 'Barista', site: 'Ocean Beach' })
    entered.push(await h.cmd('time.prepare', { staffId: p.id, start: `2026-10-${12 + (i % 7)}T14:00:00Z`, end: `2026-10-${12 + (i % 7)}T18:00:00Z`, breakMinutes: 0, reason: 'Missed clock-in' }))
  }
  const sheets = []; for (const [i, p] of team.entries()) sheets.push(await clocked(p, 12 + (i % 7)))
  const own = await clocked(priya, 13), foreign = await clocked(lee, 13), cover = await clocked(morgan, 14)
  // Priya filters Ocean Beach to clean time: 26 of the 59 waiting (not her own, not North Park, not the hand-entered time).
  const page = await h.send('/app/time?week=2026-10-12&cafe=Ocean%20Beach&state=clean', undefined, priya.cookie)
  assert.match(page.text, /Approve 26 shown/); assert.match(page.text, /26 of 59 waiting/)
  const pins = JSON.parse(page.text.match(/name="items" value="([^"]+)"/)[1].replaceAll('&quot;', '"'))
  assert.deepEqual(pins.map(x => x.id).sort(), [...sheets, cover].map(t => t.id).sort())
  // Before she submits, Morgan decides one included timesheet on his own.
  await h.cmd('time.approve', { id: sheets[5].id, revision: 1 }, morgan.cookie)
  const items = [...pins, { id: own.id, revision: 1 }, { id: foreign.id, revision: 1 }, { id: entered[0].id, revision: 1 }]
  const body = new URLSearchParams({ site: 'Ocean Beach', position: '', from: '', to: '', state: 'clean', items: JSON.stringify(items) })
  const posted = await h.mf.dispatchFetch(h.origin + '/app/action?name=time.approveMany&returnTo=' + encodeURIComponent('/app/time?cafe=Ocean Beach&state=clean'), { method: 'POST', headers: { origin: h.origin, cookie: priya.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(), redirect: 'manual' })
  const html = await posted.text()
  assert.equal(posted.status, 200, html); assert.match(html, /Approved 25 · skipped 4/)
  for (const reason of ['Changed since you reviewed it', 'Your own time', 'Outside the filter']) assert.ok(html.includes(reason), reason)
  const s = await h.state(), byId = new Map(s.timesheets.map(t => [t.id, t])), me = (await h.state(priya.cookie)).actor.id
  const approved = [...sheets.filter((_, i) => i !== 5), cover].map(t => t.id)
  for (const id of approved) { const t = byId.get(id); assert.deepEqual([t.status, t.revision, t.approvedBy], ['approved', 2, me]) }
  assert.equal(byId.get(sheets[5].id).approvedBy, (await h.state(morgan.cookie)).actor.id)
  for (const t of [own, foreign, ...entered]) assert.deepEqual([byId.get(t.id).status, byId.get(t.id).revision], ['submitted', 1])
  // Audit: one time.approve decision by Priya per approved revision, at the approval time, and nothing for the skipped ones.
  const decisions = s.events.filter(e => e.action === 'time.approve' && e.actorId === me)
  assert.deepEqual(decisions.map(e => e.entityId).sort(), [...approved].sort())
  assert.ok(decisions.every(e => e.actorRole === 'manager' && e.at === byId.get(e.entityId).approvedAt))
  await h.cmd('time.approveMany', { state: 'clean', items: [{ id: own.id, revision: 1 }] }, team[1].cookie, 403)
}))

test('TIME-006 and TIME-008: an early clock-in is refused with its opening time or flagged, a clock-in without a shift is refused, flagged pending approval or allowed for a listed position, and flagged time is skipped by bulk approval until a manager approves it', () => run(async h => {
  const place = (p, position) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site: 'Ocean Beach' })
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager')
  await place(alex, 'Barista'); await place(priya, 'Manager')
  await h.cmd('availability.save', { staffId: alex.id, start: '2026-10-12T07:00:00Z', end: '2026-10-13T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [shift(alex.id)] }) // Mon 7:00 am – 3:00 pm PDT
  await h.cmd('roster.publish', { id: week.id, revision: week.revision })
  const punch = (p, name, capturedAt, extra = {}) => h.send('/api/lanyard/command', { name, input: { commandId: crypto.randomUUID(), capturedAt, ...extra } }, p.cookie)
  const rule = await h.cmd('clockrule.save', { site: 'Ocean Beach', position: '', early: 'refuse', earlyMinutes: 10, unscheduled: 'refuse' })
  await h.cmd('clockrule.save', { site: 'Ocean Beach', position: 'Manager', early: 'any', unscheduled: 'allow' })
  await h.cmd('clockrule.save', { site: 'Ocean Beach', position: '', early: 'flag', earlyMinutes: 10, unscheduled: 'pending' }, priya.cookie, 403)
  // 25 minutes early with a 10-minute window: refused, naming when clock-in opens; no shift: refused.
  const early = await punch(alex, 'clock.in', '2026-10-12T13:35:00Z')
  assert.equal(early.status, 409); assert.match(early.value.error, /opens at 6:50 am, 10 minutes before your 7:00 am shift/)
  const none = await punch(alex, 'clock.in', '2026-10-13T15:00:00Z')
  assert.equal(none.status, 409); assert.match(none.value.error, /No scheduled shift/)
  // The Manager position's own rule allows a clock-in without a shift, unflagged.
  assert.equal((await punch(priya, 'clock.in', '2026-10-13T15:00:00Z')).status, 200)
  const managers = (await punch(priya, 'clock.out', '2026-10-13T19:00:00Z', { breakMinutes: 0 })).value.result.timesheet
  assert.equal(managers.exceptions, undefined)
  // Switch the cafe to flag mode (exact revision) and repeat: accepted and flagged, then a pending unscheduled punch.
  await h.cmd('clockrule.save', { site: 'Ocean Beach', position: '', revision: rule.revision + 1, early: 'flag', earlyMinutes: 10, unscheduled: 'pending' }, h.owner, 409)
  await h.cmd('clockrule.save', { site: 'Ocean Beach', position: '', revision: rule.revision, early: 'flag', earlyMinutes: 10, unscheduled: 'pending' })
  assert.equal((await punch(alex, 'clock.in', '2026-10-12T13:35:00Z')).status, 200)
  const flagged = (await punch(alex, 'clock.out', '2026-10-12T22:00:00Z', { breakMinutes: 30 })).value.result.timesheet
  assert.equal((await punch(alex, 'clock.in', '2026-10-13T15:00:00Z')).status, 200)
  const unscheduled = (await punch(alex, 'clock.out', '2026-10-13T19:00:00Z', { breakMinutes: 0 })).value.result.timesheet
  assert.deepEqual([flagged.exceptions, flagged.start, flagged.minutes], [['early clock-in'], '2026-10-12T13:35:00.000Z', 475])
  assert.deepEqual(unscheduled.exceptions, ['unscheduled punch'])
  const page = await h.send('/app/time?week=2026-10-12', undefined, priya.cookie)
  assert.match(page.text, /Flagged: early clock-in/); assert.match(page.text, /Flagged: unscheduled punch/)
  // Bulk approval skips flagged time and names the exception; nothing is payable yet.
  const bulk = await h.cmd('time.approveMany', { items: [{ id: flagged.id, revision: 1 }, { id: unscheduled.id, revision: 1 }] }, priya.cookie)
  assert.deepEqual(bulk.approved, []); assert.deepEqual(bulk.skipped.map(x => x.reason), ['Exception: early clock-in', 'Exception: unscheduled punch'])
  await h.cmd('payroll.prepare', { ids: [flagged.id] }, h.owner, 409)
  // A manager approves the early time (it counts as worked) and corrects the unscheduled punch with a reason.
  assert.equal((await h.cmd('time.approve', { id: flagged.id, revision: 1 }, priya.cookie)).exportMinutes, 475)
  const kept = await h.cmd('time.approve', { id: unscheduled.id, revision: 1 }, priya.cookie)
  const fixed = await h.cmd('time.prepare', { staffId: alex.id, start: '2026-10-13T15:00:00Z', end: '2026-10-13T18:00:00Z', breakMinutes: 0, corrects: kept.id, reason: 'Unscheduled cover: left at 11 am' }, priya.cookie)
  await h.cmd('time.approve', { id: fixed.id, revision: 1 }, priya.cookie)
  const batch = await h.cmd('payroll.prepare', {}, h.owner)
  assert.deepEqual(batch.lines.filter(l => l.staffId === alex.id).map(l => [l.timeId, l.minutes]), [[flagged.id, 475], [fixed.id, 180]])
  const s = await h.state()
  assert.deepEqual(s.clocks.filter(c => c.staffId === alex.id).map(c => c.start).sort(), ['2026-10-12T13:35:00.000Z', '2026-10-13T15:00:00.000Z'])
  assert.deepEqual([s.timesheets.find(t => t.id === unscheduled.id).status, s.timesheets.find(t => t.id === unscheduled.id).end], ['superseded', '2026-10-13T19:00:00.000Z'])
}))

test('LEAVE-002: a holiday blackout refuses requests, a two-server limit routes the third approval to an override with a reason, and the team leave calendar and allowed dates show it to managers and staff', () => run(async h => {
  const place = (p, position) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site: 'Ocean Beach' })
  const priya = await h.person('Priya', 'manager'), servers = [], eve = await h.person('Eve')
  for (const n of ['Ana', 'Ben', 'Cal', 'Dee']) { const p = await h.person(n); await place(p, 'Server'); servers.push(p) }
  await place(eve, 'Barista')
  const [ana, ben, cal, dee] = servers
  // Dates 40 and 47 days out, 5 am – 1 pm venue time, so the test never ages out.
  const date = days => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10), day = date(40), holiday = date(47)
  const off = (p, d, status = 200) => h.cmd('leave.request', { start: `${d}T12:00:00Z`, end: `${d}T20:00:00Z`, reason: 'Family' }, p.cookie, status)
  await h.cmd('leaverule.save', { kind: 'limit', position: 'Server', max: 2, mode: 'override' }, ana.cookie, 403)
  await h.cmd('leaverule.save', { kind: 'blackout', label: 'Holiday', from: holiday, to: holiday, mode: 'refuse' }, priya.cookie)
  await h.cmd('leaverule.save', { kind: 'limit', position: 'Server', max: 2, mode: 'override' }, priya.cookie)
  const [a, b, c] = [await off(ana, day), await off(ben, day), await off(cal, day)]
  const refused = await h.send('/api/lanyard/command', { name: 'leave.request', input: { start: `${holiday}T12:00:00Z`, end: `${holiday}T20:00:00Z`, reason: 'Trip' } }, dee.cookie)
  assert.equal(refused.status, 409); assert.match(refused.value.error, /Inside the Holiday blackout/)
  await h.cmd('leave.decide', { id: a.id, revision: 1, decision: 'approved' }, priya.cookie)
  await h.cmd('leave.decide', { id: b.id, revision: 1, decision: 'approved' }, priya.cookie)
  const over = await h.send('/api/lanyard/command', { name: 'leave.decide', input: { id: c.id, revision: 1, decision: 'approved' } }, priya.cookie)
  assert.equal(over.status, 409); assert.match(over.value.error, /2 Server already off on .*Approve with an override reason/)
  const third = await h.cmd('leave.decide', { id: c.id, revision: 1, decision: 'approved', override: 'Ana and Ben swapped coverage for the rush' }, priya.cookie)
  assert.equal(third.override.reason, 'Ana and Ben swapped coverage for the rush'); assert.equal(third.override.by, (await h.state(priya.cookie)).actor.id)
  // Now full: Dee's request is routed (flagged) for an override; a barista is outside the server limit.
  const routed = await off(dee, day)
  assert.match(routed.flags[0], /2 Server already off/)
  assert.equal((await off(eve, day)).flags, undefined)
  // Staff see the dates they cannot take, never who is off.
  const mine = await h.state(dee.cookie)
  assert.deepEqual(mine.leaveDates.closed.map(x => [x.label, x.from, x.mode]), [['Holiday', holiday, 'refuse']]); assert.deepEqual(mine.leaveDates.full, [day])
  for (const other of [ana.id, ben.id, cal.id, a.id]) assert.ok(!JSON.stringify(mine).includes(other))
  const week = (() => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) })()
  const staffPage = await h.send(`/app/schedule?week=${week}`, undefined, dee.cookie)
  assert.match(staffPage.text, /Time off is limited on these dates/); assert.match(staffPage.text, /Already full/); assert.ok(!staffPage.text.includes('Team leave calendar'))
  const managerPage = await h.send(`/app/schedule?week=${week}`, undefined, priya.cookie)
  const start = managerPage.text.indexOf('id="leave-calendar"'), calendar = managerPage.text.slice(start, managerPage.text.indexOf('</section>', start))
  for (const n of ['Ana', 'Ben', 'Cal']) assert.ok(calendar.includes(`${n} <span class="status positive">approved</span>`), n)
  for (const n of ['Dee', 'Eve']) assert.ok(calendar.includes(`${n} <span class="status neutral">pending</span>`), n)
  assert.match(managerPage.text, /Override: Ana and Ben swapped coverage/); assert.match(managerPage.text, /Needs an override: 2 Server already off/)
}))

test('SCHEDULE-005: a manager prints cafe and employee PDFs stamped with the revision, opens the wall display, and a later change moves the wall and marks both copies superseded; pay and leave reasons never print', () => run(async h => {
  const place = (p, position, site) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site, hourlyRate: '21.75' })
  const alex = await h.person('Alex'), sam = await h.person('Sam'), lee = await h.person('Lee'), priya = await h.person('Priya', 'manager')
  await place(alex, 'Barista', 'Ocean Beach'); await place(sam, 'Kitchen', 'Ocean Beach'); await place(lee, 'Barista', 'North Park')
  for (const p of [alex, sam, lee]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-12T07:00:00Z', end: '2026-10-19T07:00:00Z' })
  const leave = await h.cmd('leave.request', { start: '2026-10-18T15:00:00Z', end: '2026-10-18T20:00:00Z', reason: 'Dentist appointment' }, alex.cookie)
  await h.cmd('leave.decide', { id: leave.id, revision: 1, decision: 'approved' }, priya.cookie)
  const on = (p, d, from = 14) => ({ staffId: p.id, start: `2026-10-${d}T${from}:00:00Z`, end: `2026-10-${d}T${from + 8}:00:00Z`, breakMinutes: 30, label: 'Opening' })
  const first = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [on(alex, 12), on(sam, 13), on(lee, 12)] })
  await h.cmd('roster.publish', { id: first.id, revision: first.revision }, priya.cookie)
  // The cafe copy through the print form, the employee copy through the command door.
  const form = await h.mf.dispatchFetch(h.origin + '/app/action?name=schedule.post&returnTo=' + encodeURIComponent('/app/schedule?week=2026-10-12'), { method: 'POST', headers: { origin: h.origin, cookie: priya.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ week: '2026-10-12', site: 'Ocean Beach', position: '', staffId: '' }).toString() })
  const formHtml = await form.text(); assert.equal(form.status, 200, formHtml); assert.match(formHtml, /Download the PDF/)
  const own = await h.cmd('schedule.post', { week: '2026-10-12', staffId: alex.id }, priya.cookie)
  await h.cmd('schedule.post', { week: '2026-10-12', site: 'Ocean Beach' }, alex.cookie, 403)
  const site = (await h.state(priya.cookie)).postings.find(p => p.id !== own.id)
  const download = async (id, cookie = priya.cookie) => { const r = await h.mf.dispatchFetch(`${h.origin}/api/lanyard/postings/${id}.pdf`, { headers: { cookie } }); return { status: r.status, type: r.headers.get('content-type'), bytes: Buffer.from(await r.arrayBuffer()) } }
  const sitePdf = await download(site.id), ownPdf = await download(own.id)
  assert.equal(sitePdf.type, 'application/pdf'); assert.equal(sitePdf.bytes.subarray(0, 8).toString(), '%PDF-1.4')
  const text = b => b.toString('latin1')
  for (const pdf of [sitePdf, ownPdf]) assert.match(text(pdf.bytes), /published revision 1,/)
  assert.match(text(sitePdf.bytes), /\(Alex\)/); assert.match(text(sitePdf.bytes), /\(Sam\)/); assert.ok(!text(sitePdf.bytes).includes('(Lee)'))
  assert.match(text(ownPdf.bytes), /\(Alex\)/); assert.ok(!text(ownPdf.bytes).includes('(Sam)'))
  assert.equal((await download(site.id, alex.cookie)).status, 403)
  // The wall display shows this revision, read-only, for managers.
  const wall = async () => (await h.send('/app/wall?site=Ocean%20Beach&week=2026-10-12', undefined, priya.cookie)).text
  const before = await wall()
  assert.match(before, /data-wall-revision="1"/); assert.match(before, /http-equiv="refresh" content="60"/); assert.ok(!before.includes('<form') && !before.includes('Lee'))
  assert.equal((await h.send('/app/wall?site=Ocean%20Beach', undefined, alex.cookie)).status, 403)
  // Change Alex's shift: the wall moves to the new revision; both printed copies keep the old one and show superseded.
  const second = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [on(alex, 12, 15), on(sam, 13), on(lee, 12)] })
  await h.cmd('roster.publish', { id: second.id, revision: second.revision }, priya.cookie)
  assert.match(await wall(), /data-wall-revision="2"/)
  assert.deepEqual((await download(site.id)).bytes, sitePdf.bytes)
  const page = await h.send('/app/schedule?week=2026-10-12', undefined, priya.cookie)
  assert.equal(page.text.match(/Superseded [A-Z][a-z]{2} [A-Z][a-z]{2} \d+, \d+:\d\d [ap]m/g)?.length, 2)
  // Pay, contact details and time-off reasons are in no output.
  for (const out of [text(sitePdf.bytes), text(ownPdf.bytes), before]) for (const secret of ['21.75', 'Dentist', alex.email]) assert.ok(!out.includes(secret), secret)
}))

test('BREAK-002: a 30-minute automatic meal deduction is confirmed at clock-out, reversed with an exception when the meal is reported missed, and flagged when left unconfirmed', () => run(async h => {
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager')
  for (const p of [alex, priya]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site: 'Ocean Beach' })
  await h.cmd('mealrule.save', { site: 'Ocean Beach', afterMinutes: 360, deductMinutes: 30, enabled: true }, priya.cookie, 403)
  await h.cmd('mealrule.save', { site: 'Ocean Beach', afterMinutes: 360, deductMinutes: 30, enabled: true })
  const work = async (d, hours, breakMinutes, meal, look) => {
    await h.cmd('clock.in', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T15:00:00Z` }, alex.cookie)
    if (look) { const page = await h.send('/app/time', undefined, alex.cookie); assert.match(page.text, /30 minutes are deducted as an unpaid meal/); assert.match(page.text, /Did you take your meal\?/) }
    return (await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T${15 + hours}:00:00Z`, breakMinutes, ...(meal ? { meal } : {}) }, alex.cookie)).timesheet
  }
  const taken = await work(12, 7, 0, 'taken', true), missed = await work(13, 7, 0, 'missed'), silent = await work(14, 7, 0)
  const short = await work(15, 5, 0, 'taken'), recorded = await work(16, 7, 45)
  assert.deepEqual([taken.minutes, taken.breakMinutes, taken.mealDeduction.answer, taken.exceptions], [390, 30, 'taken', undefined])
  assert.deepEqual([missed.minutes, missed.breakMinutes, missed.mealDeduction.reversed, missed.exceptions], [420, 0, true, ['missed meal']])
  assert.deepEqual([silent.minutes, silent.mealDeduction.answer, silent.exceptions], [390, null, ['unconfirmed meal deduction']])
  assert.deepEqual([short.minutes, short.mealDeduction, recorded.minutes, recorded.mealDeduction], [300, undefined, 375, undefined])
  const page = await h.send('/app/time?week=2026-10-12', undefined, priya.cookie)
  for (const text of ['Meal deducted 30 min · confirmed taken', 'Meal reported missed: 30 min deduction reversed', 'Flagged: missed meal', 'Flagged: unconfirmed meal deduction']) assert.ok(page.text.includes(text), text)
  // Reported and unconfirmed meals wait for a manager: bulk approval skips them, a single approval pays the full reported time.
  const bulk = await h.cmd('time.approveMany', { items: [taken, missed, silent].map(t => ({ id: t.id, revision: 1 })) }, priya.cookie)
  assert.deepEqual(bulk.approved.map(x => x.id), [taken.id]); assert.deepEqual(bulk.skipped.map(x => x.reason), ['Exception: missed meal', 'Exception: unconfirmed meal deduction'])
  assert.equal((await h.cmd('time.approve', { id: missed.id, revision: 1 }, priya.cookie)).exportMinutes, 420)
}))

test('SCHEDULE-002: a saved week is applied to a holiday week at the same wall times, a recurring shift skips its exception date, conflicts name the person now on leave, one occurrence is edited and published while earlier weeks stay unchanged', () => run(async h => {
  const alex = await h.person('Alex'), sam = await h.person('Sam'), priya = await h.person('Priya', 'manager')
  for (const p of [alex, sam]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-11T07:00:00Z', end: '2026-12-01T08:00:00Z' })
  // Week of Oct 12 (PDT): Alex Mon 7 am – 3 pm, Sam Tue 7 am – 3 pm; Alex confirms his shift.
  const a = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [{ staffId: alex.id, start: '2026-10-12T14:00:00Z', end: '2026-10-12T22:00:00Z', breakMinutes: 30, label: 'Opening' }, { staffId: sam.id, start: '2026-10-13T14:00:00Z', end: '2026-10-13T22:00:00Z', breakMinutes: 30 }] })
  await h.cmd('roster.publish', { id: a.id, revision: a.revision }, priya.cookie)
  const mine = (await h.state(alex.cookie)).shifts[0]; await h.cmd('shift.confirm', { id: mine.id, revision: mine.revision }, alex.cookie)
  const octoberOf = s => JSON.stringify(s.shifts.filter(x => x.rosterId === s.rosters.find(r => r.week === '2026-10-12' && r.status === 'published').id)), weekA = octoberOf(await h.state())
  await h.cmd('template.save', { name: 'Standard week', week: '2026-10-12' }, alex.cookie, 403)
  const template = await h.cmd('template.save', { name: 'Standard week', week: '2026-10-12' }, priya.cookie)
  assert.deepEqual(template.slots.map(s => [s.day, s.start, s.end]), [[0, '07:00', '15:00'], [1, '07:00', '15:00']])
  // Sam is now on approved leave on Tue Nov 24 of the Thanksgiving week.
  const leave = await h.cmd('leave.request', { start: '2026-11-24T08:00:00Z', end: '2026-11-25T08:00:00Z', reason: 'Travel' }, sam.cookie)
  await h.cmd('leave.decide', { id: leave.id, revision: 1, decision: 'approved' }, priya.cookie)
  const applied = await h.cmd('template.apply', { id: template.id, week: '2026-11-23' }, priya.cookie)
  assert.deepEqual(applied.shifts.map(x => [x.staffId, x.start, x.confirmedAt]), [[alex.id, '2026-11-23T15:00:00.000Z', undefined], [sam.id, '2026-11-24T15:00:00.000Z', undefined]])
  assert.deepEqual(applied.conflicts.map(x => [x.staffId, x.reason]), [[sam.id, 'Approved leave']])
  // Alex also opens Wednesdays and Fridays through November, except the day after Thanksgiving.
  await h.cmd('recurrence.save', { staffId: alex.id, days: [2, 4], start: '06:00', end: '10:00', breakMinutes: 0, label: 'Bake', from: '2026-11-01', until: '2026-11-30', except: ['2026-11-27'] }, priya.cookie)
  const repeated = await h.cmd('recurrence.apply', { week: '2026-11-23' }, priya.cookie)
  assert.deepEqual(repeated.shifts.map(x => [x.staffId, x.start]).slice(2), [[alex.id, '2026-11-25T14:00:00.000Z']])
  const page = await h.send('/app/schedule?week=2026-11-23&view=draft', undefined, priya.cookie)
  assert.match(page.text, /Copy and repeat/); assert.match(page.text, /Skips Fri Nov 27/)
  // Copy only Monday of the October week into the next week.
  const copied = await h.cmd('roster.copy', { fromWeek: '2026-10-12', week: '2026-10-19', days: [0] }, priya.cookie)
  assert.deepEqual(copied.shifts.map(x => [x.staffId, x.start, x.label]), [[alex.id, '2026-10-19T14:00:00.000Z', 'Opening']])
  // Edit one occurrence (Wednesday ends at 11), leave Sam off, publish; October stays exactly as it was.
  const rows = repeated.shifts.filter(x => x.staffId === alex.id).map(x => ({ staffId: x.staffId, start: x.start, end: x.start === '2026-11-25T14:00:00.000Z' ? '2026-11-25T19:00:00Z' : x.end, breakMinutes: x.breakMinutes, label: x.label, site: x.site }))
  const edited = await h.cmd('roster.prepare', { week: '2026-11-23', shifts: rows }, priya.cookie)
  assert.deepEqual(edited.conflicts, [])
  await h.cmd('roster.publish', { id: edited.id, revision: edited.revision }, priya.cookie)
  const s = await h.state()
  assert.deepEqual(s.shifts.filter(x => x.status === 'published' && x.rosterId === edited.id).map(x => [x.start, x.end]).sort(), [['2026-11-23T15:00:00.000Z', '2026-11-23T23:00:00.000Z'], ['2026-11-25T14:00:00.000Z', '2026-11-25T19:00:00.000Z']])
  assert.equal(octoberOf(s), weekA)
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
test('PUBLIC-001: installed Lobby follows the durable owner claim before first-run confirmation while private product data stays session-protected', async () => {
  const h = await harness({ unclaimed: true })
  const sealed = async (cookie = '') => {
    assert.equal((await h.send('/api/lanyard/state', undefined, cookie)).status, 401)
    const app = await h.send('/app/schedule', undefined, cookie)
    assert.equal(app.status, 303); assert.match(app.headers.get('location'), /^\/signin\?returnTo=/)
  }
  try {
    await sealed()
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
    await sealed()
    assert.equal((await h.send('/setup', undefined, claimed.cookie)).status, 200)
    const confirmed = await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: claimed.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
    assert.equal(confirmed.status, 303)
    assert.equal((await h.send('/setup/state')).value.state, 'claimed')
    const lobby = await h.send('/')
    assert.equal(lobby.headers.get('x-rer-document'), 'lobby'); assert.match(lobby.text, /href="\/signin(\?login_hint=[^"]+)?"/)
    await sealed(); await sealed('rer_session=forged')
    assert.equal((await h.send('/api/lanyard/state', undefined, claimed.cookie)).status, 200)
  } finally { await h.close() }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from './harness.mjs'

const iso = ms => new Date(ms).toISOString()
const localDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms))
const weekOf = ms => {
  const d = new Date(localDate(ms) + 'T00:00:00Z')
  return iso(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).slice(0, 10)
}
const pin = row => ({ id: row.id, revision: row.revision })

test('COVER-003: preferred in-app offers expire; exact approvals retain assignments and history through a scoped no-show reoffer until a real clock verifies coverage', () => run(async h => {
  const ana = await h.person('Ana'), ben = await h.person('Ben'), zoe = await h.person('Zoe'), cy = await h.person('Cy')
  const priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const p of [ana, ben, zoe, cy, priya, omar]) {
    await h.cmd('staff.save', { ...pin(p), name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true,
      position: p.role === 'manager' ? 'Manager' : 'Barista', site: p === omar ? 'Mission' : 'Ocean Beach', hourlyRate: p === zoe ? '24.00' : '20.00' })
  }
  const now = Date.now(), nextMonday = Date.parse(weekOf(now) + 'T18:00:00Z') + 7 * 86400000
  for (const p of [ana, ben, zoe]) await h.cmd('availability.save', { staffId: p.id, start: iso(now - 2 * 86400000), end: iso(nextMonday + 8 * 86400000) })
  await h.cmd('pattern.save', { staffId: zoe.id, from: localDate(now - 2 * 86400000), blocks: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `${d} preferred 00:00-24:00`).join('\n') }, priya.cookie)
  const publish = async inputs => {
    const draft = await h.cmd('roster.prepare', { week: weekOf(Date.parse(inputs[0].start)), shifts: inputs }, priya.cookie)
    assert.deepEqual(draft.conflicts, [])
    await h.cmd('roster.publish', pin(draft), priya.cookie)
    return (await h.state()).shifts.filter(x => x.rosterId === draft.id && x.status === 'published')
  }
  const read = async (asOf, cookie = priya.cookie, status = 200, site = '') => {
    const q = new URLSearchParams({ ...(asOf ? { asOf } : {}), ...(site ? { site } : {}) })
    const response = await h.send('/api/lanyard/coverage?' + q, undefined, cookie)
    assert.equal(response.status, status, response.text)
    return response.value.rows
  }
  const future = await publish([0, 1].map(day => ({ staffId: ana.id, start: iso(nextMonday + day * 86400000), end: iso(nextMonday + day * 86400000 + 3 * 3600000), breakMinutes: 0 })))
  const called = await h.cmd('shift.callout', { ...pin(future[0]), note: 'Cannot make this shift' }, ana.cookie)
  assert.ok(Date.parse(called.shift.start) > Date.now(), 'absence was reported before the shift')
  assert.deepEqual(called.shift.callout.qualified.map(f => f.staffId), [zoe.id, ben.id])
  assert.deepEqual(called.offers.map(o => o.staffId), [zoe.id, ben.id])
  assert.ok(called.shift.callout.leftOut.some(f => f.staffId === cy.id && f.reason === 'unavailable'))
  assert.ok(called.offers.every(o => o.shiftRevision === called.shift.revision && o.expiresAt === called.shift.end))
  const offered = called.offers.find(o => o.staffId === zoe.id)
  assert.ok((await h.state(zoe.cookie)).offers.some(o => o.id === offered.id), 'the employee received the real in-app offer')
  const yes = await h.cmd('cover.respond', { ...pin(offered), decision: 'accepted' }, zoe.cookie)
  const waiting = (await read()).find(c => c.shiftId === called.shift.id)
  assert.deepEqual([waiting.status, waiting.actionable, waiting.staffId], ['waiting', true, ana.id])
  assert.ok(waiting.exception.managerStaffIds.includes(priya.id))
  assert.equal(waiting.notice.offers.find(o => o.offerId === yes.id).acknowledgedAt, yes.respondedAt)
  assert.ok(waiting.offers.find(o => o.id === yes.id).cost.differenceCents > 0, 'manager sees the replacement wage difference')
  assert.equal(waiting.clock, null)
  const expired = (await read(called.shift.end)).find(c => c.shiftId === called.shift.id)
  assert.deepEqual([expired.status, expired.actionable, expired.clock], ['expired', false, null])
  assert.ok(expired.offers.every(o => o.status === 'expired'), 'both unanswered and accepted but unapproved offers expire')
  await read(undefined, ana.cookie, 403)
  assert.deepEqual(await read(undefined, omar.cookie), [])
  assert.deepEqual(await read(undefined, priya.cookie, 200, 'Mission'), [])
  assert.ok((await read(undefined, h.owner, 200, 'Ocean Beach')).some(c => c.shiftId === called.shift.id))

  const second = await h.cmd('shift.callout', { ...pin(future[1]) }, ana.cookie)
  const secondYes = await h.cmd('cover.respond', { ...pin(second.offers.find(o => o.staffId === zoe.id)), decision: 'accepted' }, zoe.cookie)
  await h.cmd('cover.approve', pin(secondYes), omar.cookie, 403)
  const assigned = await h.cmd('cover.approve', pin(secondYes), priya.cookie)
  assert.equal(assigned.staffId, zoe.id)
  assert.equal((await read()).find(c => c.shiftId === assigned.id).status, 'assigned')

  // An already-running service exercises the actual configured no-show point;
  // asOf is only a reporting input and never changes application command time.
  const start = Math.floor(Date.now() / 60000) * 60000 - 3600000
  const [running] = await publish([{ staffId: ana.id, start: iso(start), end: iso(start + 4 * 3600000), breakMinutes: 0 }])
  await h.cmd('attendrule.save', { site: 'Ocean Beach', graceMinutes: 1, noShowMinutes: 5 })
  const absence = await h.cmd('shift.callout', { ...pin(running) }, ana.cookie)
  const firstYes = await h.cmd('cover.respond', { ...pin(absence.offers.find(o => o.staffId === zoe.id)), decision: 'accepted' }, zoe.cookie)
  const firstAssignment = await h.cmd('cover.approve', pin(firstYes), priya.cookie)
  const reopened = (await read()).find(c => c.shiftId === running.id)
  assert.deepEqual([reopened.status, reopened.actionable, reopened.staffId, reopened.clock], ['reopened', true, zoe.id, null])
  assert.equal(reopened.reopenedAt, reopened.noShowAt)
  const page = await h.send(`/app/schedule?week=${weekOf(start)}&site=Ocean%20Beach`, undefined, priya.cookie)
  assert.equal(page.status, 200)
  assert.match(page.text, /name=cover.reopen/)
  await h.cmd('cover.reopen', pin(firstAssignment), omar.cookie, 403)
  await h.cmd('cover.reopen', pin(firstAssignment), ana.cookie, 403)
  const reoffer = await h.cmd('cover.reopen', pin(firstAssignment), priya.cookie)
  assert.equal(reoffer.shift.staffId, zoe.id, 'outreach retains the assigned replacement')
  assert.deepEqual(reoffer.offers.map(o => o.staffId), [ben.id], 'the original caller and current replacement are excluded')
  const benYes = await h.cmd('cover.respond', { ...pin(reoffer.offers[0]), decision: 'accepted' }, ben.cookie)
  // A revision change after acceptance invalidates the exact offered assignment.
  const changed = await h.cmd('shift.confirm', pin(reoffer.shift), zoe.cookie)
  await h.cmd('cover.approve', pin(benYes), priya.cookie, 409)
  assert.equal((await h.state()).shifts.find(x => x.id === running.id).staffId, zoe.id)
  const fresh = await h.cmd('cover.reopen', pin(changed), priya.cookie)
  const freshYes = await h.cmd('cover.respond', { ...pin(fresh.offers[0]), decision: 'accepted' }, ben.cookie)
  const finalAssignment = await h.cmd('cover.approve', pin(freshYes), priya.cookie)
  assert.equal(finalAssignment.staffId, ben.id)
  assert.equal((await read()).find(c => c.shiftId === running.id).clock, null)
  const clock = await h.cmd('clock.in', { commandId: 'coverage-ben-clock', capturedAt: iso(Date.now() - 1000) }, ben.cookie)
  const verified = (await read()).find(c => c.shiftId === running.id)
  assert.deepEqual([verified.status, verified.actionable, verified.clock.clockId], ['verified', false, clock.id])
  assert.deepEqual(verified.approvals.map(a => a.staffId), [zoe.id, ben.id])
  assert.equal(verified.offers.find(o => o.id === firstYes.id).status, 'approved', 'the prior approval remains intact')
  const history=(await h.send(`/api/lanyard/shifts/${running.id}/history`,undefined,zoe.cookie)).value
  assert.deepEqual(history.events.filter(e=>e.action==='covered').map(e=>e.staffId),[zoe.id,ben.id])
  assert.ok((await h.state(priya.cookie)).coverageCases.some(c => c.shiftId === running.id && c.status === 'verified'))

  // This short real shift ends while the test waits. Command time stays native,
  // so expiry refusal exercises the same production door as an employee would.
  const expiryNow = Date.now(), end = iso(expiryNow + 5000)
  const [short] = await publish([{ staffId: ana.id, start: iso(expiryNow - 55000), end, breakMinutes: 0 }])
  const expiring = await h.cmd('shift.callout', pin(short), ana.cookie)
  const acceptedBeforeEnd = await h.cmd('cover.respond', { ...pin(expiring.offers.find(o => o.staffId === zoe.id)), decision: 'accepted' }, zoe.cookie)
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(end) - Date.now() + 25)))
  await h.cmd('cover.respond', { ...pin(expiring.offers.find(o => o.staffId === ben.id)), decision: 'accepted' }, ben.cookie, 409)
  await h.cmd('cover.approve', pin(acceptedBeforeEnd), priya.cookie, 409)
  const ended = (await read()).find(c => c.shiftId === short.id)
  assert.deepEqual([ended.status, ended.actionable, ended.clock], ['expired', false, null])
  assert.ok(ended.offers.every(o => o.status === 'expired'))
}))

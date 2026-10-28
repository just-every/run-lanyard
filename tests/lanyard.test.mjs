import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { run, harness } from './harness.mjs'
import {acaPeople,acaYear,acaTrending,pin as acaPin} from './aca-fixture.mjs'

test('ACA-001: a year of approved service for three variable-hour people, monthly and look-back status, paid leave, scoped projections and a traced filer export',()=>run(async h=>{
 const people=await acaPeople(h),{alex,ben,cy,priya,omar}=people,{year,plan,days,entries,overnight}=await acaYear(h,people)
 const read=async(cookie=h.owner,id=plan.id,query='')=>{const r=await h.send(`/api/lanyard/aca/${id}${query}`,undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
 let report=await read(),a=report.rows.find(r=>r.staffId===alex.id),b=report.rows.find(r=>r.staffId===ben.id),c=report.rows.find(r=>r.staffId===cy.id)
 assert.equal(a.workedMinutes,days.length*480);assert.ok(a.averageWeeklyHours>30);assert.equal(a.status,'full-time');assert.equal(a.stabilityStart,`${year+1}-01-31`);assert.equal(a.stabilityEnd,`${year+2}-01-30`)
 assert.deepEqual(a.monthly.map(m=>[m.totalMinutes,m.fullTime]),Array.from({length:12},(_,i)=>{const month=`${year}-${String(i+1).padStart(2,'0')}`,minutes=days.filter(d=>d.startsWith(month)).length*480;return [minutes,minutes>=130*60]}),'monthly 130-hour results reconcile to actual service independently of the annual look-back')
 assert.equal(b.workedMinutes,12*480);assert.equal(b.status,'not-full-time');assert.equal(report.rows.length,3)
 assert.deepEqual(c.sources.filter(x=>x.id===overnight.id).map(x=>[x.date,x.minutes]),[[`${year}-01-31`,230],[`${year}-02-01`,460]])
 assert.equal(c.monthly.reduce((n,m)=>n+m.totalMinutes,0),c.totalMinutes)
 const input={staffId:ben.id,date:`${year}-01-09`,minutes:240,category:'vacation',reference:'hr-paid-leave-one',reason:'Employer-approved vacation service'}
 await h.cmd('aca.credit.save',input,ben.cookie,403);await h.cmd('aca.credit.save',input,priya.cookie,403)
 let credit=await h.cmd('aca.credit.save',input)
 await h.cmd('aca.credit.save',input,h.owner,409)
 credit=await h.cmd('aca.credit.save',{...input,...acaPin(credit),minutes:480,reason:'Corrected to a full paid day'})
 await h.cmd('aca.credit.save',{...input,id:credit.id,revision:1},h.owner,409)
 report=await read();b=report.rows.find(r=>r.staffId===ben.id);assert.equal(b.paidLeaveMinutes,480);assert.equal(b.totalMinutes,13*480);assert.equal(credit.versions.length,1)
 const before=(await h.state()).timesheets.length
 assert.equal(before,entries.length,'paid leave never fabricates worked time')
 const last=entries.findLast(t=>t.staffId===alex.id),correction=await h.cmd('time.prepare',{staffId:alex.id,start:last.start,end:new Date(Date.parse(last.end)-3600000).toISOString(),breakMinutes:0,reason:'Approved one-hour correction',corrects:last.id})
 const pending=(await read()).rows.find(r=>r.staffId===alex.id);assert.equal(pending.workedMinutes,days.length*480);assert.ok(pending.incomplete.some(x=>x.id===correction.id&&x.reason.includes('correction')))
 await h.cmd('time.approve',acaPin(correction));a=(await read()).rows.find(r=>r.staffId===alex.id);assert.equal(a.workedMinutes,days.length*480-60);assert.ok(!a.sources.some(x=>x.id===last.id));assert.ok(a.sources.some(x=>x.id===correction.id&&x.revision===2))
 const filePath=`/api/lanyard/aca/${plan.id}.csv?asOf=${encodeURIComponent(report.asOf)}`,download=await h.send(filePath,undefined,h.owner),again=await h.send(filePath,undefined,h.owner)
 assert.equal(download.status,200);assert.equal(download.text,again.text);assert.match(download.text,/measurement/);assert.match(download.text,/source: paid non-work/);assert.ok(download.text.includes(credit.reference));assert.ok(download.text.includes(correction.id));assert.ok(download.text.includes('"'+(days.length*480-60)+'"'));assert.ok(download.text.includes('"'+((days.length*480-60)/60).toFixed(4)+'"'),'filer file carries hours as well as exact source minutes')
 assert.equal((await h.send(`/api/lanyard/aca/${plan.id}`,undefined,ben.cookie)).status,403)
 assert.equal((await h.send(`/api/lanyard/aca/${plan.id}.csv`,undefined,'')).status,401)
 assert.deepEqual((await read(priya.cookie)).rows.map(r=>r.staffId),[alex.id,ben.id]);assert.deepEqual((await read(omar.cookie)).rows.map(r=>r.staffId),[cy.id])
 assert.ok(!(await h.send(`/api/lanyard/aca/${plan.id}.csv`,undefined,priya.cookie)).text.includes(cy.payrollId))
 const agent=await h.cmd('agent.create',{label:'Preparation only'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`})
 assert.equal(context.status,200);assert.deepEqual(context.value.acaPlans,[]);assert.deepEqual(context.value.acaCredits,[]);assert.deepEqual(context.value.acaReports,[])
 assert.deepEqual((await h.state(ben.cookie)).acaCredits,[])
 const {plan:current,week,shift,threshold}=await acaTrending(h,people),trending=(await read(h.owner,current.id)).rows.find(r=>r.staffId===ben.id)
 assert.ok(trending.totalMinutes<threshold&&trending.projectedMinutes>=threshold);assert.equal(trending.warning,true);assert.equal(trending.status,'pending')
 const currentCsv=await h.send(`/api/lanyard/aca/${current.id}.csv`,undefined,h.owner),futureMonth=current.end.slice(0,7)
 assert.ok(currentCsv.text.split('\r\n').filter(line=>line.startsWith('\"monthly\"')&&line.includes('\"'+futureMonth+'\"')).every(line=>line.includes('\"pending\"')),'unclosed monthly periods in the filer file remain pending')
 assert.equal((await h.send(`/api/lanyard/aca/${current.id}?asOf=${encodeURIComponent(new Date(Date.now()+86400000).toISOString())}`,undefined,h.owner)).status,400,'a future reporting date cannot finalize unobserved service')
 assert.ok((await h.send(`/app/schedule?week=${week}`,undefined,priya.cookie)).text.includes('ACA projected hours'))
 const small=await h.send('/api/lanyard/schedule/review',{week,shifts:[{...shift,end:new Date(Date.parse(shift.start)+2*3600000).toISOString()}]},priya.cookie)
 assert.equal(small.status,200);assert.ok(!small.value.warnings.some(w=>w.kind==='aca'),'draft replaces the published week')
 const large=await h.send('/api/lanyard/schedule/review',{week,shifts:[shift]},priya.cookie)
 assert.ok(large.value.warnings.some(w=>w.kind==='aca'&&w.message.includes('Ben')))
 await h.cmd('aca.plan.save',{name:'Bad',start:`${year}-01-01`,end:`${year}-02-28`,adminEnd:`${year}-02-28`,stabilityEnd:`${year+1}-02-28`,staffIds:[alex.id]},h.owner,400)
 await h.cmd('aca.plan.save',{name:plan.name,start:plan.start,end:plan.end,adminEnd:plan.adminEnd,stabilityEnd:plan.stabilityEnd,staffIds:plan.staffIds,id:plan.id,revision:99},h.owner,409)
 assert.ok((await h.state()).events.some(e=>e.action==='aca.download'))
}))

test('ACA-001: owners configure plans and paid service, inspect source-backed status, download the filer file and see scheduler warnings at 1440 and 390',async()=>{const {acaJourney}=await import('./aca-journey.mjs');await acaJourney()})

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

test('staff cannot change the sign-in email to another person’s staff identity', () => run(async h => {
  const alex = await h.person('Alex')
  const priya = await h.cmd('staff.save', { name: 'Priya', email: 'priya@venue.example', payrollId: 'PRIYA', role: 'manager', active: true, site: 'Ocean Beach' })
  const before = await h.state(alex.cookie)
  assert.deepEqual([before.actor.role, before.actor.staffId], ['staff', alex.id])
  const changed = await h.send('/auth/email', { email: priya.email }, alex.cookie)
  assert.equal(changed.status, 404, changed.text)
  const after = await h.state(alex.cookie)
  assert.deepEqual([after.actor.role, after.actor.staffId], ['staff', alex.id])
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
  // The Saturday of a week starting 7–13 days from now, early morning on the venue clock; Andrea already has 36.0 hours that week.
  const today = new Date(Math.floor(Date.now() / 86400000) * 86400000), mon = new Date(today.getTime() + (7 + (8 - today.getUTCDay()) % 7) * 86400000)
  const on = (d, t) => new Date(mon.getTime() + d * 86400000).toISOString().slice(0, 10) + `T${t}:00Z`, monday = on(0, '00:00').slice(0, 10)
  const sat = { start: on(5, '14:00'), end: on(5, '22:00'), breakMinutes: 30, label: 'Barista' }
  const days = [0, 1, 2, 3].map(d => ({ staffId: andrea.id, start: on(d, '14:00'), end: on(d, '23:30'), breakMinutes: 30 }))
  for (const p of [jess, luis, andrea]) await h.cmd('availability.save', { staffId: p.id, start: on(-1, '00:00'), end: on(8, '00:00') })
  const week = await h.cmd('roster.prepare', { week: monday, shifts: [{ staffId: jess.id, ...sat }, ...days] })
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
  assert.equal((await h.send(`/app/schedule?week=${monday}&site=Ocean%20Beach`, undefined, h.owner)).status, 200)
  const old = await h.send(`/app/roster?week=${monday}`, undefined, h.owner)
  assert.equal(old.status, 301); assert.equal(old.headers.get('location'), `/app/schedule?week=${monday}`)
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
  for (const secret of [draft.id, sam.email, kim.email, lee.id, lee.email, 'North Park', 'rate_cents']) assert.ok(!before.text.includes(secret), secret)
  // The only wage a staff state carries is their own (EARN-001), never a coworker's.
  assert.deepEqual(before.s.staff.map(p => [p.id, p.hourlyRateCents]), [[alex.id, 2100]]); assert.equal(before.text.match(/hourlyRateCents/g).length, 1)
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

test('managers see base wages only for staff at their own cafe', () => run(async h => {
  const priya = await h.person('Priya', 'manager'), lee = await h.person('Lee')
  const place = (p, site, hourlyRate) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site, hourlyRate })
  await place(priya, 'Ocean Beach', '25.00')
  await place(lee, 'North Park', '37.21')
  const staff = (await h.state(priya.cookie)).staff
  assert.equal(staff.find(p => p.id === priya.id).hourlyRateCents, 2500)
  assert.equal(staff.find(p => p.id === lee.id).hourlyRateCents, undefined)
  assert.equal((await h.state()).staff.find(p => p.id === lee.id).hourlyRateCents, 3721)
}))

test('bulk approval uses the manager’s cafe when a foreign or omitted site filter is supplied', () => run(async h => {
  const priya = await h.person('Priya', 'manager'), lee = await h.person('Lee')
  const place = (p, site) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site })
  await place(priya, 'Ocean Beach')
  await place(lee, 'North Park')
  const foreign = await h.cmd('time.prepare', { staffId: lee.id, start: '2026-10-12T14:00:00Z', end: '2026-10-12T22:00:00Z', breakMinutes: 30, reason: 'Missed clock-in' })
  for (const filter of [{ site: 'North Park' }, {}]) {
    const result = await h.cmd('time.approveMany', { ...filter, items: [{ id: foreign.id, revision: foreign.revision }] }, priya.cookie)
    assert.deepEqual(result.approved, [])
    assert.equal(result.skipped[0].reason, 'Outside your cafe')
  }
  const stored = (await h.state()).timesheets.find(t => t.id === foreign.id)
  assert.deepEqual([stored.status, stored.revision], ['submitted', 1])
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
  // Priya filters Ocean Beach to clean time: 26 of the 58 waiting at her cafe (not her own or the hand-entered time).
  const page = await h.send('/app/time?week=2026-10-12&cafe=Ocean%20Beach&state=clean', undefined, priya.cookie)
  assert.match(page.text, /Approve 26 shown/); assert.match(page.text, /26 of 58 waiting/)
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
  const {failedBulkApi,failedBulkBrowser}=await import('./bulk-approval-journey.mjs')
  await run(other=>failedBulkApi(other));await failedBulkBrowser()
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
  await place(priya, 'Manager')
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
  // Two partial-day absences by Ana consume one person's place in a daily limit.
  const partialDay = date(41), request = (p, from, to) => h.cmd('leave.request', { start: `${partialDay}T${from}:00:00Z`, end: `${partialDay}T${to}:00:00Z`, reason: 'Partial-day appointment' }, p.cookie)
  for (const [from, to] of [['12', '14'], ['20', '22']]) {
    const part = await request(ana, from, to)
    await h.cmd('leave.decide', { id: part.id, revision: part.revision, decision: 'approved' }, priya.cookie)
  }
  assert.ok(!(await h.state(ben.cookie)).leaveDates.full.includes(partialDay))
  const secondPerson = await request(ben, '15', '17')
  assert.equal(secondPerson.flags, undefined)
  await h.cmd('leave.decide', { id: secondPerson.id, revision: secondPerson.revision, decision: 'approved' }, priya.cookie)
  assert.ok((await h.state(cal.cookie)).leaveDates.full.includes(partialDay))
  const thirdPerson = await request(cal, '18', '19')
  assert.ok(thirdPerson.flags.length)
  await h.cmd('leave.decide', { id: thirdPerson.id, revision: thirdPerson.revision, decision: 'approved' }, priya.cookie, 409)
}))

test('SCHEDULE-005: a manager prints cafe and employee PDFs stamped with the revision, opens the wall display, and a later change moves the wall and marks both copies superseded; pay and leave reasons never print', () => run(async h => {
  const place = (p, position, site) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site, hourlyRate: '21.75' })
  const alex = await h.person('Alex'), sam = await h.person('Sam'), lee = await h.person('Lee'), priya = await h.person('Priya', 'manager')
  await place(alex, 'Barista', 'Ocean Beach'); await place(sam, 'Kitchen', 'Ocean Beach'); await place(lee, 'Barista', 'North Park'); await place(priya, 'Manager', 'Ocean Beach')
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

test('BREAK-001: timed rest and meal breaks pass the cafe policy; a short meal and rest open exceptions with premiums and an attestation, a waiver covers a short shift, a pinned timesheet that gains a missed meal is skipped by name, and a reasoned correction reconciles net and premium hours in payroll', () => run(async h => {
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager')
  for (const p of [alex, priya]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site: 'Ocean Beach' })
  const policy = { site: 'Ocean Beach', mealAfterMinutes: 300, mealMinutes: 30, waiveUpTo: 360, restEveryMinutes: 240, restMinutes: 10, premium: true }
  await h.cmd('breakrule.save', policy, priya.cookie, 403)
  await h.cmd('breakrule.save', policy)
  await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
  assert.match((await h.send('/app/people', undefined, h.owner)).text, /Break policy[\s\S]*Meal of 30 min started by 5\.0 hours worked, waivable up to 6\.0 hours/)
  // Each day starts 8:00 am PDT; breaks are [kind, start, end] in UTC hours.
  const day = async (d, breaks, out, extra = {}, look) => {
    const at = hm => `2026-10-${d}T${hm}:00Z`
    await h.cmd('clock.in', { commandId: crypto.randomUUID(), capturedAt: at('15:00') }, alex.cookie)
    for (const [kind, start, end] of breaks) {
      await h.cmd('clock.breakStart', { commandId: crypto.randomUUID(), capturedAt: at(start), kind }, alex.cookie)
      if (look) {
        assert.match((await h.send('/app/time', undefined, alex.cookie)).text, new RegExp(`End ${kind} break`))
        await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: at(end), breakMinutes: 0 }, alex.cookie, 409)
      }
      await h.cmd('clock.breakEnd', { commandId: crypto.randomUUID(), capturedAt: at(end) }, alex.cookie)
    }
    if (look) assert.match((await h.send('/app/time', undefined, alex.cookie)).text, /<form data-clock-form data-command="clock\.out">.*name="waiveMeal".*name="breakNote".*data-command="clock\.breakStart" data-kind="meal".*data-kind="rest".*Clock out<\/button><\/form>/)
    return (await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: at(out), breakMinutes: 0, ...extra }, alex.cookie)).timesheet
  }
  // Mon: two 10-minute rests and a 30-minute meal at four hours worked over 8.5 hours.
  const mon = await day('05', [['rest', '17:00', '17:10'], ['meal', '19:00', '19:30'], ['rest', '21:00', '21:10']], '23:30', {}, true)
  assert.deepEqual([mon.minutes, mon.breakMinutes, mon.breaks.length, mon.exceptions, mon.premiums], [480, 30, 3, undefined, undefined])
  // Tue: a 5-minute rest and a 20-minute meal after six hours; only the timed 20 minutes are unpaid, and the employee attests.
  const tue = await day('06', [['rest', '17:00', '17:05'], ['meal', '21:00', '21:20']], '23:00', { breakNote: 'Rush at lunch; asked to stay on register' })
  assert.deepEqual([tue.minutes, tue.breakMinutes, tue.exceptions, tue.premiums.map(p => [p.code, p.minutes])], [460, 20, ['short meal break', 'short rest break'], [['meal premium', 60], ['rest premium', 60]]])
  assert.deepEqual([tue.breakAttestation.note, tue.breakAttestation.text], ['Rush at lunch; asked to stay on register', 'I confirm my breaks on this shift are recorded accurately.'])
  // Wed: a 5.5-hour shift with its rest; the employee waives the meal. Thu: 7 hours is past the waiver limit.
  const wed = await day('07', [['rest', '17:00', '17:10']], '20:30', { waiveMeal: true })
  assert.deepEqual([wed.minutes, wed.exceptions, wed.breakWaiver.text], [330, undefined, 'I chose to waive my meal break on this shift.'])
  const thu = await day('08', [], '22:00', { waiveMeal: true })
  assert.deepEqual([thu.minutes, thu.exceptions, thu.breakWaiver], [420, ['missed meal break', 'missed rest break'], undefined])
  const page = (await h.send('/app/time?week=2026-10-05', undefined, priya.cookie)).text
  for (const text of ['Flagged: short meal break, short rest break', 'employee: “Rush at lunch; asked to stay on register”', 'meal premium 1 hr', 'meal waived by the employee']) assert.ok(page.includes(text), text)
  // TIME-008: Monday is pinned clean, then a manager's edit records no meal; the bulk approval skips it naming the exception.
  const edited = await h.cmd('time.edit', { id: mon.id, revision: mon.revision, start: mon.start, end: mon.end, breakMinutes: 0, reason: 'Meal was interrupted per the floor log' }, priya.cookie)
  assert.deepEqual([edited.exceptions, edited.premiums, edited.breaks.length], [['missed meal break'], [{ code: 'meal premium', minutes: 60 }], 3])
  const bulk = await h.cmd('time.approveMany', { items: [{ id: mon.id, revision: mon.revision }, { id: wed.id, revision: wed.revision }] }, priya.cookie)
  assert.deepEqual([bulk.approved.map(x => x.id), bulk.skipped.map(x => x.reason)], [[wed.id], ['Exception: missed meal break']])
  // A reasoned correction: the meal ran 30 minutes. The captured facts stay, the meal premium goes, the rest premium stays.
  const fixed = await h.cmd('time.edit', { id: tue.id, revision: tue.revision, start: tue.start, end: tue.end, breakMinutes: 30, reason: 'Meal ran 30 minutes per the floor log' }, priya.cookie)
  assert.deepEqual([fixed.minutes, fixed.captured.breakMinutes, fixed.breaks.length, fixed.premiums], [450, 20, 2, [{ code: 'rest premium', minutes: 60 }]])
  const resolved = await h.cmd('time.resolve', { id: fixed.id, revision: fixed.revision, reason: 'Rest was cut short by the rush; premium stands' }, priya.cookie)
  const approved = await h.cmd('time.approve', { id: resolved.id, revision: resolved.revision }, priya.cookie)
  const batch = await h.cmd('payroll.prepare', { ids: [approved.id, wed.id] }, priya.cookie)
  assert.deepEqual(batch.lines.map(l => [l.timeId, l.minutes, l.payCode ?? 'regular']), [[approved.id, 450, 'regular'], [approved.id, 60, 'rest premium'], [wed.id, 330, 'regular']])
  assert.match(batch.csvPreview, /^payroll_id,time_id,revision,start_utc,end_utc,minutes,hours,corrects,pay_code\r\n/)
  assert.match(batch.csvPreview, /,450,7\.5000,,regular\r\n.*,60,1\.0000,,rest premium\r\n.*,330,5\.5000,,regular\r\n$/s)
  assert.match((await h.send('/app/payroll', undefined, priya.cookie)).text, /Rest premium · premium pay at the regular rate, not worked time/)
  await h.cmd('payroll.export', { id: batch.id, revision: batch.revision }, priya.cookie)
  // A later correction without the rest premium exports its reversal beside the unchanged hours.
  const again = await h.cmd('time.prepare', { staffId: alex.id, start: approved.start, end: approved.end, breakMinutes: 30, reason: 'Rest breaks confirmed taken on the camera log', corrects: approved.id }, priya.cookie)
  const done = await h.cmd('time.approve', { id: again.id, revision: again.revision }, priya.cookie)
  const delta = await h.cmd('payroll.prepare', { ids: [done.id] }, priya.cookie)
  assert.deepEqual(delta.lines.map(l => [l.minutes, l.payCode ?? 'regular']), [[0, 'regular'], [-60, 'rest premium']])
}))

test('COST-002: a 38-hour week with three extra hours clocked by Thursday alerts the cafe manager at 41 projected hours with the premium and a substitute; a pickup and a swap that add overtime show it before approval, and approving a substitute clears the alert', () => run(async h => {
  const alex = await h.person('Alex'), ben = await h.person('Ben'), dee = await h.person('Dee'), priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const [p, site] of [[alex, 'Ocean Beach'], [ben, 'Ocean Beach'], [dee, 'Ocean Beach'], [priya, 'Ocean Beach'], [omar, 'Mission']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: p.role === 'staff' ? 'Barista' : 'Manager', site, hourlyRate: '20.00' })
  // A past week read as of an instant: Mon Oct 5, 2026, 9-to-5 Mon–Thu and 9-to-3 Fri (38 hours); 9-to-6 worked Mon–Wed.
  const shiftsOf = (at, staffId) => [0, 1, 2, 3, 4].map(d => ({ staffId, start: at(d, 16), end: at(d, d === 4 ? 22 : 24), breakMinutes: 0 }))
  const oct = (d, hh) => new Date(Date.UTC(2026, 9, 5 + d, hh)).toISOString().replace('.000Z', 'Z')
  for (const p of [alex, ben]) await h.cmd('availability.save', { staffId: p.id, start: oct(0, 7), end: oct(7, 7) })
  const past = await h.cmd('roster.prepare', { week: '2026-10-05', shifts: shiftsOf(oct, alex.id) })
  await h.cmd('roster.publish', { id: past.id, revision: past.revision }, priya.cookie)
  for (const d of [0, 1, 2]) await h.cmd('time.prepare', { staffId: alex.id, start: oct(d, 16), end: oct(d, 25), breakMinutes: 0, reason: 'Paper sheet' }, priya.cookie)
  const read = async (week, asOf, cookie, status = 200) => { const r = await h.send(`/api/lanyard/overtime?week=${week}${asOf ? `&asOf=${asOf}` : ''}`, undefined, cookie); assert.equal(r.status, status, r.text); return r.value.alerts }
  const [alert] = await read('2026-10-05', '2026-10-08T14:00:00Z', priya.cookie)
  assert.deepEqual([alert.staffId, alert.actualMinutes, alert.scheduledMinutes, alert.projectedMinutes, alert.overtimeMinutes, alert.premiumCents, alert.days['2026-10-07'], alert.days['2026-10-08']], [alex.id, 1620, 840, 2460, 60, 1000, 540, 480])
  assert.deepEqual(alert.remaining.map(r => [r.start, r.substitutes.map(x => x.staffId)]), [[oct(3, 16).replace('Z', '.000Z'), [ben.id]], [oct(4, 16).replace('Z', '.000Z'), [ben.id]]])
  // A day earlier Wednesday's extra hour is not yet recorded: 40 hours, no alert. Another cafe's manager and the employee read none.
  assert.deepEqual(await read('2026-10-05', '2026-10-07T14:00:00Z', priya.cookie), [])
  assert.deepEqual(await read('2026-10-05', '2026-10-08T14:00:00Z', omar.cookie), [])
  await read('2026-10-05', '2026-10-08T14:00:00Z', alex.cookie, 403)
  // An upcoming week, whatever today is: 38 scheduled hours, then a 3-hour Saturday open shift.
  const base = new Date(Date.now() + 14 * 86400000), monday = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + (8 - base.getUTCDay()) % 7)
  const at = (d, hh) => new Date(monday + d * 86400000 + hh * 3600000).toISOString().replace('.000Z', 'Z'), week = at(0, 0).slice(0, 10)
  for (const p of [alex, ben]) await h.cmd('availability.save', { staffId: p.id, start: at(0, 7), end: at(7, 7) })
  const next = await h.cmd('roster.prepare', { week, shifts: shiftsOf(at, alex.id) })
  await h.cmd('roster.publish', { id: next.id, revision: next.revision }, priya.cookie)
  const open = await h.cmd('openshift.post', { site: 'Ocean Beach', position: 'Barista', start: at(5, 16), end: at(5, 19), breakMinutes: 0, approval: 'manager' }, priya.cookie)
  const ask = await h.cmd('openshift.request', { id: open.id, revision: open.revision }, alex.cookie)
  assert.deepEqual((await h.state(priya.cookie)).pickups.find(x => x.id === ask.id).cost, { staffId: alex.id, projectedMinutes: 2460, overtimeMinutes: 60, premiumCents: 1000 })
  assert.ok((await h.send(`/app/schedule?week=${week}`, undefined, priya.cookie)).text.includes('Projected overtime: Alex would reach 41.0 hrs this workweek · 1.0 hr overtime · est. premium $10.00'))
  await h.cmd('openshift.approve', { id: ask.id, revision: ask.revision }, priya.cookie)
  const [risk] = (await h.state(priya.cookie)).overtime.filter(a => a.week === week)
  assert.deepEqual([risk.staffId, risk.projectedMinutes, risk.premiumCents], [alex.id, 2460, 1000])
  const page = (await h.send(`/app/schedule?week=${week}`, undefined, priya.cookie)).text
  for (const text of ['Overtime risk', '41.0 hrs projected (0.0 recorded + 41.0 scheduled) · 1.0 hr overtime · est. premium $10.00', 'Give to Ben (6.0 hrs)']) assert.ok(page.includes(text), text)
  // Priya gives Friday to Ben, a listed substitute; Dee (no availability), Alex and another cafe's manager are refused. The alert clears.
  const fri = risk.remaining.find(r => r.start === at(4, 16).replace('Z', '.000Z'))
  await h.cmd('overtime.substitute', { shiftId: fri.shiftId, revision: fri.revision, staffId: dee.id }, priya.cookie, 409)
  await h.cmd('overtime.substitute', { shiftId: fri.shiftId, revision: fri.revision, staffId: ben.id }, alex.cookie, 403)
  await h.cmd('overtime.substitute', { shiftId: fri.shiftId, revision: fri.revision, staffId: ben.id }, omar.cookie, 403)
  const moved = await h.cmd('overtime.substitute', { shiftId: fri.shiftId, revision: fri.revision, staffId: ben.id }, priya.cookie)
  assert.deepEqual([moved.staffId, moved.substitute.from, moved.substitute.reason], [ben.id, alex.id, 'projected overtime'])
  assert.deepEqual((await h.state(priya.cookie)).overtime.filter(a => a.week === week), [])
  // Ben then offers Friday back to Alex: the swap shows the same projected overtime before a manager decides.
  const swap = await h.cmd('swap.propose', { shiftId: moved.id, revision: moved.revision, to: alex.id }, ben.cookie)
  await h.cmd('swap.respond', { id: swap.id, revision: swap.revision, decision: 'accepted' }, alex.cookie)
  assert.deepEqual((await h.state(priya.cookie)).swaps.find(w => w.id === swap.id).cost, [{ staffId: alex.id, projectedMinutes: 2460, overtimeMinutes: 60, premiumCents: 1000 }])
}))

test('SCHEDULE-006: after a week is published, a moved shift, an approved swap and a canceled shift each keep a history the manager and the affected employees read with who, when, why and the notice state; the first and latest revisions compare by person and site; the change log exports', () => run(async h => {
  const alex = await h.person('Alex'), ben = await h.person('Ben'), cy = await h.person('Cy'), priya = await h.person('Priya', 'manager')
  for (const p of [alex, ben, cy, priya]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: p.role === 'staff' ? 'Barista' : 'Manager', site: 'Ocean Beach' })
  const base = new Date(Date.now() + 14 * 86400000), monday = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + (8 - base.getUTCDay()) % 7)
  const at = (d, hh) => new Date(monday + d * 86400000 + hh * 3600000).toISOString().replace('.000Z', 'Z'), week = at(0, 0).slice(0, 10)
  for (const p of [alex, ben, cy]) await h.cmd('availability.save', { staffId: p.id, start: at(0, 7), end: at(7, 7) })
  const draft = await h.cmd('roster.prepare', { week, shifts: [[alex, 0], [ben, 1], [cy, 2]].map(([p, d]) => ({ staffId: p.id, start: at(d, 16), end: at(d, 24), breakMinutes: 0 })) })
  const first = await h.cmd('roster.publish', { id: draft.id, revision: draft.revision, reason: 'First schedule' }, priya.cookie)
  const current = async () => (await h.state(priya.cookie)).shifts.filter(x => x.status === 'published')
  const of = async p => (await current()).find(x => x.staffId === p.id)
  // Move Alex's Monday an hour later, with a reason; staff cannot.
  const mon = await of(alex)
  await h.cmd('shift.change', { id: mon.id, revision: mon.revision, start: at(0, 17), end: at(0, 25), reason: 'Delivery moved to 10am' }, alex.cookie, 403)
  const moved = await h.cmd('shift.change', { id: mon.id, revision: mon.revision, start: at(0, 17), end: at(0, 25), reason: 'Delivery moved to 10am' }, priya.cookie)
  await h.cmd('shift.confirm', { id: moved.shift.id, revision: moved.shift.revision }, alex.cookie)
  // Ben gives Tuesday to Cy, approved by Priya; then Priya cancels Cy's Wednesday.
  const tue = await of(ben), swap = await h.cmd('swap.propose', { shiftId: tue.id, revision: tue.revision, to: cy.id }, ben.cookie)
  const yes = await h.cmd('swap.respond', { id: swap.id, revision: swap.revision, decision: 'accepted' }, cy.cookie)
  await h.cmd('swap.decide', { id: yes.id, revision: yes.revision, decision: 'approved' }, priya.cookie)
  const wed = (await current()).find(x => x.start === at(2, 16).replace('Z', '.000Z'))
  const canceled = await h.cmd('shift.cancel', { id: wed.id, revision: wed.revision, reason: 'Closed for a private event' }, priya.cookie)
  const history = async (id, cookie, status = 200) => { const r = await h.send(`/api/lanyard/shifts/${id}/history`, undefined, cookie); assert.equal(r.status, status, r.text); return r.value.events }
  // Alex's Monday, read by Alex and the manager: published, moved with its reason and previous time, acknowledged, carried into the latest revision.
  const monNow = (await current()).find(x => x.staffId === alex.id), mine = await history(monNow.id, alex.cookie)
  assert.deepEqual(mine.map(e => e.action), ['created', 'moved', 'acknowledged', 'republished'])
  assert.deepEqual([mine[0].by, mine[0].reason, mine[1].by, mine[1].reason, mine[1].from.start, mine[1].start, mine[1].notice, mine[2].by], ['Priya', 'First schedule', 'Priya', 'Delivery moved to 10am', at(0, 16).replace('Z', '.000Z'), at(0, 17).replace('Z', '.000Z'), 'not sent: in-app schedule only until NOTICE-001', 'Alex'])
  assert.deepEqual((await history(monNow.id, priya.cookie)).length, 4)
  // Tuesday: both people in the swap read it (Cy's consent is her acknowledgment); Alex, never on it, cannot.
  const tueNow = (await current()).find(x => x.start === at(1, 16).replace('Z', '.000Z'))
  for (const p of [ben, cy]) { const list = await history(tueNow.id, p.cookie); assert.deepEqual(list.filter(e => e.action !== 'republished').map(e => [e.action, e.staffId, e.from?.staffId ?? null]), [['created', ben.id, null], ['acknowledged', cy.id, null], ['swapped', cy.id, ben.id]]); assert.equal(list.find(e => e.action === 'swapped').by, 'Priya') }
  await history(tueNow.id, alex.cookie, 404)
  // The canceled Wednesday keeps its history for Cy, with the reason.
  const gone = await history(wed.id, cy.cookie)
  assert.deepEqual([gone.map(e => e.action), gone.at(-1).reason, gone.at(-1).by], [['created', 'republished', 'canceled'], 'Closed for a private event', 'Priya'])
  // Compare the first and latest revisions by shift line, person and cafe.
  const diff = await h.send(`/api/lanyard/weeks/${week}/compare?from=${first.id}&to=${canceled.roster.id}`, undefined, priya.cookie)
  assert.equal(diff.status, 200, diff.text)
  assert.deepEqual([diff.value.added, diff.value.removed.map(x => x.staffId), diff.value.changed.map(x => [x.before.staffId, x.after.staffId, x.before.start === x.after.start]).sort(), diff.value.minutesByPerson, diff.value.minutesBySite], [[], [cy.id], [[alex.id, alex.id, false], [ben.id, cy.id, true]].sort(), { [ben.id]: -480 }, { 'Ocean Beach': -480 }])
  assert.equal((await h.send(`/api/lanyard/weeks/${week}/compare?from=${first.id}&to=${canceled.roster.id}`, undefined, alex.cookie)).status, 403)
  // The change log exports with reasons and notice states; employees cannot export it.
  const log = await h.send(`/api/lanyard/weeks/${week}/changes.csv`, undefined, priya.cookie)
  assert.match(log.text, /^at_utc,shift_line,action,employee,previous_employee,start_utc,end_utc,site,by,reason,notice\r\n/)
  for (const row of [/,moved,Alex,Alex,.*,Ocean Beach,Priya,Delivery moved to 10am,not sent: in-app schedule only until NOTICE-001\r\n/, /,swapped,Cy,Ben,.*,Priya,,not sent/, /,canceled,,Cy,.*,Priya,Closed for a private event,not sent/, /,acknowledged,Alex,,.*,Alex,,\r\n/]) assert.match(log.text, row)
  assert.equal((await h.send(`/api/lanyard/weeks/${week}/changes.csv`, undefined, alex.cookie)).status, 403)
  // The schedule shows the changes to the manager and to the employee.
  const page = (await h.send(`/app/schedule?week=${week}`, undefined, priya.cookie)).text
  for (const text of ['Schedule changes', 'Compare first and latest', 'Export change log (CSV)', '“Delivery moved to 10am”', '“Closed for a private event”']) assert.ok(page.includes(text), text)
  assert.ok((await h.send(`/app/schedule?week=${week}`, undefined, alex.cookie)).text.includes('Changes to my shifts'))
}))

test('CLOCK-006: an owner’s break, injury, cash-tip and fit-for-duty questions are asked in English and Spanish; a missed break opens a break exception, an injury a private safety follow-up for that cafe’s managers, the tip declaration is listed for managers, and an edited question keeps earlier answers under their old wording', () => run(async h => {
  const alex = await h.person('Alex'), cy = await h.person('Cy'), priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const [p, site] of [[alex, 'Ocean Beach'], [cy, 'Ocean Beach'], [priya, 'Ocean Beach'], [omar, 'Mission']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site })
  const ask = (when, kind, text, textEs, extra = {}) => h.cmd('question.save', { site: 'Ocean Beach', position: '', when, kind, text, textEs, required: true, ...extra })
  await h.cmd('question.save', { site: 'Ocean Beach', when: 'out', kind: 'breaks', text: 'Did you take all your breaks?', required: true }, priya.cookie, 403)
  const breaks = await ask('out', 'breaks', 'Did you take all your breaks?', '¿Tomó todos sus descansos?'), injury = await ask('out', 'injury', 'Were you injured at work today?', '¿Se lesionó hoy en el trabajo?')
  const tips = await ask('out', 'tips', 'Cash tips received', 'Propinas en efectivo', { required: false }), fit = await ask('in', 'yesno', 'Are you fit for duty?', '¿Está en condiciones de trabajar?', { flagOn: 'no' })
  const clockPage = async () => (await h.send('/app/time', undefined, alex.cookie)).text
  assert.ok((await clockPage()).includes('Are you fit for duty? / ¿Está en condiciones de trabajar?'))
  await h.cmd('clock.in', { commandId: 'a1', capturedAt: '2026-10-06T15:00:00Z' }, alex.cookie, 400)
  await h.cmd('clock.in', { commandId: 'a2', capturedAt: '2026-10-06T15:00:00Z', answers: { [fit.id]: 'yes' } }, alex.cookie)
  const out = await clockPage()
  for (const text of ['Did you take all your breaks? / ¿Tomó todos sus descansos?', 'Were you injured at work today? / ¿Se lesionó hoy en el trabajo?', 'Cash tips received / Propinas en efectivo ($)']) assert.ok(out.includes(text), text)
  await h.cmd('clock.out', { commandId: 'a3', capturedAt: '2026-10-06T23:00:00Z', breakMinutes: 30, answers: { [breaks.id]: 'no' } }, alex.cookie, 400)
  const { timesheet } = await h.cmd('clock.out', { commandId: 'a4', capturedAt: '2026-10-06T23:00:00Z', breakMinutes: 30, answers: { [breaks.id]: 'no', [injury.id]: 'yes', [tips.id]: '42.50' } }, alex.cookie)
  assert.deepEqual(timesheet.exceptions, ['missed break reported'])
  assert.deepEqual(timesheet.answers.map(a => [a.kind, a.text, a.version, a.value]), [['yesno', 'Are you fit for duty?', 1, 'yes'], ['breaks', 'Did you take all your breaks?', 1, 'no'], ['injury', 'Were you injured at work today?', 1, undefined], ['tips', 'Cash tips received', 1, 4250]])
  // The break exception waits for a manager: bulk approval skips it by name.
  assert.deepEqual((await h.cmd('time.approveMany', { items: [{ id: timesheet.id, revision: timesheet.revision }] }, priya.cookie)).skipped.map(x => x.reason), ['Exception: missed break reported'])
  // The injury follow-up: the employee and this cafe's manager read it; a coworker, another cafe's manager and an agent do not.
  const [report] = (await h.state(priya.cookie)).injuries
  assert.deepEqual([report.staffId, report.answer, report.status, report.text, report.clockId], [alex.id, 'yes', 'open', 'Were you injured at work today?', timesheet.clockId])
  for (const p of [cy, omar]) assert.deepEqual((await h.state(p.cookie)).injuries, [])
  const key = await h.cmd('agent.create', { label: 'Roster assistant' }), context = (await h.send('/api/lanyard/agent/context', undefined, '', { authorization: `Bearer ${key.token}` })).value
  assert.deepEqual([context.injuries, context.timesheets.some(t => 'answers' in t)], [[], false])
  const page = (await h.send('/app/time?week=2026-10-05', undefined, priya.cookie)).text
  for (const text of ['Safety follow-ups', 'Declared cash tips', '$42.50', 'Answers: Are you fit for duty? yes · Did you take all your breaks? no · Cash tips received $42.50']) assert.ok(page.includes(text), text)
  await h.cmd('injury.resolve', { id: report.id, revision: report.revision, reason: 'First aid given; incident log filed' }, omar.cookie, 403)
  await h.cmd('injury.resolve', { id: report.id, revision: report.revision, reason: 'First aid given; incident log filed' }, priya.cookie)
  assert.equal((await h.state(alex.cookie)).injuries[0].resolution.reason, 'First aid given; incident log filed')
  // Rewording the breaks question makes version 2; the earlier answer keeps version 1's words. A flagged fit-for-duty "no" opens an exception.
  const edited = await h.cmd('question.save', { id: breaks.id, revision: breaks.revision, site: 'Ocean Beach', when: 'out', kind: 'breaks', text: 'Did you take every meal and rest break?', textEs: '¿Tomó todas sus comidas y descansos?', required: true })
  assert.deepEqual([edited.version, edited.wordings.map(w => w.text)], [2, ['Did you take all your breaks?', 'Did you take every meal and rest break?']])
  await h.cmd('clock.in', { commandId: 'b1', capturedAt: '2026-10-07T15:00:00Z', answers: { [fit.id]: 'no' } }, alex.cookie)
  const next = (await h.cmd('clock.out', { commandId: 'b2', capturedAt: '2026-10-07T23:00:00Z', breakMinutes: 30, answers: { [breaks.id]: 'yes', [injury.id]: 'no' } }, alex.cookie)).timesheet
  assert.deepEqual([next.exceptions, next.answers.find(a => a.kind === 'breaks').text, next.answers.find(a => a.kind === 'breaks').version], [['Are you fit for duty?: no'], 'Did you take every meal and rest break?', 2])
  const first = (await h.state(priya.cookie)).timesheets.find(t => t.id === timesheet.id)
  assert.deepEqual([first.answers[1].text, first.answers[1].version], ['Did you take all your breaks?', 1])
}))

test('CLOCK-004: a running service shift with an on-time, late, absent and offline employee shows on the live board from received punches; the absent one turns late then no-show, a manager records handling it and finds cover, and only the cover’s clock-in closes the alert', () => run(async h => {
  const [ana, ben, cy, dee, eve] = [await h.person('Ana'), await h.person('Ben'), await h.person('Cy'), await h.person('Dee'), await h.person('Eve')], priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const p of [ana, ben, cy, dee, eve, priya, omar]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: p === omar ? 'Mission' : 'Ocean Beach' })
  // The shift began an hour ago, whatever the time now.
  const start = Math.floor(Date.now() / 60000) * 60000 - 3600000, iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z'), min = m => iso(start + m * 60000)
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(start)), d = new Date(local + 'T00:00:00Z')
  const week = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10)
  for (const p of [ana, ben, cy, dee, eve]) await h.cmd('availability.save', { staffId: p.id, start: iso(start - 86400000), end: iso(start + 2 * 86400000) })
  const draft = await h.cmd('roster.prepare', { week, shifts: [ana, ben, cy, dee].map(p => ({ staffId: p.id, start: min(0), end: min(300), breakMinutes: 0 })) })
  await h.cmd('roster.publish', { id: draft.id, revision: draft.revision }, priya.cookie)
  await h.cmd('attendrule.save', { site: 'Ocean Beach', graceMinutes: 10, noShowMinutes: 30 }, priya.cookie, 403)
  await h.cmd('attendrule.save', { site: 'Ocean Beach', graceMinutes: 10, noShowMinutes: 30 })
  await h.cmd('clocknet.save', { site: 'Mission', mode: 'flag', ranges: '198.51.100.0/24' })
  // Ana on time but from Mission's network, Ben 20 minutes late, Dee's phone captured 8:01 offline and sends it only now; Cy never comes.
  await h.cmd('clock.in', { commandId: 'ana', capturedAt: min(0) }, ana.cookie, 200, { 'CF-Connecting-IP': '198.51.100.7' })
  await h.cmd('clock.in', { commandId: 'ben', capturedAt: min(20) }, ben.cookie)
  const read = async (asOf, cookie = priya.cookie, status = 200) => { const r = await h.send(`/api/lanyard/attendance${asOf ? `?asOf=${asOf}` : ''}`, undefined, cookie); assert.equal(r.status, status, r.text); return r.value.rows }
  const row = (list, p) => list.find(r => r.staffId === p.id)
  // Until Dee's phone sends its queued punch, the live board has her as a no-show.
  assert.deepEqual([row(await read(), dee).status, row(await read(), dee).alert.kind], ['no-show', 'no-show'])
  await h.cmd('clock.in', { commandId: 'dee', capturedAt: min(1) }, dee.cookie)
  const early = await read(min(15))
  assert.deepEqual([row(early, cy).status, row(early, cy).alert.kind, row(early, cy).alert.since], ['missing', 'late', new Date(start + 600000).toISOString()])
  const half = await read(min(30))
  assert.deepEqual([ana, ben, cy, dee].map(p => [row(half, p).status, row(half, p).lateMinutes, row(half, p).alert?.kind ?? null]), [['present', 0, null], ['present', 20, null], ['no-show', null, 'no-show'], ['present', 0, null]])
  // Read as of 8:30, Dee's punch shows it was captured then but received only later.
  assert.deepEqual([row(half, dee).punch.receivedAfter, row(half, ana).punch.receivedAfter], [true, true])
  assert.deepEqual([row(half, ana).wrongSite, row(half, ana).punch.seenAt], [true, 'Mission'])
  const now = await read()
  assert.deepEqual([row(now, dee).status, row(now, dee).alert, row(now, dee).punch.offlineMinutes >= 58], ['present', null, true])
  assert.deepEqual([row(now, cy).status, row(now, cy).alert.kind], ['no-show', 'no-show'])
  // Another cafe's manager sees no rows and cannot act; staff cannot read the board.
  assert.deepEqual(await read(undefined, omar.cookie), [])
  await read(undefined, ana.cookie, 403)
  const cyShift = row(now, cy)
  await h.cmd('attendance.acknowledge', { shiftId: cyShift.shiftId, note: 'Calling Cy' }, omar.cookie, 403)
  await h.cmd('attendance.acknowledge', { shiftId: cyShift.shiftId, note: 'Calling Cy' }, priya.cookie)
  const handled = row((await h.state(priya.cookie)).attendance, cy)
  assert.deepEqual([handled.alert.kind, handled.alert.acknowledged.map(a => [a.byName, a.note])], ['no-show', [['Priya', 'Calling Cy']]])
  assert.deepEqual((await h.state(ana.cookie)).attendacks, [])
  const page = (await h.send('/app/time', undefined, priya.cookie)).text
  for (const text of ['Live attendance', 'No-show', '20 min late', 'clocked at Mission', 'handled by Priya: “Calling Cy”', 'Find cover']) assert.ok(page.includes(text), text)
  // Cover: Priya calls out Cy's shift, Eve accepts and is approved. The alert stays open until Eve's clock-in is received.
  await h.cmd('shift.callout', { id: cyShift.shiftId, revision: cyShift.revision, note: 'No-show: cover needed' }, priya.cookie)
  const offer = (await h.state(eve.cookie)).offers[0], yes = await h.cmd('cover.respond', { id: offer.id, revision: offer.revision, decision: 'accepted' }, eve.cookie)
  await h.cmd('cover.approve', { id: yes.id, revision: yes.revision }, priya.cookie)
  const covered = row(await read(), eve)
  assert.deepEqual([covered.shiftId, covered.status, covered.alert.kind, covered.alert.acknowledged], [cyShift.shiftId, 'no-show', 'no-show', []])
  await h.cmd('clock.in', { commandId: 'eve', capturedAt: iso(Date.now() - 1000).replace(/\.\d+Z$/, 'Z') }, eve.cookie)
  const closed = row(await read(), eve)
  assert.deepEqual([closed.status, closed.alert, closed.lateMinutes >= 60], ['present', null, true])
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

test('AVAIL-001: a staff weekly pattern waits for approval, lists the published shift it collides with, governs only from its first day, flags unavailable blocks, exception dates and the weekly maximum, and ranks a preferred teammate first for cover', () => run(async h => {
  const place = p => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: 'Ocean Beach' })
  const alex = await h.person('Alex'), ben = await h.person('Ben'), cara = await h.person('Cara'), priya = await h.person('Priya', 'manager')
  for (const p of [alex, ben, cara]) await place(p)
  await h.cmd('staff.save', { id: priya.id, revision: priya.revision, name: priya.name, email: priya.email, payrollId: priya.payrollId, role: priya.role, active: true, position: 'Manager', site: 'Ocean Beach' })
  for (const p of [ben, cara]) await h.cmd('availability.save', { staffId: p.id, start: '2027-05-30T07:00:00Z', end: '2027-06-14T07:00:00Z' })
  // The old pattern (entered by a manager, so effective at once): every day 6 am – 10 pm from May 1, 2027.
  await h.cmd('pattern.save', { staffId: alex.id, from: '2027-05-01', blocks: 'Mon available 06:00-22:00\nTue available 06:00-22:00\nWed available 06:00-22:00\nThu available 06:00-22:00\nFri available 06:00-22:00\nSat available 06:00-22:00\nSun available 06:00-22:00' }, priya.cookie)
  // 7:00 am – 3:00 pm PDT on a date.
  const at = (p, d, from = '14:00', to = '22:00') => ({ staffId: p.id, start: `2027-${d}T${from}:00Z`, end: `2027-${d}T${to}:00Z`, breakMinutes: 30 })
  const week = await h.cmd('roster.prepare', { week: '2027-06-07', shifts: [at(alex, '06-07'), at(alex, '06-10'), at(ben, '06-08')] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  const mondayShift = week.shifts.find(x => x.start === '2027-06-07T14:00:00.000Z')
  await h.cmd('availability.policy', { requireApproval: true }, alex.cookie, 403)
  await h.cmd('availability.policy', { requireApproval: true }, priya.cookie)
  // Alex's new pattern from Sun Jun 6: never Mondays, Tuesdays preferred, other days 6 am – 4 pm, not Wed Jun 9; at most 30 hours.
  const blocks = 'Mon unavailable 00:00-24:00\nTue preferred 06:00-16:00\nWed available 06:00-16:00\nThu available 06:00-16:00\nFri available 06:00-16:00\nSat available 06:00-16:00\nSun available 06:00-16:00'
  const pending = await h.cmd('pattern.save', { from: '2027-06-06', blocks, exceptions: '2027-06-09 unavailable', preferredHours: 24, maxHours: 30 }, alex.cookie)
  assert.equal(pending.status, 'pending'); assert.deepEqual(pending.collisions.map(x => x.shiftId), [mondayShift.id])
  // Still pending: the old pattern decides, so a Monday and the exception Wednesday draw no conflicts.
  assert.deepEqual((await h.cmd('roster.prepare', { week: '2027-06-07', shifts: [at(alex, '06-07'), at(alex, '06-09'), at(ben, '06-08')] }, priya.cookie)).conflicts, [])
  await h.cmd('pattern.decide', { id: pending.id, revision: 1, decision: 'approved' }, alex.cookie, 403)
  const approved = await h.cmd('pattern.decide', { id: pending.id, revision: 1, decision: 'approved' }, priya.cookie)
  assert.deepEqual(approved.collisions.map(x => x.shiftId), [mondayShift.id])
  // Before Jun 6 the old pattern still governs (Mon May 31 is fine); from Jun 6 the new one does.
  assert.deepEqual((await h.cmd('roster.prepare', { week: '2027-05-31', shifts: [at(alex, '05-31'), at(alex, '06-06')] }, priya.cookie)).conflicts, [])
  const after = await h.cmd('roster.prepare', { week: '2027-06-07', shifts: [at(alex, '06-07'), at(alex, '06-09'), at(alex, '06-10', '23:00', '23:59'), at(ben, '06-08')] }, priya.cookie)
  const reasons = Object.fromEntries(after.conflicts.map(x => [after.shifts.find(s => s.id === x.shiftId).start.slice(5, 16), x.reason]))
  assert.deepEqual(reasons, { '06-07T14:00': 'Marked unavailable', '06-09T14:00': 'Marked unavailable', '06-10T23:00': 'Outside availability' })
  const heavy = await h.cmd('roster.prepare', { week: '2027-06-14', shifts: ['06-15', '06-17', '06-18', '06-19', '06-20'].map(d => at(alex, d)) }, priya.cookie)
  assert.deepEqual(heavy.conflicts.map(x => [heavy.shifts.find(s => s.id === x.shiftId).start, x.reason]), [['2027-06-20T14:00:00.000Z', 'Over maximum weekly hours']])
  // Ben calls out of Tuesday: Alex (preferred that day, 7.5 h on) ranks above Cara (0 h on).
  const tuesday = (await h.state(ben.cookie)).shifts.find(x => x.start === '2027-06-08T14:00:00.000Z')
  const { shift: called } = await h.cmd('shift.callout', { id: tuesday.id, revision: tuesday.revision, note: 'Sick' }, ben.cookie)
  assert.deepEqual(called.callout.qualified.map(f => f.staffId), [alex.id, cara.id])
  const page = await h.send('/app/schedule?week=2027-06-07', undefined, alex.cookie)
  assert.match(page.text, /Tue preferred 06:00-16:00/); assert.match(page.text, /Except 2027-06-09 unavailable/)
  // A lower weekly maximum collides even when every availability block still covers the shifts.
  const full = 'Mon available 06:00-22:00\nTue available 06:00-22:00'
  await h.cmd('pattern.save', { staffId: ben.id, from: '2027-06-06', blocks: full, maxHours: 15 }, priya.cookie)
  const next = await h.cmd('roster.prepare', { week: '2027-06-14', shifts: [at(ben, '06-14'), at(ben, '06-15')] }, priya.cookie)
  assert.deepEqual(next.conflicts, [], 'exactly the maximum is allowed')
  await h.cmd('roster.publish', { id: next.id, revision: next.revision }, priya.cookie)
  const last = next.shifts.find(x => x.start.startsWith('2027-06-15'))
  const lower = await h.cmd('pattern.save', { from: '2027-06-07', until: '2027-06-20', blocks: full, maxHours: 14 }, ben.cookie)
  assert.deepEqual(lower.collisions.map(x => x.shiftId), [last.id], 'saving previews the published last shift over the weekly cap')
  assert.deepEqual((await h.cmd('roster.prepare', { week: '2027-06-14', shifts: [at(ben, '06-14'), at(ben, '06-15')] }, priya.cookie)).conflicts, [], 'pending maximum does not affect scheduling')
  const decided = await h.cmd('pattern.decide', { id: lower.id, revision: lower.revision, decision: 'approved' }, priya.cookie)
  assert.deepEqual(decided.collisions.map(x => x.shiftId), [last.id], 'approval returns the same published collision')
  const limited = await h.cmd('roster.prepare', { week: '2027-06-14', shifts: [at(ben, '06-14'), at(ben, '06-15')] }, priya.cookie)
  assert.deepEqual(limited.conflicts.map(x => [limited.shifts.find(y => y.id === x.shiftId).start, x.reason]), [['2027-06-15T14:00:00.000Z', 'Over maximum weekly hours']])
  assert.deepEqual((await h.cmd('pattern.save', { staffId: ben.id, from: '2027-06-21', blocks: full, maxHours: 0 }, priya.cookie)).collisions, [], 'a future maximum does not relabel earlier published work')
}))

test('EARN-001: an employee reconciles their week’s scheduled, regular, overtime and pending hours and estimate to approved records; turning estimates off hides the amount; no coworker data', () => run(async h => {
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager')
  for (const [p, rate] of [[alex, '20.00'], [priya, '30.00']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, hourlyRate: rate })
  await h.cmd('availability.save', { start: '2026-10-11T23:00:00Z', end: '2026-10-19T00:00:00Z' }, alex.cookie)
  const days = [12, 13, 14, 15, 16].map(d => ({ staffId: alex.id, start: `2026-10-${d}T14:00:00Z`, end: `2026-10-${d}T23:00:00Z`, breakMinutes: 30 }))
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: days })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  // Five approved 8.5-hour days (42.5 hours: 2.5 over 40), a coworker's approved day and an unapproved Saturday punch.
  for (const d of [...days, { ...days[0], staffId: priya.id }]) { const t = await h.cmd('time.prepare', { ...d, reason: 'Paper timesheet' }); await h.cmd('time.approve', { id: t.id, revision: 1 }) }
  await h.cmd('clock.in', { commandId: crypto.randomUUID(), capturedAt: '2026-10-17T16:00:00Z' }, alex.cookie)
  await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: '2026-10-17T20:00:00Z', breakMinutes: 0 }, alex.cookie)
  await h.cmd('earnings.save', { estimates: true, payDays: 5, statementUrl: 'https://payroll.example/statements' }, priya.cookie, 403)
  const saved = await h.cmd('earnings.save', { estimates: true, payDays: 5, statementUrl: 'https://payroll.example/statements' })
  const mine = await h.state(alex.cookie), approved = mine.timesheets.filter(t => t.status === 'approved')
  assert.deepEqual([mine.staff.map(p => [p.id, p.hourlyRateCents]), approved.reduce((n, t) => n + t.minutes, 0)], [[[alex.id, 2000]], 2550])
  const page = (await h.send('/app/time?week=2026-10-12', undefined, alex.cookie)).text
  const estimate=(await h.send('/api/lanyard/state?week=2026-10-12',undefined,alex.cookie)).value.ownEarnings
  assert.deepEqual([estimate.scheduledMinutes,estimate.regularMinutes,estimate.overtimeMinutes,estimate.doubleMinutes,estimate.pendingMinutes,estimate.estimateCents],[2550,2400,150,0,240,87500])
  for(const amount of ['$800.00','$75.00','$875.00'])assert.ok(page.includes(amount),amount+' appears in the employee view')
  assert.ok(page.includes('href="https://payroll.example/statements"'))
  assert.ok(!page.includes('Priya') && !page.includes('$900.00'), 'no coworker hours or pay')
  // The owner turns estimates off from People: an unticked box is off.
  await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
  const posted = await h.mf.dispatchFetch(h.origin + '/app/action?name=earnings.save&returnTo=%2Fapp%2Fpeople', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ revision: String(saved.revision), payDays: '5', statementUrl: 'https://payroll.example/statements' }).toString() })
  assert.equal(posted.status,200);await posted.arrayBuffer()
  const off = (await h.send('/app/time?week=2026-10-12', undefined, alex.cookie)).text
  assert.ok(off.includes('40.0 hrs') && !off.includes('$875.00') && !off.includes('$800.00'))
  assert.equal((await h.send('/api/lanyard/state?week=2026-10-12',undefined,alex.cookie)).value.ownEarnings.estimateCents,null)
  assert.equal((await h.state(alex.cookie)).staff[0].hourlyRateCents, undefined)
}))

test('TIME-005: quarter-hour rounding at one cafe and a 7-minute snap at another pay rounded time beside captured punches, report net minutes, refuse a round-down rule and never alter approved history', () => run(async h => {
  const alex = await h.person('Alex'), sam = await h.person('Sam'), priya = await h.person('Priya', 'manager'), nora = await h.person('Nora', 'manager')
  for (const [p, site] of [[priya, 'Ocean Beach'], [nora, 'Noe Valley']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site })
  for (const [p, site] of [[alex, 'Ocean Beach'], [sam, 'Noe Valley']]) {
    await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site })
    await h.cmd('availability.save', { start: '2026-10-11T23:00:00Z', end: '2026-10-19T00:00:00Z' }, p.cookie)
  }
  const rule = { site: 'Ocean Beach', from: '2026-10-12', method: 'nearest', increment: 15, apply: 'capture' }
  await h.cmd('roundrule.save', { ...rule, direction: 'down' }, h.owner, 400)
  await h.cmd('roundrule.save', rule, priya.cookie, 403)
  await h.cmd('roundrule.save', rule)
  await h.cmd('roundrule.save', { site: 'Noe Valley', from: '2026-10-12', method: 'snap', window: 7, apply: 'approval' })
  // 9:00 am – 5:00 pm PDT shifts Monday to Thursday; clock in at 8:52, 8:58, 9:04 and 9:09 and out at 5:00 at each cafe.
  const days = [12, 13, 14, 15], ins = ['15:52', '15:58', '16:04', '16:09']
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [alex, sam].flatMap(p => days.map(d => ({ staffId: p.id, start: `2026-10-${d}T16:00:00Z`, end: `2026-10-${d + 1}T00:00:00Z`, breakMinutes: 0 }))) })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  for (const [i, d] of days.entries()) for (const p of [alex, sam]) {
    await h.cmd('clock.in', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T${ins[i]}:00Z` }, p.cookie)
    await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d + 1}T00:00:00Z`, breakMinutes: 0 }, p.cookie)
  }
  const sheets = async (p, cookie = h.owner) => (await h.state(cookie)).timesheets.filter(t => t.staffId === p.id).sort((a, b) => a.start.localeCompare(b.start))
  const a = await sheets(alex), b = await sheets(sam)
  assert.deepEqual(a.map(t => [t.start.slice(11, 16), t.payable.start.slice(11, 16), t.rounding.capturedMinutes, t.minutes]), [['15:52', '15:45', 488, 495], ['15:58', '16:00', 482, 480], ['16:04', '16:00', 476, 480], ['16:09', '16:15', 471, 465]])
  assert.deepEqual(b.map(t => [t.payable, t.minutes]), [[undefined, 488], [undefined, 482], [undefined, 476], [undefined, 471]])
  const beforeA = (await h.send('/app/time?week=2026-10-12&site=all', undefined, priya.cookie)).text, beforeB = (await h.send('/app/time?week=2026-10-12&site=all', undefined, nora.cookie)).text
  assert.ok(beforeA.includes(a[0].id) && !beforeA.includes(b[0].id)); assert.ok(beforeB.includes(b[0].id) && !beforeB.includes(a[0].id))
  const before = beforeA + beforeB
  assert.ok(before.includes('Paid 8:45 am – 5:00 pm (+7 min)') && before.includes('Rounded at approval'))
  for (const t of [...a, ...b]) await h.cmd('time.approve', { id: t.id, revision: t.revision })
  const approvedA = await sheets(alex), approvedB = await sheets(sam)
  assert.deepEqual(approvedB.map(t => [t.payable.start.slice(11, 16), t.minutes, t.status]), [['15:52', 488, 'approved'], ['15:58', 482, 'approved'], ['16:00', 480, 'approved'], ['16:09', 471, 'approved']])
  const report = (await h.send('/app/time?week=2026-10-12&site=all', undefined, priya.cookie)).text + (await h.send('/app/time?week=2026-10-12&site=all', undefined, nora.cookie)).text
  assert.ok(report.includes('Alex</th><td class="num">+3 min') && report.includes('Sam</th><td class="num">+4 min'), 'period neutrality report')
  const own = (await h.send('/app/time?week=2026-10-12', undefined, alex.cookie)).text
  assert.ok(own.includes('9:09 am – 5:00 pm') && own.includes('Paid 9:15 am – 5:00 pm (−6 min)'), 'the employee sees captured and paid time')
  // Payroll keeps the captured times and pays the payable minutes.
  const batch = await h.cmd('payroll.prepare', { ids: [approvedA[0].id] }), file = await h.cmd('payroll.export', { id: batch.id, revision: batch.revision })
  assert.match(file.csv, /2026-10-12T15:52:00\.000Z,2026-10-13T00:00:00\.000Z,495,8\.2500/)
  // A rule effective next week leaves approved history as it was.
  await h.cmd('roundrule.save', { ...rule, from: '2026-10-19', increment: 5 })
  assert.deepEqual((await sheets(alex)).map(t => [t.minutes, t.revision]), approvedA.map(t => [t.minutes, t.revision]))
  await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
  const people = (await h.send('/app/people', undefined, h.owner)).text
  assert.ok(people.includes('2026-10-19') && people.includes('Nearest quarter hour · at clock-out') && people.includes('Snap to schedule within 7 min · at approval'))
}))

test('FEEDBACK-001: after clock-out a low rating with a safety flag, an anonymous comment and a skip reach the cafe manager, who resolves the flag with a reply the employee sees; the trend shows and the author stays hidden from pay, ranking and agents', () => run(async h => {
  const alex = await h.person('Alex'), sam = await h.person('Sam'), kim = await h.person('Kim'), priya = await h.person('Priya', 'manager'), remy = await h.person('Remy', 'manager')
  for (const [p, site] of [[alex, 'Ocean Beach'], [sam, 'Ocean Beach'], [kim, 'Ocean Beach'], [priya, 'Ocean Beach'], [remy, 'North Park']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site })
  const clock = async (p, d) => { await h.cmd('clock.in', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T14:00:00Z` }, p.cookie); return (await h.cmd('clock.out', { commandId: crypto.randomUUID(), capturedAt: `2026-10-${d}T22:00:00Z`, breakMinutes: 30 }, p.cookie)).timesheet }
  // Last week Alex rated an unscheduled shift 4; this week's Monday shifts were published by Priya.
  await h.cmd('feedback.submit', { timesheetId: (await clock(alex, '05')).id, rating: 4 }, alex.cookie)
  for (const p of [alex, sam, kim]) await h.cmd('availability.save', { start: '2026-10-11T23:00:00Z', end: '2026-10-19T00:00:00Z' }, p.cookie)
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [alex, sam, kim].map(p => shift(p.id)) })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  const [ta, ts, tk] = [await clock(alex, 12), await clock(sam, 12), await clock(kim, 12)]
  await h.cmd('feedback.submit', { timesheetId: ts.id, comment: 'The walk-in door is stuck', anonymous: true }, sam.cookie, 400)
  await h.cmd('feedback.settings', { anonymous: true }, priya.cookie, 403)
  await h.cmd('feedback.settings', { anonymous: true })
  assert.match((await h.send('/app/time?week=2026-10-12', undefined, alex.cookie)).text, /How was your shift Mon Oct 12, 7:00 am – 3:00 pm\?/)
  const sent = await h.mf.dispatchFetch(h.origin + '/app/action?name=feedback.submit&returnTo=%2Fapp%2Ftime', { method: 'POST', headers: { origin: h.origin, cookie: alex.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams([['timesheetId', ta.id], ['rating', '2'], ['flags', 'safety'], ['flags', 'understaffed'], ['comment', 'Wet floor by the espresso bar and one person short']]).toString() })
  assert.match(await sent.text(), /Saved\./)
  const anon = await h.cmd('feedback.submit', { timesheetId: ts.id, comment: 'The walk-in door is stuck', flags: ['safety'], anonymous: true }, sam.cookie)
  await h.cmd('feedback.submit', { timesheetId: tk.id, skip: true }, kim.cookie)
  await h.cmd('feedback.submit', { timesheetId: tk.id, rating: 5 }, kim.cookie, 409)
  // The cafe manager and the owner see the flag and the anonymous comment without its author; the other cafe sees nothing.
  for (const cookie of [priya.cookie, h.owner]) {
    const state = await h.state(cookie), list = state.feedback, hidden = list.find(f => f.id === anon.id)
    assert.deepEqual(list.map(f => f.rating ?? f.comment).sort(), [2, 4, 'The walk-in door is stuck'].sort())
    assert.deepEqual([hidden.staffId, hidden.timesheetId, hidden.shiftId, hidden.clockId, hidden.flags], [null, undefined, undefined, undefined, ['safety']])
    assert.ok(!JSON.stringify(hidden).includes(sam.id) && !state.events.some(e => e.entityId === anon.id), 'the anonymous author stays hidden')
  }
  assert.deepEqual((await h.state(remy.cookie)).feedback, [])
  // The records and history the installation archive carries never name the anonymous author; the author still sees their answer.
  const samState = await h.state(sam.cookie), stored = (await h.db.prepare("SELECT data FROM l_records WHERE kind='feedback' AND id=?").bind(anon.id).first()).data
  const history = JSON.stringify([...(await h.db.prepare('SELECT actor_id,digest,result FROM l_commands').all()).results.filter(r => r.result.includes(anon.id)), ...(await h.db.prepare('SELECT actor_id FROM l_events WHERE entity_id=?').bind(anon.id).all()).results])
  assert.ok(history.includes('actor_id') && [sam.id, samState.actor.id, ts.id, ts.clockId].every(id => !stored.includes(id) && !history.includes(id)), 'only keyed digests link the answer to its author')
  assert.deepEqual([samState.feedback.find(f => f.id === anon.id).clockId, (await h.send('/app/time', undefined, sam.cookie)).text.includes('How was your shift')], [ts.clockId, false])
  const flagged = (await h.state(priya.cookie)).feedback.find(f => f.rating === 2)
  assert.ok(flagged.managerName && flagged.staffId === alex.id && (await h.state(priya.cookie)).feedback.find(f => f.rating === 4).managerName === null)
  const page = (await h.send('/app/time?week=2026-10-12&site=all', undefined, priya.cookie)).text, byManager = (await h.send(`/app/time?week=2026-10-12&site=all&manager=${encodeURIComponent(flagged.managerName)}`, undefined, priya.cookie)).text
  for (const text of ['Average rating <strong>2.0</strong> this week (last week 4.0) · down', 'Flagged: Safety, Understaffed', 'Anonymous', 'The walk-in door is stuck']) assert.ok(page.includes(text) && (text.startsWith('Average') || byManager.includes(text)), text)
  await h.cmd('feedback.reply', { id: flagged.id, revision: flagged.revision, reply: 'A second closer is on from Friday', resolve: true }, remy.cookie, 403)
  await h.cmd('feedback.reply', { id: flagged.id, revision: flagged.revision, reply: 'A second closer is on from Friday', resolve: true }, priya.cookie)
  const mine = (await h.state(alex.cookie)).feedback.find(f => f.id === flagged.id)
  assert.deepEqual([mine.status, mine.reply], ['resolved', 'A second closer is on from Friday'])
  assert.match((await h.send('/app/time?week=2026-10-12', undefined, alex.cookie)).text, /Reply: A second closer is on from Friday/)
  // Feedback never touches pay, approval or ranking inputs: the timesheet is unchanged and approves clean, and agents never read it.
  const sheet = (await h.state()).timesheets.find(t => t.id === ta.id)
  assert.deepEqual([sheet.revision, sheet.status, sheet.minutes], [1, 'submitted', 450])
  assert.deepEqual((await h.cmd('time.approveMany', { items: [{ id: ta.id, revision: 1 }] }, priya.cookie)).approved.map(x => x.id), [ta.id])
  const key = await h.cmd('agent.create', { label: 'Roster assistant' }), context = await h.send('/api/lanyard/agent/context', undefined, '', { authorization: `Bearer ${key.token}` })
  assert.deepEqual([context.value.feedback, context.value.feedbackopts], [[], []])
}))

test('JOURNAL-001: a cafe manager keeps a private note with an attachment and a shared note on an employee; another cafe’s manager, the employee and an agent read only what each may; an edit keeps its version', () => run(async h => {
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager'), remy = await h.person('Remy', 'manager')
  for (const [p, site] of [[alex, 'Ocean Beach'], [priya, 'Ocean Beach'], [remy, 'North Park']]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, site })
  const body = new FormData()
  for (const [k, v] of Object.entries({ staffId: alex.id, date: '2026-10-12', category: 'attendance', visibility: 'private', text: 'Late twice this week; agreed a 6:45 alarm' })) body.append(k, v)
  body.append('attachment', new Blob(['Signed attendance conversation'], { type: 'text/plain' }), 'conversation.txt')
  const encoded = new Response(body), posted = await h.mf.dispatchFetch(h.origin + '/app/action?name=note.save&returnTo=%2Fapp%2Fpeople', { method: 'POST', headers: { origin: h.origin, cookie: priya.cookie, 'content-type': encoded.headers.get('content-type') }, body: await encoded.arrayBuffer() })
  assert.equal(posted.status,200);await posted.arrayBuffer()
  const shared = await h.cmd('note.save', { staffId: alex.id, date: '2026-10-13', category: 'commendation', visibility: 'employee', text: 'Covered the Sunday rush calmly' }, priya.cookie)
  await h.cmd('note.save', { staffId: alex.id, date: '2026-10-13', category: 'performance', visibility: 'private', text: 'Other cafe' }, remy.cookie, 403)
  await h.cmd('note.save', { staffId: priya.id, date: '2026-10-13', category: 'performance', visibility: 'private', text: 'About myself' }, priya.cookie, 403)
  const kept = (await h.state(priya.cookie)).notes, secret = kept.find(n => n.visibility === 'private'), file = `/api/lanyard/notes/${secret.id}/files/${secret.attachment.id}`
  assert.deepEqual([kept.length, secret.attachment.name, secret.byName.length > 0], [2, 'conversation.txt', true])
  assert.equal((await h.send(file, undefined, priya.cookie)).text, 'Signed attendance conversation')
  // The second cafe's manager, the employee and an agent key read only what each may.
  assert.deepEqual((await h.state(remy.cookie)).notes, [])
  assert.equal((await h.send(file, undefined, remy.cookie)).status, 404)
  const own = await h.state(alex.cookie), ownText = JSON.stringify(own)
  assert.deepEqual(own.notes.map(n => [n.id, n.text, n.versions, n.by]), [[shared.id, 'Covered the Sunday rush calmly', undefined, undefined]])
  assert.ok(!ownText.includes('Late twice') && !own.events.some(e => e.entityId === secret.id), 'a private note never reaches its employee')
  assert.equal((await h.send(file, undefined, alex.cookie)).status, 404)
  const page = (await h.send('/app/time', undefined, alex.cookie)).text
  assert.ok(page.includes('Notes shared with you') && page.includes('Covered the Sunday rush calmly') && !page.includes('Late twice'))
  const key = await h.cmd('agent.create', { label: 'Roster assistant' }), context = await h.send('/api/lanyard/agent/context', undefined, '', { authorization: `Bearer ${key.token}` })
  assert.ok(Array.isArray(context.value.notes) && !context.value.notes.length && !context.text.includes('Covered the Sunday') && !context.text.includes('Late twice'))
  // An edit keeps the earlier version and its attachment; a stale revision is refused.
  const edited = await h.cmd('note.save', { id: secret.id, revision: secret.revision, date: '2026-10-12', category: 'attendance', visibility: 'private', text: 'Late twice; alarm plan working since Wednesday' }, priya.cookie)
  await h.cmd('note.save', { id: secret.id, revision: secret.revision, date: '2026-10-12', category: 'attendance', visibility: 'private', text: 'Stale' }, priya.cookie, 409)
  const history = (await h.state()).notes.find(n => n.id === secret.id)
  assert.deepEqual([history.text, history.revision, history.versions.map(v => [v.revision, v.text, v.attachment.name])], ['Late twice; alarm plan working since Wednesday', edited.revision, [[1, 'Late twice this week; agreed a 6:45 alarm', 'conversation.txt']]])
}))

test('COVER-001: staff propose a two-person exchange, the coworker consents and a cafe manager approves; ineligible, unavailable, stale and competing swaps are refused and the original assignee keeps the shift until approval', () => run(async h => {
  const place = (p, site) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site })
  const jess = await h.person('Jess'), luis = await h.person('Luis'), andrea = await h.person('Andrea'), mo = await h.person('Mo')
  const priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const p of [jess, luis, andrea, priya]) await place(p, 'Ocean Beach')
  for (const p of [mo, omar]) await place(p, 'Mission')
  for (const p of [jess, luis, mo]) await h.cmd('availability.save', { staffId: p.id, start: '2027-07-12T07:00:00Z', end: '2027-07-19T07:00:00Z' })
  // Andrea's AVAIL-001 pattern marks Tuesdays unavailable.
  await h.cmd('pattern.save', { staffId: andrea.id, from: '2027-07-01', blocks: 'Tue unavailable 00:00-24:00\nWed available 06:00-22:00' }, priya.cookie)
  // 7:00 am – 3:00 pm PDT: Jess on Tue Jul 13, Luis on Wed Jul 14.
  const at = (p, d) => ({ staffId: p.id, start: `2027-07-${d}T14:00:00Z`, end: `2027-07-${d}T22:00:00Z`, breakMinutes: 30 })
  const week = await h.cmd('roster.prepare', { week: '2027-07-12', shifts: [at(jess, 13), at(luis, 14)] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  const tue = (await h.state(jess.cookie)).shifts[0], wed = (await h.state(luis.cookie)).shifts[0]
  // Jess's choices: Luis can take Tuesday or exchange Wednesday; Andrea (unavailable) and Mo (another cafe) are not offered.
  const [choice] = (await h.state(jess.cookie)).swapOptions
  assert.deepEqual(choice.give.map(g => g.staffId), [luis.id]); assert.deepEqual(choice.exchange.map(x => x.shiftId), [wed.id])
  await h.cmd('swap.propose', { shiftId: tue.id, revision: tue.revision, to: andrea.id }, jess.cookie, 409)
  await h.cmd('swap.propose', { shiftId: tue.id, revision: tue.revision, to: mo.id }, jess.cookie, 409)
  await h.cmd('swap.propose', { shiftId: wed.id, revision: wed.revision, to: luis.id }, jess.cookie, 403)
  const exchange = await h.cmd('swap.propose', { shiftId: tue.id, revision: tue.revision, theirShiftId: wed.id, note: 'Swap my Tuesday for your Wednesday?' }, jess.cookie)
  const giveaway = await h.cmd('swap.propose', { shiftId: tue.id, revision: tue.revision, to: luis.id }, jess.cookie)
  assert.equal(exchange.toId, luis.id); assert.equal(exchange.status, 'proposed')
  await h.cmd('swap.decide', { id: exchange.id, revision: exchange.revision, decision: 'approved' }, priya.cookie, 409)
  await h.cmd('swap.respond', { id: exchange.id, revision: exchange.revision, decision: 'accepted' }, andrea.cookie, 403)
  assert.match((await h.send('/app/schedule?week=2027-07-12', undefined, luis.cookie)).text, /name=swap\.respond/)
  const agreed = await h.cmd('swap.respond', { id: exchange.id, revision: exchange.revision, decision: 'accepted' }, luis.cookie)
  const competing = await h.cmd('swap.respond', { id: giveaway.id, revision: giveaway.revision, decision: 'accepted' }, luis.cookie)
  // Pending swaps change no responsibility.
  assert.equal((await h.state(jess.cookie)).shifts.find(x => x.id === tue.id).staffId, jess.id)
  assert.equal((await h.state(luis.cookie)).shifts.find(x => x.id === wed.id).staffId, luis.id)
  assert.match((await h.send('/app/schedule?week=2027-07-12', undefined, priya.cookie)).text, /name=swap\.decide/)
  await h.cmd('swap.decide', { id: agreed.id, revision: agreed.revision, decision: 'approved' }, omar.cookie, 403)
  await h.cmd('swap.decide', { id: agreed.id, revision: agreed.revision, decision: 'approved' }, jess.cookie, 403)
  const done = await h.cmd('swap.decide', { id: agreed.id, revision: agreed.revision, decision: 'approved' }, priya.cookie)
  assert.equal(done.status, 'approved')
  await h.cmd('swap.decide', { id: agreed.id, revision: agreed.revision, decision: 'approved' }, priya.cookie, 409)
  await h.cmd('swap.decide', { id: competing.id, revision: competing.revision, decision: 'approved' }, h.owner, 409)
  // Both schedules changed exactly once; each person's swap record shows the outcome.
  const jessNow = await h.state(jess.cookie), luisNow = await h.state(luis.cookie)
  assert.deepEqual(jessNow.shifts.map(x => [x.id, x.swap.id]), [[wed.id, agreed.id]])
  assert.deepEqual(luisNow.shifts.map(x => [x.id, x.swap.id]), [[tue.id, agreed.id]])
  assert.deepEqual(Object.fromEntries(jessNow.swaps.map(w => [w.id, w.status])), { [agreed.id]: 'approved', [giveaway.id]: 'closed' })
  assert.equal(luisNow.swaps.find(w => w.id === agreed.id).fromName, 'Jess')
  // A stale request: Luis offers his new Tuesday back, Jess agrees, then Luis calls out of it.
  const moved = luisNow.shifts[0]
  const back = await h.cmd('swap.propose', { shiftId: moved.id, revision: moved.revision, to: jess.id }, luis.cookie)
  const yes = await h.cmd('swap.respond', { id: back.id, revision: back.revision, decision: 'accepted' }, jess.cookie)
  await h.cmd('shift.callout', { id: moved.id, revision: moved.revision, note: 'Sick' }, luis.cookie)
  await h.cmd('swap.decide', { id: yes.id, revision: yes.revision, decision: 'approved' }, priya.cookie, 409)
  assert.ok((await h.state(priya.cookie)).events.some(e => e.action === 'swap.decide' && e.entityId === agreed.id && e.actorRole === 'manager'))
}))

test('TIME-007: a forgotten 9-to-5 clock-out is reminded at 5:15 and provisionally closed at 5:00, held from payroll and bulk approval until the employee corrects it; an unscheduled punch stops at the 12-hour cap', () => run(async h => {
  const jess = await h.person('Jess'), andrea = await h.person('Andrea'), luis = await h.person('Luis'), priya = await h.person('Priya', 'manager')
  await h.cmd('closerule.save', { site: '', graceMinutes: 15, capHours: 12 }, priya.cookie, 403)
  await h.cmd('closerule.save', { site: '', graceMinutes: 15, capHours: 12 })
  // Mon Oct 12, 2026, 9:00 am – 5:00 pm PDT.
  await h.cmd('availability.save', { staffId: jess.id, start: '2026-10-12T07:00:00Z', end: '2026-10-19T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-12', shifts: [{ staffId: jess.id, start: '2026-10-12T16:00:00Z', end: '2026-10-13T00:00:00Z', breakMinutes: 0 }] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  await h.cmd('clock.in', { commandId: 'jess-in', capturedAt: '2026-10-12T15:58:00Z' }, jess.cookie)
  // Wed Oct 14, 8:00 am PDT, with no shift.
  await h.cmd('clock.in', { commandId: 'andrea-in', capturedAt: '2026-10-14T15:00:00Z' }, andrea.cookie)
  const mine = (await h.state(jess.cookie)).clocks[0]
  assert.equal(mine.status, 'open')
  assert.deepEqual(mine.provisional, { end: '2026-10-13T00:00:00.000Z', due: '2026-10-13T00:15:00.000Z', scheduled: true })
  const capped = (await h.state(priya.cookie)).clocks.find(k => k.staffId === andrea.id)
  assert.deepEqual(capped.provisional, { end: '2026-10-15T03:00:00.000Z', due: '2026-10-15T03:00:00.000Z', scheduled: false })
  const overtime = await h.send('/api/lanyard/overtime?week=2026-10-12&asOf=2026-10-18T20:00:00Z', undefined, priya.cookie)
  assert.equal(overtime.status, 200); assert.deepEqual(overtime.value.alerts, [], 'provisional ends cannot manufacture overtime days later')
  const actual = async date => {
    const response = await h.send('/api/lanyard/intervals?date=' + date + '&size=60', undefined, priya.cookie)
    assert.equal(response.status, 200)
    return response.value.intervals.reduce((n, x) => n + x.actual.minutes, 0)
  }
  assert.equal(await actual('2026-10-12'), 482, 'scheduled provisional labor ends at 5 pm')
  assert.equal(await actual('2026-10-14'), 720, 'unscheduled labor ends at the 12-hour cap')
  assert.equal(await actual('2026-10-15'), 0, 'unconfirmed punches add no labor after their provisional end')
  assert.match((await h.send('/app/time', undefined, jess.cookie)).text, /name=time\.confirm/)
  // A late clock-out cannot end it, and nothing is approvable or exportable yet.
  await h.cmd('clock.out', { commandId: 'jess-out', capturedAt: new Date(Date.now() - 1000).toISOString().replace(/\.\d+Z$/, 'Z'), breakMinutes: 0 }, jess.cookie, 409)
  assert.equal((await h.state(priya.cookie)).timesheets.length, 0)
  await h.cmd('payroll.prepare', {}, priya.cookie, 409)
  const other = await h.cmd('time.prepare', { staffId: luis.id, start: '2026-10-13T16:00:00Z', end: '2026-10-13T20:00:00Z', breakMinutes: 0, reason: 'Paper sheet' }, priya.cookie)
  await h.cmd('time.approve', { id: other.id, revision: other.revision })
  const draft = await h.cmd('payroll.prepare', {}, priya.cookie)
  assert.deepEqual(draft.lines.map(l => l.staffId), [luis.id])
  assert.deepEqual(draft.held.map(x => [x.clockId, x.reason]).sort(), [[capped.id, 'provisional close'], [mine.id, 'provisional close']].sort())
  // The employee corrects the end to 5:30 pm; a manager confirms Andrea's capped punch.
  await h.cmd('time.confirm', { id: mine.id, revision: mine.revision, end: '2026-10-13T00:30:00Z', breakMinutes: 0 }, andrea.cookie, 403)
  const { timesheet, clock } = await h.cmd('time.confirm', { id: mine.id, revision: mine.revision, end: '2026-10-13T00:30:00Z', breakMinutes: 0, reason: 'Stayed to close' }, jess.cookie)
  assert.equal(timesheet.minutes, 512); assert.deepEqual(timesheet.exceptions, ['provisional close']); assert.equal(timesheet.provisional.end, '2026-10-13T00:00:00.000Z')
  assert.equal(clock.start, '2026-10-12T15:58:00.000Z'); assert.equal(clock.provisional.due, '2026-10-13T00:15:00.000Z')
  const confirmed = await h.cmd('time.confirm', { id: capped.id, revision: capped.revision, end: capped.provisional.end, breakMinutes: 30 }, priya.cookie)
  assert.deepEqual(confirmed.timesheet.exceptions, ['provisional close'])
  assert.equal(await actual('2026-10-12'), 512, 'a confirmed correction replaces the provisional count once')
  assert.equal(await actual('2026-10-14'), 690, 'confirmed meal minutes replace the capped estimate')
  // TIME-008 bulk approval skips both with the exception named; a single approval decides each.
  const bulk = await h.cmd('time.approveMany', { items: [timesheet, confirmed.timesheet].map(t => ({ id: t.id, revision: t.revision })) }, priya.cookie)
  assert.deepEqual(bulk.approved, []); assert.deepEqual(bulk.skipped.map(x => x.reason), ['Exception: provisional close', 'Exception: provisional close'])
  const approved = await h.cmd('time.approve', { id: timesheet.id, revision: timesheet.revision }, priya.cookie)
  const batch = await h.cmd('payroll.prepare', { ids: [approved.id] }, priya.cookie)
  assert.deepEqual(batch.held, [])
  const exported = await h.cmd('payroll.export', { id: batch.id, revision: batch.revision }, priya.cookie)
  assert.match(exported.csvPreview, /,512,8\.5333,/)
  const liveStart = new Date(Date.now() - 60 * 60000).toISOString().replace(/\.\d+Z$/, 'Z')
  await h.cmd('clock.in', { commandId: 'live-before-cap', capturedAt: liveStart }, luis.cookie)
  const dates = [...new Set([liveStart, new Date().toISOString()].map(at => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at))))]
  assert.equal((await Promise.all(dates.map(actual))).reduce((n, m) => n + m, 0), 60, 'before the cap, live labor counts to the reporting instant')
}))

test('CLOCK-007: a cafe’s web clock accepts punches from its approved IP range or an enrolled browser, records only the network, refuses or flags other networks as configured, and a range change applies on the next punch', () => run(async h => {
  const jess = await h.person('Jess'), priya = await h.person('Priya', 'manager')
  const from = ip => ({ 'CF-Connecting-IP': ip })
  const punch = (name, n, ip, status = 200, cookie = jess.cookie) => h.cmd(name, { commandId: `${name}-${n}`, capturedAt: `2026-10-05T${String(10 + n).padStart(2, '0')}:00:00Z`, ...(name === 'clock.out' ? { breakMinutes: 0 } : {}) }, cookie, status, from(ip))
  await h.cmd('clocknet.save', { site: '', mode: 'refuse', ranges: '203.0.113.0/24' }, priya.cookie, 403)
  const rule = await h.cmd('clocknet.save', { site: '', mode: 'refuse', ranges: '203.0.113.0/24\n2001:db8::/32' })
  await punch('clock.in', 1, '198.51.100.9', 409)
  const open = await punch('clock.in', 1, '203.0.113.7')
  assert.deepEqual(open.network, { in: { ip: '203.0.113.7', via: 'approved range' } })
  await punch('clock.out', 2, '198.51.100.9', 409)
  const widened = await h.cmd('clocknet.save', { site: '', mode: 'refuse', ranges: '203.0.113.0/24, 198.51.100.0/24', revision: rule.revision })
  const first = await punch('clock.out', 2, '198.51.100.9')
  assert.deepEqual(first.timesheet.network.out, { ip: '198.51.100.9', via: 'approved range' }); assert.equal(first.timesheet.exceptions, undefined)
  // Flag mode: an outside punch is accepted with its exception; an IPv6 address inside 2001:db8::/32 is approved.
  const flagged = await h.cmd('clocknet.save', { site: '', mode: 'flag', ranges: '2001:db8::/32', revision: widened.revision })
  const outside = await punch('clock.in', 3, '192.0.2.44')
  assert.deepEqual(outside.exceptions, ['off-network punch']); assert.deepEqual(outside.network.in, { ip: '192.0.2.44', via: null })
  const second = await punch('clock.out', 4, '2001:db8:0:1::5')
  assert.deepEqual(second.timesheet.network, { in: { ip: '192.0.2.44', via: null }, out: { ip: '2001:db8:0:1::5', via: 'approved range' } })
  const bulk = await h.cmd('time.approveMany', { items: [{ id: second.timesheet.id, revision: second.timesheet.revision }] }, priya.cookie)
  assert.deepEqual(bulk.skipped.map(x => x.reason), ['Exception: off-network punch'])
  // An enrolled browser punches from any network; its token is only an HttpOnly cookie, and revoking it applies at once.
  await h.cmd('clocknet.save', { site: '', mode: 'refuse', ranges: '', revision: flagged.revision })
  assert.equal((await h.send('/api/lanyard/command', { name: 'clockbrowser.enroll', input: { site: '', label: 'Back office PC' } }, priya.cookie)).status, 403)
  const enrolled = await h.send('/api/lanyard/command', { name: 'clockbrowser.enroll', input: { site: '', label: 'Back office PC' } }, h.owner)
  assert.equal(enrolled.status, 200); assert.equal(enrolled.value.token, undefined)
  const cookie = enrolled.headers.get('set-cookie').split(';')[0]
  assert.match(enrolled.headers.get('set-cookie'), /^__Host-lanyard-clock=[0-9a-f]{64}; .*HttpOnly; Secure; SameSite=Strict/)
  await punch('clock.in', 5, '192.0.2.44', 409)
  const desk = await punch('clock.in', 5, '192.0.2.44', 200, `${jess.cookie}; ${cookie}`)
  assert.deepEqual(desk.network.in, { ip: '192.0.2.44', via: 'enrolled browser', browserId: enrolled.value.id })
  const owner = await h.state()
  assert.deepEqual(owner.clockBrowsers.map(b => [b.id, b.label]), [[enrolled.value.id, 'Back office PC']]); assert.ok(!JSON.stringify(owner).includes(cookie.split('=')[1]))
  assert.equal((await h.send('/api/lanyard/command', { name: 'clockbrowser.revoke', input: { id: enrolled.value.id } }, h.owner)).status, 200)
  await punch('clock.out', 6, '192.0.2.44', 409, `${jess.cookie}; ${cookie}`)
  assert.deepEqual(owner.events.filter(e => e.action.startsWith('clockbrowser.')).map(e => e.entityId), [enrolled.value.id])
}))

test('COVER-002: a manager posts an open shift that eligible staff see with their rate and request; approving one assigns it once and closes the rest; approved pickup and a pool; a template position-only row posts as an open shift', () => run(async h => {
  const place = (p, position) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site: 'Ocean Beach', hourlyRate: '19.00' })
  const jess = await h.person('Jess'), luis = await h.person('Luis'), cara = await h.person('Cara'), priya = await h.person('Priya', 'manager')
  for (const p of [jess, luis]) await place(p, 'Barista')
  await place(cara, 'Kitchen'); await place(priya, 'Manager')
  for (const p of [jess, luis, cara]) await h.cmd('availability.save', { staffId: p.id, start: '2027-08-02T07:00:00Z', end: '2027-08-16T07:00:00Z' })
  const omar = await h.person('Omar', 'manager')
  const at = d => ({ start: `2027-08-${d}T14:00:00Z`, end: `2027-08-${d}T22:00:00Z`, breakMinutes: 30 })
  const week = await h.cmd('roster.prepare', { week: '2027-08-02', shifts: [{ staffId: jess.id, ...at('02') }] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  await h.cmd('openshift.post', { site: 'Ocean Beach', position: 'Barista', ...at('04'), approval: 'manager' }, jess.cookie, 403)
  const wed = await h.cmd('openshift.post', { site: 'Ocean Beach', position: 'Barista', ...at('04'), label: 'Patio', approval: 'manager' }, priya.cookie)
  // Eligible staff see it with their own rate; a Kitchen cook neither sees nor can request it.
  assert.deepEqual((await h.state(jess.cookie)).openshifts.map(o => [o.id, o.hourlyRateCents]), [[wed.id, 1900]])
  assert.deepEqual((await h.state(cara.cookie)).openshifts, [])
  await h.cmd('openshift.request', { id: wed.id, revision: wed.revision }, cara.cookie, 409)
  const a = await h.cmd('openshift.request', { id: wed.id, revision: wed.revision }, jess.cookie)
  await h.cmd('openshift.request', { id: wed.id, revision: wed.revision }, jess.cookie, 409)
  const b = await h.cmd('openshift.request', { id: wed.id, revision: wed.revision }, luis.cookie)
  assert.match((await h.send('/app/schedule?week=2027-08-02', undefined, priya.cookie)).text, /name=openshift\.approve/)
  await h.cmd('openshift.approve', { id: b.id, revision: b.revision }, luis.cookie, 403)
  await h.cmd('openshift.approve', { id: b.id, revision: b.revision }, omar.cookie, 403)
  const filled = await h.cmd('openshift.approve', { id: b.id, revision: b.revision }, priya.cookie)
  assert.equal(filled.shift.staffId, luis.id); assert.equal(filled.openShift.status, 'filled')
  await h.cmd('openshift.approve', { id: a.id, revision: a.revision }, priya.cookie, 409)
  const all = await h.state(priya.cookie)
  assert.deepEqual(all.pickups.map(x => [x.staffId, x.status]).sort(), [[jess.id, 'closed'], [luis.id, 'approved']].sort())
  assert.equal(all.shifts.filter(x => x.openShiftId === wed.id).length, 1)
  assert.deepEqual((await h.state(luis.cookie)).shifts.filter(x => x.openShiftId === wed.id).map(x => x.start), ['2027-08-04T14:00:00.000Z'])
  // Approved pickup offered only to a pool of Jess: Luis never sees it; Jess's request assigns it at once.
  const thu = await h.cmd('openshift.post', { site: 'Ocean Beach', position: 'Barista', ...at('05'), approval: 'auto', pool: [jess.id] }, priya.cookie)
  assert.deepEqual((await h.state(luis.cookie)).openshifts, [])
  const picked = await h.cmd('openshift.request', { id: thu.id, revision: thu.revision }, jess.cookie)
  assert.equal(picked.shift.staffId, jess.id)
  // A week saved with an open Friday shift applies as a draft carrying it, posted when that draft is published.
  await h.cmd('openshift.post', { site: 'Ocean Beach', position: 'Barista', ...at('06'), approval: 'manager' }, priya.cookie)
  const template = await h.cmd('template.save', { name: 'Summer week', week: '2027-08-02' }, priya.cookie)
  assert.deepEqual(template.slots.filter(x => !x.staffId).map(x => [x.day, x.position]), [[4, 'Barista']])
  const next = await h.cmd('template.apply', { id: template.id, week: '2027-08-09' }, priya.cookie)
  assert.deepEqual(next.openShifts.map(o => [o.start, o.status]), [['2027-08-13T14:00:00.000Z', 'draft']])
  assert.deepEqual((await h.state(jess.cookie)).openshifts.filter(o => o.week === '2027-08-09'), [])
  await h.cmd('roster.publish', { id: next.id, revision: next.revision }, priya.cookie)
  assert.deepEqual((await h.state(jess.cookie)).openshifts.filter(o => o.week === '2027-08-09').map(o => [o.start, o.position, o.status]), [['2027-08-13T14:00:00.000Z', 'Barista', 'open']])
}))

test('COVER-004: a two-tier open shift by part-time priority: tier two waits, tier one declines and expires, tier two accepts and is approved; the offer log keeps times and answers; seniority and custom rankings; tiered call-out replacements; at an access-to-hours cafe a new hire is flagged until existing part-time staff are offered the hours', () => run(async h => {
  const place = (p, extra) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: 'San Jose', hourlyRate: '19.00', ...extra })
  const ana = await h.person('Ana'), ben = await h.person('Ben'), cy = await h.person('Cy'), dee = await h.person('Dee'), priya = await h.person('Priya', 'manager')
  await place(ana, { employmentType: 'part-time', startDate: '2020-01-01' }); await place(ben, { employmentType: 'part-time', startDate: '2024-01-01' })
  await place(cy, {}); await place(dee, { employmentType: 'full-time', startDate: '2019-05-01' })
  await h.cmd('staff.save', { id: priya.id, revision: priya.revision, name: priya.name, email: priya.email, payrollId: priya.payrollId, role: 'manager', active: true, position: 'Manager', site: 'San Jose' })
  for (const p of [ana, ben, cy, dee]) await h.cmd('availability.save', { staffId: p.id, start: '2027-09-06T07:00:00Z', end: '2027-09-13T07:00:00Z' })
  const at = d => ({ start: `2027-09-${d}T15:00:00Z`, end: `2027-09-${d}T23:00:00Z`, breakMinutes: 30 })
  const week = await h.cmd('roster.prepare', { week: '2027-09-06', shifts: [{ staffId: ana.id, ...at('06') }] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  // Ana's pattern asks for 30 hours a week: part-time wanting more hours first, then part-time, then type not set, then full-time; tiers of two a minute apart.
  await h.cmd('pattern.save', { staffId: ana.id, from: '2027-09-01', blocks: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `${d} available 06:00-22:00`).join('\n'), preferredHours: 30 }, priya.cookie)
  const o = await h.cmd('openshift.post', { site: 'San Jose', position: 'Barista', ...at('08'), approval: 'manager', order: 'tiers', rule: 'parttime', size: 2, minutes: 1 }, priya.cookie)
  assert.equal(o.minutes, 450, 'COVER-004: timed tiers retain the payable shift duration')
  assert.deepEqual(o.tiers.map(t => t.staffIds), [[ana.id, ben.id], [cy.id, dee.id]])
  assert.equal(Date.parse(o.tiers[1].opensAt) - Date.parse(o.tiers[0].opensAt), 60000)
  assert.deepEqual((await h.state(cy.cookie)).openshifts, [])
  await h.cmd('openshift.request', { id: o.id, revision: o.revision }, cy.cookie, 409)
  assert.deepEqual((await h.state(ana.cookie)).openshifts.map(x => [x.id, x.tiers]), [[o.id, undefined]])
  const no = await h.cmd('openshift.decline', { id: o.id, revision: o.revision }, ana.cookie)
  await h.cmd('openshift.decline', { id: o.id, revision: o.revision }, ana.cookie, 409)
  // Seniority: earliest start date first, no start date last; custom: the manager's order, then fewest hours.
  const senior = await h.cmd('openshift.post', { site: 'San Jose', position: 'Barista', ...at('09'), approval: 'manager', order: 'tiers', rule: 'seniority', size: 4, minutes: 30 }, priya.cookie)
  assert.deepEqual(senior.tiers.map(t => t.staffIds), [[dee.id, ana.id, ben.id, cy.id]])
  const custom = await h.cmd('openshift.post', { site: 'San Jose', position: 'Barista', ...at('10'), approval: 'manager', order: 'tiers', rule: 'custom', ranking: [cy.id, dee.id], size: 3, minutes: 30 }, priya.cookie)
  assert.deepEqual(custom.tiers.map(t => t.staffIds), [[cy.id, dee.id, ben.id], [ana.id]])
  // Access to hours: only the owner turns it on; a person added now is flagged while Cy (no employment type) is still owed the offer.
  await h.cmd('offerrule.save', { site: 'San Jose', order: 'tiers', rule: 'fewest', size: 1, minutes: 60, accessToHours: true }, priya.cookie, 403)
  await h.cmd('offerrule.save', { site: 'San Jose', order: 'tiers', rule: 'fewest', size: 1, minutes: 60, accessToHours: true })
  const eve = await h.cmd('staff.save', { name: 'Eve', email: 'eve@venue.example', payrollId: 'EVE', role: 'staff', active: true, position: 'Barista', site: 'San Jose', employmentType: 'part-time' })
  await h.cmd('staff.invite', { id: eve.id }); eve.cookie = await h.confirmMail(eve.email)
  await h.cmd('availability.save', { staffId: eve.id, start: '2027-09-06T07:00:00Z', end: '2027-09-13T07:00:00Z' })
  const flag = (await h.state(priya.cookie)).openshifts.find(x => x.id === o.id).accessToHours
  assert.deepEqual(flag, { owed: [{ staffId: cy.id, typeSet: false }], hires: [eve.id], flagged: true })
  assert.match((await h.send('/app/schedule?week=2027-09-06', undefined, priya.cookie)).text, /Cy \(employment type not set\)/)
  await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
  assert.match((await h.send('/app/people', undefined, h.owner)).text, /Flag: added while access-to-hours offers for San Jose/)
  // Call-out replacements follow the cafe's order: one teammate per hour, fewest hours then name.
  const shift = (await h.state(ana.cookie)).shifts.find(x => x.staffId === ana.id)
  const out = await h.cmd('shift.callout', { id: shift.id, revision: shift.revision }, ana.cookie)
  assert.deepEqual(out.offers.map(x => [x.staffId, x.tier]), [[ben.id, 1], [cy.id, 2], [dee.id, 3], [eve.id, 4]])
  const later = out.offers[1]
  assert.deepEqual((await h.state(cy.cookie)).offers, [])
  await h.cmd('cover.respond', { id: later.id, revision: later.revision, decision: 'accepted' }, cy.cookie, 409)
  // An eligible newcomer outside the original log waits for the last tier, not an extra interval.
  await h.cmd('openshift.request', { id: o.id, revision: o.revision }, eve.cookie, 409)
  // Tier one expires with Ana's decline and no answer from Ben; tier two reaches Cy, who requests, and Priya approves.
  await new Promise(r => setTimeout(r, Math.max(0, Date.parse(o.tiers[1].opensAt) - Date.now() + 1000)))
  const newcomer = (await h.state(eve.cookie)).openshifts.find(x => x.id === o.id)
  assert.ok(newcomer, 'The last tier is open to an eligible newcomer outside the original log')
  const newcomerAsk = await h.cmd('openshift.request', { id: newcomer.id, revision: newcomer.revision }, eve.cookie)
  const open = (await h.state(cy.cookie)).openshifts.find(x => x.id === o.id)
  const ask = await h.cmd('openshift.request', { id: open.id, revision: open.revision }, cy.cookie)
  const filled = await h.cmd('openshift.approve', { id: ask.id, revision: ask.revision }, priya.cookie)
  assert.equal(filled.shift.staffId, cy.id)
  assert.equal(ask.after, 450, 'COVER-004: pickup weekly hours use the shift duration')
  assert.equal(filled.shift.minutes, 450, 'COVER-004: approval preserves payable minutes')
  const all = await h.state(priya.cookie), log = all.openshifts.find(x => x.id === o.id)
  assert.deepEqual(all.pickups.filter(x => x.openShiftId === o.id).map(x => [x.staffId, x.status]).sort(), [[ana.id, 'declined'], [cy.id, 'approved'], [eve.id, 'closed']].sort())
  assert.ok(no.declinedAt < log.tiers[1].opensAt && log.tiers[1].opensAt <= ask.requestedAt)
  assert.deepEqual(log.accessToHours, { owed: [], hires: [eve.id], flagged: false })
  assert.match((await h.send('/app/schedule?week=2027-09-06', undefined, priya.cookie)).text, /Offer log/)
}))

test('TIME-004: the owner defines a pay period, employees and a manager sign off and it locks; an ordinary manager cannot edit or reopen it; the owner reopens with a reason and fresh signoff, a reopened period holds its prepared payroll, and after the provider run closes it a correction is a linked adjustment that leaves the locked record unchanged', () => run(async h => {
  const alex = await h.person('Alex'), ben = await h.person('Ben'), priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  const at = (staffId, d, extra = {}) => ({ staffId, start: `2026-10-${d}T14:00:00Z`, end: `2026-10-${d}T22:00:00Z`, breakMinutes: 30, reason: 'Entered from the paper sheet', ...extra })
  await h.cmd('period.save', { start: '2026-10-12', end: '2026-10-18' }, priya.cookie, 403)
  let period = await h.cmd('period.save', { start: '2026-10-12', end: '2026-10-18' })
  await h.cmd('period.save', { start: '2026-10-18', end: '2026-10-24' }, h.owner, 409)
  const a = await h.cmd('time.approve', { id: (await h.cmd('time.prepare', at(alex.id, '13'))).id, revision: 1 }, priya.cookie)
  await h.cmd('time.approve', { id: (await h.cmd('time.prepare', at(ben.id, '14'))).id, revision: 1 }, priya.cookie)
  // Approved time in an open period waits for the lock.
  await h.cmd('payroll.prepare', {}, h.owner, 409)
  const signAll = async () => { for (const p of [alex, ben, priya]) period = await h.cmd('period.signoff', { id: period.id, revision: period.revision }, p.cookie) }
  await h.cmd('period.lock', { id: period.id, revision: period.revision }, h.owner, 409)
  await signAll()
  await h.cmd('period.lock', { id: period.id, revision: period.revision }, priya.cookie, 403)
  period = await h.cmd('period.lock', { id: period.id, revision: period.revision })
  assert.deepEqual([period.status, period.locked.length], ['locked', 2])
  // Offline captures retain their venue date: even 06:30Z on Monday is Sunday here.
  const beforeCapture = await h.state()
  const capture = { commandId: 'locked-period-capture', capturedAt: '2026-10-12T15:00:00Z' }
  await h.cmd('clock.in', capture, alex.cookie, 409)
  await h.cmd('clock.in', { commandId: 'locked-last-date', capturedAt: '2026-10-19T06:30:00Z' }, ben.cookie, 409)
  const afterCapture = await h.state()
  assert.deepEqual(afterCapture.clocks, beforeCapture.clocks)
  assert.deepEqual(afterCapture.timesheets, beforeCapture.timesheets)
  assert.deepEqual(afterCapture.events, beforeCapture.events, 'refused captures write no activity')
  // Locked: an ordinary manager neither corrects the time nor reopens the period.
  await h.cmd('time.prepare', at(alex.id, '13', { breakMinutes: 45, corrects: a.id }), omar.cookie, 409)
  await h.cmd('period.reopen', { id: period.id, revision: period.revision, reason: 'Missed break' }, omar.cookie, 403)
  // A batch prepared while locked is rechecked at export: the owner reopens with a reason, signoffs clear, the batch is refused.
  const stale = await h.cmd('payroll.prepare', {})
  await h.cmd('period.reopen', { id: period.id, revision: period.revision }, h.owner, 400)
  period = await h.cmd('period.reopen', { id: period.id, revision: period.revision, reason: 'Alex took a 45-minute break' })
  assert.deepEqual([period.status, period.signoffs, period.reopens.map(x => x.reason)], ['open', [], ['Alex took a 45-minute break']])
  // The same rejected command can be retried after an authorized reopen.
  const captured = await h.cmd('clock.in', capture, alex.cookie)
  assert.deepEqual(await h.cmd('clock.in', capture, alex.cookie), captured)
  await h.cmd('period.lock', { id: period.id, revision: period.revision }, h.owner, 409)
  const stopped = await h.cmd('clock.out', { commandId: 'reopened-period-out', capturedAt: '2026-10-12T15:30:00Z', breakMinutes: 0 }, alex.cookie)
  await h.cmd('time.approve', { id: stopped.timesheet.id, revision: stopped.timesheet.revision }, priya.cookie)
  await h.cmd('payroll.export', { id: stale.id, revision: stale.revision }, h.owner, 409)
  const fixed = await h.cmd('time.approve', { id: (await h.cmd('time.prepare', at(alex.id, '13', { breakMinutes: 45, corrects: a.id }), priya.cookie)).id, revision: 1 }, h.owner)
  await h.cmd('period.lock', { id: period.id, revision: period.revision }, h.owner, 409)
  await signAll()
  period = await h.cmd('period.lock', { id: period.id, revision: period.revision })
  await h.cmd('period.close', { id: period.id, revision: period.revision, reference: 'Run 2026-10-23' }, h.owner, 409)
  const batch = await h.cmd('payroll.prepare', {}), sent = await h.cmd('payroll.export', { id: batch.id, revision: batch.revision })
  assert.match(sent.csv, /435,7\.2500/)
  period = await h.cmd('period.close', { id: period.id, revision: period.revision, reference: 'Run 2026-10-23' })
  assert.deepEqual([period.status, period.reference], ['closed', 'Run 2026-10-23'])
  await h.cmd('period.reopen', { id: period.id, revision: period.revision, reason: 'Late fix' }, h.owner, 409)
  // After close: a correction is a linked adjustment; the original keeps its times and the locked record is unchanged.
  const late = await h.cmd('time.prepare', at(alex.id, '13', { breakMinutes: 30, corrects: fixed.id, reason: 'Break was 30 minutes after all' }))
  await h.cmd('time.approve', { id: late.id, revision: 1 }, priya.cookie)
  const s = await h.state(), original = s.timesheets.find(t => t.id === fixed.id), adj = s.timesheets.find(t => t.id === late.id)
  assert.deepEqual(adj.adjustment, { periodId: period.id, of: fixed.id })
  assert.deepEqual([original.start, original.end, original.minutes, original.status], [fixed.start, fixed.end, fixed.minutes, 'superseded'])
  assert.deepEqual(s.periods.find(p => p.id === period.id).locked, period.locked)
  const extra = await h.cmd('payroll.prepare', {})
  assert.deepEqual(extra.lines.map(l => [l.timeId, l.corrects, l.minutes]), [[late.id, fixed.id, 15]])
}))



test('TIME-009: the approval review shows scheduled, captured and payable times, variance, breaks, network, job, cost and the running week; filtering to exceptions lists the early, missed-meal and off-network rows; an edit keeps the captured facts and a send-back returns to the employee', () => run(async h => {
  const ana = await h.person('Ana'), ben = await h.person('Ben'), cy = await h.person('Cy'), dee = await h.person('Dee'), priya = await h.person('Priya', 'manager')
  for (const p of [ana, ben, cy, dee, priya]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: 'Ocean Beach', hourlyRate: '19.00' })
  await h.cmd('clockrule.save', { site: 'Ocean Beach', position: '', early: 'flag', earlyMinutes: 10, unscheduled: 'allow' })
  await h.cmd('mealrule.save', { site: 'Ocean Beach', afterMinutes: 360, deductMinutes: 30, enabled: true })
  await h.cmd('clocknet.save', { site: 'Ocean Beach', mode: 'flag', ranges: '203.0.113.0/24' })
  for (const p of [ana, ben, cy, dee]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-05T07:00:00Z', end: '2026-10-12T07:00:00Z' })
  // Tue Oct 6, 2026, 9:00 am – 5:00 pm PDT for all four.
  const week = await h.cmd('roster.prepare', { week: '2026-10-05', shifts: [ana, ben, cy, dee].map(p => ({ staffId: p.id, start: '2026-10-06T16:00:00Z', end: '2026-10-07T00:00:00Z', breakMinutes: 30 })) })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  const day = async (p, inAt, ip, meal) => {
    await h.cmd('clock.in', { commandId: `${p.name}-in`, capturedAt: inAt }, p.cookie, 200, { 'CF-Connecting-IP': ip })
    return (await h.cmd('clock.out', { commandId: `${p.name}-out`, capturedAt: '2026-10-07T00:00:00Z', breakMinutes: 0, meal }, p.cookie, 200, { 'CF-Connecting-IP': ip })).timesheet
  }
  const early = await day(ana, '2026-10-06T15:35:00Z', '203.0.113.5', 'taken'), missed = await day(ben, '2026-10-06T16:00:00Z', '203.0.113.6', 'missed')
  const away = await day(cy, '2026-10-06T16:00:00Z', '198.51.100.9', 'taken'), clean = await day(dee, '2026-10-06T16:00:00Z', '203.0.113.7', 'taken')
  const rows = Object.fromEntries((await h.state(priya.cookie)).timesheets.map(t => [t.id, t.review]))
  assert.deepEqual(rows[early.id].scheduled, { start: '2026-10-06T16:00:00.000Z', end: '2026-10-07T00:00:00.000Z', minutes: 450 })
  assert.deepEqual(rows[early.id].variance, { start: -25, end: 0, minutes: 25 })
  assert.deepEqual([rows[early.id].captured.minutes, rows[early.id].payable.minutes, rows[early.id].roundingMinutes], [475, 475, 0])
  assert.deepEqual([rows[early.id].costCents, rows[early.id].job, rows[early.id].site, rows[early.id].exceptions], [15042, 'Barista', 'Ocean Beach', ['early clock-in']])
  assert.deepEqual([rows[missed.id].breaks, rows[missed.id].exceptions, rows[missed.id].week], [{ taken: 0, required: 30 }, ['missed meal'], { week: '2026-10-05', runningMinutes: 480, overtimeMinutes: 0 }])
  assert.deepEqual([rows[away.id].network, rows[away.id].exceptions], [{ in: { ip: '198.51.100.9', via: null }, out: { ip: '198.51.100.9', via: null } }, ['off-network punch']])
  assert.deepEqual([rows[clean.id].breaks, rows[clean.id].exceptions], [{ taken: 30, required: 30 }, []])
  // The exception filter lists exactly the three flagged rows.
  const page = (await h.send('/app/time?state=exception', undefined, priya.cookie)).text
  assert.deepEqual([early, missed, away, clean].map(t => page.includes(t.id)), [true, true, true, false])
  // Edit with a reason keeps the captured facts; send back waits for the employee, who resubmits.
  await h.cmd('time.edit', { id: missed.id, revision: missed.revision, start: '2026-10-06T16:00:00Z', end: '2026-10-06T23:30:00Z', breakMinutes: 0, reason: 'Left at 4:30 per the closing log' }, ben.cookie, 403)
  const edited = await h.cmd('time.edit', { id: missed.id, revision: missed.revision, start: '2026-10-06T16:00:00Z', end: '2026-10-06T23:30:00Z', breakMinutes: 0, reason: 'Left at 4:30 per the closing log' }, priya.cookie)
  assert.deepEqual([edited.minutes, edited.revision, edited.captured.end, edited.captured.minutes, edited.edited.reason], [450, missed.revision + 1, '2026-10-07T00:00:00.000Z', 480, 'Left at 4:30 per the closing log'])
  const back = await h.cmd('time.return', { id: away.id, revision: away.revision, reason: 'Were you off site at clock-in?' }, priya.cookie)
  await h.cmd('time.approve', { id: back.id, revision: back.revision }, priya.cookie, 409)
  assert.equal((await h.state(cy.cookie)).timesheets[0].returned.reason, 'Were you off site at clock-in?')
  const again = await h.cmd('time.resubmit', { id: back.id, revision: back.revision, note: 'Phone was on cellular data' }, cy.cookie)
  assert.equal(again.status, 'submitted')
  await h.cmd('time.approve', { id: again.id, revision: again.revision }, priya.cookie)
}))

test('TIME-003: a missed clock-out opens an exception the employee corrects with an attestation, another manager approves and a manager resolves with a reason the employee reads; a manager edit makes a pinned bulk approval skip it; employee confirmation and requests leave the unconfirmed state', () => run(async h => {
  const jess = await h.person('Jess'), dee = await h.person('Dee'), priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  await h.cmd('closerule.save', { site: '', graceMinutes: 15, capHours: 12 })
  await h.cmd('clockrule.save', { site: '', position: '', early: 'flag', earlyMinutes: 10, unscheduled: 'allow' })
  for (const p of [jess, dee]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-05T07:00:00Z', end: '2026-10-12T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-05', shifts: [{ staffId: jess.id, start: '2026-10-06T16:00:00Z', end: '2026-10-07T00:00:00Z', breakMinutes: 0 }, { staffId: dee.id, start: '2026-10-07T16:00:00Z', end: '2026-10-08T00:00:00Z', breakMinutes: 0 }] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  // Jess misses her clock-out: the punch is provisionally closed; she corrects it and attests.
  await h.cmd('clock.in', { commandId: 'jess-in', capturedAt: '2026-10-06T15:58:00Z' }, jess.cookie)
  const punch = (await h.state(jess.cookie)).clocks[0]
  assert.ok(punch.provisional)
  const { timesheet } = await h.cmd('time.confirm', { id: punch.id, revision: punch.revision, end: '2026-10-07T00:20:00Z', breakMinutes: 0, reason: 'Closed the register', attest: true }, jess.cookie)
  assert.deepEqual([timesheet.exceptions, timesheet.attestation.by], [['provisional close'], timesheet.submittedBy])
  const approved = await h.cmd('time.approve', { id: timesheet.id, revision: timesheet.revision }, omar.cookie)
  await h.cmd('time.resolve', { id: approved.id, revision: approved.revision, reason: 'Checked' }, jess.cookie, 403)
  // Approval leaves the exception open until a manager resolves it; the employee reads the outcome before payroll.
  assert.equal((await h.state(jess.cookie)).timesheets[0].resolution, undefined)
  const resolved = await h.cmd('time.resolve', { id: approved.id, revision: approved.revision, reason: 'Register log shows 5:20 pm close' }, priya.cookie)
  await h.cmd('time.resolve', { id: resolved.id, revision: resolved.revision, reason: 'Again' }, priya.cookie, 409)
  const seen = (await h.state(jess.cookie)).timesheets[0]
  assert.deepEqual([seen.status, seen.approvedBy, seen.reason, seen.attestation.text, seen.resolution.reason, seen.start], ['approved', approved.approvedBy, 'Closed the register', 'I confirm these times and breaks are accurate.', 'Register log shows 5:20 pm close', '2026-10-06T15:58:00.000Z'])
  assert.deepEqual((await h.cmd('payroll.prepare', { ids: [resolved.id] }, priya.cookie)).lines.map(l => l.minutes), [502])
  // A TIME-006 early punch opens an exception that stays open through approval until resolved.
  await h.cmd('clock.in', { commandId: 'dee-in', capturedAt: '2026-10-07T15:35:00Z' }, dee.cookie)
  const early = (await h.cmd('clock.out', { commandId: 'dee-out', capturedAt: '2026-10-08T00:00:00Z', breakMinutes: 0 }, dee.cookie)).timesheet
  const ok = await h.cmd('time.approve', { id: early.id, revision: early.revision }, priya.cookie)
  assert.equal(ok.resolution, undefined); assert.deepEqual(ok.exceptions, ['early clock-in'])
  assert.equal((await h.cmd('time.resolve', { id: ok.id, revision: ok.revision, reason: 'Opening prep was approved' }, omar.cookie)).resolution.reason, 'Opening prep was approved')
  // A manager's edit changes the revision another manager pinned, so the bulk approval skips it as changed.
  const thu = await h.cmd('time.prepare', { staffId: dee.id, start: '2026-10-08T16:00:00Z', end: '2026-10-08T20:00:00Z', breakMinutes: 0, reason: 'Paper sheet' }, priya.cookie)
  await h.cmd('time.edit', { id: thu.id, revision: thu.revision, start: '2026-10-08T16:00:00Z', end: '2026-10-08T21:00:00Z', breakMinutes: 0, reason: 'Stayed for a delivery' }, omar.cookie)
  const pinned = await h.cmd('time.approveMany', { items: [{ id: thu.id, revision: thu.revision }] }, priya.cookie)
  assert.deepEqual(pinned.skipped.map(x => x.reason), ['Changed since you reviewed it'])
  // Dee confirms Friday's manager-entered time: it leaves the unconfirmed filter.
  const fri = await h.cmd('time.prepare', { staffId: dee.id, start: '2026-10-09T16:00:00Z', end: '2026-10-09T20:00:00Z', breakMinutes: 0, reason: 'Paper sheet' }, priya.cookie)
  const mine = await h.cmd('time.acknowledge', { id: fri.id, revision: fri.revision }, dee.cookie)
  const filtered = await h.cmd('time.approveMany', { state: 'unconfirmed', items: [{ id: mine.id, revision: mine.revision }] }, omar.cookie)
  assert.deepEqual(filtered.skipped.map(x => x.reason), ['Outside the filter'])
  // An employee's missing-punch request needs the attestation, carries its exception and waits for a manager.
  const sat = { start: '2026-10-10T16:00:00Z', end: '2026-10-10T19:00:00Z', breakMinutes: 0, reason: 'Phone died at the event' }
  await h.cmd('time.request', sat, dee.cookie, 400)
  const asked = await h.cmd('time.request', { ...sat, attest: true }, dee.cookie)
  assert.deepEqual([asked.status, asked.exceptions], ['submitted', ['missed punch']])
  await h.cmd('time.approve', { id: asked.id, revision: asked.revision }, dee.cookie, 403)
  await h.cmd('time.approve', { id: asked.id, revision: asked.revision }, omar.cookie)
}))

test('CLOCK-002: ordered clock retries bind identity, retain conflicting captures for scoped review, respect revocation and use capture-date rounding', () => run(async h => {
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
  const priya = await h.person('Priya', 'manager'), lee = await h.person('Lee', 'manager')
  await h.cmd('staff.save', {id:lee.id,revision:1,name:lee.name,email:lee.email,payrollId:'LEE',role:'manager',active:true,site:'Elsewhere'})
  const capture = {name:'clock.in',input:{...input,capturedAt:'2026-10-12T01:00:00Z'}}
  const reportInput = {commandId:crypto.randomUUID(),capture,error:'Command identity already used by another actor or body'}
  const issue = await h.cmd('clock.report',reportInput,alex.cookie)
  assert.deepEqual(await h.cmd('clock.report',reportInput,alex.cookie),issue)
  assert.equal((await h.state()).clockissues.length,1)
  assert.deepEqual((await h.state(sam.cookie)).clockissues,[])
  assert.deepEqual((await h.state(lee.cookie)).clockissues,[])
  assert.deepEqual((await h.state(priya.cookie)).clockissues[0].capture,capture)
  await h.cmd('clockissue.resolve',{id:issue.id,revision:1,reason:'Not our cafe'},lee.cookie,403)
  await h.cmd('clockissue.resolve',{id:issue.id,revision:1,reason:'Self'},alex.cookie,403)
  const resolved = await h.cmd('clockissue.resolve',{id:issue.id,revision:1,reason:'Original shift already recorded; duplicate capture rejected'},priya.cookie)
  assert.equal((await h.state(alex.cookie)).clockissues[0].resolution.reason,resolved.resolution.reason)
  assert.equal((await h.state()).timesheets.length,1)
  const originalActor=(await h.state(alex.cookie)).actor.id
  await h.cmd('staff.save',{id:alex.id,revision:1,name:alex.name,email:alex.email,payrollId:'ALEX',role:'staff',active:false})
  await h.cmd('clock.in',{commandId:'revoked-clock',capturedAt:'2026-10-13T00:00:00Z'},alex.cookie,403)
  await h.cmd('clock.report',{...reportInput,commandId:'revoked-report'},alex.cookie,403)
  assert.equal((await h.state()).clockissues.length,1)
  const recovery={commandId:crypto.randomUUID(),actorId:originalActor,capture:{name:'clock.in',input:{commandId:'revoked-clock',capturedAt:'2026-10-13T00:00:00Z'}},error:'Staff access has been revoked or is not granted'}
  await h.cmd('clock.recover',recovery,sam.cookie,403)
  await h.cmd('clock.recover',recovery,lee.cookie,403)
  const recovered=await h.cmd('clock.recover',recovery,priya.cookie)
  assert.equal(recovered.staffId,alex.id);assert.equal(recovered.status,'unresolved')
  assert.deepEqual(await h.cmd('clock.recover',recovery,priya.cookie),recovered)
  assert.equal((await h.state()).clocks.length,1)
  // Replay an entire offline shift and timed meal, after a newer rounding rule exists.
  await h.cmd('roundrule.save',{site:'',from:'2026-10-01',method:'nearest',increment:15,apply:'capture'})
  await h.cmd('roundrule.save',{site:'',from:'2026-10-13',method:'nearest',increment:5,apply:'capture'})
  const events = [
    ['clock.in',{commandId:'offline-in',capturedAt:'2026-10-12T14:07:00Z'}],
    ['clock.breakStart',{commandId:'offline-meal',capturedAt:'2026-10-12T18:00:00Z',kind:'meal'}],
    ['clock.breakEnd',{commandId:'offline-end-meal',capturedAt:'2026-10-12T18:30:00Z'}],
    ['clock.out',{commandId:'offline-out',capturedAt:'2026-10-12T22:08:00Z',breakMinutes:0}],
  ]
  let last
  for (const [name,input] of events) { last=await h.cmd(name,input,sam.cookie); assert.deepEqual(await h.cmd(name,input,sam.cookie),last) }
  assert.equal(last.timesheet.minutes,465)
  assert.equal(last.timesheet.rounding.increment,15)
  assert.equal(last.timesheet.breakMinutes,30)
  assert.ok(last.clock.breaks[0].receivedAt>last.clock.breaks[0].start)
  assert.ok(last.clock.breaks[0].endReceivedAt>last.clock.breaks[0].end)
  assert.ok(last.clock.closedReceivedAt>last.clock.end)
  assert.equal((await h.state(sam.cookie)).clocks.length,1)
  assert.equal((await h.state(sam.cookie)).timesheets.length,1)
  const page=await h.send('/app/time',undefined,priya.cookie)
  assert.match(page.text,/Original shift already recorded/)
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
  // AUDIT-001 readers: the owner reads all of it; a manager reads activity about people at their cafe; staff read their own events.
  for (const e of events) assert.deepEqual(Object.keys(e).sort(), ['action', 'actorId', 'actorRole', 'at', 'entityId', 'id'])
  const remote = await h.person('Remy', 'manager'), moved = await h.cmd('staff.save', { id: remote.id, revision: remote.revision, name: 'Remy', email: remote.email, payrollId: 'REMY', role: 'manager', active: true, site: 'Oakland' })
  const rules = await h.cmd('team.visibility', { site: 'Oakland', scope: 'position', hidden: [] }, remote.cookie)
  const s0 = await h.state(), all = s0.events, near = (await h.state(manager.cookie)).events, far = (await h.state(remote.cookie)).events, own = (await h.state(alex.cookie)).events
  assert.ok([moved.id, rules.id].every(id => all.some(e => e.entityId === id)), 'the owner reads every event')
  assert.deepEqual(near.map(e => e.id), all.filter(e => ![moved.id, rules.id].includes(e.entityId)).map(e => e.id), 'the cafe manager reads everything about the cafe’s people, nothing about Oakland')
  assert.deepEqual([...new Set(far.map(e => e.entityId))].sort(), [moved.id, rules.id].sort(), 'the Oakland manager reads only Oakland activity')
  const mine = new Set([alex.id, ...['availability', 'shifts', 'timesheets'].flatMap(k => s0[k].filter(r => r.staffId === alex.id).map(r => r.id))])
  assert.ok(own.length && own.every(e => mine.has(e.entityId)), 'staff read only events on their own records')
  assert.ok(own.some(e => e.action === 'time.approve' && e.entityId === approved.id) && !own.some(e => ['roster.publish', 'payroll.export', 'payroll.download'].includes(e.action)))
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

test('DASH-001: a live Thursday with a late arrival, an open shift, three pending approvals, an overtime risk and a missed punch shows on the cafe manager’s dashboard with counts and links, labor against forecast sales and budget and the pay-period cutoff; another cafe’s manager sees only their cafe; resolving items clears them', () => run(async h => {
  const [alex, ben, dee, eve, mo] = [await h.person('Alex'), await h.person('Ben'), await h.person('Dee'), await h.person('Eve'), await h.person('Mo')], priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const p of [alex, ben, dee, eve, mo, priya, omar]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: p.role === 'staff' ? 'Barista' : 'Manager', site: p === mo || p === omar ? 'Mission' : 'Ocean Beach', hourlyRate: '20.00' })
  // Week of Mon Oct 5, 2026 read as of Thu Oct 8, 8:30 am PDT.
  const riley = await h.person('Riley', 'manager')
  await h.cmd('staff.save', { id: riley.id, revision: riley.revision, name: riley.name, email: riley.email, payrollId: riley.payrollId, role: riley.role, active: true, position: 'Manager', site: 'Ocean Beach' })
  const oct = (d, hh, mm = 0) => new Date(Date.UTC(2026, 9, 5 + d, hh, mm)).toISOString().replace('.000Z', 'Z'), asOf = oct(3, 15, 30), W = '2026-10-05'
  for (const p of [alex, ben, dee, eve, mo]) await h.cmd('availability.save', { staffId: p.id, start: oct(0, 7), end: oct(7, 7) })
  await h.cmd('attendrule.save', { site: 'Ocean Beach', graceMinutes: 10, noShowMinutes: 30 })
  await h.cmd('closerule.save', { site: 'Ocean Beach', graceMinutes: 15, capHours: 12 })
  // Alex: 38 scheduled hours with 9-hour days worked Mon–Wed (41 projected); Ben opens Thursday; Dee worked Wednesday; Eve closes Thursday; Mo opens Mission.
  const shifts = [...[0, 1, 2, 3, 4].map(d => ({ staffId: alex.id, start: oct(d, 16), end: oct(d, d === 4 ? 22 : 24), breakMinutes: 0 })), { staffId: ben.id, start: oct(3, 15), end: oct(3, 23), breakMinutes: 0 }, { staffId: dee.id, start: oct(2, 15), end: oct(2, 23), breakMinutes: 0 }, { staffId: eve.id, start: oct(3, 19), end: oct(3, 23), breakMinutes: 0 }, { staffId: mo.id, start: oct(3, 15), end: oct(3, 23), breakMinutes: 0 }]
  await h.cmd('roster.prepare', { week: W, shifts }, priya.cookie)
  // An open Friday shift, carried into the week by a template saved from a later week.
  await h.cmd('openshift.post', { site: 'Ocean Beach', position: 'Barista', start: '2027-08-13T14:00:00Z', end: '2027-08-13T22:00:00Z', breakMinutes: 0, approval: 'manager' }, priya.cookie)
  const template = await h.cmd('template.save', { name: 'Open Friday', week: '2027-08-09' }, priya.cookie)
  const draft = await h.cmd('template.apply', { id: template.id, week: W, days: [4] }, priya.cookie)
  await h.cmd('roster.publish', { id: draft.id, revision: draft.revision }, priya.cookie)
  for (const d of [0, 1, 2]) { const t = await h.cmd('time.prepare', { staffId: alex.id, start: oct(d, 16), end: oct(d, 25), breakMinutes: 0, reason: 'Paper sheet' }, priya.cookie); await h.cmd('time.approve', { id: t.id, revision: t.revision }, riley.cookie) }
  // Dee misses her Wednesday clock-out and corrects it; Ben clocks in 20 minutes late.
  await h.cmd('clock.in', { commandId: 'dee-in', capturedAt: oct(2, 15) }, dee.cookie)
  const punch = (await h.state(dee.cookie)).clocks[0]
  const { timesheet } = await h.cmd('time.confirm', { id: punch.id, revision: punch.revision, end: oct(2, 23, 5), breakMinutes: 0, reason: 'Closed the register', attest: true }, dee.cookie)
  await h.cmd('clock.in', { commandId: 'ben-in', capturedAt: oct(3, 15, 20) }, ben.cookie)
  // Pending: Dee's time, Ben's time off and Eve's new availability.
  const leave = await h.cmd('leave.request', { start: '2026-11-20T16:00:00Z', end: '2026-11-21T00:00:00Z', reason: 'Appointment' }, ben.cookie)
  await h.cmd('availability.policy', { requireApproval: true }, priya.cookie)
  await h.cmd('pattern.save', { from: '2027-01-03', blocks: 'Mon available 06:00-16:00' }, eve.cookie)
  await h.cmd('period.save', { start: '2026-10-05', end: '2026-10-11' })
  await h.cmd('forecast.save', { week: W, site: 'Ocean Beach', days: [1000, 1000, 1000, 1000, 1000, 1000, 1000], budgetPercent: 15 }, priya.cookie)
  const read = async (cookie, query = '', status = 200) => { const r = await h.send(`/api/lanyard/dashboard?asOf=${asOf}${query}`, undefined, cookie); assert.equal(r.status, status, r.text); return r.value }
  const ids = list => list.map(x => x.staffId ?? x.id), plan = `/app/schedule?week=${W}`
  let d = await read(priya.cookie)
  assert.deepEqual([d.today, d.week, d.site], ['2026-10-08', W, 'Ocean Beach'])
  assert.deepEqual([ids(d.now), d.late.map(x => [x.staffId, x.lateMinutes]), d.now[0].link, d.late[0].link], [[ben.id], [[ben.id, 20]], '/app/time#attendance', '/app/time#attendance'])
  assert.deepEqual([d.openShifts.map(o => [o.start, o.site]), d.openShifts[0].link], [[['2026-10-09T14:00:00.000Z', 'Ocean Beach']], `${plan}&site=Ocean%20Beach#open-shifts`])
  assert.deepEqual(d.unconfirmed.map(x => x.staffId).sort(), [alex.id, alex.id, ben.id, eve.id].sort())
  assert.deepEqual([ids(d.approvals.time), ids(d.approvals.leave), ids(d.approvals.availability), d.approvals.swaps], [[dee.id], [ben.id], [eve.id], []])
  assert.deepEqual([d.approvals.time[0].link, d.approvals.leave[0].link, d.approvals.availability[0].link], ['/app/time#approve', `${plan}&site=Ocean%20Beach#time-off`, `${plan}&site=Ocean%20Beach#availability`])
  assert.deepEqual(d.overtime.map(x => [x.staffId, x.overtimeMinutes, x.link]), [[alex.id, 60, `${plan}&site=Ocean%20Beach#overtime`]])
  assert.deepEqual(d.exceptions.map(x => [x.id, x.exceptions, x.link]), [[timesheet.id, ['provisional close'], '/app/time#exceptions']])
  // 38 + 8 + 8 + 4 scheduled hours at $20.00 = $1,160.00 against $7,000 forecast sales: 16.6%, over a 15% budget.
  assert.deepEqual(d.labor, [{ site: 'Ocean Beach', scheduledCents: 116000, forecastCents: 700000, percent: 16.6, budgetPercent: 15, overBudget: true, actual: null, link: `${plan}&site=Ocean%20Beach` }])
  assert.deepEqual([d.cutoff.end, d.cutoff.daysLeft, d.cutoff.link], ['2026-10-11', 3, '/app/payroll#pay-periods'])
  // Mission's manager sees only Mission, whatever cafe is asked for; the owner sees both or picks one; staff read none.
  for (const q of ['', '&site=Ocean%20Beach']) {
    const m = await read(omar.cookie, q)
    assert.deepEqual([m.site, ids(m.late), m.now, m.openShifts, ids(m.unconfirmed), m.approvals, m.overtime, m.exceptions, m.labor.map(x => [x.site, x.scheduledCents, x.percent])], ['Mission', [mo.id], [], [], [mo.id], { time: [], leave: [], swaps: [], availability: [] }, [], [], [['Mission', 16000, null]]])
  }
  assert.deepEqual(ids((await read(h.owner)).late).sort(), [ben.id, mo.id].sort())
  assert.deepEqual(ids((await read(h.owner, '&site=Mission')).late), [mo.id])
  await read(ben.cookie, '', 403)
  // The live screen carries the dashboard for managers only, with links to each card.
  const screen = (await h.send('/app/schedule', undefined, priya.cookie)).text
  for (const part of ['id="dashboard"', 'Pending approvals', 'href="/app/time#approve"', 'href="/app/time#exceptions"', 'Unresolved exceptions</a> <strong>1</strong>', 'Pending approvals</a> <strong>3</strong>']) assert.ok(screen.includes(part), part)
  assert.ok(!(await h.send('/app/schedule', undefined, ben.cookie)).text.includes('id="dashboard"'))
  // Resolving clears: Dee's time approved and its exception resolved, Ben's time off decided; the rest stay.
  const ok = await h.cmd('time.approve', { id: timesheet.id, revision: timesheet.revision }, priya.cookie)
  await h.cmd('time.resolve', { id: ok.id, revision: ok.revision, reason: 'Register log shows the close' }, priya.cookie)
  await h.cmd('leave.decide', { id: leave.id, revision: leave.revision, decision: 'approved' }, priya.cookie)
  d = await read(priya.cookie)
  assert.deepEqual([d.approvals.time, d.approvals.leave, ids(d.approvals.availability), d.exceptions, ids(d.overtime), ids(d.late)], [[], [], [eve.id], [], [alex.id], [ben.id]])
}))

test('CONTACT-001: staff keep their own emergency contacts; the cafe manager opens a no-show alert for that person and calls from the audited card; another cafe’s manager and a coworker are refused and both attempts are audited', () => run(async h => {
  const [cy, ben] = [await h.person('Cy'), await h.person('Ben')], priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const p of [cy, ben, priya, omar]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: p === omar ? 'Mission' : 'Ocean Beach' })
  // As staff, through the form: two contacts (the blank third row is dropped); four, or a phone without an area code, are refused.
  const form = async (fields, cookie) => { const body = new URLSearchParams(fields); return (await h.mf.dispatchFetch(h.origin + '/app/action?name=contact.save&returnTo=%2Fapp%2Fschedule', { method: 'POST', headers: { origin: h.origin, cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() })).text() }
  const rows = list => list.flatMap(([n, r, p]) => [['contactName', n], ['contactRelationship', r], ['contactPhone', p]])
  assert.match(await form(rows([['Rosa Diaz', 'Mother', '(415) 555-0134'], ['Sam Lee', 'Partner', '1-628-555-0199'], ['', '', '']]), cy.cookie), /Saved\./)
  const mine = (await h.state(cy.cookie)).contacts[0]
  assert.deepEqual(mine.contacts, [{ name: 'Rosa Diaz', relationship: 'Mother', phone: '+14155550134' }, { name: 'Sam Lee', relationship: 'Partner', phone: '+16285550199' }])
  await h.cmd('contact.save', { revision: mine.revision, contacts: [1, 2, 3, 4].map(i => ({ name: `C${i}`, relationship: 'Friend', phone: '4155550100' })) }, cy.cookie, 400)
  await h.cmd('contact.save', { revision: mine.revision, contacts: [{ name: 'Rosa Diaz', relationship: 'Mother', phone: '555-0134' }] }, cy.cookie, 400)
  await h.cmd('contact.save', { revision: mine.revision + 1, contacts: [] }, cy.cookie, 409)
  // Nobody else reads them in their state, agents included.
  assert.deepEqual([(await h.state(priya.cookie)).contacts, (await h.state(ben.cookie)).contacts, (await h.state()).contacts], [[], [], []])
  const key = await h.cmd('agent.create', { label: 'Roster assistant' })
  assert.deepEqual((await h.send('/api/lanyard/agent/context', undefined, '', { authorization: `Bearer ${key.token}` })).value.contacts, [])
  // Cy's shift began an hour ago and Cy never clocked in: a no-show alert on Priya's board links to the card.
  const start = Math.floor(Date.now() / 60000) * 60000 - 3600000, iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z')
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(start)), d = new Date(local + 'T00:00:00Z')
  const week = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10)
  await h.cmd('availability.save', { staffId: cy.id, start: iso(start - 86400000), end: iso(start + 2 * 86400000) })
  const draft = await h.cmd('roster.prepare', { week, shifts: [{ staffId: cy.id, start: iso(start), end: iso(start + 5 * 3600000), breakMinutes: 0 }] })
  await h.cmd('roster.publish', { id: draft.id, revision: draft.revision }, priya.cookie)
  await h.cmd('attendrule.save', { site: 'Ocean Beach', graceMinutes: 10, noShowMinutes: 30 })
  const board = (await h.state(priya.cookie)).attendance.find(r => r.staffId === cy.id)
  assert.equal(board.alert.kind, 'no-show')
  const timeScreen = (await h.send('/app/time', undefined, priya.cookie)).text, href = `href="/app/contacts/${cy.id}"`
  assert.ok(timeScreen.includes(href), 'the alert links to the contact card')
  assert.ok((await h.send(`/app/people`, undefined, priya.cookie)).text.includes(href), 'the People card links to it')
  assert.ok((await h.send(`/app/schedule?week=${week}`, undefined, priya.cookie)).text.includes(href), 'the shift card links to it')
  assert.ok(!(await h.send('/app/time', undefined, omar.cookie)).text.includes(href) && !(await h.send('/app/people', undefined, omar.cookie)).text.includes(href), 'no link where the card would be refused')
  const page = await h.send(`/app/contacts/${cy.id}`, undefined, priya.cookie)
  assert.equal(page.status, 200)
  for (const part of ['href="tel:+14155550134"', 'Call (415) 555-0134', 'Rosa Diaz', 'Mother', 'href="tel:+16285550199"']) assert.ok(page.text.includes(part), part)
  assert.deepEqual((await h.send(`/api/lanyard/contacts/${cy.id}`, undefined, h.owner)).value.contacts.map(x => x.phone), ['+14155550134', '+16285550199'])
  // Mission's manager and a coworker are refused, on the screen and the JSON door.
  for (const [who, path] of [[omar, `/app/contacts/${cy.id}`], [ben, `/api/lanyard/contacts/${cy.id}`]]) assert.equal((await h.send(path, undefined, who.cookie)).status, 404)
  // Every view and every refusal is in activity, naming the reader and the person; Cy reads them too.
  const seen = (await h.state()).events.filter(e => e.entityId === cy.id && e.action.startsWith('contact.') && e.action !== 'contact.save').map(e => [e.action, e.actorRole])
  assert.deepEqual(seen.sort(), [['contact.refused', 'manager'], ['contact.refused', 'staff'], ['contact.view', 'manager'], ['contact.view', 'owner']].sort())
  assert.equal((await h.state(cy.cookie)).events.filter(e => e.entityId === cy.id && e.action.startsWith('contact.') && e.action !== 'contact.save').length, 4)
  assert.deepEqual((await h.state(omar.cookie)).events.filter(e => e.entityId === cy.id && e.action === 'contact.view'), [])
}))

test('SALES-001: two weeks of hourly sales by CSV and one day by hand, labelled Manual; a duplicate upload is refused at preview; a correction keeps the earlier value; labor percentage and sales per labor hour follow, on the cafe’s week and its dashboard; other cafes and staff read none', () => run(async h => {
  const alex = await h.person('Alex'), priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  for (const p of [alex, priya, omar]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: p === omar ? 'Mission' : 'Ocean Beach', hourlyRate: '20.00' })
  await h.cmd('availability.save', { staffId: alex.id, start: '2026-10-05T07:00:00Z', end: '2026-10-12T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-05', shifts: [5, 6].map(d => ({ staffId: alex.id, start: `2026-10-0${d}T16:00:00Z`, end: `2026-10-0${d + 1}T00:00:00Z`, breakMinutes: 0 })) })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  // Sep 28 – Oct 11, 9:00 and 10:00, except Wed Oct 7: $300 + $500 and 30 + 50 checks a day.
  const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10)).filter(d => d !== '2026-10-07')
  const csv = 'Date,Hour,Net sales,Checks\n' + dates.flatMap(d => [`${d},9,"$300.00",30`, `${d},10:00,500,50`]).join('\n') + '\n'
  const mapping = 'sales=Net sales\ntransactions=Checks'
  const first = await h.cmd('sales.preview', { csv, mapping, site: 'Ocean Beach' }, priya.cookie)
  assert.deepEqual([first.entries.length, first.duplicates, first.errors], [52, [], []])
  assert.deepEqual((await h.cmd('sales.import', { csv, mapping, site: 'Ocean Beach', fingerprint: first.fingerprint }, priya.cookie)).imported, 52)
  // The same file again: every row is a duplicate at preview and the upload is refused; so is a file repeating its own row.
  const again = await h.cmd('sales.preview', { csv, mapping, site: 'Ocean Beach' }, priya.cookie)
  assert.equal(again.duplicates.length, 52)
  await h.cmd('sales.import', { csv, mapping, site: 'Ocean Beach', fingerprint: again.fingerprint }, priya.cookie, 409)
  const twice = await h.cmd('sales.preview', { csv: 'date,hour,sales\n2026-10-12,9,10\n2026-10-12,9,12\n', site: 'Ocean Beach' }, priya.cookie)
  assert.deepEqual(twice.duplicates.map(d => d.line), [3])
  // Wed Oct 7 by hand through the form, for the whole day; an hourly value beside it is refused.
  const body = new URLSearchParams({ site: 'Ocean Beach', date: '2026-10-07', hour: '', metric: 'sales', value: '1,000.00' })
  const posted = await h.mf.dispatchFetch(h.origin + '/app/action?name=sales.save&returnTo=%2Fapp%2Fschedule%3Fweek%3D2026-10-05', { method: 'POST', headers: { origin: h.origin, cookie: priya.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  assert.equal(posted.status,200);await posted.arrayBuffer()
  await h.cmd('sales.save', { site: 'Ocean Beach', date: '2026-10-07', hour: 9, metric: 'sales', value: '10' }, priya.cookie, 409)
  await h.cmd('sales.save', { site: 'Ocean Beach', date: '2026-10-06', hour: 9, metric: 'covers', value: '40' }, priya.cookie)
  // Correct Tuesday 9:00 from $300 to $350; the CSV value stays in its history.
  const read = async (cookie, query = 'week=2026-10-05', status = 200) => { const r = await h.send(`/api/lanyard/sales?${query}`, undefined, cookie); assert.equal(r.status, status, r.text); return r.value }
  const nine = (await read(priya.cookie)).days[1].entries.find(e => e.metric === 'sales' && e.hour === 9)
  await h.cmd('sales.save', { id: nine.id, revision: nine.revision, value: '350' }, priya.cookie)
  await h.cmd('sales.save', { id: nine.id, revision: nine.revision, value: '360' }, priya.cookie, 409)
  const w = await read(priya.cookie)
  const fixed = w.days[1].entries.find(e => e.id === nine.id)
  assert.deepEqual([fixed.value, fixed.source, fixed.versions.map(v => [v.value, v.source])], [35000, 'form', [[30000, 'csv']]])
  // Mon: $800 against 8 scheduled hours ($160): 20.0%, $100.00 an hour. Tue: $850, 18.8%, $106.25. Wed: $1,000, no scheduled labor.
  assert.deepEqual(w.days.slice(0, 3).map(d => [d.date, d.label, d.salesCents, d.laborCents, d.laborPercent, d.salesPerLaborHour, d.hourly]), [['2026-10-05', 'Manual', 80000, 16000, 20, 10000, true], ['2026-10-06', 'Manual', 85000, 16000, 18.8, 10625, true], ['2026-10-07', 'Manual', 100000, 0, 0, null, false]])
  assert.deepEqual([w.days[1].metrics, w.entered], [{ covers: 40, sales: 85000, transactions: 80 }, { days: 7, laborBasis: 'scheduled estimate', salesCents: 585000, laborCents: 32000, laborMinutes: 960, laborPercent: 5.5, salesPerLaborHour: 36563 }])
  const dash = (await h.send('/api/lanyard/dashboard?asOf=2026-10-08T15:30:00Z', undefined, priya.cookie)).value.labor[0]
  assert.deepEqual([dash.site, dash.actual], ['Ocean Beach', { days: 7, basis: 'scheduled estimate', salesCents: 585000, laborCents: 32000, percent: 5.5, salesPerLaborHour: 36563 }])
  const screen = (await h.send('/app/schedule?week=2026-10-05', undefined, priya.cookie)).text
  for (const part of ['id="sales"', 'Manual (CSV)', 'Manual (form)', '20.0%', '$106.25', 'earlier: $300.00']) assert.ok(screen.includes(part), part)
  // Mission's manager reads and enters only Mission; staff read none; the owner reads any cafe.
  assert.deepEqual([(await read(omar.cookie, 'week=2026-10-05&site=Ocean%20Beach')).site, (await read(omar.cookie, 'week=2026-10-05&site=Ocean%20Beach')).entered.days], ['Mission', 0])
  await h.cmd('sales.save', { site: 'Ocean Beach', date: '2026-10-12', metric: 'sales', value: '5' }, omar.cookie, 403)
  assert.equal((await h.cmd('sales.preview', { csv, mapping, site: 'Ocean Beach' }, omar.cookie)).errors.length, 26)
  await read(alex.cookie, 'week=2026-10-05', 403)
  assert.deepEqual([(await h.state(alex.cookie)).sales, (await h.state(omar.cookie)).sales], [[], []])
  assert.equal((await read(h.owner, 'week=2026-09-28&site=Ocean%20Beach')).entered.salesCents, 7 * 80000)
}))

test('REPORT-003: a day of hourly sales with scheduled and actual hours at two cafes gives labor percentage and sales per labor hour by interval and position matching hand figures; a dinner target flags the exceeded intervals; hours without sales are incomplete; each cafe reads only its own', () => run(async h => {
  const [alex, ben, mo] = [await h.person('Alex'), await h.person('Ben'), await h.person('Mo')], priya = await h.person('Priya', 'manager'), omar = await h.person('Omar', 'manager')
  const place = (p, site, position, hourlyRate) => h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position, site, hourlyRate })
  await place(alex, 'Ocean Beach', 'Barista', '20.00'); await place(ben, 'Ocean Beach', 'Kitchen', '24.00'); await place(mo, 'Mission', 'Barista', '18.00'); await place(priya, 'Ocean Beach', 'Manager', '30.00'); await place(omar, 'Mission', 'Manager', '30.00')
  // Mon Oct 5, 2026 (PDT): Alex 4–9 pm, Ben 5–8 pm at Ocean Beach; Mo 9–11 am at Mission. Ben actually stays until 8:30.
  const pdt = (d, hh, mm = 0) => new Date(Date.UTC(2026, 9, d, hh + 7, mm)).toISOString().replace('.000Z', 'Z')
  for (const p of [alex, ben, mo]) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-05T07:00:00Z', end: '2026-10-12T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-05', shifts: [{ staffId: alex.id, start: pdt(5, 16), end: pdt(5, 21), breakMinutes: 0 }, { staffId: ben.id, start: pdt(5, 17), end: pdt(5, 20), breakMinutes: 0 }, { staffId: mo.id, start: pdt(5, 9), end: pdt(5, 11), breakMinutes: 0 }] })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  for (const [p, a, b] of [[alex, pdt(5, 16), pdt(5, 21)], [ben, pdt(5, 17), pdt(5, 20, 30)]]) await h.cmd('time.prepare', { staffId: p.id, start: a, end: b, breakMinutes: 0, reason: 'Paper sheet' }, priya.cookie)
  for (const [hour, value] of [[17, '400'], [18, '600'], [19, '500'], [20, '200']]) await h.cmd('sales.save', { site: 'Ocean Beach', date: '2026-10-05', hour, metric: 'sales', value }, priya.cookie)
  await h.cmd('sales.save', { site: 'Mission', date: '2026-10-05', hour: 9, metric: 'sales', value: '150' }, omar.cookie)
  // Dinner 5–9 pm at a 9% target.
  await h.cmd('daypart.save', { site: 'Ocean Beach', name: 'Dinner', start: '17:00', end: '21:00', targetPercent: '9' }, omar.cookie, 403)
  await h.cmd('daypart.save', { site: 'Ocean Beach', name: 'Dinner', start: '17:00', end: '21:00', targetPercent: '9' }, priya.cookie)
  await h.cmd('daypart.save', { site: 'Ocean Beach', name: 'Late', start: '20:00', end: '22:00', targetPercent: '12' }, priya.cookie, 409)
  const read = async (cookie, query, status = 200) => { const r = await h.send(`/api/lanyard/intervals?${query}`, undefined, cookie); assert.equal(r.status, status, r.text); return r.value }
  const ob = await read(priya.cookie, 'date=2026-10-05&size=60')
  const row = (r, time) => r.intervals.find(x => x.time === time)
  // 4 pm: Alex's hour ($20.00) with no sales: incomplete, never zero.
  assert.deepEqual([row(ob, '16:00').incomplete, row(ob, '16:00').salesCents, row(ob, '16:00').actual.cents, row(ob, '16:00').actual.laborPercent], [true, null, 2000, null])
  // 5 pm: $400 against Alex + Ben ($20 + $24 = $44.00): 11.0%, $200.00 per labor hour, over the 9% dinner target.
  // 6 pm: $600, 7.3%; 7 pm: $500, 8.8%; 8 pm: $200 against scheduled Alex ($20, 10.0%) and actual Alex + Ben's half hour ($32, 16.0%).
  assert.deepEqual(['17:00', '18:00', '19:00', '20:00'].map(t => { const x = row(ob, t); return [t, x.salesCents, x.scheduled.cents, x.scheduled.laborPercent, x.actual.minutes, x.actual.cents, x.actual.laborPercent, x.actual.salesPerLaborHour, x.exceeded] }),
    [['17:00', 40000, 4400, 11, 120, 4400, 11, 20000, true], ['18:00', 60000, 4400, 7.3, 120, 4400, 7.3, 30000, false], ['19:00', 50000, 4400, 8.8, 120, 4400, 8.8, 25000, false], ['20:00', 20000, 2000, 10, 90, 3200, 16, 13333, true]])
  assert.deepEqual([row(ob, '17:00').actual.byPosition, row(ob, '17:00').daypart, row(ob, '21:00').scheduled.minutes], [{ Barista: { minutes: 60, cents: 2000 }, Kitchen: { minutes: 60, cents: 2400 } }, { name: 'Dinner', targetPercent: 9 }, 0])
  // Half hours take half the hour's sales, labelled as split.
  const half = row(await read(priya.cookie, 'date=2026-10-05&size=30'), '17:30')
  assert.deepEqual([half.salesCents, half.salesBasis, half.actual.cents, half.actual.laborPercent], [20000, 'hourly sales split evenly', 2200, 11])
  assert.equal((await read(priya.cookie, 'date=2026-10-05&size=15')).intervals.length, 96)
  // Mission: Mo's scheduled $18.00 hour against $150: 12.0% (nothing worked yet: 0.0%); 10 am has no sales. Omar reads only Mission whatever is asked; the owner picks.
  const mission = await read(omar.cookie, 'site=Ocean%20Beach&date=2026-10-05&size=60')
  assert.deepEqual([mission.site, row(mission, '09:00').actual.laborPercent, row(mission, '09:00').scheduled.laborPercent, row(mission, '10:00').incomplete, mission.dayparts], ['Mission', 0, 12, true, []])
  assert.equal(row(await read(h.owner, 'site=Ocean%20Beach&date=2026-10-05&size=60'), '20:00').actual.laborPercent, 16)
  await read(alex.cookie, 'date=2026-10-05&size=60', 403)
  await read(priya.cookie, 'date=2026-10-05&size=20', 400)
  const page = (await h.send('/app/intervals?site=Ocean%20Beach&date=2026-10-05&size=60', undefined, priya.cookie)).text
  for (const part of ['id="intervals"', '2 over target', 'incomplete', '16.0%', 'Dinner 9.0%']) assert.ok(page.includes(part), part)
}))

test('AUTO-001: the owner previews and authorizes a cafe rule that approves only clean schedule-matching punched time; exception-bearing, off-schedule, unattested, edited and managers’ time stays for a person; a stale preview is refused; a paused rule approves nothing and payroll carries only approved time', () => run(async h => {
  const team = ['Ana', 'Ben', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus']
  const people = {}; for (const n of team) people[n] = await h.person(n)
  const priya = await h.person('Priya', 'manager')
  for (const p of [...Object.values(people), priya]) await h.cmd('staff.save', { id: p.id, revision: p.revision, name: p.name, email: p.email, payrollId: p.payrollId, role: p.role, active: true, position: 'Barista', site: 'Ocean Beach', hourlyRate: '20.00' })
  // Mon Oct 5, 2026: everyone 9 am – 5 pm PDT with a 30-minute meal.
  const all = [...Object.values(people), priya]
  for (const p of all) await h.cmd('availability.save', { staffId: p.id, start: '2026-10-05T07:00:00Z', end: '2026-10-12T07:00:00Z' })
  const week = await h.cmd('roster.prepare', { week: '2026-10-05', shifts: all.map(p => ({ staffId: p.id, start: '2026-10-05T16:00:00Z', end: '2026-10-06T00:00:00Z', breakMinutes: 30 })) })
  await h.cmd('roster.publish', { id: week.id, revision: week.revision }, priya.cookie)
  const punch = async (p, inAt, outAt, extra = {}) => { await h.cmd('clock.in', { commandId: `${p.name}-in`, capturedAt: inAt }, p.cookie); return (await h.cmd('clock.out', { commandId: `${p.name}-out`, capturedAt: outAt, breakMinutes: 30, breakNote: 'Took my meal at noon', ...extra }, p.cookie)).timesheet }
  await h.cmd('clockrule.save', { site: 'Ocean Beach', position: '', early: 'flag', earlyMinutes: 10, unscheduled: 'allow' })
  await h.cmd('autorule.save', { site: 'Ocean Beach' }, priya.cookie, 403)
  let rule = await h.cmd('autorule.save', { site: 'Ocean Beach' })
  assert.equal(rule.status, 'draft')
  // Ana and Eve clean (the scheduled minutes); Ben 20 minutes early, flagged as an exception; Cy without the break attestation; Dee with no meal; Priya is a manager.
  const ana = await punch(people.Ana, '2026-10-05T16:00:20Z', '2026-10-06T00:00:00Z')
  const eve = await punch(people.Eve, '2026-10-05T16:00:00Z', '2026-10-06T00:00:40Z')
  const ben = await punch(people.Ben, '2026-10-05T15:40:00Z', '2026-10-06T00:00:00Z')
  assert.ok(ben.exceptions.length)
  await punch(people.Cy, '2026-10-05T16:00:00Z', '2026-10-06T00:00:00Z', { breakNote: undefined })
  await punch(people.Dee, '2026-10-05T16:00:00Z', '2026-10-06T00:00:00Z', { breakMinutes: 0 })
  await punch(priya, '2026-10-05T16:00:00Z', '2026-10-06T00:00:00Z')
  // Drafts approve nothing as time is submitted.
  assert.equal((await h.state()).timesheets.filter(t => t.status === 'approved').length, 0)
  const look = async () => (await h.send(`/api/lanyard/autorules/${rule.id}/preview`, undefined, h.owner)).value
  const byName = v => Object.fromEntries(v.items.map(x => [all.find(p => p.id === x.staffId).name, x.decision === 'approve' ? 'approve' : x.reasons.join('; ')]))
  const first = await look()
  assert.deepEqual(byName(first), { Ana: 'approve', Eve: 'approve', Ben: ['not the scheduled start and end', ...ben.exceptions.map(e => `exception: ${e}`)].join('; '), Cy: 'no break attestation', Dee: 'breaks differ from the schedule', Priya: 'own time of a person who approves time' })
  assert.equal((await h.send(`/api/lanyard/autorules/${rule.id}/preview`, undefined, priya.cookie)).status, 403)
  assert.deepEqual((await look()).digest, first.digest, 'a preview writes nothing')
  // A manager edits Eve's time after the preview: the old preview cannot authorize, and Eve now needs a person.
  await h.cmd('time.edit', { id: eve.id, revision: eve.revision, start: '2026-10-05T16:00:00Z', end: '2026-10-06T00:00:00Z', breakMinutes: 30, reason: 'Register log' }, priya.cookie)
  await h.cmd('autorule.authorize', { id: rule.id, revision: rule.revision, digest: first.digest }, h.owner, 409)
  const second = await look()
  assert.deepEqual([byName(second).Ana, byName(second).Eve], ['approve', 'edited by a manager'])
  await h.cmd('autorule.authorize', { id: rule.id, revision: rule.revision, digest: second.digest }, priya.cookie, 403)
  rule = await h.cmd('autorule.authorize', { id: rule.id, revision: rule.revision, digest: second.digest })
  assert.deepEqual([rule.status, rule.approved], ['active', [ana.id]])
  let s = await h.state()
  const auto = s.timesheets.find(t => t.id === ana.id)
  assert.deepEqual([auto.status, auto.approvedBy, auto.automation.ruleId, auto.automation.version, auto.automation.inputRevision], ['approved', `rule:${rule.id}`, rule.id, 1, ana.revision])
  assert.deepEqual(s.timesheets.filter(t => t.status === 'submitted').map(t => all.find(p => p.id === t.staffId).name).sort(), ['Ben', 'Cy', 'Dee', 'Eve', 'Priya'])
  // Active: Fay's clean clock-out is approved as it is submitted. Paused: Gus's stays for a person.
  const fay = await punch(people.Fay, '2026-10-05T16:00:00Z', '2026-10-06T00:00:00Z')
  assert.equal((await h.state()).timesheets.find(t => t.id === fay.id).automation.ruleId, rule.id)
  rule = await h.cmd('autorule.pause', { id: rule.id, revision: rule.revision })
  const gus = await punch(people.Gus, '2026-10-05T16:00:00Z', '2026-10-06T00:00:00Z')
  s = await h.state()
  assert.deepEqual([s.timesheets.find(t => t.id === fay.id).status, s.timesheets.find(t => t.id === gus.id).status], ['approved', 'submitted'])
  // Payroll carries only approved time: Ana and Fay.
  assert.deepEqual((await h.cmd('payroll.prepare', {})).lines.map(l => l.timeId).sort(), [ana.id, fay.id].sort())
  rule = await h.cmd('autorule.revoke', { id: rule.id, revision: rule.revision })
  await h.cmd('autorule.authorize', { id: rule.id, revision: rule.revision, digest: (await look()).digest }, h.owner, 409)
  await h.mf.dispatchFetch(h.origin + '/setup', { method: 'POST', headers: { origin: h.origin, cookie: h.owner, 'content-type': 'application/x-www-form-urlencoded' }, body: 'confirm=yes', redirect: 'manual' })
  const pay = (await h.send('/app/payroll', undefined, h.owner)).text
  assert.ok(pay.includes('id="auto-approval"') && !pay.includes('Authorize v1'), 'the revoked rule is no longer offered for authorization')
  assert.deepEqual((await h.state(priya.cookie)).autorulePreviews, undefined)
}))


test('CLOCK-002: encrypted offline phone capture survives client restart and reconciles exactly once',async()=>{const {offlineJourney}=await import('./clock-offline-journey.mjs');await offlineJourney()})

test('SCHEDULE-001: live review is read-only, persists conflicts and budgets, counts roles/sites/gaps and preserves duplicate diff rows',()=>run(async h=>{
 const future=new Date(Date.now()+14*86400000);future.setUTCDate(future.getUTCDate()-((future.getUTCDay()+6)%7))
 const day=n=>new Date(future.getTime()+n*86400000).toISOString().slice(0,10),week=day(0)
 const alex=await h.person('Alex'),sam=await h.person('Sam'),priya=await h.person('Priya','manager')
 for(const [p,site,rate] of [[alex,'Harbor',20],[sam,'Market',25]]){
  await h.cmd('staff.save',{id:p.id,revision:1,name:p.name,email:p.email,payrollId:p.name.toUpperCase(),role:'staff',active:true,site,position:'Counter',hourlyRate:rate})
  await h.cmd('availability.save',{staffId:p.id,start:day(0)+'T07:00:00Z',end:day(7)+'T07:00:00Z'})
 }
 const shifts=[{staffId:alex.id,start:day(1)+'T15:00:00Z',end:day(1)+'T23:00:00Z',breakMinutes:30,label:'Counter',site:'Harbor'},{staffId:sam.id,start:day(1)+'T15:00:00Z',end:day(1)+'T23:00:00Z',breakMinutes:30,label:'Kitchen',site:'Market'}]
 const first=await h.cmd('roster.prepare',{week:week,shifts});await h.cmd('roster.publish',{id:first.id,revision:first.revision})
 await h.cmd('forecast.save',{week:week,site:'Harbor',days:[100,100,100,100,100,100,100],budgetPercent:10})
 await h.cmd('openshift.post',{site:'Harbor',position:'Counter',start:day(2)+'T15:00:00Z',end:day(2)+'T23:00:00Z',breakMinutes:30,approval:'manager'})
 const before=await h.state(),input={week:week,shifts:[shifts[0],shifts[0],{...shifts[1],start:day(2)+'T15:00:00Z',end:day(2)+'T23:00:00Z'}]}
 const r=await h.send('/api/lanyard/schedule/review',input,priya.cookie);assert.equal(r.status,200)
 assert.equal(r.value.added.length,2);assert.equal(r.value.removed.length,1);assert.equal(r.value.unchanged.length,1)
 assert.equal(r.value.days[1].costCents,30000);assert.equal(r.value.days[1].headcount,1);assert.equal(r.value.days[2].costCents,18750)
 assert.ok(r.value.conflicts.some(c=>c.reason==='Overlapping shift'));assert.ok(r.value.warnings.some(w=>w.kind==='budget'))
 assert.equal(r.value.gaps.length,1);assert.equal(r.value.days[2].gaps,1);assert.equal(r.value.sites.length,2)
 assert.equal((await h.state()).version,before.version,'preview cannot write a draft or an audit event')
 assert.equal((await h.send('/api/lanyard/schedule/review',input,alex.cookie)).status,403)
 assert.equal((await h.send('/api/lanyard/schedule/review',input,'')).status,401)
 assert.equal((await h.send('/api/lanyard/schedule/review',input,priya.cookie,{origin:'https://elsewhere.example'})).status,403)
 const draft=await h.cmd('roster.prepare',input)
 const reload=await h.send(`/app/schedule?week=${week}&view=draft`,undefined,priya.cookie)
 const savedReview=(await h.state()).scheduleReviews.find(r=>r.week===week)
 for(const issue of savedReview.conflicts)assert.ok(reload.text.includes(issue.reason))
 for(const warning of savedReview.warnings.filter(w=>w.kind==='budget'))assert.ok(reload.text.includes(warning.message))
 assert.ok(reload.text.includes('data-saved-review'))
 assert.deepEqual((await h.state(alex.cookie)).scheduleReviews,[]);assert.equal((await h.state(alex.cookie)).shifts.length,1)
 await h.cmd('roster.publish',{id:draft.id,revision:draft.revision},priya.cookie,409)
 // Every existing preparation door has the same saved review, including draft open positions.
 const template=await h.cmd('template.save',{name:'Service week',week:week})
 const target=day(7)
 const copied=await h.cmd('template.apply',{id:template.id,week:target})
 let inherited=(await h.state()).scheduleReviews.find(r=>r.week===target)
 assert.ok(inherited.conflicts.length);assert.ok(inherited.gaps.some(g=>g.kind==='open shift'))
 const copiedInputs=copied.shifts.map(({staffId,start,end,breakMinutes,label,site})=>({staffId,start,end,breakMinutes,label,site}))
 await h.cmd('roster.prepare',{week:target,shifts:copiedInputs})
 assert.ok((await h.state()).scheduleReviews.find(r=>r.week===target).gaps.some(g=>g.kind==='open shift'),'editing a draft retains its open positions')
 await h.cmd('roster.copy',{fromWeek:week,week:day(14)})
 assert.ok((await h.state()).scheduleReviews.some(r=>r.week===day(14)&&r.conflicts.length))
 await h.cmd('recurrence.save',{staffId:alex.id,days:[0],start:'08:00',end:'16:00',breakMinutes:30,label:'Counter',site:'Harbor',from:day(21),until:day(27)})
 await h.cmd('recurrence.apply',{week:day(21)})
 assert.ok((await h.state()).scheduleReviews.some(r=>r.week===day(21)&&r.conflicts.length))
}))

test('SCHEDULE-001: visual service-week editing, resize, copy, bulk assignment, undo and reviewed publish work at 1440 and 390',async()=>{const {scheduleJourney}=await import('./schedule-journey.mjs');await scheduleJourney()})


test('PEOPLE-002: qualifications, expiring certificates, preferences, effective job rates, retained costs and inherited template/swap/pickup checks through HTTP',()=>run(async h=>{const {workforceApi}=await import('./workforce-journey.mjs');await workforceApi(h)}))
test('PEOPLE-002: retained rate costs in schedule/grid, interval reports and time review at 1440 and 390',async()=>{const {workforceBrowser}=await import('./workforce-journey.mjs');await workforceBrowser()})

test('SCHEDULE-004: native shift handover keeps revisioned notes/checklists and immutable blockers; reassignment, offers, cancellation and supersession fence instructions while authors retain their own responses',()=>run(async h=>{
 const {days,monday}=await import('./workforce-journey.mjs'),pin=r=>({id:r.id,revision:r.revision})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),morgan=await h.person('Morgan','manager'),taylor=await h.person('Taylor','manager')
 for(const p of [alex,ben,cy,morgan,taylor])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,position:'Counter',site:p===taylor?'Mission':'Ocean Beach'})
 const week=days(monday(new Date().toISOString().slice(0,10)),14),start=week+'T16:00:00Z',end=week+'T20:00:00Z'
 for(const p of [alex,ben,cy])await h.cmd('availability.save',{staffId:p.id,start:days(week,-1)+'T00:00:00Z',end:days(week,7)+'T00:00:00Z'})
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:alex.id,start,end,breakMinutes:0,label:'Service'}]})
 let shift=draft.shifts[0],request={shiftId:shift.id,shiftRevision:shift.revision,notes:'Private safe handover',tasks:['Sanitize counter','Lock kitchen']}
 await h.cmd('shiftwork.save',request,morgan.cookie,409)
 await h.cmd('roster.publish',pin(draft));shift=(await h.state()).shifts.find(x=>x.id===shift.id)
 const shiftPin=()=>({shiftId:shift.id,shiftRevision:shift.revision})
 request={...request,...shiftPin()}
 await h.cmd('shiftwork.save',request,alex.cookie,403);await h.cmd('shiftwork.save',request,taylor.cookie,403)
 const work=await h.cmd('shiftwork.save',request,morgan.cookie)
 assert.equal(work.notes,request.notes);assert.equal(work.tasks.length,2);assert.ok(work.by&&work.at)
 assert.deepEqual((await h.state(ben.cookie)).shiftwork,[]);assert.deepEqual((await h.state(taylor.cookie)).shiftwork,[])
 const mine=(await h.state(alex.cookie)).shiftwork[0];assert.equal(mine.notes,work.notes);assert.ok(!('versions'in mine))
 const response={...shiftPin(),revision:work.revision,completed:[work.tasks[0].id],blocker:'Kitchen lock jammed'}
 await h.cmd('shiftwork.respond',response,ben.cookie,403)
 const answer=await h.cmd('shiftwork.respond',response,alex.cookie)
 assert.deepEqual(answer.completed,[work.tasks[0]]);assert.equal(answer.workRevision,work.revision);assert.equal(answer.staffId,alex.id);assert.ok(answer.by&&answer.at)
 assert.deepEqual((await h.state(morgan.cookie)).taskanswers,[answer]);assert.deepEqual((await h.state(ben.cookie)).taskanswers,[]);assert.deepEqual((await h.state(taylor.cookie)).taskanswers,[])
 await h.cmd('shiftwork.respond',{...response,completed:[work.tasks[0].id,work.tasks[0].id]},alex.cookie,409)
 const beforeBad=(await h.state()).version
 await h.cmd('shiftwork.save',{...request,revision:work.revision,tasks:Array(31).fill('Too many')},morgan.cookie,400)
 await h.cmd('shiftwork.save',{...request,revision:work.revision,notes:'x'.repeat(4001)},morgan.cookie,400)
 assert.equal((await h.state()).version,beforeBad)
 const changed=await h.cmd('shiftwork.save',{...request,revision:work.revision,notes:'Changed private handover',tasks:['Recheck counter','Lock kitchen']},morgan.cookie)
 assert.deepEqual(changed.versions[0].tasks,work.tasks);assert.equal(changed.versions[0].notes,work.notes);assert.equal(changed.versions[0].revision,1)
 await h.cmd('shiftwork.save',{...request,revision:work.revision},morgan.cookie,409)
 await h.cmd('shiftwork.respond',response,alex.cookie,409)
 await h.cmd('shiftwork.respond',{...response,revision:changed.revision},alex.cookie,409)
 const later=await h.cmd('shiftwork.respond',{...shiftPin(),revision:changed.revision,completed:[changed.tasks[1].id],blocker:''},alex.cookie)
 assert.equal(later.workRevision,2);assert.deepEqual((await h.state()).taskanswers.find(x=>x.id===answer.id),answer)
 // Instructions never enter print, wall, worked time or payroll.
 const posted=await h.cmd('schedule.post',{week,site:'Ocean Beach'})
 const pdf=await h.mf.dispatchFetch(`${h.origin}/api/lanyard/postings/${posted.id}.pdf`,{headers:{cookie:h.owner}}),pdfText=Buffer.from(await pdf.arrayBuffer()).toString('latin1')
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 const wall=await h.send(`/app/wall?week=${week}&site=Ocean%20Beach`,undefined,h.owner)
 assert.equal(wall.status,200)
 for(const out of [pdfText,wall.text,JSON.stringify(posted)])for(const secret of [work.notes,changed.notes,answer.blocker,...work.tasks.map(t=>t.text)])assert.ok(!out.includes(secret),secret)
 const state=await h.state();assert.deepEqual(state.timesheets,[]);assert.deepEqual(state.batches,[]);assert.equal(state.shifts.find(x=>x.id===shift.id).minutes,240)
 // An offer is not assignment. In-place cover moves instructions to its assignee.
 await h.cmd('shift.callout',{...pin(shift),note:'Unavailable'},alex.cookie)
 shift=(await h.state()).shifts.find(x=>x.id===shift.id)
 assert.equal((await h.state(ben.cookie)).offers.length,1);assert.deepEqual((await h.state(ben.cookie)).shiftwork,[])
 const offer=(await h.state(ben.cookie)).offers[0],accepted=await h.cmd('cover.respond',{...pin(offer),decision:'accepted'},ben.cookie)
 assert.deepEqual((await h.state(ben.cookie)).shiftwork,[])
 await h.cmd('cover.approve',pin(accepted),morgan.cookie)
 shift=(await h.state()).shifts.find(x=>x.id===shift.id)
 assert.deepEqual((await h.state(alex.cookie)).shiftwork,[]);assert.equal((await h.state(ben.cookie)).shiftwork[0].id,work.id)
 assert.deepEqual((await h.state(alex.cookie)).taskanswers.map(x=>x.id).sort(),[answer.id,later.id].sort());assert.deepEqual((await h.state(ben.cookie)).taskanswers,[])
 await h.cmd('shiftwork.respond',{...shiftPin(),revision:changed.revision,completed:[],blocker:'Former assignee'},alex.cookie,403)
 const benAnswer=await h.cmd('shiftwork.respond',{...shiftPin(),revision:changed.revision,completed:[],blocker:'Handover accepted; lock still jammed'},ben.cookie)
 // Supersession retains the instruction lineage, but grants only the new assignee.
 const moved=await h.cmd('shift.change',{...pin(shift),staffId:cy.id,reason:'Coverage handover'},morgan.cookie)
 const oldShift=shift;shift=moved.shift
 assert.deepEqual((await h.state(ben.cookie)).shiftwork,[]);assert.equal((await h.state(cy.cookie)).shiftwork[0].id,work.id)
 assert.deepEqual((await h.state(ben.cookie)).taskanswers,[benAnswer]);assert.deepEqual((await h.state(cy.cookie)).taskanswers,[])
 await h.cmd('shiftwork.respond',{shiftId:oldShift.id,shiftRevision:oldShift.revision+1,revision:changed.revision,completed:[],blocker:'Obsolete shift'},ben.cookie,409)
 await h.cmd('shiftwork.respond',{...shiftPin(),revision:changed.revision,completed:[],blocker:'Current assignee'},cy.cookie)
 await h.cmd('shift.cancel',{...pin(shift),reason:'Service canceled'},morgan.cookie)
 assert.deepEqual((await h.state(cy.cookie)).shiftwork,[]);assert.equal((await h.state(cy.cookie)).taskanswers.length,1)
 assert.equal((await h.state(morgan.cookie)).taskanswers.length,4);assert.equal((await h.state(morgan.cookie)).shiftwork[0].versions.length,1)
 const key=await h.cmd('agent.create',{label:'No handover access'}),headers={authorization:`Bearer ${key.token}`}
 const agent=await h.send('/api/lanyard/agent/context',undefined,'',headers);assert.equal(agent.status,200);assert.deepEqual(agent.value.shiftwork,[]);assert.deepEqual(agent.value.taskanswers,[])
 assert.equal((await h.send('/api/lanyard/agent/command',{name:'shiftwork.save',input:request},'',headers)).status,403)
 assert.equal((await h.send('/api/lanyard/state')).status,401)
}))


test('SCHEDULE-004: blocker files, immutable job-area reconciliation, labor costs and once-only split payroll with signed corrections through native HTTP',()=>run(async h=>{const {handoverApi}=await import('./shiftwork-api.mjs');await handoverApi(h)}))

test('SCHEDULE-004: managers publish counter/kitchen handovers, staff complete tasks with blocker files and managers reconcile labor and export payroll at 1440 and 390',async()=>{const {handoverBrowser}=await import('./shiftwork-browser.mjs');await handoverBrowser()})

test('CLOCK-008: a phone job change splits the punch into qualified job segments with retained rates, refuses unqualified jobs and ineligible or off-network cafes, exports split payroll with signed per-job corrections and counts every segment toward weekly overtime through native HTTP',()=>run(async h=>{const {transferApi}=await import('./transfer-journey.mjs');await transferApi(h)}))

test('CLOCK-008: staff change job from the phone clock and managers approve the job segments with rates and pay codes and export split payroll at 1440 and 390',async()=>{const {transferBrowser}=await import('./transfer-journey.mjs');await transferBrowser()})

test('TIPS-002: a tipped server’s low-tip week raises a make-up pay input and the normal week none, side work on a non-tipped job is reported, a new minimum wage checks only later weeks, and tip-credit setups in California and the six other barring states are refused through native HTTP',()=>run(async h=>{const {tipCreditApi}=await import('./tipcredit-journey.mjs');await tipCreditApi(h)}))

test('TIPS-002: the owner is refused a California tip credit, sets one up for a Texas cafe and reads each week’s make-up pay input and non-tipped duty time with the cafe manager at 1440 and 390',async()=>{const {tipCreditBrowser}=await import('./tipcredit-journey.mjs');await tipCreditBrowser()})

test('PAY-009: independent pay groups recur on all four schedules; a whole Sunday workweek crossing the fifteenth carries traced once-only overtime to the second locked period and EARN-001 shows scheduled dates',()=>run(async h=>{const {payScheduleApi}=await import('./payschedules-journey.mjs');await payScheduleApi(h)}))
test('PAY-009: the payroll administrator defines and opens a pay schedule, reviews the cross-period overtime adjustment and the employee reads the scheduled period and pay date at 1440 and 390',async()=>{const {payScheduleBrowser}=await import('./payschedules-journey.mjs');await payScheduleBrowser()})


test('PAYRULE-002: federal and site holidays, eligibility, retained area premiums, earnings, non-work service and once-only signed payroll corrections',()=>run(async h=>{const {holidayApi}=await import('./holidays-api.mjs');await holidayApi(h)}))

test('PAYRULE-002: owners configure holidays, inspect eligibility, approve non-work pay and view area payroll, schedule costs and employee estimates at 1440 and 390',async()=>{const {holidayBrowser}=await import('./holidays-journey.mjs');await holidayBrowser()})

test('PAYRULE-003: CA reporting and split, NY call-in and spread inputs retain source/area rates, reasoned disputes, own estimates and once-only signed payroll corrections',()=>run(async h=>{const {premiumApi}=await import('./premiums-api.mjs');await premiumApi(h)}))
test('PAYRULE-003: owners configure and review premium facts, managers dispute and approve inputs, payroll exports and staff read estimates at 1440 and 390',async()=>{const {premiumBrowser}=await import('./premiums-journey.mjs');await premiumBrowser()})

test('FAIR-001: eight-week source-backed preference gaps, preferred-block shifts, configurable inputs, unknown evidence, cafe authority and feedback independence through native HTTP',()=>run(async h=>{const {fairnessApi}=await import('./fairness-journey.mjs');await fairnessApi(h);const {fairnessOptimizationApi}=await import('./fairness-optimization-journey.mjs');await run(async other=>fairnessOptimizationApi(other))}))
test('FAIR-001: a manager inspects preference gaps, downloads inputs, changes the window and sees unknown weeks at 1440 and 390',async()=>{const {fairnessBrowser}=await import('./fairness-journey.mjs');await fairnessBrowser();const {fairnessOptimizationBrowser}=await import('./fairness-optimization-journey.mjs');await fairnessOptimizationBrowser()})

test('TRADEOFF-001: fixed-slot alternatives explain cost, fairness, coverage and unknown inputs without publishing or waiving hard constraints',()=>run(async h=>{const {tradeoffApi,tradeoffOvertimeApi}=await import('./tradeoff-journey.mjs');await tradeoffApi(h);await run(other=>tradeoffOvertimeApi(other));const {comparisonScopeApi}=await import('./comparison-scope-journey.mjs');await run(other=>comparisonScopeApi(other))}))
test('TRADEOFF-001: a manager inspects explained alternatives, downloads facts and explicitly publishes the selected draft at 1440 and 390',async()=>{const {tradeoffBrowser}=await import('./tradeoff-journey.mjs');await tradeoffBrowser();const {comparisonScopeBrowser}=await import('./comparison-scope-journey.mjs');await comparisonScopeBrowser()})


test('AUTO-001: Sunday workweeks keep 40-hour captured time eligible, hold 41 hours for human review and start a fresh Sunday independently of the prior week',()=>run(async h=>{const {workweekApi}=await import('./autorules-workweek-journey.mjs');await workweekApi(h)}))
test('AUTO-001: owner preview, authorization and next-workweek approval preserve the overtime hold on Payroll at 1440 and 390',async()=>{const {workweekBrowser}=await import('./autorules-workweek-journey.mjs');await workweekBrowser()})


test('SCHEDULE-002 and COVER-002: position-only templates add to an empty week privately, retain draft slots, publish without assigned shifts and fill once; assigned edits preserve positions and archive superseded draft rows',()=>run(async h=>{const {openTemplateApi}=await import('./open-template-journey.mjs');await openTemplateApi(h)}))
test('SCHEDULE-002 and COVER-002: a manager saves, applies, reviews and publishes a position-only week, then fills an employee pickup at 1440 and 390',async()=>{const {openTemplateBrowser}=await import('./open-template-journey.mjs');await openTemplateBrowser()})

test('TIME-007: provisional job-segment labor stops at the scheduled end, stays reviewable and is replaced once on confirmation at 1440 and 390',async()=>{const {provisionalLaborBrowser}=await import('./provisional-labor-journey.mjs');await provisionalLaborBrowser()})

test('AVAIL-001: staff saving and managers approving a lower weekly maximum see the affected published shift at 1440 and 390',async()=>{const {availabilityLimitBrowser}=await import('./availability-limit-journey.mjs');await availabilityLimitBrowser()})

test('SCHEDULE-006: repeated approved swaps retain every assignment, decision reason and acknowledgment for original and later assignees in history and CSV',()=>run(async h=>{const {repeatedHistoryApi}=await import('./schedule-history-journey.mjs');await repeatedHistoryApi(h)}))
test('SCHEDULE-006: managers and original assignees read both swaps and all acknowledgments at 1440 and 390',async()=>{const {repeatedHistoryBrowser}=await import('./schedule-history-journey.mjs');await repeatedHistoryBrowser()})

test('TIME-009: policy meals, waiver thresholds, full paid-rest counts and unknown manual breaks reconcile beside automatic deductions through native HTTP',()=>run(async h=>{const {breakReviewApi}=await import('./break-review-journey.mjs');await breakReviewApi(h)}))
test('TIME-009: managers compare taken and required meals and paid rests and filter exceptions at 1440 and 390',async()=>{const {breakReviewBrowser}=await import('./break-review-journey.mjs');await breakReviewBrowser()})

test('LEARN-001: retained pre-service manual forecasts reconcile to corrected daily and complete hourly sales; missing outcomes and no-show signals stay unknown under native cafe scope without policy or schedule writes',()=>run(async h=>{const {learningApi}=await import('./learning-journey.mjs');await learningApi(h)}))

test('durable in-Lanyard reminders survive cron replay and restart, withdraw on resolution and escalate once',()=>run(async h=>{const {noticesApi}=await import('./notices-journey.mjs');await noticesApi(h)}))
test('reminder inbox and manager settings work on Schedule and Time at 1440 and 390',async()=>{const {noticesBrowser}=await import('./notices-journey.mjs');await noticesBrowser()})
test('reminders follow a changed revision, a missed meal, a closed offer and owner-only escalation',()=>run(async h=>{const {noticesCases}=await import('./notices-journey.mjs');await noticesCases(h)}))
test('DEMAND-001: hourly forecasts from entered sales carry event uplift, uncertainty, staleness, reasoned overrides and actual error, and add forecast hours to the interval report without writing schedules',()=>run(async h=>{const {demandOutcomes}=await import('./demand-journey.mjs');await demandOutcomes(h)}))
test('DEMAND-001: the forecast, incomplete and interval screens work at 1440 and 390',async()=>{const {demandBrowser}=await import('./demand-journey.mjs');await demandBrowser()})
test('LEARN-001: comparable demand forecasts propose a held-out growth change that a manager approves, declines or reverts without altering history or schedules',()=>run(async h=>{const {learnApi}=await import('./learn-demand-journey.mjs');await learnApi(h)}))
test('LEARN-001: a manager reviews the held-out comparison and approves then reverts a proposal at 1440 and 390',async()=>{const {learnBrowser}=await import('./learn-demand-journey.mjs');await learnBrowser()})

// Scoped access, operational messages and shared-device authority use native HTTP doors.
test('ACCESS-003: site-scoped draft and swap permissions, grant ceilings, live revocation, contact refusal and wage exclusion',()=>run(async h=>{const {accessApi}=await import('./access-chat-kiosk-journey.mjs');await accessApi(h)}))
test('CHAT-001: operational announcements and handovers, acknowledgments, search, attachments and current membership',()=>run(async h=>{const {chatApi}=await import('./access-chat-kiosk-journey.mjs');await chatApi(h)}))
test('CLOCK-001: device and employee verification, consecutive users, private photo receipts, timed breaks and revocation',()=>run(async h=>{const {kioskApi}=await import('./access-chat-kiosk-journey.mjs');await kioskApi(h)}))
test('ACCESS-003 CHAT-001 CLOCK-001: native access forms, message acknowledgments and Spanish kiosk at 1440 and 390',async()=>{const {surfaceBrowser,kioskOffline}=await import('./access-chat-kiosk-journey.mjs');await surfaceBrowser();await kioskOffline()})

test('CLOCK-001: kiosk job changes retain qualified job rates and split payroll once; PIN and employee changes revoke active device sessions',()=>run(async h=>{const {kioskSegmentApi}=await import('./access-chat-kiosk-journey.mjs');await kioskSegmentApi(h)}))

test('PAYRULE-001: differential boundaries, stacking, retained area rates and signed mapped payroll under one claim',()=>run(async h=>{const {differentialApi}=await import('./differentials-journey.mjs');await differentialApi(h)}))
test('PAYRULE-001: differential configuration, payroll, own estimates and icon tooltips at 1440 and 390',async()=>{const {differentialBrowser}=await import('./differentials-journey.mjs');await differentialBrowser()})

test('MINOR-001: private birth and permit records, school-day, school-week and evening limits across schedule, offers, swaps, cover and clock',()=>run(async h=>{const {minorApi}=await import('./minors-journey.mjs');await minorApi(h)},{now:'2026-10-27T12:00:00Z'}))
test('MINOR-001: owner records, named scheduler conflicts and private coworker screens at 1440 and 390',async()=>{const {minorBrowser}=await import('./minors-journey.mjs');await minorBrowser()})

test('LEAVE-003: every preset accrues approved work, caps and carries, pays partial leave once, exports source balances and reconciles ACA',async()=>{const {sickApi}=await import('./sick-journey.mjs');await sickApi()})
test('LEAVE-003: policy, unmaintained label, own request, owner approval, export and earnings at 1440 and 390',async()=>{const {sickBrowser}=await import('./sick-journey.mjs');await sickBrowser()})

test('CLOCK-005: kiosk and native stills, private approval review, camera exceptions, bulk skips, holds and explicit expired-photo erasure',()=>run(async h=>{const {photoApi}=await import('./photos-journey.mjs');await photoApi(h)}))
test('CLOCK-005: photo policy, notice, consented camera capture and private approval at 1440 and 390',async()=>{const {photoBrowser}=await import('./photos-journey.mjs');await photoBrowser()})

test('CLOCK-003: event-only location consent, accuracy, private review, bulk refusal, retention and device revocation through native commands',()=>run(async h=>{const {geofenceApi}=await import('./geofence-journey.mjs');await geofenceApi(h)}))
test('CLOCK-003: owner sees captured location and bulk exception at 1440 and 390',async()=>{const {geofenceBrowser}=await import('./geofence-journey.mjs');await geofenceBrowser()})

test('POLICY-001: versioned cross-site actual overtime, daily and double time, seventh day, wage thresholds and weighted estimates',async()=>{const {policyClassifications}=await import('./policy-journey.mjs');await policyClassifications()})
test('POLICY-001: reviewed policy settings, California deduction refusal, template warnings, swap rest and locked payroll fences',()=>run(async h=>{const {policyBoundaries}=await import('./policy-journey.mjs');await policyBoundaries(h)}))
test('POLICY-001: policy warnings and keyboard tooltips in schedule review at 1440 and 390',async()=>{const {policyBrowser}=await import('./policy-journey.mjs');await policyBrowser()})
test('COST-002: policy daily and double-time risk prices actual and remaining work, substitutes and receiving pickup and swap employees',async()=>{const {policyCostApi}=await import('./policy-cost-journey.mjs');await policyCostApi()})
test('COST-002: policy estimates, cited inputs, tooltips and substitute end state at 1440 and 390',async()=>{const {policyCostBrowser}=await import('./policy-cost-journey.mjs');await policyCostBrowser()})
test('POLICY-001: preset releases require current reviewed open-period calculations and retain previous rule inputs',async()=>{const {policyReleaseReview}=await import('./policy-release-journey.mjs');await policyReleaseReview()})
test('EARN-001: daily policy overtime, double time and retained rates reach only the employee estimate across period boundaries',async()=>{const {policyEarningsApi}=await import('./policy-earnings-journey.mjs');await policyEarningsApi()})
test('EARN-001: policy estimate categories, hidden amounts and account tooltip at 1440 and 390',async()=>{const {policyEarningsBrowser}=await import('./policy-earnings-journey.mjs');await policyEarningsBrowser()})

test('PRIVACY-001: authorized former employee export, held history and explicit journal dispositions preserve employment facts',()=>run(async h=>{
 const alex=await h.person('PrivacyAlex'),other=await h.person('PrivacyOther'),manager=await h.person('PrivacyManager','manager')
 const oldDate=new Date(Date.now()-30*86400000).toISOString().slice(0,10)
 const consent={consent:true,reason:'synthetic-lanyard-1 authorized former employee request'}
 const privateNote=await h.cmd('note.save',{staffId:alex.id,date:oldDate,category:'other',visibility:'private',text:'synthetic-lanyard-2 private assessment',attachment:{name:'private.txt',type:'text/plain',data:btoa('synthetic-lanyard-3')}})
 const visible=await h.cmd('note.save',{staffId:alex.id,date:oldDate,category:'commendation',visibility:'employee',text:'synthetic-lanyard-4 employee-visible',attachment:{name:'visible.txt',type:'text/plain',data:btoa('synthetic-lanyard-5')}})
 await h.cmd('note.save',{id:visible.id,revision:visible.revision,staffId:alex.id,date:oldDate,category:'commendation',visibility:'employee',text:'synthetic-lanyard-6 revised employee-visible'})
 await h.cmd('note.save',{staffId:other.id,date:oldDate,category:'other',visibility:'employee',text:'synthetic-lanyard-7 unrelated'})
 const time=await h.cmd('time.prepare',{staffId:alex.id,start:oldDate+'T14:00:00Z',end:oldDate+'T22:00:00Z',breakMinutes:30,reason:'Authorized paper sheet'})
 await h.cmd('time.approve',{id:time.id,revision:time.revision})
 const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',{id:batch.id,revision:batch.revision})
 const before=await h.state()
 await h.cmd('privacy.export',{staffId:alex.id,consent:false,reason:consent.reason},h.owner,403)
 await h.cmd('privacy.erase',{staffId:alex.id,type:'notes',reason:consent.reason},h.owner,403)
 await h.cmd('privacy.export',{staffId:alex.id,...consent},manager.cookie,403)
 await h.cmd('privacy.export',{staffId:other.id,...consent},alex.cookie,403)
 const key=await h.cmd('agent.create',{label:'Preparation only'})
 assert.equal((await h.send('/api/lanyard/agent/command',{name:'privacy.export',input:{staffId:alex.id,...consent}},'',{authorization:`Bearer ${key.token}`})).status,403)
 await h.cmd('staff.save',{id:alex.id,revision:alex.revision,name:alex.name,email:alex.email,payrollId:alex.payrollId,role:'staff',active:false})
 const exported=await h.cmd('privacy.export',{staffId:alex.id,...consent})
 assert.equal(exported.employee.active,false);assert.equal(exported.notes.length,1);assert.equal(exported.notes[0].text,'synthetic-lanyard-6 revised employee-visible');assert.equal(exported.notes[0].versions,undefined)
 assert.ok(!JSON.stringify(exported).includes(privateNote.text));assert.ok(!JSON.stringify(exported).includes('synthetic-lanyard-7'));assert.equal(exported.payroll.length,1);assert.equal(exported.timesheets[0].id,time.id)
 await h.cmd('privacy.retention',{type:'history',days:1,...consent})
 const hold=await h.cmd('privacy.hold',{staffId:alex.id,type:'history',hold:true,...consent})
 await h.cmd('privacy.erase',{staffId:alex.id,type:'history',...consent},h.owner,409)
 assert.equal((await h.cmd('privacy.review',{staffId:alex.id})).holds[0].hold,true)
 for(const cookie of [other.cookie,manager.cookie]){
  const state=await h.state(cookie)
  for(const kind of ['privacypolicies','privacyholds','privacyresults'])assert.deepEqual(state[kind],[])
 }
 const agentState=(await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})).value
 for(const kind of ['privacypolicies','privacyholds','privacyresults'])assert.deepEqual(agentState[kind],[])
 assert.ok((await h.state()).privacyresults.some(r=>r.id===exported.receiptId&&r.reason===consent.reason))

 await h.cmd('privacy.hold',{staffId:alex.id,type:'history',hold:false,revision:hold.revision,...consent})
 const retained=await h.cmd('privacy.erase',{staffId:alex.id,type:'history',...consent});assert.equal(retained.erased.length,0);assert.match(retained.retained[0].reason,/Necessary employment/)
 await h.cmd('privacy.retention',{type:'attachments',days:1,...consent})
 const noteHold=await h.cmd('privacy.hold',{staffId:alex.id,type:'notes',hold:true,...consent})
 const refused=await h.cmd('privacy.erase',{staffId:alex.id,type:'attachments',...consent});assert.equal(refused.erased.length,0);assert.ok(refused.retained.every(r=>r.reason==='Legal hold'))
 assert.equal((await h.send(`/api/lanyard/notes/${visible.id}/files/${visible.attachment.id}`,undefined,h.owner)).status,200)
 const fileHold=await h.cmd('privacy.hold',{staffId:alex.id,type:'attachments',hold:true,...consent})
 await h.cmd('privacy.hold',{staffId:alex.id,type:'notes',hold:false,revision:noteHold.revision,...consent})
 await h.cmd('privacy.erase',{staffId:alex.id,type:'attachments',...consent},h.owner,409)
 assert.equal((await h.send(`/api/lanyard/notes/${visible.id}/files/${visible.attachment.id}`,undefined,h.owner)).status,200)
 await h.cmd('privacy.hold',{staffId:alex.id,type:'attachments',hold:false,revision:fileHold.revision,...consent})
 const deleted=await h.cmd('privacy.erase',{staffId:alex.id,type:'attachments',...consent});assert.ok(deleted.erased.includes(visible.attachment.id));assert.ok(deleted.erased.includes(privateNote.attachment.id))
 assert.equal((await h.send(`/api/lanyard/notes/${visible.id}/files/${visible.attachment.id}`,undefined,h.owner)).status,404)
 const after=await h.state();assert.deepEqual(after.timesheets,before.timesheets);assert.deepEqual(after.batches,before.batches)
 await h.cmd('privacy.retention',{type:'notes',days:1,...consent})
 const erased=await h.cmd('privacy.erase',{staffId:alex.id,type:'notes',...consent});assert.ok(erased.erased.includes(visible.id));assert.ok(erased.erased.includes(privateNote.id))
 await h.restart()
 const final=await h.cmd('privacy.export',{staffId:alex.id,...consent});assert.ok(final.notes.every(n=>n.erasedAt));assert.ok(!JSON.stringify(final).includes('synthetic-lanyard-6'));assert.equal(final.timesheets[0].id,time.id)
 assert.ok((await h.cmd('privacy.review',{staffId:alex.id})).results.some(r=>r.id===erased.id))
 const savedResults=JSON.stringify((await h.db.prepare('SELECT result FROM l_commands').all()).results)
 for(const erasedText of ['synthetic-lanyard-2 private assessment','synthetic-lanyard-4 employee-visible','synthetic-lanyard-6 revised employee-visible'])assert.ok(!savedResults.includes(erasedText),'erased journal text absent from saved command copies')
 assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_note_files WHERE note_id IN (?,?)').bind(visible.id,privateNote.id).first()).n,0)
 const current=(await h.state()).notes.find(n=>n.id===visible.id)
 await h.cmd('note.save',{id:visible.id,revision:current.revision,staffId:alex.id,date:oldDate,category:'other',visibility:'employee',text:'Restore erased text'},h.owner,409)
}))

test('PRIVACY-001: erased journal content loses its file and edit controls at 1440 and 390',async()=>{const {privacyBrowser}=await import('./privacy-journey.mjs');await privacyBrowser()})

test('PAY-001 and PAY-002: explicit employee workflows and mapped grouped files retain signed sources, exact revisions and once-only claims',()=>run(async h=>{const {templatesApi}=await import('./paytemplates-journey.mjs');await templatesApi(h)}))
test('PAY-002: reviewed mapped bytes export from Payroll at 1440 and 390',async()=>{const {templatesBrowser}=await import('./paytemplates-journey.mjs');await templatesBrowser()})
test('PAY-001: retained policy classifies employee overtime and double time, separates contractor treatment and exports signed code corrections once',()=>run(async h=>{const {classificationApi}=await import('./paytemplates-journey.mjs');await classificationApi(h)}))
test('PAY-001: approved PTO, tip allocations and tip-credit make-up sources map independently and corrections export only signed differences',()=>run(async h=>{const {earningInputsApi}=await import('./paytemplates-journey.mjs');await earningInputsApi(h)},{now:'2026-10-27T12:00:00Z'}))
test('PAY-001: pinned work areas and clock-transfer jobs classify retained rates once with signed per-job corrections',async()=>{const {classifiedSegmentsApi}=await import('./paytemplates-journey.mjs');for(const transfer of [false,true])await run(h=>classifiedSegmentsApi(h,transfer),{now:'2026-10-27T12:00:00Z'})})
test('PAY-002: XLSX downloads retain literal identifiers, exact approved numbers, binary hashes and immutable signed corrections',()=>run(async h=>{const {workbookApi}=await import('./paytemplates-journey.mjs');await workbookApi(h)}))
test('PAY-002: TSV and custom-delimited files retain configured column order, dates, UTC times, payable precision and immutable downloads',async()=>{const {delimitedApi}=await import('./paytemplates-journey.mjs');for(const format of ['tsv','delimited'])await run(h=>delimitedApi(h,format))})

test('POLICY-001: adjacent cafe captures retain one break obligation without changing historical releases',async()=>{const {policyAdjacentApi}=await import('./policy-adjacent-journey.mjs');await policyAdjacentApi()})

test('POLICY-001: Settings release preview and reviewed application at 1440 and 390',async()=>{const {policySettingsBrowser}=await import('./policy-settings-journey.mjs');await policySettingsBrowser()})

test('POLICY-001: elected alternative workweeks require current evidence and reviewed recalculation',async()=>{const {policyAlternateApi}=await import('./policy-alternate-journey.mjs');await policyAlternateApi()})
test('POLICY-001: elected days, extra workdays and unknown shortening aggregate across cafes',async()=>{const {policyAlternateClassificationApi}=await import('./policy-alternate-journey.mjs');await policyAlternateClassificationApi()})

test('POLICY-001: employer-reviewed applicability retains federal, state and cross-cafe obligations separately',async()=>{const {policyCoverageApi}=await import('./policy-coverage-journey.mjs');await policyCoverageApi()})

test('POLICY-001: Alaska approved flex and Nevada mutual schedules require current evidence and reviewed adoption',async()=>{const {policyRegionalConfigurationApi}=await import('./policy-regional-journey.mjs');await policyRegionalConfigurationApi()})
test('POLICY-001: regional alternate workweeks preserve enrollment, overtime and unresolved deviations across cafes',async()=>{const {policyRegionalClassificationApi}=await import('./policy-regional-journey.mjs');await policyRegionalClassificationApi()})

test('POLICY-001: alternate schedule evidence, recalculation and application through Settings at 1440 and 390',async()=>{const {policyAlternateSettingsBrowser}=await import('./policy-alternate-settings-journey.mjs');await policyAlternateSettingsBrowser()})

test('POLICY-001: California employer workdays require current reviewed adoption and preserve closed history',async()=>{const {policyWorkdayApi}=await import('./policy-workday-journey.mjs');await policyWorkdayApi()})

test('POLICY-001: California workdays carry prior-week daily context without replaying payroll minutes',async()=>{const {policyWorkdayBoundaryApi}=await import('./policy-workday-journey.mjs');await policyWorkdayBoundaryApi()})

test('POLICY-001: California workday recuts retain approved rates and exact whole payable minutes',async()=>{const {policyWorkdayAllocationApi}=await import('./policy-workday-journey.mjs');await policyWorkdayAllocationApi()})

test('POLICY-001: California employer workday boundaries follow venue daylight-saving transitions',async()=>{const {policyWorkdayDstApi}=await import('./policy-workday-journey.mjs');await policyWorkdayDstApi()})

test('POLICY-001: California workday rests combine split cafe service and retain unknown boundary timing',async()=>{const {policyRestDaysApi}=await import('./policy-rest-days-journey.mjs');await policyRestDaysApi()})

test('POLICY-001: Washington reviewed normal workdays govern additional meals without changing historical rules',async()=>{const {policyWashingtonApi}=await import('./policy-washington-journey.mjs');await policyWashingtonApi()})
test('POLICY-001: Washington normal workday review and application through Settings at 1440 and 390',async()=>{const {policyWashingtonBrowser}=await import('./policy-washington-journey.mjs');await policyWashingtonBrowser()})

test('CHAT-001: reviewed group removal immediately fences history, files and commands without granting readers',async()=>{const {chatMembershipApi}=await import('./chat-membership-journey.mjs');await chatMembershipApi()})
test('CHAT-001: listed owner removes a group member through the native form at 1440 and 390',async()=>{const {chatMembershipBrowser}=await import('./chat-membership-journey.mjs');await chatMembershipBrowser()})

test('PAY-011: reviewed IIF activities reconcile regular overtime and PTO with mapping refusal and once-only exports',()=>run(async h=>{const {iifApi}=await import('./payiif-journey.mjs');await iifApi(h)},{now:'2026-10-26T12:00:00Z'}))
test('PAY-011: owner configures Desktop mappings and reviews and downloads IIF at 1440 and 390',async()=>{const {iifBrowser}=await import('./payiif-journey.mjs');await iifBrowser()})

test('COST-001: native worked and approved cost retain rate history overtime burden and correction variance with budget warnings',async()=>{const {costApi}=await import('./cost-journey.mjs');await costApi()})
test('COST-001: managers inspect worked costs and template warnings and owners configure burdens at 1440 and 390',async()=>{const {costBrowser}=await import('./cost-journey.mjs');await costBrowser()})

test('AI-001: consented extraction resolves ambiguous names and repeated local times before exact native draft publication',async()=>{const {aiScheduleApi}=await import('./ai-schedule-journey.mjs');await aiScheduleApi()})
test('AI-001: owner-scoped sources and model sends refuse other roles and erasure purges local material through restart',async()=>{const {aiScheduleScopeApi}=await import('./ai-schedule-journey.mjs');await aiScheduleScopeApi()})
test('AI-001: owner corrects extracted fields inspects sources and approves a draft at 1440 and 390',async()=>{const {aiScheduleBrowser}=await import('./ai-schedule-journey.mjs');await aiScheduleBrowser()})

test('POLICY-002: attributable source-versioned coverage and retained consequence previews refuse unauthorized and stale decisions atomically',async()=>{const {fairworkApi}=await import('./fairwork-journey.mjs');await fairworkApi()})
test('POLICY-002: owner reviews coverage and change consequences in Settings',async()=>{const {fairworkBrowser}=await import('./fairwork-journey.mjs');await fairworkBrowser()})

test('TEAM-001: owner organization records retain hierarchy and eligible locations without granting authority',()=>run(async h=>{const {organizationApi}=await import('./organization-journey.mjs');await organizationApi(h)}))
test('TEAM-001: organization Settings creates two locations and a shared employee through native forms',async()=>{const {organizationBrowser}=await import('./organization-journey.mjs');await organizationBrowser()})
test('ACCESS-003: organization scopes and editable role defaults separate scheduling time approval and payroll authority',()=>run(async h=>{const {organizationAccessApi}=await import('./organization-journey.mjs');await organizationAccessApi(h)}))

test('LEAVE-003: employer coverage refuses unpaid and undersized tiers and preserves private effective reviews',async()=>{const {sickEmployerCoverage}=await import('./sick-journey.mjs');await sickEmployerCoverage()})
test('LEAVE-003: Oregon donations need donor consent and owner approval and retain balanced sources without creating pay',async()=>{const {sickDonations}=await import('./sick-journey.mjs');await sickDonations()})
test('REPORT-001: filtered native reports and CSV reconcile approved revisions across two sites and retain incomplete offline sources without leaking wages',async()=>{const {reportsApi}=await import('./reports-journey.mjs');await reportsApi()})

test('REPORT-002: audit records reconcile retained sources, preserve unknown coverage, refuse foreign readers and export without changing sources',()=>run(async h=>{const {auditApi}=await import('./audit-report-journey.mjs');await auditApi(h)},{now:'2026-10-27T12:00:00Z'}))
test('REPORT-002: native audit filters, source links and download remain usable on desktop with phone proof',async()=>{const {auditBrowser}=await import('./audit-report-journey.mjs');await auditBrowser()})

test('MOBILE-001 MOBILE-002: phone shift change, offline unsent state, current attendance, reasoned edits and scoped exact-revision approvals',async()=>{const {mobileJourney}=await import('./clock-offline-journey.mjs');await mobileJourney()})

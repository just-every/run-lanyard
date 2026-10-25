import assert from 'node:assert/strict'
import {holidayFixture,pin} from './holidays-fixture.mjs'
export async function holidayApi(h) {
 const f=await holidayFixture(h),{alex,ben,cy,foreign,manager,rule}=f
 assert.equal(f.pendingHeld,true);let s=await h.state();assert.equal(s.holidays.filter(r=>r.site==='Ocean Beach'&&r.source==='federal').length,11)
 assert.ok(s.holidays.some(r=>r.date==='2025-11-27'&&r.name==='Thanksgiving Day'));assert.ok(s.holidays.some(r=>r.date==='2025-07-04'))
 assert.deepEqual((await h.cmd('holiday.seed',{site:'Ocean Beach',year:2025})).created,[])
 const historicalCalendar=(await h.cmd('holiday.seed',{site:'Historical calendar',year:1974})).created
 assert.ok(historicalCalendar.some(r=>r.name==='Veterans Day'&&r.date==='1974-10-28'))
 assert.ok(!historicalCalendar.some(r=>r.name==='Martin Luther King Jr. Day'||r.name==='Juneteenth National Independence Day'))
 const beforeJuneteenth=(await h.cmd('holiday.seed',{site:'Historical calendar',year:2020})).created
 assert.ok(beforeJuneteenth.some(r=>r.name==='Martin Luther King Jr. Day'));assert.ok(!beforeJuneteenth.some(r=>r.name==='Juneteenth National Independence Day'))
 await h.cmd('holiday.seed',{site:'Mission',year:2027});assert.ok((await h.state()).holidays.some(r=>r.site==='Mission'&&r.date==='2027-12-31'&&r.name==="New Year's Day")===false)
 await h.cmd('holiday.seed',{site:'Mission',year:2028});assert.ok((await h.state()).holidays.some(r=>r.site==='Mission'&&r.date==='2027-12-31'&&r.name==="New Year's Day"),'observed New Year can fall in previous calendar year')
 const thanksgiving=f.approved.find(t=>t.staffId===alex.id&&t.start===f.thanksgiving.start),company=f.approved.find(t=>t.staffId===alex.id&&t.start===f.companyShift.start)
 assert.deepEqual(thanksgiving.holidayBasis.map(x=>[x.area,x.minutes,x.rateCents,x.costCents]),[['Front counter',240,2000,4000],['Kitchen',240,2400,4800]])
 assert.equal(company.holidayBasis.reduce((n,x)=>n+x.costCents,0),8000)
 assert.equal(f.approved.find(t=>t.staffId===foreign.id).holidayBasis.length,0,'other site has no company holiday')
 assert.ok(s.holidayReviews.some(r=>r.staffId===ben.id&&r.kind==='worked'&&!r.eligible&&r.reasons.some(x=>x.includes('2025-11-28'))),'missed next scheduled shift is ineligible')
 const page=(await h.send('/app/time?week=2025-11-24',undefined,alex.cookie)).text;assert.match(page,/Holiday premium \(approved\)/);assert.match(page,/\$88.00/);assert.match(page,/<strong>\$584.00<\/strong>/)
 // An effective rule edit and calendar removal never reprice approved holiday time.
 await h.cmd('holidayrule.save',{...rule,...pin(rule),value:2,nonWorkMinutes:480},h.owner,400) // unknown retained metadata is refused
 const updated=await h.cmd('holidayrule.save',{...pin(rule),site:rule.site,from:rule.from,mode:'added',value:300,nonWorkMinutes:480,beforeAfter:true,code:'HOL-ADD'})
 const hday=s.holidays.find(r=>r.site==='Ocean Beach'&&r.date==='2025-11-27')
 await h.cmd('holiday.save',{...pin(hday),site:hday.site,date:hday.date,name:hday.name,enabled:false});await h.cmd('holiday.seed',{site:'Ocean Beach',year:2025});assert.equal((await h.state()).holidays.find(r=>r.id===hday.id).enabled,false,'reseeding retains employer edits');await h.cmd('holiday.save',{...pin(hday),revision:2,site:hday.site,date:hday.date,name:hday.name,enabled:true})
 s=await h.state();const review=s.holidayReviews.find(r=>r.staffId===cy.id&&r.date==='2025-11-27'&&r.kind==='non-work')
 assert.ok(review.eligible&&!review.pending)
 await h.cmd('holidaypay.approve',{staffId:cy.id,site:review.site,date:review.date,reference:'holiday-service-cy',digest:'stale'},h.owner,409)
 const approval={staffId:cy.id,site:review.site,date:review.date,reference:'holiday-service-cy',digest:review.digest}
 await h.cmd('holidaypay.approve',approval,cy.cookie,403);await h.cmd('holidaypay.approve',approval,manager.cookie,403)
 const before=s.timesheets.length,pay=await h.cmd('holidaypay.approve',approval);assert.equal(pay.minutes,480);assert.equal(pay.costCents,16000);assert.equal((await h.state()).timesheets.length,before)
 await h.cmd('holidaypay.approve',approval,h.owner,409)
 await h.cmd('aca.credit.save',{staffId:cy.id,date:review.date,minutes:480,category:'holiday',reference:approval.reference,reason:'Same paid-service fact'})
 const plan=await h.cmd('aca.plan.save',{name:'Holiday paid service',start:'2025-10-01',end:'2025-12-31',adminEnd:'2025-12-31',stabilityEnd:'2026-06-30',staffIds:[cy.id]})
 const report=await h.send(`/api/lanyard/aca/${plan.id}`,undefined,h.owner);assert.equal(report.status,200);assert.equal(report.value.rows[0].paidLeaveMinutes,480);assert.equal(report.value.rows[0].sources.filter(x=>x.reference===approval.reference).length,1)
 assert.match((await h.send('/app/time?week=2025-11-24',undefined,cy.cookie)).text,/<strong>\$480.00<\/strong>/)
 await h.cmd('holidayrule.save',{site:'Mission',from:'2025-01-01',mode:'added',value:300,nonWorkMinutes:0,beforeAfter:false,code:'HOL-ADD'})
 const added=await f.enter(f.spec(foreign,'2025-11-27'));assert.equal(added.holidayBasis[0].costCents,2400)
 const batch=await h.cmd('payroll.prepare',{}),competing=await h.cmd('payroll.prepare',{})
 const holiday=batch.lines.filter(l=>l.holidayLine&&l.timeId===thanksgiving.id)
 assert.deepEqual(holiday.map(l=>[l.area,l.minutes,l.costCents,l.payCode]),[['Front counter',240,4000,'HOL'],['Kitchen',240,4800,'HOL']])
 assert.ok(!batch.lines.some(l=>l.holidayLine&&l.staffId===ben.id));assert.ok(batch.lines.some(l=>l.holidayPayId===pay.id))
 const sent=await h.cmd('payroll.export',pin(batch));await h.cmd('payroll.export',pin(competing),h.owner,409)
 assert.match(sent.csv,/earnings_cents,premium_rate_cents,holiday_date/);assert.ok(sent.csv.includes(',4000,1000,2025-11-27,'));await h.cmd('payroll.prepare',{ids:[thanksgiving.id]},h.owner,409)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,alex.cookie)).status,403)
 const corrected=await f.enter({...f.thanksgiving,end:f.spec(alex,'2025-11-27','09:00','16:00').end},{corrects:thanksgiving.id,reason:'Holiday kitchen closed an hour earlier'})
 // Corrections retain the source's holiday rule and price only the changed area minutes.
 const delta=await h.cmd('payroll.prepare',{ids:[corrected.id]}),premium=delta.lines.filter(l=>l.holidayLine)
 assert.equal(delta.lines.filter(l=>!l.payCode).reduce((n,l)=>n+l.minutes,0),-60)
 assert.deepEqual(premium.map(l=>[l.area,l.minutes,l.costCents,l.payCode]),[['Kitchen',-60,-1200,'HOL']])
 await h.cmd('payroll.export',pin(delta));assert.equal([...sent.lines,...delta.lines].filter(l=>l.rootId===thanksgiving.rootId&&!l.payCode).reduce((n,l)=>n+l.minutes,0),420)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv,'old file unchanged after correction')
 // Later rate/rule updates cannot change the original retained premium amounts.
 assert.deepEqual((await h.state()).timesheets.find(t=>t.id===thanksgiving.id).holidayBasis,thanksgiving.holidayBasis)
 const managerState=await h.state(manager.cookie);assert.ok(managerState.holidayReviews.every(r=>r.site==='Ocean Beach'))
 const staff=await h.state(alex.cookie);assert.ok(staff.holidayReviews.length===0);assert.ok(staff.holidaypay.every(r=>r.staffId===alex.id))
 const agent=await h.cmd('agent.create',{label:'Holiday preparation'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`})
 for(const k of ['holidays','holidayrules','holidaypay','holidayReviews'])assert.deepEqual(context.value[k],[])
 for(const b of context.value.batches)for(const l of b.lines)for(const k of ['costCents','unitCents','rateCents','basis','digest','holidayBasis'])assert.equal(l[k],undefined,'agent payroll context excludes holiday wage inputs')
 await h.cmd('holiday.seed',{site:'Ocean Beach',year:2025},alex.cookie,403)
 await h.cmd('holidayrule.save',{site:'Ocean Beach'},manager.cookie,403)
 // Schedule review and visible week cost include a fresh added-rate holiday rule.
 // A later worked record cannot coexist with approved non-work holiday pay.
 const cyWork=await h.cmd('time.prepare',{staffId:cy.id,start:f.spec(cy,'2025-11-27').start,end:f.spec(cy,'2025-11-27').end,breakMinutes:0,reason:'Recovered worked holiday record'})
 await h.cmd('time.approve',pin(cyWork),manager.cookie,409)
 const paid=(await h.state()).holidaypay.find(r=>r.id===pay.id)
 await h.cmd('holidaypay.correct',{...pin(paid),minutes:0,reason:'Reverse non-work input before approving actual work'})
 const reversal=await h.cmd('payroll.prepare',{});assert.deepEqual(reversal.lines.map(l=>[l.minutes,l.costCents]),[[-480,-16000]])
 await h.cmd('payroll.export',pin(reversal))
 await h.cmd('time.approve',pin(cyWork),manager.cookie)
 const final=await h.cmd('payroll.prepare',{});assert.ok(final.lines.every(l=>l.staffId===cy.id&&!l.holidayPayId));await h.cmd('payroll.export',pin(final))
 const service=(await h.send(`/api/lanyard/aca/${plan.id}`,undefined,h.owner)).value.rows[0]
 assert.equal(service.paidLeaveMinutes,0);assert.equal(service.workedMinutes,1440)

 const draft=await h.cmd('roster.prepare',{week:'2025-12-01',shifts:[f.companyShift]})
 const schedule=await h.send('/api/lanyard/schedule/review',{week:'2025-12-01',shifts:[f.companyShift]},h.owner)
 assert.equal(schedule.status,200);assert.equal(schedule.value.sites.reduce((n,x)=>n+x.costCents,0),18400)
 const schedulePage=(await h.send('/app/schedule?week=2025-12-01&view=draft',undefined,h.owner)).text;assert.match(schedulePage,/Company service day/);assert.match(schedulePage,/additional scheduled premium \$24.00/)
 // Non-work means no worked time: an unworked scheduled holiday and retained
 // inactive employment remain eligible when the configured attendance rule permits them.
 const idle=await h.person('Idle')
 await h.cmd('staff.save',{...pin(idle),name:idle.name,email:idle.email,payrollId:idle.payrollId,role:'staff',active:true,site:'Ocean Beach',hourlyRate:'20.00'})
 const planned=f.spec(idle,'2025-12-01')
 await h.cmd('availability.save',{staffId:idle.id,start:planned.start,end:planned.end})
 const scheduled=await h.cmd('roster.prepare',{week:'2025-12-01',shifts:[f.companyShift,planned]});await h.cmd('roster.publish',pin(scheduled))
 await h.cmd('staff.save',{id:idle.id,revision:2,name:idle.name,email:idle.email,payrollId:idle.payrollId,role:'staff',active:false,site:'Ocean Beach',hourlyRate:'20.00'})
 const retained=(await h.state()).holidayReviews.find(r=>r.staffId===idle.id&&r.date==='2025-12-01'&&r.kind==='non-work')
 assert.ok(retained.eligible&&!retained.pending,'scheduled but unworked holiday and later deactivation do not remove earned eligibility')
 await h.cmd('holidaypay.approve',{staffId:idle.id,site:'Ocean Beach',date:retained.date,reference:'idle-company-holiday',digest:retained.digest})
 const historical=await h.cmd('payroll.prepare',{});assert.ok(historical.lines.some(l=>l.staffId===idle.id&&l.holidayPayId&&l.minutes===480))
 await h.cmd('payroll.export',pin(historical))

}

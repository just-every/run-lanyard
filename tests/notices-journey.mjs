import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const iso=n=>new Date(n).toISOString()
export async function noticesFixture(h) {
 const base=Date.parse(new Date().toISOString().slice(0,10)+'T12:00:00Z'),at=m=>iso(base+m*60000),head=m=>({'x-test-now':String(base+m*60000)})
 const cmd=(n,p,c=h.owner,status=200,m=0)=>h.cmd(n,p,c,status,head(m))
 await cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),dee=await h.person('Dee'),manager=await h.person('Priya','manager'),foreign=await h.person('Omar','manager')
 await cmd('staff.save',{...pin(foreign),name:foreign.name,email:foreign.email,payrollId:foreign.payrollId,active:true,role:'manager',site:'Elsewhere'})
 const settings={site:'',shiftLeadMinutes:60,ackMinutes:5,offerLeadMinutes:30,exceptionMinutes:5,reviewMinutes:5,payrollLeadMinutes:60,escalationMinutes:10}
 await cmd('noticerule.save',settings,alex.cookie,403);await cmd('noticerule.save',settings,foreign.cookie,403)
 const rule=await cmd('noticerule.save',settings,manager.cookie)
 await cmd('attendrule.save',{site:'',graceMinutes:5,noShowMinutes:15})
 await cmd('closerule.save',{site:'',graceMinutes:0,capHours:12})
 const shifts=[{staffId:alex.id,start:at(60),end:at(180),breakMinutes:0},{staffId:ben.id,start:at(-30),end:at(180),breakMinutes:0},{staffId:cy.id,start:at(-480),end:at(-60),breakMinutes:0},{staffId:dee.id,start:at(300),end:at(420),breakMinutes:0}]
 for(const p of [alex,ben,cy,dee,manager])await cmd('availability.save',{staffId:p.id,start:at(-1440),end:at(2880)})
 const weekOf=t=>{const d=new Date(t),n=(d.getUTCDay()+6)%7;return iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-n)).slice(0,10)}
 for(const week of new Set(shifts.map(x=>weekOf(x.start)))){const r=await cmd('roster.prepare',{week,shifts:shifts.filter(x=>weekOf(x.start)===week)});await cmd('roster.publish',pin(r))}
 await cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:at(-480)},cy.cookie,200,-480)
 await cmd('openshift.post',{site:'',position:'',start:at(20),end:at(120),breakMinutes:0,approval:'manager',order:'all'})
 const request=await cmd('time.request',{start:at(-180),end:at(-120),breakMinutes:0,reason:'Forgot the clock',attest:true},alex.cookie)
 const date=at(0).slice(0,10),period=await cmd('period.save',{start:date,end:date})
 const tick=async m=>{const result=await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(base+m*60000),cron:'*/15 * * * *'});assert.equal(result.outcome,'ok')}
 const state=async(c=h.owner,m=6)=>(await h.send('/api/lanyard/state',undefined,c,head(m))).value
 return {base,at,head,cmd,tick,state,alex,ben,cy,dee,manager,foreign,request,period,rule,settings,week:weekOf(at(0))}
}
export async function noticesApi(h) {
 const f=await noticesFixture(h);await f.tick(6)
 let s=await f.state(),employee=await f.state(f.alex.cookie)
 assert.ok(employee.notices.some(n=>n.kind==='shift'));assert.ok(employee.notices.some(n=>n.kind==='acknowledgment'))
 for(const kind of ['late','no-show','exception'])assert.ok(s.notices.some(n=>n.kind===kind),kind)
 assert.ok((await f.state(f.manager.cookie)).notices.some(n=>n.kind==='offer-expiry'))
 assert.ok(!(await f.state(f.foreign.cookie)).notices.length)
 const stored=async()=> (await h.db.prepare("SELECT data FROM l_records WHERE kind='notices' ORDER BY id").all()).results.map(r=>JSON.parse(r.data))
 const before=await stored();await f.tick(6);assert.deepEqual(await stored(),before,'a replayed tick cannot duplicate or rewrite reminders')
 // Restart the actual Worker while keeping its persisted D1 and run the same public cron entry.
 await h.restart();await f.tick(6);assert.deepEqual(await stored(),before)
 const benShift=(await f.state()).shifts.find(x=>x.staffId===f.ben.id)
 await f.cmd('attendance.acknowledge',{shiftId:benShift.id,note:'I am investigating'},f.manager.cookie,200,7)
 await f.tick(26)
 s=await f.state(h.owner,26);assert.equal(s.notices.filter(n=>n.subject===benShift.id&&n.kind==='no-show'&&n.escalation).length,1)
 assert.ok(s.events.some(e=>e.action==='notice.escalate'));assert.ok(s.events.some(e=>e.action==='noticerule.save'))
 assert.ok(s.notices.some(n=>n.kind==='no-show'&&!n.escalation),'a handling note does not resolve an alert')
 const shift=(await f.state(f.alex.cookie,26)).shifts.find(x=>x.staffId===f.alex.id)
 await f.cmd('shift.confirm',pin(shift),f.alex.cookie,200,26)
 assert.ok(!(await f.state(f.alex.cookie,26)).notices.some(n=>n.kind==='acknowledgment'))
 await f.cmd('time.resolve',{...pin((await f.state(h.owner,26)).timesheets.find(x=>x.id===f.request.id)),reason:'Verified with the employee'},f.manager.cookie,200,26)
 assert.ok(!(await f.state(h.owner,26)).notices.some(n=>n.subject===f.request.id))
 await f.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:f.at(27)},f.ben.cookie,200,27)
 assert.ok(!(await f.state(h.owner,27)).notices.some(n=>n.subject===benShift.id))
 await f.tick(180);assert.ok(!(await f.state(f.alex.cookie,180)).notices.some(n=>n.kind==='shift'))
 const midnight=Date.parse(f.at(0).slice(0,10)+'T00:00:00Z')+86400000,cutoff=(midnight-f.base)/60000
 await f.tick(cutoff-30);assert.ok((await f.state(h.owner,cutoff-30)).notices.some(n=>n.kind==='payroll-review'))
 await f.tick(cutoff+6);assert.ok((await f.state(h.owner,cutoff+6)).notices.some(n=>n.kind==='timesheet-review'))
 // Resolve every open punch and review, then lock the period through its public doors.
 const cyClock=(await f.state(h.owner,cutoff+6)).clocks.find(k=>k.staffId===f.cy.id)
 await f.cmd('time.confirm',{...pin(cyClock),end:f.at(-60),breakMinutes:0,reason:'Employee confirmed the end'},h.owner,200,cutoff+6)
 await f.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:f.at(120),breakMinutes:0},f.ben.cookie,200,120)
 for(const t of (await f.state(h.owner,cutoff+6)).timesheets){
  if(t.exceptions?.length&&!t.resolution)await f.cmd('time.resolve',{...pin(t),reason:'Confirmed accurate'},h.owner,200,cutoff+6)
  const current=(await f.state(h.owner,cutoff+6)).timesheets.find(r=>r.id===t.id)
  if(current.status==='submitted')await f.cmd('time.approve',pin(current),h.owner,200,cutoff+6)
 }
 for(const person of [f.alex,f.ben,f.cy])await f.cmd('period.signoff',pin((await f.state(h.owner,cutoff+6)).periods[0]),person.cookie,200,cutoff+6)
 await f.cmd('period.signoff',pin((await f.state(h.owner,cutoff+6)).periods[0]),h.owner,200,cutoff+6)
 await f.cmd('period.lock',pin((await f.state(h.owner,cutoff+6)).periods[0]),h.owner,200,cutoff+6)
 assert.ok(!(await f.state(h.owner,cutoff+6)).notices.some(n=>['timesheet-review','payroll-review'].includes(n.kind)))
 const all=await stored();assert.equal(new Set(all.map(n=>JSON.stringify([n.kind,n.subject,n.basis,n.recipient,n.due]))).size,all.length)
 assert.ok(all.some(n=>n.status==='withdrawn'&&n.withdrawalReason),'withdrawals retain a reason')
 const safe=JSON.stringify((await f.state(h.owner,cutoff+6)).notices)
 for(const privateText of ['Forgot the clock','I am investigating','rate_cents','hourlyRate'])assert.ok(!safe.includes(privateText))
 const key=await h.cmd('agent.create',{label:'Preparation only'})
 await h.cmd('noticerule.save',f.settings,'',401,{authorization:`Bearer ${key.token}`})
 const agent=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.equal(agent.status,200);assert.deepEqual(agent.value.notices,[],'agents never receive reminders')
 return f
}
export async function noticesCases(h) {
 const f=await noticesFixture(h),stored=async()=> (await h.db.prepare("SELECT data FROM l_records WHERE kind='notices' ORDER BY id").all()).results.map(r=>JSON.parse(r.data))
 const ownerId=(await f.state()).actor.id
 await f.tick(6)
 // A changed revision supersedes the unacknowledged one: its reminder is withdrawn with a reason and the new revision asks again.
 const old=(await f.state(f.alex.cookie,6)).shifts.find(x=>x.staffId===f.alex.id)
 assert.ok((await stored()).some(n=>n.kind==='acknowledgment'&&n.subject===old.id&&n.status==='active'))
 await f.cmd('shift.change',{...pin(old),start:f.at(90),end:f.at(200),reason:'Delivery moved'},f.manager.cookie,200,7)
 await f.tick(13)
 const moved=(await f.state(f.alex.cookie,13)).shifts.find(x=>x.staffId===f.alex.id&&x.id!==old.id)
 let rows=await stored()
 assert.match(rows.find(n=>n.kind==='acknowledgment'&&n.subject===old.id).withdrawalReason,/superseded/)
 assert.equal(rows.filter(n=>n.kind==='acknowledgment'&&n.subject===moved.id&&n.status==='active').length,1)
 assert.ok(!(await f.state(f.alex.cookie,13)).notices.some(n=>n.subject===old.id))
 // BREAK-002: a missed meal flags the timesheet, reminds the managers, and resolution withdraws it.
 const eli=await h.person('Eli')
 await f.cmd('mealrule.save',{site:'',afterMinutes:360,deductMinutes:30,enabled:true},h.owner,200,-900)
 await f.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:f.at(-900)},eli.cookie,200,-900)
 const meal=(await f.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:f.at(-480),breakMinutes:0,meal:'missed'},eli.cookie,200,-480)).timesheet
 assert.deepEqual(meal.exceptions,['missed meal'])
 await f.tick(14)
 assert.ok((await f.state(f.manager.cookie,14)).notices.some(n=>n.kind==='exception'&&n.subject===meal.id))
 assert.ok(!(await f.state(eli.cookie,14)).notices.some(n=>n.subject===meal.id),'the employee is never their own exception recipient')
 await f.cmd('time.resolve',{...pin((await f.state(h.owner,14)).timesheets.find(x=>x.id===meal.id)),reason:'Meal confirmed missed by the employee'},f.manager.cookie,200,15)
 assert.ok(!(await f.state(f.manager.cookie,15)).notices.some(n=>n.subject===meal.id))
 assert.ok((await stored()).filter(n=>n.subject===meal.id).every(n=>n.status==='withdrawn'&&n.withdrawalReason))
 // A closed call-out offer: approving one cover explicitly closes the others and their expiry reminders.
 const dee=(await f.state(f.dee.cookie,15)).shifts.find(x=>x.staffId===f.dee.id)
 const callout=await f.cmd('shift.callout',{...pin(dee),note:'Private family reason'},f.dee.cookie,200,16)
 const offers=callout.offers
 assert.ok(offers.length>=2,'two offers go out')
 await f.tick(17)
 const live=()=>stored().then(r=>r.filter(n=>n.kind==='offer-expiry'&&offers.some(o=>o.id===n.subject)))
 assert.equal((await live()).filter(n=>n.status!=='withdrawn'&&!n.escalation).length,offers.length)
 const chosen=offers[0],cover=(await f.state(h.owner,17)).offers.find(o=>o.id===chosen.id)
 const taker=[f.cy,f.manager].find(p=>p.id===chosen.staffId)
 const yes=await f.cmd('cover.respond',{id:cover.id,revision:cover.revision,decision:'accepted',note:'I can cover'},taker.cookie,200,18)
 await f.cmd('cover.approve',{id:yes.id,revision:yes.revision},h.owner,200,19)
 await f.tick(20)
 const closed=await live()
 assert.ok(closed.every(n=>n.status==='withdrawn'&&/offer closed/.test(n.withdrawalReason)),'every offer-expiry follow-up is withdrawn once its offer is closed')
 // Escalation reaches the owner only, once per item; a cafe whose only manager is the owner has no higher manager.
 const gus=await h.person('Gus')
 await f.cmd('staff.save',{...pin(gus),name:gus.name,email:gus.email,payrollId:gus.payrollId,active:true,role:'staff',site:'Solo'},h.owner,200,20)
 await f.cmd('noticerule.save',{...f.settings,site:'Solo'},h.owner,200,20)
 const solo=await f.cmd('time.request',{start:f.at(-180),end:f.at(-120),breakMinutes:0,reason:'Forgot the clock',attest:true},gus.cookie,200,20)
 await f.tick(40)
 rows=await stored()
 const escalations=rows.filter(n=>n.escalation&&n.status!=='withdrawn')
 assert.ok(escalations.length>0&&escalations.every(n=>n.recipient===ownerId),'escalations reach only the owner as accountable manager')
 assert.equal(new Set(escalations.map(n=>JSON.stringify([n.kind,n.subject,n.basis]))).size,escalations.length,'one escalation per item')
 assert.ok(!(await f.state(f.manager.cookie,40)).notices.some(n=>n.escalation),'a cafe manager never receives the escalation')
 const sole=rows.filter(n=>n.subject===solo.id)
 assert.ok(sole.length>0&&sole.every(n=>n.recipient===ownerId&&!n.escalation&&n.escalationState==='no higher manager'),'the owner as only manager records no higher manager instead of escalating to themself')
 assert.ok(!(await f.state(h.owner,40)).events.some(e=>e.action==='notice.escalate'&&sole.some(n=>n.id===e.entityId)))
 const safe=JSON.stringify([rows,(await f.state(h.owner,40)).notices])
 for(const privateText of ['Private family reason','Forgot the clock','Delivery moved','Meal confirmed missed'])assert.ok(!safe.includes(privateText),privateText)
}
export async function noticesBrowser() {
 const h=await harness(),browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic','--no-sandbox']})
 try{
  const f=await noticesFixture(h);await f.tick(6)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:f.head(6)})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async key=>{if(process.env.NOTICE_SCREENS){await mkdir(process.env.NOTICE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.NOTICE_SCREENS,`${key}-page-${width}.png`)});await page.locator('#reminder-inbox').screenshot({path:join(process.env.NOTICE_SCREENS,`${key}-${width}.png`)})}}
   for(const screen of ['schedule','time']){
    await page.goto(h.origin+`/app/${screen}?week=${f.week}&site=all`,{waitUntil:'networkidle'})
    assert.ok((await page.locator('#reminder-inbox').innerText()).includes('In Lanyard only'))
    await shot(screen)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   }
   await page.getByText('Reminder settings',{exact:true}).click()
   const form=page.locator('form[action*="name=noticerule.save"]');await form.locator('[name=ackMinutes]').fill('8')
   await shot('settings')
   await Promise.all([page.waitForResponse(r=>r.url().includes('name=noticerule.save')),form.getByRole('button',{name:'Save reminder settings',exact:true}).click()])
   assert.equal(await page.locator('.notice.error').count(),0)
   assert.equal((await f.state()).noticerules.find(r=>r.site==='').ackMinutes,8)
   await shot('saved');assert.deepEqual(errors,[]);await context.close()
  }
 }finally{await browser.close();await h.close()}
}

const scheduleNow='2026-11-02T12:00:00.000Z'
const assignmentInput=x=>Object.fromEntries(['staffId','start','end','breakMinutes','label','site','job'].filter(k=>x[k]!==undefined).map(k=>[k,x[k]]))
export async function scheduleNoticesFixture(h){
 const head={'x-test-now':String(Date.parse(scheduleNow))},cmd=(name,input,c=h.owner,status=200)=>h.cmd(name,input,c,status,head)
 const state=async(c=h.owner,status=200)=>{const r=await h.send('/api/lanyard/state',undefined,c,head);assert.equal(r.status,status,r.text);return r.value}
 await cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),manager=await h.person('Priya','manager')
 for(const p of [alex,ben,cy,manager])await cmd('availability.save',{staffId:p.id,start:'2026-11-01T00:00:00Z',end:'2026-11-15T00:00:00Z'})
 const shifts=[{staffId:alex.id,start:'2026-11-03T09:00:00Z',end:'2026-11-03T11:00:00Z',breakMinutes:0,label:'Opening'},{staffId:ben.id,start:'2026-11-04T09:00:00Z',end:'2026-11-04T11:00:00Z',breakMinutes:0,label:'Counter'}]
 const draft=await cmd('roster.prepare',{week:'2026-11-02',shifts})
 assert.deepEqual((await state(alex.cookie)).schedulenotices,[],'drafts create no schedule notice')
 const roster=await cmd('roster.publish',pin(draft),manager.cookie)
 return {head,cmd,state,alex,ben,cy,manager,roster,week:'2026-11-02'}
}

export async function scheduleNoticesApi(h){
 const f=await scheduleNoticesFixture(h),{cmd,state,alex,ben,cy,manager}=f
 const stored=async()=> (await h.db.prepare("SELECT data FROM l_records WHERE kind='schedulenotices' ORDER BY id").all()).results.map(r=>JSON.parse(r.data))
 const records=async()=> (await h.db.prepare("SELECT kind,id,revision,data FROM l_records WHERE kind IN ('shifts','rosters','schedulenotices','eventnotices','timesheets','batches') ORDER BY kind,id").all()).results
 const notices=async person=>(await state(person.cookie)).schedulenotices
 let a=(await notices(alex))[0],b=(await notices(ben))[0]
 assert.equal(a.kind,'publication');assert.equal(a.actionable,true);assert.equal(a.delivery.state,'available');assert.equal(a.acknowledgedAt,null)
 assert.equal(a.assignment.start,'2026-11-03T09:00:00.000Z');assert.equal(a.assignment.end,'2026-11-03T11:00:00.000Z')
 const initial=(await state()).shifts.filter(x=>x.status==='published'),alexShift=initial.find(x=>x.staffId===alex.id)
 assert.deepEqual(a.assignmentSource,{shiftId:alexShift.id,shiftRevision:alexShift.revision,rosterId:f.roster.id,rosterRevision:f.roster.revision})
 assert.deepEqual(await notices(cy),[]);assert.deepEqual(await notices(manager),[]);assert.deepEqual((await state()).schedulenotices,[],'the owner has no recipient inbox for other employees')
 const isolated=await records();await cmd('schedule.notice.acknowledge',pin(a),ben.cookie,404);await cmd('schedule.notice.acknowledge',pin(a),manager.cookie,404)
 assert.deepEqual(await records(),isolated,'foreign notice actions change no source or receipt')
 // A rejected source decision cannot leave a notification behind.
 await cmd('shift.change',{...pin(alexShift),start:alexShift.start,end:alexShift.end,reason:'No actual change'},manager.cookie,400)
 assert.deepEqual(await records(),isolated)
 // Confirmation is neither delivery nor explicit notice acknowledgment.
 await cmd('shift.confirm',pin(alexShift),alex.cookie)
 assert.equal((await notices(alex))[0].acknowledgedAt,null)
 const confirmed=(await state()).shifts.find(x=>x.id===alexShift.id)
 a=await cmd('schedule.notice.acknowledge',pin(a),alex.cookie)
 assert.ok(a.acknowledgedAt);assert.equal((await state()).shifts.find(x=>x.id===confirmed.id).revision,confirmed.revision)
 const acknowledged=await records(),auditBefore=(await state(alex.cookie)).events.filter(e=>e.action==='schedule.notice.acknowledge')
 await cmd('schedule.notice.acknowledge',{id:a.id,revision:a.revision-1},alex.cookie)
 assert.deepEqual(await records(),acknowledged);assert.deepEqual((await state(alex.cookie)).events.filter(e=>e.action==='schedule.notice.acknowledge'),auditBefore)
 // Replacing only the physical published rows changes no recipient event or source pins.
 const unchanged=await stored(),republish=await cmd('roster.prepare',{week:f.week,shifts:initial.map(assignmentInput)})
 await cmd('roster.publish',pin(republish),manager.cookie)
 assert.deepEqual(await stored(),unchanged)
 const oldBen=(await state()).shifts.find(x=>x.status==='published'&&x.staffId===ben.id)
 // A storage failure after source writes rolls back the assignment, notice and audit together.
 const beforeFault=await records(),eventsBeforeFault=(await state()).events
 await h.db.exec("CREATE TRIGGER synthetic_notice_failure BEFORE INSERT ON l_records WHEN NEW.kind='schedulenotices' BEGIN SELECT RAISE(ABORT,'CHECK synthetic-lanyard-1'); END;")
 try{await cmd('shift.change',{...pin(oldBen),start:'2026-11-04T10:00:00Z',end:'2026-11-04T12:00:00Z',reason:'Storage refusal'},manager.cookie,409)}finally{await h.db.exec('DROP TRIGGER synthetic_notice_failure')}
 assert.deepEqual(await records(),beforeFault);assert.deepEqual((await state()).events,eventsBeforeFault)
 const changed=await cmd('shift.change',{...pin(oldBen),start:'2026-11-04T10:00:00Z',end:'2026-11-04T12:00:00Z',reason:'Private manager reason'},manager.cookie)
 b=(await notices(ben)).find(n=>n.kind==='change')
 assert.equal(b.assignment.start,'2026-11-04T10:00:00.000Z');assert.equal(b.previous.start,'2026-11-04T09:00:00.000Z')
 assert.deepEqual(b.priorSource,{shiftId:oldBen.id,shiftRevision:oldBen.revision,rosterId:oldBen.rosterId,rosterRevision:republish.revision+1})
 assert.equal(b.assignmentSource.shiftId,changed.shift.id)
 const stale=(await notices(ben)).find(n=>n.kind==='publication');assert.equal(stale.status,'superseded');assert.equal(stale.actionable,false)
 const beforeStale=await records();await cmd('schedule.notice.acknowledge',pin(stale),ben.cookie,409);assert.deepEqual(await records(),beforeStale)
 await cmd('schedule.notice.acknowledge',pin(b),ben.cookie)
 const history=await h.send(`/api/lanyard/shifts/${changed.shift.id}/history`,undefined,ben.cookie,f.head)
 assert.equal(history.status,200);assert.ok(history.value.events.some(e=>e.notice.includes('employee acknowledged')))
 // Reassignment tells the former recipient only that their own assignment ended.
 const reassigned=await cmd('shift.change',{...pin(changed.shift),staffId:cy.id,reason:'Private replacement decision'},manager.cookie)
 const cancellation=(await notices(ben)).find(n=>n.kind==='cancellation')
 assert.equal(cancellation.assignment,null);assert.equal(cancellation.assignmentSource,null);assert.equal(cancellation.previous.start,'2026-11-04T10:00:00.000Z')
 assert.ok(!JSON.stringify(await notices(ben)).includes(cy.id));assert.ok(!JSON.stringify(await notices(ben)).includes('Private'))
 assert.equal((await notices(cy))[0].assignment.start,'2026-11-04T10:00:00.000Z')
 const cancellationReceipt=await cmd('schedule.notice.acknowledge',pin(cancellation),ben.cookie)
 assert.ok(!('decision' in cancellationReceipt));assert.equal(cancellationReceipt.assignmentSource,null);assert.ok(!JSON.stringify(cancellationReceipt).includes(cy.id))
 const cyNotice=(await notices(cy))[0]
 await cmd('shift.cancel',{...pin(reassigned.shift),reason:'Private cancellation reason'},manager.cookie)
 assert.equal((await notices(cy)).find(n=>n.id===cyNotice.id).status,'superseded')
 assert.equal((await notices(cy)).find(n=>n.kind==='cancellation').assignment,null)
 // Both manager-approved and automatic pickups create exactly one recipient event.
 for(const [person,approval,day] of [[alex,'manager','05'],[cy,'auto','06']]){
  const o=await cmd('openshift.post',{site:'',position:'',start:`2026-11-${day}T09:00:00Z`,end:`2026-11-${day}T11:00:00Z`,breakMinutes:0,approval,order:'all'})
  const request=await cmd('openshift.request',pin(o),person.cookie)
  if(approval==='manager'){
   assert.ok(!(await notices(person)).some(n=>n.kind==='pickup'))
   await cmd('openshift.approve',pin(request),manager.cookie)
   const done=await stored();await cmd('openshift.approve',pin(request),manager.cookie,409);assert.deepEqual(await stored(),done)
  }
  assert.equal((await notices(person)).filter(n=>n.kind==='pickup').length,1)
 }
 // Consent and an approved exchange confirm shifts but do not acknowledge notices.
 const current=(await state()).shifts.filter(x=>x.status==='published'),give=current.find(x=>x.staffId===alex.id&&x.start.startsWith('2026-11-03')),take=current.find(x=>x.staffId===cy.id)
 const proposed=await cmd('swap.propose',{shiftId:give.id,revision:give.revision,theirShiftId:take.id},alex.cookie)
 const consented=await cmd('swap.respond',{...pin(proposed),decision:'accepted'},cy.cookie)
 const beforeDecision=await stored();await cmd('swap.decide',{...pin(consented),decision:'approved'},alex.cookie,403);assert.deepEqual(await stored(),beforeDecision)
 await cmd('swap.decide',{...pin(consented),decision:'approved'},manager.cookie)
 for(const person of [alex,cy]){const n=(await notices(person)).find(n=>n.kind==='swap');assert.ok(n);assert.equal(n.acknowledgedAt,null);assert.equal(n.actionable,true)}
 for(const person of [alex,cy])assert.ok((await state(person.cookie)).eventnotices.some(n=>n.topic==='swap'&&n.source.id===consented.id&&n.label==='Swap approved'))
 const swapped=(await state()).shifts.find(x=>x.id===give.id);assert.ok(swapped.confirmedAt)
 // A real payroll file remains byte-identical across acknowledgment, restart and revocation.
 const t=await cmd('time.prepare',{staffId:ben.id,start:'2026-10-31T09:00:00Z',end:'2026-10-31T11:00:00Z',breakMinutes:0,reason:'Recorded worked time'})
 const approved=await cmd('time.approve',pin(t)),batch=await cmd('payroll.prepare',{ids:[approved.id]})
 const exported=await cmd('payroll.export',pin(batch)),timeBefore=(await state()).timesheets,batchesBefore=(await state()).batches
 const fileBefore=await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner,f.head)
 assert.equal(fileBefore.status,200)
 const swapNotice=(await notices(alex)).find(n=>n.kind==='swap');await cmd('schedule.notice.acknowledge',pin(swapNotice),alex.cookie)
 const persisted=await stored();await h.restart();assert.deepEqual(await stored(),persisted)
 assert.ok((await notices(alex)).find(n=>n.id===swapNotice.id).acknowledgedAt)
 const person=(await state()).staff.find(p=>p.id===cy.id)
 await cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:false})
 await state(cy.cookie,403);await cmd('schedule.notice.acknowledge',pin((persisted.find(n=>n.recipient===cy.id&&n.status==='current'))),cy.cookie,403)
 assert.ok((await stored()).filter(n=>n.recipient===cy.id&&n.status==='current').length===0)
 // Reactivation does not resurrect withdrawn assignment notices.
 const inactive=(await state()).staff.find(p=>p.id===cy.id)
 await cmd('staff.save',{...pin(inactive),name:inactive.name,email:inactive.email,payrollId:inactive.payrollId,role:inactive.role,active:true})
 assert.ok((await notices(cy)).every(n=>!n.actionable))
 assert.deepEqual((await state()).timesheets,timeBefore);assert.deepEqual((await state()).batches,batchesBefore)
 assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner,f.head)).text,fileBefore.text)
 const key=await cmd('agent.create',{label:'Preparation only'})
 const agent=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`,...f.head})
 assert.equal(agent.status,200);assert.deepEqual(agent.value.schedulenotices,[]);assert.deepEqual(agent.value.eventnotices,[])
 const all=await stored();assert.equal(new Set(all.map(n=>n.id)).size,all.length)
 await eventNoticesApi(h,f)
 assert.ok(all.every(n=>n.delivery.channel==='in-app'&&n.delivery.state==='available'))
 for(const secret of ['Private manager reason','Private replacement decision','Private cancellation reason','rateBasis','payrollId','consent'])assert.ok(!JSON.stringify(all).includes(secret),secret)
}

export async function scheduleNoticesBrowser(){
 const h=await harness({now:scheduleNow}),browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--use-mock-keychain','--password-store=basic','--no-sandbox']})
 try{
  const f=await scheduleNoticesFixture(h)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const a=(await f.state(f.alex.cookie)).shifts.find(x=>x.staffId===f.alex.id)
  await f.cmd('shift.change',{...pin(a),start:'2026-11-03T10:00:00Z',end:'2026-11-03T12:00:00Z',reason:'Later opening'},f.manager.cookie)
  const b=(await f.state(f.ben.cookie)).shifts.find(x=>x.staffId===f.ben.id)
  await f.cmd('shift.cancel',{...pin(b),reason:'No longer required'},f.manager.cookie)
  const open=await f.cmd('openshift.post',{site:'',position:'',start:'2026-11-06T09:00:00Z',end:'2026-11-06T11:00:00Z',breakMinutes:0,approval:'auto',pool:[f.alex.id],order:'all'})
  const propose=async()=>{const x=(await f.state(f.alex.cookie)).shifts.find(x=>x.staffId===f.alex.id&&x.status==='published');return f.cmd('swap.propose',{shiftId:x.id,revision:x.revision,to:f.ben.id,note:'Private browser-only proposal'},f.alex.cookie)}
  let proposal=await propose()
  const prove=async(width,assertions)=>{
   const context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:f.head})
   const [name,...value]=f.alex.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async key=>{if(process.env.NOTICE_SCREENS){await mkdir(process.env.NOTICE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.NOTICE_SCREENS,`${key}-page-${width}.png`)});await page.locator('#schedule-inbox').screenshot({path:join(process.env.NOTICE_SCREENS,`${key}-${width}.png`)});if(await page.locator('#activity-inbox').count())await page.locator('#activity-inbox').screenshot({path:join(process.env.NOTICE_SCREENS,`${key}-activity-${width}.png`)})}}
   await page.goto(h.origin+`/app/schedule?week=${f.week}`,{waitUntil:'networkidle'})
   if(assertions){
    const inbox=page.locator('#schedule-inbox');assert.match(await inbox.innerText(),/Shift changed/);assert.match(await inbox.innerText(),/Superseded/)
    assert.equal(await inbox.getByRole('button',{name:'Acknowledge notice',exact:true}).count(),1)
    assert.ok(!await inbox.innerText().then(t=>t.includes('No longer required')))
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    assert.ok(await inbox.locator('p,strong,button,summary').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)))
    const account=page.locator('[data-tooltip="Account menu"]');await account.focus();assert.equal(await page.locator('[role=tooltip]').innerText(),'Account menu')
   }
   if(assertions){
    const activity=page.locator('#activity-inbox');assert.match(await activity.innerText(),/Open shift offered/);assert.match(await activity.innerText(),/External delivery not attempted/);assert.ok(!await activity.innerText().then(t=>t.includes('Private browser-only proposal')))
    assert.ok(await activity.locator('p,strong,button,a').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)))
    const receipt=(await f.state(f.alex.cookie)).eventnotices.find(n=>n.source.id===open.id);assert.equal(receipt.source.revision,open.revision)
   }
   await shot('schedule-change-inbox')
   if(assertions){
    await Promise.all([page.waitForResponse(r=>r.url().includes('name=schedule.notice.acknowledge')),page.locator('#schedule-inbox').getByRole('button',{name:'Acknowledge notice',exact:true}).click()])
    assert.equal(await page.locator('.notice.error').count(),0);assert.equal(await page.locator('#schedule-inbox').getByRole('button',{name:'Acknowledge notice',exact:true}).count(),0)
    const s=await f.state(f.alex.cookie);assert.ok(s.schedulenotices.find(n=>n.kind==='change').acknowledgedAt);assert.ok(!s.shifts.find(x=>x.staffId===f.alex.id).confirmedAt)
    await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('#schedule-inbox').innerText(),/You acknowledged this notice/)
   }
   if(assertions){
    await Promise.all([page.waitForResponse(r=>r.url().includes('name=notice.acknowledge')),page.locator('#activity-inbox').getByRole('button',{name:'Acknowledge activity notice',exact:true}).click()])
    assert.equal(await page.locator('.notice.error').count(),0);assert.match(await page.locator('#activity-inbox').innerText(),/You acknowledged this notice/);assert.equal((await f.state()).openshifts.find(x=>x.id===open.id).status,'open')
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#activity-inbox').getByRole('button',{name:'Acknowledge activity notice',exact:true}).count(),0)
   }
   await shot('schedule-acknowledged-inbox')
   const [bn,...bv]=f.ben.cookie.split('=');await context.clearCookies();await context.addCookies([{name:bn,value:bv.join('='),url:h.origin}])
   await page.goto(h.origin+`/app/time?week=${f.week}`,{waitUntil:'networkidle'})
   if(assertions){assert.match(await page.locator('#schedule-inbox').innerText(),/Assignment cancelled/);assert.equal(await page.locator('#schedule-inbox').getByRole('button',{name:'Acknowledge notice',exact:true}).count(),1);assert.deepEqual(errors,[])}
   if(assertions){
    const activity=page.locator('#activity-inbox');assert.match(await activity.innerText(),/Swap proposed/);assert.ok(!await activity.innerText().then(t=>t.includes('Private browser-only proposal')))
    await Promise.all([page.waitForResponse(r=>r.url().includes('name=notice.acknowledge')),activity.getByRole('button',{name:'Acknowledge activity notice',exact:true}).click()])
    assert.equal((await f.state()).swaps.find(x=>x.id===proposal.id).status,'proposed');assert.match(await activity.innerText(),/You acknowledged this notice/)
   }
   await shot('schedule-cancellation-inbox');await context.close()
  }
  await prove(1440,true)
  // The phone capture uses a fresh changed revision, so both proofs show the live action.
  const moved=(await f.state(f.alex.cookie)).shifts.find(x=>x.staffId===f.alex.id)
  await f.cmd('shift.change',{...pin(moved),start:'2026-11-03T11:00:00Z',end:'2026-11-03T13:00:00Z',reason:'Final opening'},f.manager.cookie)
  proposal=await propose()
  await prove(390,false)
 }finally{await browser.close();await h.close()}
}

/** Continue the same public-door sanity journey through inherited events. */
async function eventNoticesApi(h,f){
 const {cmd,state,alex,ben,manager}=f,read=async p=>(await state(p?.cookie??h.owner)).eventnotices
 const stored=async()=>(await h.db.prepare("SELECT id,revision,data FROM l_records WHERE kind='eventnotices' ORDER BY id").all()).results
 const unchanged=async()=> (await h.db.prepare('SELECT version FROM l_meta').first()).version
 const dee=await h.person('Eli'),foreign=await h.person('Omar','manager')
 for(const p of [dee,foreign])await cmd('availability.save',{staffId:p.id,start:'2026-11-01T00:00:00Z',end:'2026-11-15T00:00:00Z'})
 await cmd('staff.save',{...pin(foreign),name:foreign.name,email:foreign.email,payrollId:foreign.payrollId,active:true,role:'manager',site:'Elsewhere'})
 const noPayrollChange={times:(await state()).timesheets,batches:(await state()).batches}
 // A proposal, its consent, a manager's refusal and the resulting personal
 // decisions reach only the existing participants and authorized reviewers.
 let shift=(await state()).shifts.find(x=>x.status==='published'&&x.staffId===alex.id&&x.start.startsWith('2026-11-05'))
 let swap=await cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:dee.id,note:'Private swap explanation'},alex.cookie)
 let n=(await read(dee)).find(n=>n.topic==='swap'&&n.source.id===swap.id)
 assert.equal(n.label,'Swap proposed');assert.equal(n.actionable,true);assert.deepEqual(n.source,{kind:'swaps',id:swap.id,revision:swap.revision});assert.equal(n.sourceAt,swap.proposedAt)
 assert.ok(!(await read(ben)).some(n=>n.source.id===swap.id));assert.ok(!(await read(foreign)).some(n=>n.source.id===swap.id))
 const before=await unchanged();await cmd('notice.acknowledge',pin(n),ben.cookie,404);assert.equal(await unchanged(),before)
 await cmd('notice.acknowledge',{id:n.id,revision:n.revision+1},dee.cookie,409);assert.equal(await unchanged(),before)
 const ack=await cmd('notice.acknowledge',pin(n),dee.cookie)
 assert.ok(ack.acknowledgedAt);assert.equal((await state()).swaps.find(w=>w.id===swap.id).status,'proposed','notice acknowledgment grants no swap consent')
 const version=await unchanged(),saved=await stored();await cmd('notice.acknowledge',pin(n),dee.cookie)
 assert.equal(await unchanged(),version);assert.deepEqual(await stored(),saved,'receipt retry is a complete no-op')
 swap=await cmd('swap.respond',{...pin(swap),decision:'accepted',note:'Private reply'},dee.cookie)
 assert.ok((await read(alex)).some(n=>n.source.id===swap.id&&n.label==='Swap consent recorded'))
 assert.ok((await read(manager)).some(n=>n.source.id===swap.id&&n.label==='Swap consent recorded'))
 assert.ok((await read()).some(n=>n.source.id===swap.id));assert.ok(!(await read(foreign)).some(n=>n.source.id===swap.id))
 const stale=await unchanged();await cmd('notice.acknowledge',pin(ack),dee.cookie,404);assert.equal(await unchanged(),stale)
 swap=await cmd('swap.decide',{...pin(swap),decision:'refused',note:'Private decision'},manager.cookie)
 for(const p of [alex,dee])assert.ok((await read(p)).some(n=>n.source.id===swap.id&&n.label==='Swap refused'))
 swap=await cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:ben.id},alex.cookie)
 await cmd('swap.withdraw',pin(swap),alex.cookie)
 assert.ok((await read(ben)).some(n=>n.source.id===swap.id&&n.label==='Swap withdrawn'))
 swap=await cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:dee.id},alex.cookie)
 const staleProposal=(await read(dee)).find(n=>n.source.id===swap.id)
 await cmd('shift.confirm',pin(shift),alex.cookie)
 assert.ok(!(await read(dee)).some(n=>n.id===staleProposal.id))
 const staleVersion=await unchanged();await cmd('notice.acknowledge',pin(staleProposal),dee.cookie,404);assert.equal(await unchanged(),staleVersion)
 // Each tier appears at its opening, not at posting. Replay and restart do not
 // repeat it; picking one recipient closes every competing pending purpose.
 const offer=await cmd('openshift.post',{site:'',position:'',start:'2026-11-07T09:00:00Z',end:'2026-11-07T11:00:00Z',breakMinutes:0,approval:'manager',pool:[alex.id,dee.id],order:'tiers',rule:'custom',ranking:[alex.id,dee.id],size:1,minutes:30})
 assert.ok((await read(alex)).some(n=>n.source.id===offer.id&&n.topic==='open-offer'))
 assert.ok(!(await read(dee)).some(n=>n.source.id===offer.id))
 const at='2026-11-02T12:30:00.000Z',head={'x-test-now':String(Date.parse(at))}
 const tick=async()=>{const r=await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(at),cron:'*/15 * * * *'});assert.equal(r.outcome,'ok')}
 const later=async(p=h.owner)=>(await h.send('/api/lanyard/state',undefined,p.cookie??p,head)).value
 await tick();let due=(await later(dee)).eventnotices.find(n=>n.source.id===offer.id)
 assert.ok(due);assert.equal(due.delivery.state,'available');assert.equal(due.acknowledgedAt,null)
 const persisted=await stored();await tick();assert.deepEqual(await stored(),persisted);await h.restart();await tick();assert.deepEqual(await stored(),persisted)
 const request=await h.cmd('openshift.request',pin(offer),dee.cookie,200,head)
 assert.ok((await later(manager)).eventnotices.some(n=>n.topic==='pickup'&&n.source.id===request.id&&n.label==='Pickup requested'))
 const other=await h.cmd('openshift.request',pin(offer),alex.cookie,200,head)
 const assigned=await h.cmd('openshift.approve',pin(request),manager.cookie,200,head)
 assert.ok((await later(dee)).eventnotices.some(n=>n.source.id===request.id&&n.label==='Pickup approved'))
 assert.ok((await later(alex)).eventnotices.some(n=>n.source.id===other.id&&n.label==='Pickup closed'))
 assert.ok(!(await later(alex)).eventnotices.some(n=>n.source.id===offer.id),'filled offers are obsolete')
 const refused=await unchanged();await h.cmd('notice.acknowledge',pin(due),dee.cookie,404,head);assert.equal(await unchanged(),refused)
 // Call-out offers exclude the private reason; explicit offer responses and
 // replacement approval retain their own notice receipts.
 const callout=await cmd('shift.callout',{...pin(assigned.shift),note:'Private medical reason'},dee.cookie)
 assert.ok((await read(manager)).some(n=>n.topic==='coverage'&&n.label==='Call-out needs cover'))
 let replacement=callout.offers.find(o=>o.staffId===ben.id)
 assert.ok(replacement);assert.ok((await read(ben)).some(n=>n.source.id===replacement.id&&n.label==='Replacement shift offered'))
 replacement=await cmd('cover.respond',{...pin(replacement),decision:'accepted',note:'Private cover reply'},ben.cookie)
 assert.ok((await read(manager)).some(n=>n.source.id===replacement.id&&n.label==='Replacement offer accepted'))
 const covered=await cmd('cover.approve',pin(replacement),manager.cookie)
 assert.ok((await read(ben)).some(n=>n.source.id===replacement.id&&n.label==='Replacement offer approved'))
 assert.ok((await read(dee)).some(n=>n.source.id===covered.id&&n.label==='Replacement approved'))
 await cmd('attendrule.save',{site:'',graceMinutes:5,noShowMinutes:15})
 const missed='2026-11-07T09:16:00.000Z'
 await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(missed),cron:'*/15 * * * *'})
 const missedHead={'x-test-now':String(Date.parse(missed))}
 let missedState=(await h.send('/api/lanyard/state',undefined,manager.cookie,missedHead)).value
 assert.ok(missedState.eventnotices.some(n=>n.source.id===covered.id&&n.label==='Replacement missed clock-in'))
 await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:missed},ben.cookie,200,missedHead)
 missedState=(await h.send('/api/lanyard/state',undefined,manager.cookie,missedHead)).value
 assert.ok(!missedState.eventnotices.some(n=>n.source.id===covered.id&&n.topic==='coverage'))
 // TIME-007's own in-app reminder remains distinct from an end-time decision.
 await cmd('closerule.save',{site:'',graceMinutes:0,capHours:12})
 const overdue='2026-11-07T12:00:00.000Z',overdueHead={'x-test-now':String(Date.parse(overdue))}
 await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(overdue),cron:'*/15 * * * *'})
 const overdueState=(await h.send('/api/lanyard/state',undefined,ben.cookie,overdueHead)).value
 const clockNotice=overdueState.eventnotices.find(n=>n.topic==='clock-out')
 assert.ok(clockNotice);assert.ok(overdueState.clocks.find(k=>k.id===clockNotice.source.id).provisional)
 const clockBefore=(await state()).clocks,workBefore=(await state()).timesheets
 await h.cmd('notice.acknowledge',pin(clockNotice),ben.cookie,200,overdueHead)
 assert.deepEqual((await state()).clocks,clockBefore);assert.deepEqual((await state()).timesheets,workBefore,'notice receipt cannot set a forgotten end time')
 // Mentions resolve only for current native logbook readers. Correction and
 // cafe transfer immediately withdraw access, including an old receipt pin.
 const log=await cmd('log.save',{site:'',date:'2026-11-02',category:'staffing',text:'Private staffing details',mentions:[manager.id]})
 let mention=(await read(manager)).find(n=>n.source.id===log.id)
 assert.equal(mention.label,'Mentioned in the manager logbook');assert.ok(!(await read(alex)).some(n=>n.source.id===log.id))
 await cmd('log.save',{...pin(log),site:'',date:log.date,category:log.category,text:'Corrected private staffing details',mentions:[]})
 assert.ok(!(await read(manager)).some(n=>n.source.id===log.id));await cmd('notice.acknowledge',pin(mention),manager.cookie,404)
 // Message notifications use precisely the live conversation-membership door.
 // Removing, leaving or transferring never exposes copied messages or titles.
 for(const p of [alex,dee,manager]){const current=(await state()).staff.find(v=>v.id===p.id);await cmd('staff.save',{...pin(current),name:current.name,email:current.email,payrollId:current.payrollId,active:true,role:current.role,site:'Cafe'})}
 const thread=await cmd('chat.create',{kind:'group',site:'Cafe',title:'Private conversation title',members:[alex.id,dee.id]},manager.cookie)
 const message=await cmd('chat.send',{threadId:thread.id,text:'Private conversation content'},alex.cookie)
 const messageNotice=(await read(dee)).find(n=>n.source.id===message.id)
 assert.equal(messageNotice.label,'New conversation message');assert.ok(!(await read(ben)).some(n=>n.source.id===message.id));assert.ok(!(await read()).some(n=>n.source.id===message.id),'unlisted owner receives no private-message notice')
 await cmd('chat.leave',{...pin(thread),reason:'Private departure reason'},dee.cookie)
 assert.ok(!(await read(dee)).some(n=>n.source.id===message.id));await cmd('notice.acknowledge',pin(messageNotice),dee.cookie,404)
 let person=(await state()).staff.find(v=>v.id===manager.id)
 await cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,active:true,role:person.role,site:'Elsewhere'})
 assert.ok(!(await read(manager)).some(n=>n.source.id===message.id))
 person=(await state()).staff.find(v=>v.id===manager.id)
 await cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,active:true,role:person.role,site:'Cafe'})
 assert.ok(!(await read(manager)).some(n=>n.source.id===message.id),'returning access cannot resurrect an obsolete notice')
 person=(await state()).staff.find(v=>v.id===dee.id)
 await cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,active:false,role:person.role,site:person.site})
 await state(dee.cookie,403)
 await cmd('staff.save',{...pin((await state()).staff.find(v=>v.id===dee.id)),name:person.name,email:person.email,payrollId:person.payrollId,active:true,role:person.role,site:person.site})
 assert.deepEqual(await read(dee),[],'reactivation cannot restore old native notice purposes')
 const all=await stored();assert.equal(new Set(all.map(n=>n.id)).size,all.length)
 const safe=JSON.stringify([all,await read(alex),await read(manager)])
 for(const privateText of ['Private swap explanation','Private reply','Private decision','Private medical reason','Private cover reply','Private staffing details','Corrected private staffing details','Private conversation title','Private conversation content','Private departure reason'])assert.ok(!safe.includes(privateText),privateText)
 assert.deepEqual((await state()).batches,noPayrollChange.batches)
 assert.deepEqual((await state()).timesheets,noPayrollChange.times)
}

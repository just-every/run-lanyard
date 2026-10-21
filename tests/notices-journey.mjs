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
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
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

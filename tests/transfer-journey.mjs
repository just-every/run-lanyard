import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {days,local} from './workforce-journey.mjs'
import {handoverFixture,pin} from './shiftwork-fixture.mjs'
const id=()=>crypto.randomUUID(),after=(iso,minutes)=>new Date(Date.parse(iso)+minutes*60000).toISOString()

// CLOCK-008 through native HTTP: Alex works the counter shift (with SCHEDULE-004's pinned counter/kitchen plan),
// changes to the kitchen three hours in, then on Tuesday moves to another cafe under its network rule.
export async function transferApi(h) {
 const f=await handoverFixture(h),{alex,manager,counter,kitchen,week,start,end,shift}=f
 const bar=await h.cmd('job.save',{name:'Bar',skills:['mixology'],certifications:[]})
 await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(start,60),job:kitchen.id},alex.cookie,409)
 const opened=await h.cmd('clock.in',{commandId:id(),capturedAt:start},alex.cookie);assert.equal(opened.shiftId,shift.id)
 assert.match(JSON.stringify(await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(start,60),job:bar.id},alex.cookie,409)),/Not qualified for job/)
 assert.match(JSON.stringify(await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(start,60),job:kitchen.id,site:'Mission'},alex.cookie,409)),/Not eligible at this site/)
 await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(start,60),job:counter.id},alex.cookie,409)
 const move={commandId:id(),capturedAt:after(start,180),job:kitchen.id},moved=await h.cmd('clock.transfer',move,alex.cookie)
 assert.deepEqual(moved.transfers.map(t=>[t.job,t.site,t.from.job,t.at]),[[kitchen.id,'Ocean Beach',counter.id,move.capturedAt]])
 // TIME-001 identity: a retry returns the same result; the identity with another body is refused.
 assert.deepEqual(await h.cmd('clock.transfer',move,alex.cookie),moved);await h.cmd('clock.transfer',{...move,job:counter.id},alex.cookie,409)
 await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(start,120),job:counter.id},alex.cookie,409)
 const time=(await h.cmd('clock.out',{commandId:id(),capturedAt:end,breakMinutes:30},alex.cookie)).timesheet
 assert.equal(time.segmentPlan.transfers,true);assert.equal(time.minutes,450)
 // AUTO-001 never approves a punch that changed job; a person decides it.
 const rule=await h.cmd('autorule.save',{site:'Ocean Beach'}),preview=await h.send(`/api/lanyard/autorules/${rule.id}/preview`,undefined,h.owner)
 assert.ok(preview.value.items.find(x=>x.timesheetId===time.id).reasons.includes('job changed mid-shift'))
 let approved=await h.cmd('time.approve',pin(time),manager.cookie)
 // The transfer replaces the pinned area plan: each payable minute counts once, at its segment's retained job rate.
 assert.deepEqual(approved.workSegments.map(p=>[p.job,p.area,p.site,p.minutes,p.rateBasis.segments.map(x=>x.cents),p.rateBasis.costCents]),[[counter.id,'','Ocean Beach',169,[2000],5633],[kitchen.id,'','Ocean Beach',281,[2400],11240]])
 assert.equal(approved.workSegments.reduce((n,p)=>n+p.minutes,0),approved.minutes);assert.equal(approved.rateBasis.costCents,16873)
 const report=await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${week}&size=60`,undefined,manager.cookie)
 assert.equal(Math.round(report.value.intervals.reduce((n,p)=>n+p.actual.minutes,0)),450,'actual labor counts each payable minute once, not the plan or enclosing time again')
 const mine=(await h.state(alex.cookie)).timesheets.find(t=>t.id===approved.id)
 assert.deepEqual(mine.workSegments.map(p=>[p.job,p.minutes]),[[counter.id,169],[kitchen.id,281]]);assert.ok(mine.workSegments.every(p=>!p.rateBasis))
 const batch=await h.cmd('payroll.prepare',{ids:[approved.id]}),competing=await h.cmd('payroll.prepare',{ids:[approved.id]})
 const exported=await h.cmd('payroll.export',pin(batch),manager.cookie);await h.cmd('payroll.export',pin(competing),manager.cookie,409)
 const csv=(await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,manager.cookie)).text
 const rows=csv.split('\r\n').filter(l=>l.startsWith('ALEX,')).map(l=>l.split(','))
 assert.deepEqual(rows.map(c=>[c[5],c[8],c[9],c[10],c[11]]),[['169','regular',counter.id,'','Ocean Beach'],['281','regular',kitchen.id,'','Ocean Beach']])
 assert.deepEqual(rows.map(c=>[c[3],c[4],c[12],c[13]].map(Date.parse)),[[start,after(start,180),start,end].map(Date.parse),[after(start,180),end,start,end].map(Date.parse)],'each split row keeps its segment bounds and the enclosing punch times')
 // A later correction exports only the signed per-job difference under the same enclosing timesheet.
 const correction=await h.cmd('time.prepare',{staffId:alex.id,start,end,breakMinutes:59,reason:'Agreed meal correction',corrects:approved.id})
 approved=await h.cmd('time.approve',pin(correction),manager.cookie)
 assert.deepEqual(approved.workSegments.map(p=>[p.job,p.minutes]),[[counter.id,158],[kitchen.id,263]]);assert.equal(approved.exportMinutes,-29)
 const delta=await h.cmd('payroll.prepare',{ids:[approved.id]});assert.deepEqual(delta.lines.map(l=>[l.job,l.minutes,l.corrects]),[[counter.id,-11,time.id],[kitchen.id,-18,time.id]])
 await h.cmd('payroll.export',pin(delta),manager.cookie)
 // Tuesday: a cafe change needs the cafe on the profile and passes that cafe's approved-network rule (CLOCK-007).
 const profile=(await h.state()).workforce.find(r=>r.staffId===alex.id)
 await h.cmd('workforce.save',{...pin(profile),staffId:alex.id,jobs:profile.jobs,skills:profile.skills,certifications:profile.certifications,sites:['Ocean Beach','Mission'],preferences:profile.preferences,minHours:profile.minHours,maxHours:profile.maxHours,classification:profile.classification,employmentType:'part-time',startDate:'2024-01-01',rates:profile.rates})
 const net=await h.cmd('clocknet.save',{site:'Mission',mode:'refuse',ranges:'198.51.100.0/24'}),tuesday=local(days(week,1),'09:00')
 await h.cmd('clock.in',{commandId:id(),capturedAt:tuesday},alex.cookie)
 assert.match(JSON.stringify(await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(tuesday,120),job:counter.id,site:'Mission'},alex.cookie,409)),/approved networks/)
 await h.cmd('clocknet.save',{site:'Mission',mode:'flag',ranges:'198.51.100.0/24',revision:net.revision})
 assert.deepEqual((await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(tuesday,120),job:counter.id,site:'Mission'},alex.cookie)).exceptions,['off-network punch'])
 const moving=(await h.cmd('clock.out',{commandId:id(),capturedAt:after(tuesday,240),breakMinutes:0},alex.cookie)).timesheet;assert.ok(moving.exceptions.includes('off-network punch'))
 const split=await h.cmd('time.approve',pin(moving),manager.cookie)
 assert.deepEqual(split.workSegments.map(p=>[p.job,p.site,p.minutes]),[['','Ocean Beach',120],[counter.id,'Mission',120]])
 assert.deepEqual((await h.cmd('payroll.prepare',{ids:[split.id]})).lines.map(l=>[l.job,l.site,l.minutes]),[['','Ocean Beach',120],[counter.id,'Mission',120]])
 for(const [site,minutes] of [['Ocean%20Beach',120],['Mission',120]]){const r=await h.send(`/api/lanyard/intervals?site=${site}&date=${days(week,1)}&size=60`,undefined,h.owner);assert.equal(Math.round(r.value.intervals.reduce((n,p)=>n+p.actual.minutes,0)),minutes,`each cafe counts only its own segment: ${site}`)}
 // The week's overtime counts every segment: 421 + 240 + 4 × 510 minutes.
 for(const d of [2,3,4,5])await h.cmd('time.prepare',{staffId:alex.id,start:local(days(week,d),'09:00'),end:local(days(week,d),'17:30'),breakMinutes:0,reason:'Paper timesheet'})
 const ot=await h.send(`/api/lanyard/overtime?week=${week}&asOf=${new Date().toISOString()}`,undefined,manager.cookie),alert=ot.value.alerts.find(a=>a.staffId===alex.id)
 assert.deepEqual([alert.actualMinutes,alert.overtimeMinutes,alert.days[week],alert.days[days(week,1)]],[2701,301,421,240])
}

export async function transferBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try {
   const f=await handoverFixture(h,false),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const open=async path=>{await page.goto(h.origin+path,{waitUntil:'networkidle'})}
   const shot=async(key,selector)=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key} fits ${width}px`)
    if(process.env.TRANSFER_SCREENS){await mkdir(process.env.TRANSFER_SCREENS,{recursive:true});await page.locator(selector).first().scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.TRANSFER_SCREENS,`${key}-${width}.png`)});await page.locator(selector).first().screenshot({path:join(process.env.TRANSFER_SCREENS,`${key}-section-${width}.png`)})}
   }
   const submit=async(form,name)=>{const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name=')),form.getByRole('button',{name,exact:true}).click()]);assert.equal(r.status(),200);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,await page.locator('.notice.error').allTextContents())}
   const time=`/app/time?week=${f.week}&site=Ocean%20Beach`
   // Alex clocked in on the counter shift; the phone's clock reads three hours later when they change job.
   await h.cmd('clock.in',{commandId:id(),capturedAt:f.start},f.alex.cookie)
   await page.clock.setFixedTime(new Date(Date.parse(f.start)+180*60000))
   await as(f.alex.cookie);await open(time)
   const clock=page.locator('[data-clock]')
   assert.ok((await clock.innerText()).includes('Working Counter at Ocean Beach'));await shot('clock-counter','[data-clock]')
   // Captured without service (CLOCK-002's encrypted outbox), then replayed with its original time on reconnect.
   await clock.locator('[name=transferJob]').selectOption(f.kitchen.id);await context.setOffline(true)
   await clock.getByRole('button',{name:'Change job',exact:true}).click()
   await page.waitForFunction(()=>document.querySelector('[data-clock-events]')?.innerText.includes('Change job'));assert.match(await clock.locator('[data-clock-events]').innerText(),/Change job · .* · Pending sync\./);await shot('clock-pending','[data-clock]')
   const [sent]=await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/lanyard/command')&&r.request().postDataJSON()?.name==='clock.transfer'),context.setOffline(false)])
   assert.equal(sent.status(),200);assert.equal(sent.request().postDataJSON().input.capturedAt,after(f.start,180))
   await page.waitForFunction(()=>document.querySelector('[data-clock]')?.innerText.includes('Changed to Kitchen'),undefined,{timeout:20000});await page.waitForLoadState('networkidle')
   assert.ok((await clock.innerText()).includes('Working Kitchen at Ocean Beach'));await shot('clock-kitchen','[data-clock]')
   await h.cmd('clock.out',{commandId:id(),capturedAt:f.end,breakMinutes:30},f.alex.cookie)
   await as(f.manager.cookie);await open(time)
   assert.match(await page.locator('.clock-list').textContent(),/Change job: captured .*; received /)
   await submit(page.locator('#approve form[action*="name=time.approve&"]'),'Approve')
   const list=await page.locator('.time-list').innerText()
   for(const text of ['Job segments','Counter at Ocean Beach: 2.8 hrs · regular · $20.00/hr · $56.33','Kitchen at Ocean Beach: 4.7 hrs · regular · $24.00/hr · $112.40','Total 7.5 hrs; enclosing time 7.5 hrs'])assert.ok(list.includes(text),`${text} in ${list}`)
   await shot('time-segments','.time-list')
   await open('/app/payroll');await submit(page.locator('form[data-payroll-form]'),'Prepare batch')
   const batch=page.locator('.batch');assert.deepEqual((await h.state()).batches[0].lines.map(l=>[l.job,l.minutes]),[[f.counter.id,169],[f.kitchen.id,281]])
   assert.ok((await batch.innerText()).includes('Counter · Ocean Beach'));assert.ok((await batch.innerText()).includes('Kitchen · Ocean Beach'));await shot('payroll-split','.batch')
   const exportForm=page.locator('form[action*="name=payroll.export"]');await exportForm.locator('[type=checkbox]').check();await submit(exportForm,'Export reviewed CSV')
   assert.equal((await h.state()).batches[0].status,'exported')
   // Alex sees their own segments without any rate.
   await as(f.alex.cookie);await open(time)
   const own=await page.locator('.time-list').innerText();assert.ok(own.includes('Kitchen at Ocean Beach: 4.7 hrs · regular'));assert.ok(!own.includes('/hr'))
   await shot('employee-segments','.time-list')
   assert.deepEqual(errors,[])
  } finally {await context.close();await h.close()}
 }} finally {await browser.close()}
}

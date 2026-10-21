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
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),manager=await h.person('Priya','manager'),foreign=await h.person('Omar','manager')
 await cmd('staff.save',{...pin(foreign),name:foreign.name,email:foreign.email,payrollId:foreign.payrollId,active:true,role:'manager',site:'Elsewhere'})
 const settings={site:'',shiftLeadMinutes:60,ackMinutes:5,offerLeadMinutes:30,exceptionMinutes:5,reviewMinutes:5,payrollLeadMinutes:60,escalationMinutes:10}
 await cmd('noticerule.save',settings,alex.cookie,403);await cmd('noticerule.save',settings,foreign.cookie,403)
 const rule=await cmd('noticerule.save',settings,manager.cookie)
 await cmd('attendrule.save',{site:'',graceMinutes:5,noShowMinutes:15})
 await cmd('closerule.save',{site:'',graceMinutes:0,capHours:12})
 const shifts=[{staffId:alex.id,start:at(60),end:at(180),breakMinutes:0},{staffId:ben.id,start:at(-30),end:at(180),breakMinutes:0},{staffId:cy.id,start:at(-480),end:at(-60),breakMinutes:0}]
 for(const p of [alex,ben,cy,manager])await cmd('availability.save',{staffId:p.id,start:at(-1440),end:at(2880)})
 const weekOf=t=>{const d=new Date(t),n=(d.getUTCDay()+6)%7;return iso(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-n)).slice(0,10)}
 for(const week of new Set(shifts.map(x=>weekOf(x.start)))){const r=await cmd('roster.prepare',{week,shifts:shifts.filter(x=>weekOf(x.start)===week)});await cmd('roster.publish',pin(r))}
 await cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:at(-480)},cy.cookie,200,-480)
 await cmd('openshift.post',{site:'',position:'',start:at(20),end:at(120),breakMinutes:0,approval:'manager',order:'all'})
 const request=await cmd('time.request',{start:at(-180),end:at(-120),breakMinutes:0,reason:'Forgot the clock',attest:true},alex.cookie)
 const date=at(0).slice(0,10),period=await cmd('period.save',{start:date,end:date})
 const tick=async m=>{const result=await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(base+m*60000),cron:'*/15 * * * *'});assert.equal(result.outcome,'ok')}
 const state=async(c=h.owner,m=6)=>(await h.send('/api/lanyard/state',undefined,c,head(m))).value
 return {base,at,head,cmd,tick,state,alex,ben,cy,manager,foreign,request,period,rule,settings,week:weekOf(at(0))}
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
 await h.mf.setOptions({});await f.tick(6);assert.deepEqual(await stored(),before)
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
 const all=await stored();assert.equal(new Set(all.map(n=>JSON.stringify([n.kind,n.subject,n.basis,n.recipient,n.due,n.escalation]))).size,all.length)
 assert.ok(all.some(n=>n.status==='withdrawn'&&n.withdrawalReason),'withdrawals retain a reason')
 const safe=JSON.stringify((await f.state(h.owner,cutoff+6)).notices)
 for(const privateText of ['Forgot the clock','I am investigating','rate_cents','hourlyRate'])assert.ok(!safe.includes(privateText))
 const key=await h.cmd('agent.create',{label:'Preparation only'})
 await h.cmd('noticerule.save',f.settings,'',401,{authorization:`Bearer ${key.token}`})
 return f
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
   const shot=async key=>{if(process.env.NOTICE_SCREENS){await mkdir(process.env.NOTICE_SCREENS,{recursive:true});await page.locator('#reminder-inbox').screenshot({path:join(process.env.NOTICE_SCREENS,`${key}-${width}.png`)})}}
   for(const screen of ['schedule','time']){
    await page.goto(h.origin+`/app/${screen}?week=${f.week}`,{waitUntil:'networkidle'})
    assert.ok((await page.locator('#reminder-inbox').innerText()).includes('In Lanyard only'))
    await shot(screen)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   }
   await page.getByText('Reminder settings',{exact:true}).click()
   const form=page.locator('form[action*="name=noticerule.save"]');await form.locator('[name=ackMinutes]').fill('8')
   await shot('settings')
   await Promise.all([page.waitForResponse(r=>r.url().includes('name=noticerule.save')),form.getByRole('button',{name:'Save reminder settings',exact:true}).click()])
   assert.equal(await page.locator('.notice.error').count(),0)
   assert.equal((await f.state()).noticerules[0].ackMinutes,8)
   await shot('saved');assert.deepEqual(errors,[]);await context.close()
  }
 }finally{await browser.close();await h.close()}
}

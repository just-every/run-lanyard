import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {days,local} from './workforce-journey.mjs'
export const pin=r=>({id:r.id,revision:r.revision})
export async function payFixture(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),manager=await h.person('Morgan','manager')
 for(const p of [alex,ben])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,hourlyRate:'20.00'})
 const spec={name:'Counter semimonthly',cadence:'semimonthly',from:'2026-10-01',payDays:5,workweekStart:0,staffIds:[alex.id]}
 const semi=await h.cmd('paygroup.save',spec),bi=await h.cmd('paygroup.save',{...spec,name:'Kitchen biweekly',cadence:'biweekly',from:'2026-10-11',staffIds:[ben.id]})
 const first=await h.cmd('paygroup.period',{groupId:semi.id,date:'2026-10-12'}),second=await h.cmd('paygroup.period',{groupId:semi.id,date:'2026-10-16'}),other=await h.cmd('paygroup.period',{groupId:bi.id,date:'2026-10-16'})
 const enter=async(p,d,hours=8,extra={})=>{const t=await h.cmd('time.prepare',{staffId:p.id,start:`2026-10-${d}T15:00:00Z`,end:`2026-10-${d}T${15+hours}:00:00Z`,breakMinutes:0,reason:'Agreed paper timesheet',...extra});return h.cmd('time.approve',pin(t),manager.cookie)}
 const early=[];for(const d of [11,12,13,14,15])early.push(await enter(alex,d))
 const signLock=async(r,p)=>{r=await h.cmd('period.signoff',pin(r),p.cookie);r=await h.cmd('period.signoff',pin(r),manager.cookie);return h.cmd('period.lock',pin(r))}
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,manager,semi,bi,spec,first,second,other,early,enter,signLock}
}
export async function payScheduleApi(h) {
 const f=await payFixture(h),{alex,ben,manager,semi,bi,spec,early,enter,signLock}=f
 assert.deepEqual([f.first.start,f.first.end,f.first.payDate,f.second.start,f.second.end,f.second.payDate],['2026-10-01','2026-10-15','2026-10-20','2026-10-16','2026-10-31','2026-11-05'])
 assert.deepEqual([f.other.start,f.other.end,f.other.payDate],['2026-10-11','2026-10-24','2026-10-29'])
 assert.deepEqual(await h.cmd('paygroup.period',{groupId:semi.id,date:'2026-10-03'}),f.first,'opening an existing period preserves it')
 await h.cmd('paygroup.save',{...spec,name:'Not allowed'},manager.cookie,403)
 await h.cmd('paygroup.save',{...spec,name:'Not allowed'},alex.cookie,403)
 await h.cmd('paygroup.save',{...spec,name:'Duplicate employee'},h.owner,409)
 await h.cmd('paygroup.period',{groupId:semi.id,date:'2026-09-30'},h.owner,400)
 await h.cmd('paygroup.period',{groupId:semi.id,date:'2026-02-30'},h.owner,400)
 // Lock and export the first period's 40 straight-time hours while the week still
 // has no overtime. Adding later approved work must never change that file.
 let first=await signLock(f.first,alex)
 const initial=await h.cmd('payroll.prepare',{}),sent=await h.cmd('payroll.export',pin(initial))
 assert.equal(sent.lines.reduce((n,l)=>n+l.minutes,0),2400);assert.ok(sent.lines.every(l=>l.staffId===alex.id&&!l.overtimeKey))
 first=await h.cmd('period.close',{...pin(first),reference:'Employer-recorded first-period run'})
 const locked=structuredClone(first.locked),originalFile=sent.csv
 const late=await enter(alex,16,5)
 for(const d of [11,12,13,14,15])await enter(ben,d)
 await enter(ben,16,5)
 let second=await signLock(f.second,alex)
 const batch=await h.cmd('payroll.prepare',{}),competing=await h.cmd('payroll.prepare',{})
 const [adjustment]=batch.lines.filter(l=>l.overtimeKey)
 assert.deepEqual([adjustment.staffId,adjustment.minutes,adjustment.multiplier,adjustment.label],[alex.id,300,0.5,'Cross-period overtime adjustment'])
 assert.deepEqual([adjustment.trace.week,adjustment.trace.end,adjustment.trace.sourcePeriods,adjustment.trace.targetPeriodId],['2026-10-11','2026-10-17',['2026-10-01','2026-10-16'],second.id])
 assert.deepEqual([...new Set(adjustment.trace.source.map(p=>p.timeId))],[...early.map(t=>t.id),late.id])
 assert.equal(adjustment.trace.source.reduce((n,p)=>n+p.minutes,0),2700,'whole 45-hour workweek, not either pay period alone')
 assert.equal(batch.lines.filter(l=>!l.overtimeKey).reduce((n,l)=>n+l.minutes,0),300,'no first-period straight-time replay')
 assert.ok(batch.lines.every(l=>l.staffId!==ben.id),'biweekly group waits for its own lock')
 // Source/destination revision checks also apply to premium-only work.
 second=await h.cmd('period.reopen',{...pin(second),reason:'Recheck employee signoff'})
 await h.cmd('payroll.export',pin(batch),h.owner,409)
 second=await signLock(second,alex)
 const current=await h.cmd('payroll.prepare',{}),otherDraft=await h.cmd('payroll.prepare',{})
 const exported=await h.cmd('payroll.export',pin(current))
 await h.cmd('payroll.export',pin(otherDraft),h.owner,409)
 await h.cmd('payroll.export',pin(competing),h.owner,409)
 assert.match(exported.csv,/weekly overtime premium/);assert.match(exported.csv,/Cross-period overtime adjustment/);assert.match(exported.csv,/2026-10-01;2026-10-16,0.5/)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,originalFile)
 assert.deepEqual((await h.state()).periods.find(p=>p.id===first.id).locked,locked)
 await h.cmd('payroll.prepare',{},h.owner,409)
 // EARN-001 now uses the semimonthly period/pay date, but computes overtime
 // from all 45 approved hours of the Sunday workweek, including the first period.
 const page=(await h.send('/app/time?week=2026-10-19',undefined,alex.cookie)).text
 for(const part of ['Pay period Oct 16 – Oct 31 · pay date Thu Nov 5','Overtime (approved)</th><td class="num">5.0 hrs','<strong>$150.00</strong>'])assert.ok(page.includes(part),part)
 assert.ok(!page.includes('Kitchen biweekly')&&!page.includes('Ben'))
 const projection=await h.send('/api/lanyard/overtime?week=2026-10-12&asOf=2026-10-19T00:00:00Z',undefined,h.owner)
 assert.equal(projection.status,200,projection.text);assert.equal(projection.value.alerts.find(a=>a.staffId===alex.id).actualMinutes,2700,'COST-002 follows the Sunday workweek')
 const mine=await h.state(alex.cookie);assert.deepEqual(mine.paygroups.map(g=>[g.id,g.staffIds]),[[semi.id,[alex.id]]])
 const benPage=(await h.send('/app/time?week=2026-10-19',undefined,ben.cookie)).text
 assert.ok(benPage.includes('Pay period Oct 11 – Oct 24 · pay date Thu Oct 29'));assert.ok(benPage.includes('<strong>$950.00</strong>'))
 const other=await signLock(f.other,ben),biBatch=await h.cmd('payroll.prepare',{})
 assert.ok(biBatch.lines.every(l=>l.staffId===ben.id));assert.equal(biBatch.lines.find(l=>l.overtimeKey).minutes,300);assert.equal(biBatch.lines.find(l=>l.overtimeKey).label,'Workweek overtime premium')
 await h.cmd('payroll.export',pin(biBatch))
 assert.equal((await h.state()).periods.find(p=>p.id===other.id).status,'locked')
 // A later correction changes only the premium difference. The first locked
 // period and both previously exported files stay byte-for-byte unchanged.
 await enter(alex,11,7,{corrects:early[0].id,reason:'Agreed one-hour correction'})
 const delta=await h.cmd('payroll.prepare',{})
 assert.deepEqual(delta.lines.map(l=>[l.minutes,l.payCode??'regular']),[[-60,'regular'],[-60,'weekly overtime premium']])
 await h.cmd('payroll.export',pin(delta))
 assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text,exported.csv)
 assert.deepEqual((await h.state()).periods.find(p=>p.id===first.id).locked,locked)
 // Starting a group's first pay period on the sixteenth must still look back
 // over the whole Sunday week; the earlier exported 40 hours are not replayed.
 const joiner=await h.person('Joiner'),old=[]
 for(const d of [11,12,13,14,15])old.push(await enter(joiner,d))
 const beforeGroup=await h.cmd('payroll.prepare',{ids:old.map(t=>t.id)});await h.cmd('payroll.export',pin(beforeGroup))
 const newGroup=await h.cmd('paygroup.save',{...spec,name:'Midweek start',from:'2026-10-16',staffIds:[joiner.id]})
 const newPeriod=await h.cmd('paygroup.period',{groupId:newGroup.id,date:'2026-10-16'})
 await enter(joiner,16,5);await signLock(newPeriod,joiner)
 const firstWeek=await h.cmd('payroll.prepare',{})
 assert.equal(firstWeek.lines.find(l=>l.overtimeKey).minutes,300,'first-period date never resets the workweek')
 assert.equal(firstWeek.lines.filter(l=>!l.overtimeKey).reduce((n,l)=>n+l.minutes,0),300)
 await h.cmd('payroll.export',pin(firstWeek))
 // A Sunday pickup belongs to the workweek beginning that Sunday, even
 // though it sits in the previous Monday-starting visual roster week.
 const risk=await h.person('Risk'),today=new Date().toISOString().slice(0,10),sun=days(today,(7-new Date(today+'T00:00:00Z').getUTCDay())%7||7),mon=days(sun,1)
 await h.cmd('paygroup.save',{...spec,name:'Sunday pickup',cadence:'weekly',from:sun,staffIds:[risk.id]})
 await h.cmd('availability.save',{staffId:risk.id,start:local(sun,'00:00'),end:local(days(sun,7),'00:00')})
 const scheduled=await h.cmd('roster.prepare',{week:mon,shifts:[0,1,2,3].map(n=>({staffId:risk.id,start:local(days(mon,n),'09:00'),end:local(days(mon,n),'18:00'),breakMinutes:0}))})
 await h.cmd('roster.publish',pin(scheduled))
 const sunday=await h.cmd('openshift.post',{site:'',position:'',start:local(sun,'09:00'),end:local(sun,'18:00'),breakMinutes:0,approval:'manager',pool:[risk.id]})
 const request=await h.cmd('openshift.request',pin(sunday),risk.cookie)
 const preview=(await h.state(manager.cookie)).pickups.find(p=>p.id===request.id)
 assert.deepEqual([preview.cost.projectedMinutes,preview.cost.overtimeMinutes],[2700,300],'Sunday pickup plus 36 hours later in its own workweek')
 // Weekly and monthly recurrence, leap-day/month/year transitions, and a
 // different workweek day are defined through the same public command door.
 const cal=await h.person('Cal'),dee=await h.person('Dee')
 const monthly=await h.cmd('paygroup.save',{...spec,name:'Calendar monthly',cadence:'monthly',from:'2024-02-01',workweekStart:3,staffIds:[cal.id]})
 const feb=await h.cmd('paygroup.period',{groupId:monthly.id,date:'2024-02-29'})
 assert.deepEqual([feb.start,feb.end,feb.payDate],['2024-02-01','2024-02-29','2024-03-05'])
 const dec=await h.cmd('paygroup.period',{groupId:monthly.id,date:'2026-12-31'})
 assert.deepEqual([dec.start,dec.end,dec.payDate],['2026-12-01','2026-12-31','2027-01-05'])
 const weekly=await h.cmd('paygroup.save',{...spec,name:'Weekly',cadence:'weekly',from:'2026-10-07',workweekStart:3,staffIds:[dee.id]})
 const next=await h.cmd('paygroup.period',{groupId:weekly.id,date:'2026-10-16'})
 assert.deepEqual([next.start,next.end,next.payDate],['2026-10-14','2026-10-20','2026-10-25'])
}

export async function payScheduleBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try {
   const f=await payFixture(h),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key} fits ${width}px`);if(process.env.PAY_SCREENS){await mkdir(process.env.PAY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.PAY_SCREENS,`${key}-${width}.png`),fullPage:true})}}
   await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   const groups=page.locator('#pay-groups');assert.ok((await groups.innerText()).includes('Counter semimonthly'));assert.ok((await groups.innerText()).includes('workweek starts Sunday'))
   // Add and open a monthly schedule using the real Payroll forms.
   const cal=await h.person('Cal');await page.reload({waitUntil:'networkidle'})
   await groups.locator('summary',{hasText:'Define a pay group'}).click()
   const create=groups.locator('form').filter({has:page.locator('[name=cadence]')})
   await create.getByLabel('Pay group name',{exact:true}).fill('Monthly team');await create.getByLabel('Pay schedule',{exact:true}).selectOption('monthly');await create.getByLabel('First period starts').fill('2026-10-01');await create.getByLabel('FLSA workweek starts').selectOption('0');await create.getByLabel('Cal',{exact:true}).check()
   await Promise.all([page.waitForResponse(r=>r.url().includes('name=paygroup.save')),create.getByRole('button',{name:'Save pay group',exact:true}).click()]);await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   const monthly=groups.locator('li').filter({hasText:'Monthly team'})
   await monthly.getByLabel('A date in the pay period').fill('2026-10-21')
   await Promise.all([page.waitForResponse(r=>r.url().includes('name=paygroup.period')),monthly.getByRole('button',{name:'Open scheduled period'}).click()]);await page.waitForLoadState('networkidle')
   assert.ok((await page.locator('#pay-periods').innerText()).includes('Monthly team'));await groups.scrollIntoViewIfNeeded();await shot('pay-schedules')
   await page.goto(h.origin+'/app/people',{waitUntil:'networkidle'})
   assert.equal(await page.locator('#earnings-settings').getByLabel('Fallback pay date: days after the week ends').count(),1)
   await page.locator('#earnings-settings').scrollIntoViewIfNeeded();await shot('pay-earnings-settings')
   await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   let first=await f.signLock(f.first,f.alex)
   const initial=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(initial));await h.cmd('period.close',{...pin(first),reference:'Employer reference'})
   await f.enter(f.alex,16,5);await f.signLock(f.second,f.alex)
   const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(batch))
   await page.reload({waitUntil:'networkidle'});const adjustment=page.locator('.batch').filter({hasText:'Cross-period overtime adjustment'})
   assert.ok((await adjustment.innerText()).includes('0.5× regular rate, additional premium only'));await adjustment.scrollIntoViewIfNeeded();await shot('pay-overtime-adjustment')
   await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2026-10-19',{waitUntil:'networkidle'})
   const earnings=page.locator('#earnings');assert.ok((await earnings.innerText()).includes('Pay period Oct 16 – Oct 31 · pay date Thu Nov 5'));assert.ok((await earnings.innerText()).includes('$150.00'))
   await earnings.scrollIntoViewIfNeeded();await shot('pay-employee-period');assert.deepEqual(errors,[])
  } finally {await context.close();await h.close()}
 }} finally {await browser.close()}
}

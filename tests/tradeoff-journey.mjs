import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {optimizationFixture} from './fairness-optimization-fixture.mjs'
import {days,local,pin} from './workforce-journey.mjs'

function explain(comparison) {
 const {low,high,explanation:e}=comparison
 assert.ok(e,'Comparison explains the assignment tradeoff')
 const difference=(a,b)=>a===null||b===null?null:b-a
 assert.equal(e.costDifferenceCents,difference(low.cost.costCents,high.cost.costCents))
 assert.equal(e.costDifferenceCents,comparison.difference.costCents)
 const changed=low.assignments.flatMap(from=>{
  const to=high.assignments.find(x=>x.slotId===from.slotId)
  assert.ok(to,'Both alternatives retain every service slot')
  return from.staffId===to.staffId?[]:[{slotId:from.slotId,fromStaffId:from.staffId,toStaffId:to.staffId}]
 })
 assert.deepEqual(e.changedAssignments,changed)
 assert.ok(changed.length,'The seeded alternatives change an assignment')
 assert.deepEqual(e.fairness,['spread','meanGapMinutes','maxGapMinutes','violations'].map(measure=>({
  measure,low:low.measures.totals[measure],high:high.measures.totals[measure],
  difference:difference(low.measures.totals[measure],high.measures.totals[measure])
 })))
 assert.ok(e.fairness.find(x=>x.measure==='spread').difference<0)
 assert.deepEqual(e.coverage,{
  lowSlots:low.coverage.slots.length,highSlots:high.coverage.slots.length,
  lowMinutes:low.coverage.slots.reduce((sum,x)=>sum+x.minutes,0),
  highMinutes:high.coverage.slots.reduce((sum,x)=>sum+x.minutes,0),
  uncoveredShifts:comparison.uncovered.length,
  uncoveredMinutes:comparison.uncovered.reduce((sum,x)=>sum+x.minutes,0)
 })
 assert.equal(e.serviceRisk,null)
 assert.equal(e.overtimeMinutes,null)
 for(const code of ['pos-demand','service-requirements','overtime-policy','cost-scope']){
  const unknown=e.uncertainty.find(x=>x.code===code)
  assert.ok(unknown,`${code} remains an explicit uncertainty`)
  assert.ok(typeof unknown.reason==='string'&&unknown.reason.trim().length>0)
 }
 if(low.cost.costCents===null||high.cost.costCents===null)assert.ok(e.uncertainty.some(x=>x.code==='missing-rates'))
 const overtime=e.weeklyScheduledOvertime
 assert.deepEqual(overtime.low,low.scheduledOvertime)
 assert.deepEqual(overtime.high,high.scheduledOvertime)
 assert.equal(overtime.minutesDifference,difference(overtime.low.overtimeMinutes,overtime.high.overtimeMinutes))
 assert.equal(overtime.premiumDifferenceCents,difference(overtime.low.premiumCents,overtime.high.premiumCents))
 for(const alternative of [low,high])for(const g of alternative.scheduledOvertime.groups){
  assert.equal(g.knownMinutes,g.inputs.reduce((n,p)=>n+p.minutes,0))
  for(const p of g.inputs){assert.ok(p.shiftId);assert.ok(p.revision);assert.equal(p.staffId,g.staffId);assert.equal(p.week,g.week)}
  if(g.minutes!==null){
   assert.equal(g.minutes,g.knownMinutes)
   assert.equal(g.overtimeMinutes,Math.max(0,g.minutes-2400))
   if(g.premiumCents!==null)assert.equal(g.premiumCents,g.overtimeMinutes===0?0:Math.round(g.inputs.reduce((n,p)=>n+p.minutes*p.cents,0)*g.overtimeMinutes/(g.minutes*120)))
  }else{assert.equal(g.overtimeMinutes,null);assert.equal(g.premiumCents,null);assert.ok(g.reasons.length)}
 }
 return e
}

export async function tradeoffApi(h) {
 const f=await optimizationFixture(h),before=await h.state()
 const comparison=await f.read();explain(comparison)
 const afterRead=await h.state()
 assert.equal(afterRead.version,before.version,'Explanation reads cannot mutate retained records')
 assert.deepEqual(afterRead.rosters,before.rosters)
 assert.deepEqual(afterRead.shifts,before.shifts)
 const prepare={week:f.week,site:'Ocean Beach',weeks:8,priority:'high',digest:comparison.digest}
 const draft=await h.cmd('fairness.prepare',prepare,f.manager.cookie)
 assert.deepEqual(draft.conflicts,[])
 const prepared=await h.state()
 assert.equal(prepared.rosters.find(x=>x.id===draft.id).status,'draft')
 assert.deepEqual(prepared.rosters.filter(x=>x.status==='published'),before.rosters.filter(x=>x.status==='published'))
 assert.deepEqual(prepared.shifts.filter(x=>x.status==='published'),before.shifts.filter(x=>x.status==='published'))
 const request=(await h.state()).fairnessrequests.find(x=>x.staffId===f.alex.id&&x.from===f.first)
 await h.cmd('fairness.request.save',{id:request.id,revision:request.revision,staffId:f.alex.id,from:f.first,minutes:120},f.alex.cookie)
 const stale=await h.cmd('fairness.prepare',prepare,f.manager.cookie,409)
 assert.ok(stale.error||stale.message,'Changed inputs produce a visible refusal')
 assert.equal((await h.state()).rosters.filter(x=>x.status==='draft').length,1)
 // The source itself becomes impossible: an explanation must not waive availability.
 await h.cmd('pattern.save',{from:f.week,blocks:'Mon unavailable 00:00-24:00',preferredHours:8,maxHours:40},f.alex.cookie)
 const refused=await h.send(f.path,undefined,f.manager.cookie)
 assert.equal(refused.status,400)
 const schedule=await h.send(`/app/schedule?week=${f.week}&site=Ocean%20Beach&fairCompare=1`,undefined,f.manager.cookie)
 assert.equal(schedule.status,200)
 const reason=refused.value.error??refused.value.message
 assert.ok(typeof reason==='string'&&reason.length>0)
 assert.ok(schedule.text.includes(reason),'The manager sees the comparison refusal on the schedule')
 assert.deepEqual((await h.state()).rosters.filter(x=>x.status==='published'),before.rosters.filter(x=>x.status==='published'))
}

export async function tradeoffBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await optimizationFixture(h)
   const {shifts,publish:republish}=await overtimeFixture(h,f)
   const comparison=await f.read(),e=explain(comparison),page=await context.newPage()
   await context.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname
    if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{
     return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})
    }catch{}
    await route.continue()
   })
   const [name,...value]=f.manager.cookie.split('=')
   await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const schedule=`${h.origin}/app/schedule?week=${f.week}&site=Ocean%20Beach&fairCompare=1`
   await page.goto(schedule,{waitUntil:'networkidle'})
   const card=page.locator('#fairness')
   for(const detail of await card.locator('details').all())await detail.evaluate(x=>x.open=true)
   const explanation=page.locator('#tradeoff-explanation')
   assert.equal(await explanation.isVisible(),true)
   const text=await explanation.innerText()
   assert.ok(text.includes('Scheduled weekly overtime estimate'))
   assert.ok(text.includes(comparison.low.scheduledOvertime.definition))
   assert.ok(text.includes('240 minutes / $44.36 premium'))
   assert.ok(text.includes(`${comparison.high.scheduledOvertime.overtimeMinutes} minutes`))
   const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})
   assert.ok(text.includes(usd.format(e.costDifferenceCents/100)))
   const spread=e.fairness.find(x=>x.measure==='spread')
   for(const value of [spread.low,spread.high,spread.difference])assert.ok(text.includes(String(value)))
   for(const unknown of e.uncertainty)assert.ok(text.includes(unknown.reason))
   const shot=async(key,locator)=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(process.env.TRADEOFF_SCREENS){
     await mkdir(process.env.TRADEOFF_SCREENS,{recursive:true})
     await (locator??page).screenshot({path:join(process.env.TRADEOFF_SCREENS,`${key}-${width}.png`)})
    }
   }
   await explanation.scrollIntoViewIfNeeded();await shot('tradeoff-explanation',explanation)
   const [download]=await Promise.all([page.waitForEvent('download'),card.getByRole('link',{name:'Download comparison and calculation inputs (JSON)'}).click()])
   const exported=JSON.parse(await readFile(await download.path(),'utf8'))
   explain(exported);assert.deepEqual(exported.explanation,e)
   const original=(await h.state()).rosters.filter(x=>x.status==='published')
   await page.getByRole('button',{name:'Prepare high fairness draft',exact:true}).click()
   await page.waitForLoadState('networkidle')
   const prepared=await h.state(),draft=prepared.rosters.find(x=>x.week===f.week&&x.status==='draft')
   assert.ok(draft)
   assert.deepEqual(prepared.rosters.filter(x=>x.status==='published'),original)
   const review=page.getByRole('link',{name:/Review draft revision/})
   if(await review.count())await review.click()
   const publish=page.getByRole('button',{name:'Publish this revision',exact:true})
   assert.equal(await publish.isVisible(),true)
   await publish.scrollIntoViewIfNeeded();await shot('tradeoff-draft')
   await publish.click();await page.waitForLoadState('networkidle')
   const published=(await h.state()).rosters.find(x=>x.id===draft.id)
   assert.equal(published.status,'published')
   assert.deepEqual((await f.read(f.base)).totals,comparison.high.measures.totals)
   await shot('tradeoff-published')
   // The same explanation screen shows unknown next-week inputs at both widths.
   await h.cmd('paygroup.save',{name:'Sunday browser workweek',cadence:'weekly',from:days(f.week,-1),payDays:3,workweekStart:0,staffIds:[f.alex.id,f.ben.id]})
   await republish([...shifts,{staffId:f.alex.id,site:'Ocean Beach',start:local(days(f.week,6),'23:00'),end:local(days(f.week,7),'01:00'),breakMinutes:30}])
   await page.goto(schedule,{waitUntil:'networkidle'})
   const unknown=await page.locator('#tradeoff-explanation').innerText()
   assert.ok(unknown.includes('unknown minutes / unknown premium'))
   assert.ok(unknown.includes('overnight carry-in are unpublished'))
   const boundary=await f.read()
   const next=boundary.low.scheduledOvertime.groups.find(g=>g.staffId===f.alex.id&&g.week===days(f.week,6))
   assert.deepEqual(next.inputs.map(p=>[p.date,p.minutes]),[[days(f.week,6),45],[days(f.week,7),45]])
   await page.locator('#tradeoff-explanation').scrollIntoViewIfNeeded();await shot('tradeoff-overtime-unknown')
   for(const person of [f.alex,f.ben])await h.cmd('pattern.save',{from:f.week,blocks:'Mon unavailable 00:00-24:00',preferredHours:8,maxHours:40},person.cookie)
   const refused=await h.send(f.path,undefined,f.manager.cookie)
   assert.equal(refused.status,400)
   await page.goto(schedule,{waitUntil:'networkidle'})
   const reason=refused.value.error??refused.value.message
   assert.ok((await page.locator('body').innerText()).includes(reason))
   await page.getByText(reason,{exact:true}).scrollIntoViewIfNeeded();await shot('tradeoff-impossible')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

// TRADEOFF-001 exercises the scheduled overtime slice through native HTTP.
export async function tradeoffOvertimeApi(h) {
 const f=await optimizationFixture(h)
 const {shifts,publish}=await overtimeFixture(h,f)
 let comparison=await f.read();explain(comparison)
 let g=comparison.low.scheduledOvertime.groups.find(g=>g.staffId===f.alex.id)
 assert.equal(g.minutes,2640);assert.equal(g.overtimeMinutes,240)
 assert.equal(g.premiumCents,4436,'20 hours at $20 and 24 at $24: half the weighted hourly rate for four overtime hours')
 assert.equal(g.inputs.reduce((n,p)=>n+p.minutes*p.cents,0),5856000)
 assert.ok(g.inputs.some(p=>p.profileId&&p.profileRevision&&p.rateFrom===days(f.week,2)))
 assert.equal(comparison.low.scheduledOvertime.overtimeMinutes,240)
 assert.ok(comparison.high.scheduledOvertime.overtimeMinutes<240)
 assert.ok(comparison.explanation.weeklyScheduledOvertime.premiumDifferenceCents<0)
 const before=await h.state(),request={week:f.week,site:'Ocean Beach',weeks:8,priority:'high',digest:comparison.digest}
 assert.equal((await h.send(f.path,undefined,f.alex.cookie)).status,403)
 assert.equal((await h.send(f.path,undefined,f.foreign.cookie)).status,404)
 assert.equal((await h.send(f.path)).status,401)
 assert.equal((await h.state()).version,before.version)
 // Pay-group weeks beginning Sunday cross both ends of the selected calendar week.
 await h.cmd('paygroup.save',{name:'Sunday service',cadence:'weekly',from:days(f.week,-1),payDays:3,workweekStart:0,staffIds:[f.alex.id,f.ben.id]})
 comparison=await f.read()
 g=comparison.low.scheduledOvertime.groups.find(g=>g.staffId===f.alex.id)
 assert.equal(g.week,days(f.week,-1));assert.equal(g.payGroup.workweekStart,0)
 assert.notEqual(comparison.digest,request.digest)
 await h.cmd('fairness.prepare',request,f.manager.cookie,409)
 assert.equal((await h.state()).rosters.filter(r=>r.status==='draft').length,0)
 // A Sunday slot reaches an unpublished next calendar week: unknown, never zero.
 await publish([...shifts,{staffId:f.alex.id,site:'Ocean Beach',start:local(days(f.week,6),'08:00'),end:local(days(f.week,6),'09:00'),breakMinutes:0}])
 comparison=await f.read()
 g=comparison.low.scheduledOvertime.groups.find(g=>g.staffId===f.alex.id&&g.week===days(f.week,6))
 assert.equal(g.knownMinutes,60);assert.deepEqual(g.missingWeeks,[days(f.week,7)])
 assert.equal(g.overtimeMinutes,null);assert.equal(comparison.low.scheduledOvertime.premiumCents,null)
 assert.equal(comparison.explanation.weeklyScheduledOvertime.premiumDifferenceCents,null)
 // Another cafe's source is not disclosed as a complete single-cafe calculation.
 await publish([...shifts,{staffId:f.alex.id,site:'Mission',start:local(days(f.week,5),'08:00'),end:local(days(f.week,5),'09:00'),breakMinutes:0}])
 comparison=await f.read()
 g=comparison.low.scheduledOvertime.groups.find(g=>g.staffId===f.alex.id)
 assert.equal(g.minutes,null);assert.ok(g.reasons.some(r=>r.includes('Cross-cafe')))
 assert.ok(!g.inputs.some(p=>p.date===days(f.week,5)))
 // Missing rates propagate to the premium rather than becoming a zero wage.
 const profile=(await h.state()).workforce.find(p=>p.staffId===f.alex.id)
 await h.cmd('workforce.save',{id:profile.id,revision:profile.revision,staffId:f.alex.id,jobs:[],skills:[],certifications:[],sites:['Ocean Beach','Mission'],preferences:[],minHours:0,maxHours:60,classification:'hourly',rates:[]})
 const alex=(await h.state()).staff.find(p=>p.id===f.alex.id)
 await h.cmd('staff.save',{...pin(alex),name:alex.name,email:alex.email,payrollId:alex.payrollId,role:alex.role,active:true,site:'Ocean Beach',position:'Counter',hourlyRate:'',employmentType:'part-time'})
 await publish(shifts)
 comparison=await f.read()
 g=comparison.low.scheduledOvertime.groups.find(g=>g.staffId===f.alex.id)
 assert.equal(g.overtimeMinutes,240);assert.equal(g.premiumCents,null)
 assert.ok(g.reasons.some(r=>r.includes('base rate is missing')))
}

async function overtimeFixture(h,f) {
 for(const p of [f.alex,f.ben])await h.cmd('pattern.save',{from:f.week,blocks:f.full,preferredHours:44,maxHours:60},p.cookie)
 const shifts=[{staffId:f.alex.id,site:'Ocean Beach',start:local(f.week,'08:00'),end:local(f.week,'16:00'),breakMinutes:0},
  {staffId:f.alex.id,site:'Ocean Beach',start:local(f.week,'18:00'),end:local(f.week,'22:00'),breakMinutes:0},
  ...[1,2,3,4].map(d=>({staffId:f.alex.id,site:'Ocean Beach',start:local(days(f.week,d),'08:00'),end:local(days(f.week,d),'16:00'),breakMinutes:0}))]
 const publish=async rows=>{const draft=await h.cmd('roster.prepare',{week:f.week,shifts:rows});assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft))}
 await publish(shifts)
 // Effective scheduled rates vary within the workweek; the weighted base matters.
 await h.cmd('workforce.save',{staffId:f.alex.id,jobs:[],skills:[],certifications:[],sites:['Ocean Beach','Mission'],preferences:[],minHours:0,maxHours:60,classification:'hourly',rates:[{job:'',from:f.first,cents:2000},{job:'',from:days(f.week,2),cents:2400}]})
 return {shifts,publish}
}

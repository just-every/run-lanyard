import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {generationFixture} from './demand-generation-journey.mjs'
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
 const browser=await chromium.launch({headless:true,...(process.env.LANYARD_CHROMIUM?{executablePath:process.env.LANYARD_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
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
   for(const detail of await page.locator('#fairness details').all())await detail.evaluate(x=>x.open=true)
   assert.equal(await page.locator('#tradeoff-explanation').isVisible(),true)
   const unknown=await page.locator('#tradeoff-explanation').innerText()
   assert.ok(unknown.includes('unknown minutes / unknown premium'),unknown)
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

export async function overtimeFixture(h,f) {
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

const generationNow='2026-11-01T12:00:00Z'
const projectionState=s=>Object.fromEntries(['sales','forecasts','demandforecasts','timesheets','clocks','claims','batches'].map(k=>[k,s[k]]))
async function generatedComparisonFixture(h){
 const f=await generationFixture(h),{week,site}=f.input
 const input={week,site,dates:[week],aMinShiftMinutes:60,aMaxShiftMinutes:240,aBreakAfterMinutes:240,aBreakMinutes:0,bMinShiftMinutes:180,bMaxShiftMinutes:180,bBreakAfterMinutes:120,bBreakMinutes:30}
 const path=(p=input)=>'/api/lanyard/demand/compare?'+new URLSearchParams({...p,dates:p.dates.join(',')})
 const read=async(p=input,cookie=f.manager.cookie)=>{const r=await h.send(path(p),undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
 return {...f,input,path,read,week,site}
}
function reconcileGenerated(c,f,withHoliday=false){
 assert.equal(c.a.feasible,true,JSON.stringify(c.a.infeasible));assert.equal(c.b.feasible,true,JSON.stringify(c.b.infeasible))
 assert.deepEqual(c.a.versions,c.b.versions);assert.deepEqual(c.a.budget.source,c.b.budget.source)
 assert.equal(c.a.budget.limitCents,30000);assert.equal(c.b.budget.limitCents,30000)
 assert.equal(c.a.generated.length,1);assert.equal(c.b.generated.length,2)
 assert.equal(new Set(c.b.generated.map(x=>x.staffId)).size,2)
 assert.deepEqual(c.a.generated.map(x=>[x.start,x.end,x.breakMinutes]),[[local(f.week,'08:00'),local(f.week,'11:00'),0]])
 assert.deepEqual(c.b.generated.map(x=>[x.start,x.end,x.breakMinutes]),Array.from({length:2},()=>[local(f.week,'08:00'),local(f.week,'11:00'),30]))
 for(const v of [c.a,c.b]){
  for(const i of v.service.intervals){
   const start=Date.parse(local(i.date,`${String(i.hour).padStart(2,'0')}:00`)),end=start+3600000
   const minutes=v.generated.reduce((n,x)=>{const from=Date.parse(x.start),until=Date.parse(x.end),elapsed=(until-from)/60000;return n+Math.max(0,Math.min(until,end)-Math.max(from,start))/60000*(elapsed-x.breakMinutes)/elapsed},0)
   assert.equal(i.requiredMinutes,i.hour>=8&&i.hour<11?60:0)
   assert.equal(i.scheduledMinutes,minutes);assert.equal(i.uncoveredMinutes,Math.max(0,i.requiredMinutes-minutes));assert.equal(i.excessMinutes,Math.max(0,minutes-i.requiredMinutes))
  }
  const paid=v.generated.reduce((n,x)=>n+(Date.parse(x.end)-Date.parse(x.start))/60000-x.breakMinutes,0)
  assert.equal(v.cost.costCents,paid*(withHoliday?25:20)*100/60)
  assert.equal(v.cost.inputs.reduce((n,x)=>n+x.basis.costCents,0),paid*2000/60)
  assert.equal(v.cost.inputs.reduce((n,x)=>n+x.holiday.costCents,0),withHoliday?paid*500/60:0)
 }
 assert.deepEqual([c.a.service.requiredMinutes,c.a.service.scheduledMinutes,c.a.service.uncoveredMinutes,c.a.service.excessMinutes],[180,180,0,0])
 assert.deepEqual([c.b.service.requiredMinutes,c.b.service.scheduledMinutes,c.b.service.uncoveredMinutes,c.b.service.excessMinutes],[180,300,0,120])
 assert.deepEqual([c.changes.removed.length,c.changes.added.length,c.changes.unchanged.length],[1,2,0])
 assert.deepEqual(c.changes.removed,c.a.generated);assert.deepEqual(c.changes.added,c.b.generated)
 assert.equal(c.difference.costCents,withHoliday?5000:4000);assert.equal(c.difference.requiredMinutes,0);assert.equal(c.difference.scheduledMinutes,120);assert.equal(c.difference.uncoveredMinutes,0);assert.equal(c.difference.excessMinutes,120)
}
async function confirmGeneratedFairness(h,f){
 await h.cmd('fairness.policy.save',{site:f.site,tags:['closing'],closingTime:'10:00',openingTime:'07:00',closeOpenHours:12})
 await h.cmd('fairness.cohort.save',{site:f.site,position:'Counter',from:f.week,staffIds:f.people.map(p=>p.id)})
 const blocks=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`${d} available 00:00-24:00`).join('\n')+'\nMon preferred 08:00-11:00\nMon prefer-not 10:00-12:00'
 for(const p of f.people)await h.cmd('pattern.save',{from:days(f.week,-1),blocks,preferredHours:3,maxHours:40},p.cookie)
}
export async function generatedTradeoffApi(){
 const h=await harness({now:generationNow})
 try{
  const f=await generatedComparisonFixture(h)
  const unknown=await f.read();reconcileGenerated(unknown,f)
  for(const v of [unknown.a,unknown.b]){assert.equal(v.measures.totals.spread,null);assert.equal(v.measures.totals.meanGapMinutes,null);assert.equal(v.measures.totals.violations,null);assert.ok(v.measures.cohorts.unknownMembership.length)}
  await confirmGeneratedFairness(h,f)
  await h.cmd('holiday.save',{site:f.site,date:f.week,name:'Reviewed service holiday',enabled:true})
  await h.cmd('holidayrule.save',{site:f.site,from:'2026-01-01',mode:'added',value:500,nonWorkMinutes:0,beforeAfter:false,code:'HOL'})
  // Nonempty worked-time and once-only payroll facts must remain untouched.
  const person=f.people[0],workedDate=days(f.week,-7)
  await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:local(workedDate,'08:00')},person.cookie)
  const worked=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:local(workedDate,'10:00'),breakMinutes:0},person.cookie)
  const approved=await h.cmd('time.approve',pin(worked.timesheet))
  const batch=await h.cmd('payroll.prepare',{ids:[approved.id]});await h.cmd('payroll.export',pin(batch))
  const before=await h.state(),c=await f.read();reconcileGenerated(c,f,true)
  assert.equal(before.rosters.length,0,'The comparison works in an empty unpublished week')
  assert.deepEqual([c.a.measures.totals.spread,c.b.measures.totals.spread],[1,0])
  assert.deepEqual([c.a.measures.totals.meanGapMinutes,c.b.measures.totals.meanGapMinutes],[90,30])
  assert.deepEqual([c.a.measures.totals.maxGapMinutes,c.b.measures.totals.maxGapMinutes],[180,30])
  assert.deepEqual([c.a.measures.totals.violations,c.b.measures.totals.violations],[1,2])
  assert.deepEqual(c.difference.fairness,{spread:-1,meanGapMinutes:-60,maxGapMinutes:-150,violations:1})
  for(const v of [c.a,c.b]){
   assert.equal(v.measures.undesirable.inputs.length,v.generated.length)
   assert.deepEqual(v.measures.rows.filter(r=>r.membership==='confirmed').map(r=>r.staffId).sort(),f.people.map(p=>p.id).sort())
   for(const r of v.measures.rows.filter(r=>r.membership==='confirmed')){assert.equal(r.preferredMinutes,180);assert.equal(r.gapMinutes,Math.abs(r.scheduledMinutes-180));assert.equal(r.patterns.length,7);assert.ok(r.patterns.every(x=>x.id&&x.revision))}
   assert.ok(v.measures.equity.groups.every(g=>g.totalRequestedMinutes===null),'Preferred hours never become extra-hours requests')
  }
  const boundary=await f.read({...f.input,bMinShiftMinutes:240,bMaxShiftMinutes:240})
  assert.equal(boundary.b.feasible,true);assert.equal(boundary.b.generated.length,2)
  assert.ok(boundary.b.generated.every(x=>x.end===local(f.week,'12:00')&&x.breakMinutes===30))
  assert.equal(boundary.b.service.scheduledMinutes,420);assert.equal(boundary.b.service.excessMinutes,240);assert.equal(boundary.b.cost.costCents,17500)
  assert.ok(boundary.changes.added.every(x=>x.end===local(f.week,'12:00')),'Changed shift-length review explains changed generated boundaries')
  assert.deepEqual(await h.state(),before,'Comparison writes no data')
  await h.cmd('demand.generate.prepare',{...Object.fromEntries(['week','site','dates','minShiftMinutes','maxShiftMinutes','breakAfterMinutes','breakMinutes'].map(k=>[k,c.b[k]])),minShiftMinutes:240,maxShiftMinutes:240,digest:c.b.digest},f.manager.cookie,409)
  assert.deepEqual(await h.state(),before,'Changed configuration cannot reuse the chosen review')
  const selected=await f.prepare(c.b,f.manager.cookie)
  const drafted=await h.state();assert.equal(drafted.rosters.find(r=>r.id===selected.id).status,'draft');assert.equal(drafted.shifts.filter(x=>x.status==='published').length,0)
  assert.deepEqual(projectionState(drafted),projectionState(before))
  const shape=x=>[x.staffId,x.start,x.end,x.breakMinutes,x.site,x.job]
  assert.deepEqual(selected.shifts.map(shape).sort(),c.b.generated.map(shape).sort(),'Selection prepares B, not A')
  await h.restart();await h.cmd('roster.publish',pin(selected),f.manager.cookie)
  assert.deepEqual((await h.state()).shifts.filter(x=>x.status==='published').map(shape).sort(),c.b.generated.map(shape).sort())
  const persisted=await h.state();assert.deepEqual(projectionState(persisted),projectionState(before))
  await h.cmd('roster.publish',pin(selected),f.manager.cookie,409)
  assert.deepEqual(await h.state(),persisted,'Exact-revision publication cannot be replayed')
  // Each source edit invalidates both candidate digests, without draft writes.
  const staleAfter=async edit=>{const review=await f.read();await edit();const saved=await h.state();await f.prepare(review.a,f.manager.cookie,409);await f.prepare(review.b,f.manager.cookie,409);assert.deepEqual(await h.state(),saved)}
  await staleAfter(()=>h.cmd('forecast.save',{week:f.week,site:f.site,days:[1200,0,0,0,0,0,0],budgetPercent:30}))
  await staleAfter(async()=>{const v=(await h.state()).demandforecasts.filter(x=>x.date===f.week).sort((a,b)=>b.version-a.version)[0];await h.cmd('demand.override',{...pin(v),hour:8,dollars:'110',reason:'Reviewed additional service demand'})})
  await staleAfter(async()=>{const p=(await h.state()).staff.find(x=>x.id===person.id);await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:f.site,position:'Counter',hourlyRate:'21.00'})})
  await staleAfter(async()=>{const p=(await h.state()).policies[0];await h.cmd('policy.save',{...pin(p),site:f.site,from:p.from,preset:'federal',minimumRestMinutes:600,reviewReason:'Reviewed required rest'})})
  // Supported generator refusals are explained independently for both configurations.
  await h.cmd('forecast.save',{week:f.week,site:f.site,days:[1000,0,0,0,0,0,0],budgetPercent:1})
  const refuse=async pattern=>{const comparison=await f.read();for(const v of [comparison.a,comparison.b]){assert.equal(v.feasible,false);assert.match(JSON.stringify([...v.infeasible,...v.rejections]),pattern);const state=await h.state();await f.prepare(v,f.manager.cookie,409);assert.deepEqual(await h.state(),state)}}
  await refuse(/budget/i)
  await h.cmd('forecast.save',{week:f.week,site:f.site,days:[1000,0,0,0,0,0,0],budgetPercent:30})
  const policy=(await h.state()).policies[0];await h.cmd('policy.save',{...pin(policy),site:f.site,from:policy.from,preset:'CA',reviewReason:'Review required statutory break placement'})
  await refuse(/unsupported break placement/)
  // Read and selection refuse every excluded reader without changing records.
  const key=await h.cmd('agent.create',{label:'No generated comparison authority'})
  for(const [cookie,status] of [[person.cookie,403],[f.foreign.cookie,404],['',401]])assert.equal((await h.send(f.path(),undefined,cookie)).status,status)
  for(const credential of [key,await h.cmd('agent.create',{label:'Scoped fixed-slot reader',scopes:['comparison.read'],cafes:[f.site],comparisonConsent:true})])assert.equal((await h.send(f.path(),undefined,'',{authorization:`Bearer ${credential.token}`})).status,401)
  assert.equal((await h.send('/api/lanyard/agent/command',{name:'demand.generate.prepare',input:{...c.a,digest:c.a.digest}},'',{authorization:`Bearer ${key.token}`})).status,403)
  const level=await h.cmd('access.level.save',{name:'Reviewed draft scope',site:f.site,permissions:['draft.view','draft.edit','schedule.publish']})
  const grant=await h.cmd('access.grant',{levelId:level.id,staffId:f.manager.id,site:f.site})
  const state=await h.state();assert.equal((await h.send(f.path(),undefined,f.manager.cookie)).status,403)
  await f.prepare(c.a,f.manager.cookie,403);await f.prepare(c.a,person.cookie,403);await f.prepare(c.a,f.foreign.cookie,404);assert.deepEqual(await h.state(),state)
  await h.cmd('access.revoke',pin(grant));assert.equal((await h.send(f.path(),undefined,f.manager.cookie)).status,403)
  console.log('PROBE TRADEOFF-001 generated comparison: empty week -> A 180 paid minutes, B 300, break coverage 180 required and 120 excess, holiday USD 75 and 125; B separately prepared and published after restart; stale, unsupported and authority refusals preserve source data')
 }finally{await h.close()}
}

export async function generatedTradeoffBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.LANYARD_CHROMIUM?{executablePath:process.env.LANYARD_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now:generationNow}),context=await browser.newContext({viewport:{width,height:1100}})
  try{
   const f=await generatedComparisonFixture(h);await confirmGeneratedFairness(h,f)
   const c=await f.read(),page=await context.newPage(),[name,...value]=f.manager.cookie.split('=')
   await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   await page.goto(`${h.origin}/app/schedule?week=${f.week}&site=Ocean%20Beach`,{waitUntil:'networkidle'})
   const generation=page.locator('#demand-generation')
   for(const detail of await generation.locator('details').all())await detail.evaluate(x=>x.open=true)
   await generation.getByRole('button',{name:'Compare generator configurations',exact:true}).click();await page.waitForLoadState('networkidle')
   const panel=page.locator('#demand-comparison')
   const shot=async key=>{await (key==='comparison'?panel:page.locator('main')).scrollIntoViewIfNeeded();if(process.env.TRADEOFF_SCREENS){await mkdir(process.env.TRADEOFF_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.TRADEOFF_SCREENS,`generated-${key}-${width}.png`)})}}
   if(width===1440){assert.equal(await panel.isVisible(),true);const text=await panel.innerText();for(const v of ['$60.00','$100.00','180','300','120','Candidate A','Candidate B'])assert.ok(text.includes(v),v);const changes=panel.locator('details').filter({has:page.locator('summary',{hasText:'Inspect changed boundaries and assignments'})});await changes.locator('summary').click();assert.ok((await changes.innerText()).includes('Only A'));assert.ok((await changes.innerText()).includes('Only B'));for(const person of f.people)assert.ok((await changes.innerText()).includes(person.name));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   await shot('comparison')
   const [download]=await Promise.all([page.waitForEvent('download'),panel.getByRole('link',{name:'Download generated comparison (JSON)'}).click()])
   const exported=JSON.parse(await readFile(await download.path(),'utf8'))
   if(width===1440){reconcileGenerated(exported,f);assert.deepEqual(exported.changes,c.changes);assert.equal(exported.b.digest,c.b.digest)}
   await panel.getByRole('button',{name:'Prepare candidate B',exact:true}).click();await page.waitForLoadState('networkidle')
   const prepared=await h.state(),draft=prepared.rosters.find(r=>r.week===f.week&&r.status==='draft')
   if(width===1440){assert.ok(draft);assert.equal(prepared.shifts.filter(x=>x.status==='published').length,0);assert.equal(prepared.shifts.filter(x=>x.status==='draft').length,2)}
   const review=page.getByRole('link',{name:/Review draft revision/});if(await review.count())await review.click()
   await shot('draft')
   await page.getByRole('button',{name:'Publish this revision',exact:true}).click();await page.waitForLoadState('networkidle')
   await h.restart();await page.reload({waitUntil:'networkidle'});await shot('published')
   if(width===1440)assert.deepEqual((await h.state()).shifts.filter(x=>x.status==='published').map(x=>x.breakMinutes),[30,30])
   await h.cmd('forecast.save',{week:f.week,site:f.site,days:[1000,0,0,0,0,0,0],budgetPercent:1})
   await page.goto(`${h.origin}/app/schedule?`+new URLSearchParams({...f.input,dates:f.week,demandCompare:'1'}),{waitUntil:'networkidle'})
   if(width===1440){assert.match(await panel.innerText(),/Generation refused/);assert.equal(await panel.getByRole('button',{name:'Prepare candidate B',exact:true}).count(),0)}
   await shot('refused')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

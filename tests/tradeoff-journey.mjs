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
 assert.equal(e.overtimeMinutes,null,'Statutory overtime remains unknown; scheduled exposure is separate')
 assertScheduled(comparison.scheduledOvertime)
 for(const code of ['pos-demand','service-requirements','overtime-policy','cost-scope']){
  const unknown=e.uncertainty.find(x=>x.code===code)
  assert.ok(unknown,`${code} remains an explicit uncertainty`)
  assert.ok(typeof unknown.reason==='string'&&unknown.reason.trim().length>0)
 }
 if(low.cost.costCents===null||high.cost.costCents===null)assert.ok(e.uncertainty.some(x=>x.code==='missing-rates'))
 return e
}

function assertScheduled(overtime) {
 assert.ok(overtime,'Both alternatives expose scheduled workweek inputs')
 const known=values=>values.includes(null)?null:values.reduce((n,x)=>n+x,0)
 for(const alternative of [overtime.low,overtime.high]) {
  assert.ok(alternative.definition.includes('2400'))
  for(const group of alternative.groups) {
   assert.equal(group.scheduledMinutes,group.inputs.reduce((n,x)=>n+x.minutes,0))
   assert.equal(group.observedOvertimeMinutes,Math.max(0,group.scheduledMinutes-2400))
   assert.equal(group.inputs.reduce((n,x)=>n+x.overtimeMinutes,0),group.observedOvertimeMinutes)
   for(const input of group.inputs){
    assert.ok(input.shiftId&&input.revision&&input.rosterId&&input.rosterRevision)
    assert.ok(input.date>=group.week&&input.date<=group.end)
    assert.equal(input.premiumCents,input.overtimeMinutes===0?0:input.cents===null?null:Math.round(input.overtimeMinutes/60*input.cents/2))
   }
   assert.equal(group.overtimeMinutes,group.missingWeeks.length?null:group.observedOvertimeMinutes)
   assert.equal(group.premiumCents,group.missingWeeks.length?null:known(group.inputs.map(x=>x.premiumCents)))
  }
  assert.equal(alternative.overtimeMinutes,known(alternative.groups.map(x=>x.overtimeMinutes)))
  assert.equal(alternative.premiumCents,known(alternative.groups.map(x=>x.premiumCents)))
 }
 for(const field of ['overtimeMinutes','premiumCents'])assert.equal(overtime.difference[field],overtime.low[field]===null||overtime.high[field]===null?null:overtime.high[field]-overtime.low[field])
}

async function overtimeFixture(h) {
 const f=await optimizationFixture(h)
 for(const [person,hours] of [[f.alex,8],[f.ben,4]])await h.cmd('pattern.save',{from:f.first,blocks:f.full+'\nMon preferred 08:00-16:00'+(person===f.alex?'\nMon prefer-not 18:00-22:00':''),preferredHours:hours,maxHours:60},person.cookie)
 const group=await h.cmd('paygroup.save',{name:'Sunday workweek',cadence:'weekly',from:f.first,payDays:3,workweekStart:0,staffIds:[f.alex.id]})
 const fields=x=>Object.fromEntries(['staffId','start','end','breakMinutes','label','site','job'].filter(k=>x[k]!==undefined).map(k=>[k,x[k]]))
 let state=await h.state()
 const previousWeek=days(f.week,-7),previous=state.shifts.filter(x=>x.status==='published'&&state.rosters.find(r=>r.id===x.rosterId)?.week===previousWeek).map(fields)
 const outside={staffId:f.alex.id,site:'Mission',start:local(days(f.week,-1),'08:00'),end:local(days(f.week,-1),'16:00'),breakMinutes:0}
 const publish=async(week,shifts)=>{const draft=await h.cmd('roster.prepare',{week,shifts});assert.deepEqual(draft.conflicts,[]);return h.cmd('roster.publish',pin(draft))}
 await publish(previousWeek,[...previous,outside])
 state=await h.state()
 const selected=state.shifts.filter(x=>x.status==='published'&&state.rosters.find(r=>r.id===x.rosterId)?.week===f.week).map(fields)
 const additions=[1,2,3,4].map(n=>({staffId:f.alex.id,site:'Ocean Beach',start:local(days(f.week,n),'08:00'),end:local(days(f.week,n),'17:00'),breakMinutes:0}))
 await publish(f.week,[...selected,...additions])
 return {...f,group,publish,previousWeek,previous,outside,selected,additions}
}

async function overtimeApi() {
 const h=await harness()
 try {
  const f=await overtimeFixture(h),before=await h.state(),c=await f.read(),o=c.scheduledOvertime
  assertScheduled(o)
  assert.equal((await h.state()).version,before.version,'Overtime comparison is read-only')
  const alex=o.low.groups.find(x=>x.staffId===f.alex.id)
  assert.equal(alex.workweekStart,0);assert.deepEqual(alex.paygroup,pin(f.group))
  assert.equal(alex.week,days(f.week,-1));assert.equal(alex.scheduledMinutes,56*60)
  assert.equal(alex.overtimeMinutes,16*60);assert.equal(alex.premiumCents,16000)
  assert.ok(alex.inputs.some(x=>x.site==='Mission'&&x.assignment==='published'&&x.minutes===480),'The previous roster week and other cafe remain in the estimate')
  assert.equal(o.low.overtimeMinutes,960)
  assert.ok(o.high.overtimeMinutes<o.low.overtimeMinutes,'Redistribution changes overtime exposure')
  assert.ok(o.high.premiumCents<o.low.premiumCents)
  assert.equal((await h.send(f.path,undefined,f.alex.cookie)).status,403)
  assert.equal((await h.send(f.path,undefined,f.foreign.cookie)).status,404)
  assert.equal((await h.send(f.path)).status,401)
  const key=await h.cmd('agent.create',{label:'TRADEOFF-001 boundary'})
  assert.equal((await h.send(f.path,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  assert.equal((await h.send(f.path.replace('/api/lanyard/','/api/lanyard/agent/'),undefined,'',{authorization:`Bearer ${key.token}`})).status,404)
  // An adjacent source changes without changing the selected source roster.
  await f.publish(f.previousWeek,[...f.previous,{...f.outside,end:local(days(f.week,-1),'15:00')}])
  await h.cmd('fairness.prepare',{week:f.week,site:'Ocean Beach',weeks:8,priority:'high',digest:c.digest},f.manager.cookie,409)
  const changed=await f.read();assert.equal(changed.source.id,c.source.id)
  assert.equal(changed.scheduledOvertime.low.overtimeMinutes,900)
  // Missing effective rates are never replaced by zero, even when published
  // unchanged work has an older retained rate snapshot.
  const person=(await h.state()).staff.find(x=>x.id===f.alex.id)
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:true,site:person.site,position:person.position,hourlyRate:'',employmentType:'part-time'})
  const unknown=await f.read();assertScheduled(unknown.scheduledOvertime)
  assert.equal(unknown.scheduledOvertime.low.premiumCents,null)
  const unknownAlex=unknown.scheduledOvertime.low.groups.find(x=>x.staffId===f.alex.id)
  assert.ok(unknownAlex.inputs.filter(x=>x.assignment==='candidate').every(x=>x.cents===null),'Compared assignments use the current effective rate')
  assert.ok(unknownAlex.inputs.filter(x=>x.site==='Mission').every(x=>x.cents===2000),'Unchanged published work keeps its retained rate after edits')
  assert.ok(unknown.scheduledOvertime.low.groups.some(x=>x.reasons.some(r=>r.includes('no usable hourly rate'))))
 } finally {await h.close()}
 // Overnight payable minutes cross a Sunday workweek boundary, and a missing
 // adjacent published roster leaves the full-workweek result unknown.
 const overnight=await harness()
 try {
  const f=await overtimeFixture(overnight)
  const saturday=days(f.week,5),sunday=days(f.week,6)
  const extra={staffId:f.alex.id,site:'Ocean Beach',start:local(saturday,'23:00'),end:local(sunday,'02:00'),breakMinutes:30}
  await f.publish(f.week,[...f.selected,...f.additions,extra])
  let c=await f.read();assertScheduled(c.scheduledOvertime)
  const groups=c.scheduledOvertime.low.groups.filter(x=>x.staffId===f.alex.id)
  const later=groups.find(x=>x.week===sunday)
  assert.deepEqual(later.missingWeeks,[days(f.week,7)])
  assert.equal(later.overtimeMinutes,null);assert.equal(c.scheduledOvertime.low.overtimeMinutes,null)
  assert.ok(later.reasons.some(x=>x.includes('unpublished')))
  const earlier=groups.find(x=>x.week===days(f.week,-1))
  assert.equal(earlier.inputs.filter(x=>x.start===extra.start).reduce((n,x)=>n+x.minutes,0),50)
  assert.equal(later.inputs.filter(x=>x.start===extra.start).reduce((n,x)=>n+x.minutes,0),100)
  await f.publish(days(f.week,7),[{staffId:f.ben.id,site:'Ocean Beach',start:local(days(f.week,7),'08:00'),end:local(days(f.week,7),'09:00'),breakMinutes:0}])
  c=await f.read();assertScheduled(c.scheduledOvertime)
  assert.equal(c.scheduledOvertime.low.overtimeMinutes,1010)
  assert.equal(c.scheduledOvertime.low.premiumCents,16833,'Half-rate 50-minute segment rounds once to cents')
 } finally {await overnight.close()}
}

export async function tradeoffApi(h) {
 await overtimeApi()
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
   const f=await overtimeFixture(h),comparison=await f.read(),e=explain(comparison),page=await context.newPage()
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
   const text=await explanation.innerText(),usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'})
   assert.ok(text.includes(usd.format(e.costDifferenceCents/100)))
   const spread=e.fairness.find(x=>x.measure==='spread')
   for(const value of [spread.low,spread.high,spread.difference])assert.ok(text.includes(String(value)))
   for(const unknown of e.uncertainty)assert.ok(text.includes(unknown.reason))
   const overtime=comparison.scheduledOvertime
   assert.ok(text.includes('Scheduled overtime exposure'))
   for(const alternative of [overtime.low,overtime.high]){assert.ok(text.includes(String(alternative.overtimeMinutes)));assert.ok(text.includes(usd.format(alternative.premiumCents/100)))}
   assert.ok(text.includes(overtime.low.definition))
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
   explain(exported);assert.deepEqual(exported.explanation,e);assert.deepEqual(exported.scheduledOvertime,comparison.scheduledOvertime)
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
   // The same explanation must render an incomplete workweek honestly.
   await f.publish(f.week,[...f.selected,...f.additions,{staffId:f.alex.id,site:'Ocean Beach',start:local(days(f.week,5),'23:00'),end:local(days(f.week,6),'02:00'),breakMinutes:30}])
   const incomplete=await f.read()
   assert.equal(incomplete.scheduledOvertime.low.overtimeMinutes,null)
   await page.goto(schedule,{waitUntil:'networkidle'})
   for(const detail of await page.locator('#fairness details').all())await detail.evaluate(x=>x.open=true)
   const unknown=page.locator('#tradeoff-explanation')
   const unknownText=await unknown.innerText()
   assert.ok(unknownText.includes('unknown overtime minutes'))
   assert.ok(unknownText.includes('A required roster week is unpublished; scheduled workweek totals are incomplete'))
   await unknown.scrollIntoViewIfNeeded();await shot('tradeoff-unknown',unknown)
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

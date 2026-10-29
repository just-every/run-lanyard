import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {days,local,pin} from './workforce-journey.mjs'
const week='2026-11-02',site='Ocean Beach',now='2026-11-01T12:00:00Z'
const full=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`${d} available 00:00-24:00`).join('\n')
export async function generationFixture(h){
 const people=[];for(const n of ['Avery','Blair'])people.push(await h.person(n))
 const manager=await h.person('Marlowe','manager'),foreign=await h.person('Sydney','manager')
 for(const p of [...people,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':site,position:people.includes(p)?'Counter':'Manager',hourlyRate:'20.00'})
 const job=await h.cmd('job.save',{name:'Counter',skills:['service'],certifications:[]})
 for(const p of people){
  await h.cmd('workforce.save',{staffId:p.id,jobs:[job.id],skills:['service'],certifications:[],sites:[site],preferences:[],minHours:0,maxHours:40,classification:'hourly',rates:[{job:job.id,from:'2026-01-01',cents:2000}]})
  await h.cmd('pattern.save',{from:'2026-01-01',blocks:full,maxHours:40},p.cookie)
 }
 await h.cmd('policy.save',{site,from:'2026-01-01',preset:'federal',reviewReason:'Employer reviewed ordinary hourly service policy'})
 const csv='date,hour,site,sales\n'+[week,days(week,1)].flatMap(date=>[7,14].flatMap(n=>Array.from({length:24},(_,hour)=>`${days(date,-n)},${hour},${site},${hour>=8&&hour<11?100:0}`))).join('\n')
 const parsed=await h.cmd('sales.preview',{csv,site});await h.cmd('sales.import',{csv,site,fingerprint:parsed.fingerprint})
 await h.cmd('demandrule.save',{site,roles:'Counter|100|0',staleDays:60})
 for(const date of [week,days(week,1)]){const demand=await h.send(`/api/lanyard/demand?site=Ocean%20Beach&date=${date}`,undefined,h.owner);assert.equal(demand.status,200,demand.text);await h.cmd('demand.save',{site,date,digest:demand.value.live.digest})}
 await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:30})
 const input={week,site,dates:[week],minShiftMinutes:60,maxShiftMinutes:240,breakAfterMinutes:240,breakMinutes:0}
 const path=p=>'/api/lanyard/demand/generate?'+new URLSearchParams({...p,dates:p.dates.join(',')})
 const read=async(p=input,cookie=h.owner)=>{const r=await h.send(path(p),undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
 const prepare=(c,cookie=h.owner,status=200)=>h.cmd('demand.generate.prepare',{...Object.fromEntries([...Object.keys(input),'priority','weeks'].map(k=>[k,c[k]])),digest:c.digest},cookie,status)
 return {people,manager,foreign,job,input,path,read,prepare}
}
const safetyState=s=>Object.fromEntries(['shifts','rosters','openshifts','timesheets','clocks','batches','claims','sales','demandforecasts'].map(k=>[k,s[k]]))
export async function demandGenerationApi(){
 const h=await harness({now})
 try{
  const f=await generationFixture(h),before=await h.state(),c=await f.read()
  assert.equal(c.feasible,true,JSON.stringify(c.infeasible));assert.equal(c.generated.length,1)
  assert.deepEqual(c.generated.map(x=>[x.start,x.end,x.breakMinutes]),[[local(week,'08:00'),local(week,'11:00'),0]])
  assert.equal(c.service.requiredMinutes,180);assert.equal(c.service.scheduledMinutes,180);assert.equal(c.service.uncoveredMinutes,0);assert.equal(c.service.excessMinutes,0);assert.equal(c.cost.costCents,6000)
  assert.deepEqual(safetyState(await h.state()),safetyState(before),'preview changes no source or draft')
  // Worked time and feedback cannot change a feasible generated assignment or its review.
  await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:local(days(week,-7),'08:00')},f.people[0].cookie)
  const clock=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:local(days(week,-7),'10:00'),breakMinutes:0},f.people[0].cookie)
  await h.cmd('feedback.submit',{timesheetId:clock.timesheet.id,rating:1,flags:['safety'],comment:'Needs review'},f.people[0].cookie)
  assert.deepEqual(await f.read(),c)
  // Independent interval overlap, break and USD arithmetic over the returned assignments.
  const breaks=await f.read({...f.input,minShiftMinutes:180,maxShiftMinutes:180,breakAfterMinutes:120,breakMinutes:30})
  assert.equal(breaks.feasible,true);assert.equal(breaks.generated.length,2)
  for(const interval of breaks.service.intervals.filter(x=>x.requiredMinutes)){
   const from=Date.parse(local(interval.date,`${String(interval.hour).padStart(2,'0')}:00`)),until=from+3600000
   const expected=breaks.generated.reduce((n,x)=>{const start=Date.parse(x.start),end=Date.parse(x.end),elapsed=(end-start)/60000,paid=elapsed-x.breakMinutes;return n+Math.max(0,Math.min(end,until)-Math.max(start,from))/60000*paid/elapsed},0)
   assert.equal(interval.requiredMinutes,60);assert.equal(interval.scheduledMinutes,expected);assert.equal(interval.uncoveredMinutes,0);assert.equal(interval.excessMinutes,expected-60)
  }
  assert.deepEqual([breaks.service.scheduledMinutes,breaks.service.excessMinutes,breaks.cost.costCents],[300,120,10000])
  assert.equal(breaks.cost.costCents,breaks.generated.reduce((n,x)=>n+Math.round(((Date.parse(x.end)-Date.parse(x.start))/60000-x.breakMinutes)*2000/60),0))
  // Saving identical generated rows through the ordinary editor cannot discard stale budget review.
  const generated=await f.prepare(await f.read(),f.manager.cookie)
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:1})
  let unchanged=safetyState(await h.state())
  await h.cmd('roster.publish',pin(generated),f.manager.cookie,409)
  assert.deepEqual(safetyState(await h.state()),unchanged)
  const edited=await h.cmd('roster.prepare',{week,shifts:c.generated},f.manager.cookie)
  await h.restart()
  unchanged=safetyState(await h.state())
  await h.cmd('roster.publish',pin(edited),f.manager.cookie,409)
  assert.deepEqual(safetyState(await h.state()),unchanged,'ordinary editor cannot publish the $60 generated schedule against the changed $10 budget')
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:30})
  const refuse=async(candidate,pattern)=>{assert.equal(candidate.feasible,false);assert.match(JSON.stringify([...candidate.infeasible,...candidate.rejections]),pattern);const before=safetyState(await h.state());await f.prepare(candidate,h.owner,409);assert.deepEqual(safetyState(await h.state()),before)}
  await refuse(await f.read({...f.input,dates:[days(week,2)]}),/complete saved hourly forecast/)
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:1})
  await refuse(await f.read(),/budget/i)
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:30})
  const job=await h.cmd('job.save',{...pin(f.job),name:'Counter',skills:['licensed'],certifications:[]})
  await refuse(await f.read(),/Missing job skill/)
  await h.cmd('job.save',{...pin(job),name:'Counter',skills:['service'],certifications:[]})
  for(const p of f.people)await h.cmd('pattern.save',{from:days(week,-3),blocks:'Mon unavailable 00:00-24:00',maxHours:40},p.cookie)
  await refuse(await f.read(),/Marked unavailable/)
  for(const p of f.people)await h.cmd('pattern.save',{from:days(week,-2),blocks:full,maxHours:0},p.cookie)
  await refuse(await f.read(),/Over maximum weekly hours/)
  for(const p of f.people)await h.cmd('pattern.save',{from:days(week,-1),blocks:full,maxHours:40},p.cookie)
  // Review cannot survive a forecast, budget, eligibility or policy edit.
  let reviewed=await f.read()
  await h.cmd('forecast.save',{week,site,days:[1200,0,0,0,0,0,0],budgetPercent:30})
  await f.prepare(reviewed,h.owner,409)
  for(const [cookie,status] of [[f.people[0].cookie,403],[f.foreign.cookie,404],['',401]])assert.equal((await h.send(f.path(f.input),undefined,cookie)).status,status)
  const key=await h.cmd('agent.create',{label:'Preparation without generation authority'})
  assert.equal((await h.send(f.path(f.input),undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  assert.equal((await h.send('/api/lanyard/agent/command',{name:'demand.generate.prepare',input:{...f.input,digest:(await f.read()).digest}},'',{authorization:`Bearer ${key.token}`})).status,403)
  await h.cmd('demand.generate.prepare',{...f.input,digest:(await f.read()).digest},f.people[0].cookie,403)
  await h.cmd('demand.generate.prepare',{...f.input,digest:(await f.read()).digest},f.foreign.cookie,404)
  // Demand changes add a new service interval and resize generated shifts in an empty week.
  const version=(await h.state()).demandforecasts.filter(x=>x.date===week).sort((a,b)=>b.version-a.version)[0]
  reviewed=await f.read()
  await h.cmd('demand.override',{...pin(version),hour:11,dollars:'100',reason:'Reviewed additional service hour'})
  await f.prepare(reviewed,h.owner,409)
  const extended=await f.read();assert.equal(extended.feasible,true,JSON.stringify([extended.infeasible,extended.rejections]));assert.equal(extended.generated.length,1);assert.equal(extended.generated[0].end,local(week,'12:00'));assert.equal(extended.service.requiredMinutes,240)
  let draft=await f.prepare(extended,f.manager.cookie)
  assert.equal((await h.state()).rosters.find(x=>x.id===draft.id).status,'draft')
  const longer=(await h.state()).demandforecasts.filter(x=>x.date===week).sort((a,b)=>b.version-a.version)[0]
  await h.cmd('demand.override',{...pin(longer),hour:8,dollars:'200',reason:'Reviewed additional counter capacity'})
  await h.cmd('roster.publish',pin(draft),f.manager.cookie,409)
  const expanded=await f.read();assert.equal(expanded.generated.length,2);assert.equal(expanded.service.requiredMinutes,300);assert.equal(expanded.service.uncoveredMinutes,0)
  draft=await f.prepare(expanded,f.manager.cookie)
  const policy=(await h.state()).policies[0]
  await h.cmd('policy.save',{...pin(policy),site,from:'2026-01-01',preset:'federal',minimumRestMinutes:600,reviewReason:'Reviewed required rest'})
  await h.cmd('roster.publish',pin(draft),f.manager.cookie,409)
  draft=await f.prepare(await f.read(),f.manager.cookie)
  // Eligibility changes after preparation also require a new preview, without writes.
  const person=(await h.state()).staff.find(x=>x.id===f.people[0].id)
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site,position:'Counter',hourlyRate:'21.00'})
  const stale=safetyState(await h.state());await h.cmd('roster.publish',pin(draft),f.manager.cookie,409);assert.deepEqual(safetyState(await h.state()),stale)
  draft=await f.prepare(await f.read(),f.manager.cookie)
  draft=await h.cmd('roster.prepare',{week,shifts:draft.shifts.map(({staffId,start,end,breakMinutes,label,site,job})=>({staffId,start,end,breakMinutes,label,site,job}))},f.manager.cookie)
  await h.restart();await h.cmd('roster.publish',pin(draft),f.manager.cookie)
  const published=(await h.state()).shifts.filter(x=>x.status==='published');assert.equal(published.length,2);assert.ok(published.some(x=>x.end===local(week,'12:00')))
  // Keep foreign and unselected published rows, private draft rows and open positions.
  const next=days(week,1),unselected=days(week,3)
  for(const p of [f.foreign,f.manager])await h.cmd('availability.save',{staffId:p.id,start:local(week,'00:00'),end:local(days(week,7),'00:00')})
  let retained=await h.cmd('roster.prepare',{week,shifts:[...published.map(({staffId,start,end,breakMinutes,site,job,label})=>({staffId,start,end,breakMinutes,site,job,label})),{staffId:f.foreign.id,site:'Mission',start:local(unselected,'09:00'),end:local(unselected,'10:00'),breakMinutes:0}]})
  await h.cmd('roster.publish',pin(retained))
  const open=await h.cmd('openshift.post',{site,position:'Counter',start:local(unselected,'13:00'),end:local(unselected,'14:00'),breakMinutes:0,approval:'manager',order:'all'})
  const template=await h.cmd('template.save',{name:'Retained open service',week})
  retained=await h.cmd('roster.prepare',{week,shifts:[{staffId:f.manager.id,site,start:local(unselected,'15:00'),end:local(unselected,'16:00'),breakMinutes:0}]})
  const withOpen=await h.cmd('template.apply',{id:template.id,week,days:[3]});assert.equal(withOpen.openShifts.length,1)
  const snapshot=await h.state(),fresh=await f.read({...f.input,dates:[next]}),selected=await f.prepare(fresh)
  const rows=(await h.state()).shifts.filter(x=>x.rosterId===selected.id&&x.status==='draft')
  assert.ok(rows.some(x=>x.staffId===f.foreign.id&&x.site==='Mission'));assert.ok(rows.some(x=>x.staffId===f.manager.id));assert.ok(rows.some(x=>x.start===local(week,'08:00')))
  assert.deepEqual(selected.openShifts.map(x=>[x.start,x.end,x.position,x.breakMinutes,x.status]),withOpen.openShifts.map(x=>[x.start,x.end,x.position,x.breakMinutes,x.status]))
  assert.deepEqual((await h.state()).openshifts.find(x=>x.id===open.id),snapshot.openshifts.find(x=>x.id===open.id))
  assert.deepEqual((await h.state()).demandforecasts,snapshot.demandforecasts);assert.deepEqual((await h.state()).timesheets,snapshot.timesheets)
  // Leave and required policy refusals are explicit and never prepare a draft.
  for(const p of f.people){const leave=await h.cmd('leave.request',{start:local(next,'00:00'),end:local(days(next,1),'00:00'),reason:'Planned leave'},p.cookie);await h.cmd('leave.decide',{...pin(leave),decision:'approved'})}
  await refuse(await f.read({...f.input,dates:[next]}),/Approved leave/)
  const current=(await h.state()).policies[0]
  await h.cmd('policy.save',{...pin(current),site,from:'2026-01-01',preset:'CA',reviewReason:'Reviewed required state break policy'})
  await refuse(await f.read(),/unsupported break placement/)
  const level=await h.cmd('access.level.save',{name:'Scoped schedule preparation',site,permissions:['draft.view','draft.edit','schedule.publish']})
  const grant=await h.cmd('access.grant',{levelId:level.id,staffId:f.manager.id,site})
  const protectedState=safetyState(await h.state())
  assert.equal((await h.send(f.path(f.input),undefined,f.manager.cookie)).status,403)
  await h.cmd('demand.generate.prepare',{...f.input,digest:(await f.read()).digest},f.manager.cookie,403)
  await h.cmd('access.revoke',pin(grant))
  assert.equal((await h.send(f.path(f.input),undefined,f.manager.cookie)).status,403)
  assert.deepEqual(safetyState(await h.state()),protectedState)

 }finally{await h.close()}
 await generationCostReview()
 await generationFairnessReview()
}
const differentialInput={name:'Reviewed service premium',from:'2026-01-01',site,role:'Counter',tag:'',startMinute:480,endMinute:540,days:[1],mode:'added',value:1000,order:1,code:'service premium'}
async function generationCostReview(){
 const h=await harness({now})
 try{
  const f=await generationFixture(h),sources=safetyState(await h.state()),original=await f.read(),draft=await f.prepare(original)
  const added=await h.cmd('differential.save',differentialInput)
  let unchanged=safetyState(await h.state())
  await f.prepare(original,h.owner,409);await h.cmd('roster.publish',pin(draft),h.owner,409)
  assert.deepEqual(safetyState(await h.state()),unchanged,'a changed pay rule cannot publish or replace the reviewed draft')
  const first=await f.read();assert.equal(first.cost.costCents,7000)
  const current=await f.prepare(first)
  const multiplier=await h.cmd('differential.save',{...differentialInput,name:'Reviewed later multiplier',endMinute:660,mode:'multiplier',value:1.5,order:2,code:'service multiplier'})
  unchanged=safetyState(await h.state())
  await f.prepare(first,h.owner,409);await h.cmd('roster.publish',pin(current),h.owner,409)
  assert.deepEqual(safetyState(await h.state()),unchanged)
  // One hour at (USD 20 + USD 10) times 1.5, then two hours at USD 20 times 1.5.
  const reviewed=await f.read();assert.equal(reviewed.cost.costCents,4500+2*3000)
  const additions=reviewed.cost.inputs.flatMap(x=>x.differential).flatMap(x=>x.additions)
  assert.equal(additions.reduce((n,x)=>n+x.costCents,0),4500)
  assert.deepEqual([...new Set(additions.map(x=>x.ruleId))].sort(),[added.id,multiplier.id].sort())
  assert.ok(additions.every(x=>x.ruleRevision===1))
  // Each three-hour shift has 150 payable minutes: 50 in the first hour and 100 after it.
  const breaks=await f.read({...f.input,minShiftMinutes:180,maxShiftMinutes:180,breakAfterMinutes:120,breakMinutes:30})
  assert.equal(breaks.generated.length,2);assert.equal(breaks.cost.costCents,2*(5000+833+1250+1667))
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:9})
  const impossible=await f.read();assert.equal(impossible.feasible,false);assert.match(JSON.stringify(impossible.rejections),/budget/i)
  unchanged=safetyState(await h.state());await f.prepare(impossible,h.owner,409);assert.deepEqual(safetyState(await h.state()),unchanged)
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:15})
  const fresh=await f.read();assert.equal(fresh.cost.costCents,10500);assert.equal(fresh.budget.withinBudget,true)
  const ready=await f.prepare(fresh);await h.restart();await h.cmd('roster.publish',pin(ready))
  assert.equal((await h.state()).shifts.filter(x=>x.status==='published').length,1)
  const revised=await h.cmd('differential.save',{...differentialInput,...pin(added),value:2000})
  const changed=await f.read();assert.equal(changed.cost.costCents,12000)
  assert.ok(changed.cost.inputs.flatMap(x=>x.differential).flatMap(x=>x.additions).some(x=>x.ruleId===revised.id&&x.ruleRevision===revised.revision))
  assert.equal(fresh.cost.costCents,10500)
  // A premium that needs actual-work review cannot be silently priced as zero.
  const premium={from:'2026-01-01',preset:'employer',minimumCents:2000,reportingGuaranteeMinutes:120,splitMinutes:60,spreadMinutes:60,spreadThresholdMinutes:600}
  await h.cmd('premiumrule.save',{...premium,site:'Mission'})
  await h.cmd('premiumrule.save',{...premium,site,from:days(week,1)})
  const supported=await f.read();assert.equal(supported.feasible,true,'foreign and future premium rules do not require treatment on this service date')
  const prepared=await f.prepare(supported)
  await h.cmd('premiumrule.save',{...premium,site})
  unchanged=safetyState(await h.state())
  await f.prepare(supported,h.owner,409);await h.cmd('roster.publish',pin(prepared),h.owner,409)
  const unsupported=await f.read();assert.equal(unsupported.feasible,false);assert.match(unsupported.infeasible.join('; '),/premiums require unsupported cost treatment/)
  await f.prepare(unsupported,h.owner,409);assert.deepEqual(safetyState(await h.state()),unchanged)
  const after=safetyState(await h.state());for(const key of ['sales','demandforecasts','timesheets','clocks','batches','claims'])assert.deepEqual(after[key],sources[key])
 }finally{await h.close()}
}
export async function generationFairnessFixture(h){
 const f=await generationFixture(h),first=days(week,-49),[avery,blair]=f.people
 const profile=(await h.state()).workforce.find(x=>x.staffId===blair.id)
 await h.cmd('workforce.save',{...pin(profile),staffId:blair.id,jobs:[f.job.id],skills:['service'],certifications:[],sites:[site],preferences:[],minHours:0,maxHours:40,classification:'hourly',rates:[{job:f.job.id,from:'2026-01-01',cents:2500}]})
 for(const [person,hours] of [[avery,0],[blair,3]])await h.cmd('pattern.save',{from:first,blocks:full+(person===avery?'\nMon prefer-not 08:00-11:00':''),preferredHours:hours,maxHours:40},person.cookie)
 await h.cmd('fairness.policy.save',{site,tags:['closing'],closingTime:'11:00',openingTime:'08:00',closeOpenHours:12})
 await h.cmd('fairness.cohort.save',{site,position:'Counter',from:first,staffIds:f.people.map(x=>x.id)})
 for(let i=0;i<7;i++){
  const on=days(first,i*7),draft=await h.cmd('roster.prepare',{week:on,shifts:[{staffId:avery.id,site,job:f.job.id,start:local(on,'08:00'),end:local(on,'11:00'),breakMinutes:0}]})
  assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft))
 }
 return {...f,first}
}
async function generationFairnessReview(){
 const h=await harness({now})
 try{
  const f=await generationFairnessFixture(h),sources=safetyState(await h.state())
  const low=await f.read(),high=await f.read({...f.input,priority:'high',weeks:8})
  assert.equal(low.feasible,true);assert.equal(high.feasible,true,JSON.stringify(high.infeasible))
  assert.equal(low.generated[0].staffId,f.people[0].id);assert.equal(high.generated[0].staffId,f.people[1].id)
  assert.deepEqual(low.generated.map(({staffId,...x})=>x),high.generated.map(({staffId,...x})=>x))
  assert.deepEqual([low.cost.costCents,high.cost.costCents,high.objectives.difference.costCents],[6000,7500,1500])
  assert.deepEqual([low.service.uncoveredMinutes,high.service.uncoveredMinutes,high.objectives.difference.coveredMinutes],[0,0,0])
  for(const alternative of [high.objectives.low,high.objectives.high]){
   // Seven historical three-hour closings for Avery; the projection adds one closing.
   const moved=alternative.rows[0].staffId===f.people[1].id
   assert.deepEqual(alternative.measures.undesirable.groups[0].counts.map(x=>[x.staffId,x.count]).sort(),[[f.people[0].id,moved?7:8],[f.people[1].id,moved?1:0]].sort())
   assert.equal(alternative.measures.totals.spread,moved?6:8)
   assert.equal(alternative.measures.totals.meanGapMinutes,moved?157.5:180)
   assert.equal(alternative.measures.totals.maxGapMinutes,180)
   assert.equal(alternative.measures.totals.violations,moved?7:8)
   assert.equal(alternative.cost.costCents,moved?7500:6000)
   assert.equal(alternative.measures.equity.groups[0].totalOfferedMinutes,0)
   assert.ok(alternative.measures.equity.groups[0].reasons.length,'generation never invents reached offers')
  }
  assert.deepEqual(safetyState(await h.state()),sources,'both objective previews are read only')
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:6})
  const capped=await f.read({...f.input,priority:'high',weeks:8});assert.equal(capped.feasible,true);assert.equal(capped.cost.costCents,6000);assert.equal(capped.generated[0].staffId,f.people[0].id)
  assert.equal(capped.objectives.high.measures.totals.spread,8,'fairness cannot waive the reviewed USD budget')
  await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:30})
  let reviewed=await f.read({...f.input,priority:'high'}),draft=await f.prepare(reviewed,f.manager.cookie)
  // Changed preferences invalidate both preparation and publication without draft writes.
  await h.cmd('pattern.save',{from:week,blocks:full,preferredHours:2,maxHours:40},f.people[1].cookie)
  let unchanged=safetyState(await h.state())
  await f.prepare(reviewed,h.owner,409);await h.cmd('roster.publish',pin(draft),f.manager.cookie,409)
  assert.deepEqual(safetyState(await h.state()),unchanged)
  reviewed=await f.read({...f.input,priority:'high'});draft=await f.prepare(reviewed,f.manager.cookie)
  const rule=(await h.state()).fairnesspolicies[0]
  await h.cmd('fairness.policy.save',{...{site,revision:rule.revision},tags:['closing'],closingTime:'10:00',openingTime:'08:00',closeOpenHours:12})
  unchanged=safetyState(await h.state());await h.cmd('roster.publish',pin(draft),f.manager.cookie,409);assert.deepEqual(safetyState(await h.state()),unchanged)
  // Feedback and actual worked time remain absent from generated-objective inputs.
  reviewed=await f.read({...f.input,priority:'high'})
  await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:local(f.first,'08:00')},f.people[0].cookie)
  const clock=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:local(f.first,'11:00'),breakMinutes:0},f.people[0].cookie)
  await h.cmd('feedback.submit',{timesheetId:clock.timesheet.id,rating:1,flags:['safety'],comment:'Review separately'},f.people[0].cookie)
  assert.deepEqual(await f.read({...f.input,priority:'high'}),reviewed)
  draft=await f.prepare(reviewed,f.manager.cookie);await h.restart();await h.cmd('roster.publish',pin(draft),f.manager.cookie)
  const report=await h.send(`/api/lanyard/fairness?week=${week}&site=Ocean%20Beach&weeks=8`,undefined,h.owner)
  assert.deepEqual(report.value.totals,reviewed.objectives.high.measures.totals,'actual published FAIR-001 measures match the reviewed projection')
  const state=await h.state();assert.deepEqual(state.sales,sources.sales);assert.deepEqual(state.demandforecasts,sources.demandforecasts)
  // Incomplete window evidence refuses the high objective, keeping costs and measures honest.
  const missing=await f.read({...f.input,priority:'high',weeks:9});assert.equal(missing.feasible,false);assert.match(missing.infeasible.join('; '),/confirmed FAIR-001/)
  unchanged=safetyState(await h.state());await f.prepare(missing,h.owner,409);assert.deepEqual(safetyState(await h.state()),unchanged)
 }finally{await h.close()}
}
export async function demandGenerationBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.LANYARD_CHROMIUM?{executablePath:process.env.LANYARD_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now}),context=await browser.newContext({viewport:{width,height:1100}})
  try{
   const f=await generationFairnessFixture(h),page=await context.newPage(),[name,...value]=f.manager.cookie.split('=')
   await h.cmd('differential.save',differentialInput)
   await h.cmd('differential.save',{...differentialInput,name:'Reviewed later multiplier',endMinute:660,mode:'multiplier',value:1.5,order:2,code:'service multiplier'})
   await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const url=`${h.origin}/app/schedule?`+new URLSearchParams({...f.input,dates:week,demandGenerate:'1'})
   await page.goto(url,{waitUntil:'networkidle'});const panel=page.locator('#demand-generation');await panel.scrollIntoViewIfNeeded()
   await panel.getByLabel('Fairness priority',{exact:true}).selectOption('high')
   await panel.getByRole('button',{name:'Preview demand-generated shifts',exact:true}).click();await page.waitForLoadState('networkidle')
   await panel.scrollIntoViewIfNeeded()
   const shot=async key=>{if(process.env.GENERATION_SCREENS){await mkdir(process.env.GENERATION_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.GENERATION_SCREENS,`${key}-${width}.png`),fullPage:false})}}
   if(width===1440){assert.ok((await panel.innerText()).includes('$105.00'));assert.ok((await panel.innerText()).includes('$127.50'));assert.ok((await panel.innerText()).includes('Selected priority: high'));assert.ok((await panel.innerText()).includes('Draft ready for preparation'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   await shot('generation-preview')
   await panel.getByRole('button',{name:'Prepare demand-generated draft',exact:true}).click();await page.waitForLoadState('networkidle')
   if(width===1440)assert.equal((await h.state()).rosters.filter(x=>x.status==='draft').length,1)
   await shot('generation-draft')
   const review=page.getByRole('link',{name:/Review draft revision/});if(await review.count())await review.click()
   await page.getByRole('button',{name:'Publish this revision',exact:true}).click();await page.waitForLoadState('networkidle')
   await h.restart();await page.reload({waitUntil:'networkidle'})
   if(width===1440){const published=(await h.state()).shifts.filter(x=>x.status==='published');assert.equal(published.length,8);assert.equal(published.find(x=>x.start===local(week,'08:00')).staffId,f.people[1].id)}
   await shot('generation-published')
   await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:9})
   await page.goto(url,{waitUntil:'networkidle'});await panel.scrollIntoViewIfNeeded()
   if(width===1440){assert.ok((await panel.innerText()).includes('Generation refused'));assert.equal(await panel.getByRole('button',{name:'Prepare demand-generated draft',exact:true}).count(),0)}
   await shot('generation-infeasible')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

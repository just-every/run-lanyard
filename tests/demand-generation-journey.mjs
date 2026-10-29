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
 const prepare=(c,cookie=h.owner,status=200)=>h.cmd('demand.generate.prepare',{...Object.fromEntries(Object.keys(input).map(k=>[k,c[k]])),digest:c.digest},cookie,status)
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
}
export async function demandGenerationBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.LANYARD_CHROMIUM?{executablePath:process.env.LANYARD_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now}),context=await browser.newContext({viewport:{width,height:1100}})
  try{
   const f=await generationFixture(h),page=await context.newPage(),[name,...value]=f.manager.cookie.split('=')
   await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const url=`${h.origin}/app/schedule?`+new URLSearchParams({...f.input,dates:week,demandGenerate:'1'})
   await page.goto(url,{waitUntil:'networkidle'});const panel=page.locator('#demand-generation');await panel.scrollIntoViewIfNeeded()
   const shot=async key=>{if(process.env.GENERATION_SCREENS){await mkdir(process.env.GENERATION_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.GENERATION_SCREENS,`${key}-${width}.png`),fullPage:false})}}
   if(width===1440){assert.ok((await panel.innerText()).includes('$60.00'));assert.ok((await panel.innerText()).includes('Draft ready for preparation'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
   await shot('generation-preview')
   await panel.getByRole('button',{name:'Prepare demand-generated draft',exact:true}).click();await page.waitForLoadState('networkidle')
   if(width===1440)assert.equal((await h.state()).rosters.filter(x=>x.status==='draft').length,1)
   await shot('generation-draft')
   const review=page.getByRole('link',{name:/Review draft revision/});if(await review.count())await review.click()
   await page.getByRole('button',{name:'Publish this revision',exact:true}).click();await page.waitForLoadState('networkidle')
   await h.restart();await page.reload({waitUntil:'networkidle'})
   if(width===1440)assert.equal((await h.state()).shifts.filter(x=>x.status==='published').length,1)
   await shot('generation-published')
   await h.cmd('forecast.save',{week,site,days:[1000,0,0,0,0,0,0],budgetPercent:1})
   await page.goto(url,{waitUntil:'networkidle'});await panel.scrollIntoViewIfNeeded()
   if(width===1440){assert.ok((await panel.innerText()).includes('Generation refused'));assert.equal(await panel.getByRole('button',{name:'Prepare demand-generated draft',exact:true}).count(),0)}
   await shot('generation-infeasible')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const now='2026-10-31T12:00:00Z',date='2026-11-02',site='Ocean Beach'
const pin=r=>({id:r.id,revision:r.revision})
const at=(day,time)=>`${day}T${time}:00.000Z`
const when=time=>({'x-test-now':String(Date.parse(time))})
const path=(extra={})=>'/api/lanyard/demand/coverage?'+new URLSearchParams({site,date,hour:'8',position:'Counter',...extra})
const protectedSources=s=>Object.fromEntries(['sales','demandrules','demandforecasts','forecasts','timesheets','clocks','batches','claims'].map(k=>[k,s[k]]))
async function fixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const people=[];for(const name of ['Avery','Blair','Casey','Declan'])people.push(await h.person(name))
 const manager=await h.person('Marlowe','manager'),foreign=await h.person('Sydney','manager')
 for(const p of [...people,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':site,position:people.includes(p)?'Counter':'Manager',hourlyRate:'20.00'})
 for(const p of people)await h.cmd('availability.save',{staffId:p.id,start:at(date,'00:00'),end:at('2026-11-09','00:00')})
 const draft=await h.cmd('roster.prepare',{week:date,shifts:[{staffId:people[0].id,site,start:at(date,'08:00'),end:at(date,'10:00'),breakMinutes:30},...[3,4,5,6,7].map(day=>({staffId:people[1].id,site,start:at(`2026-11-0${day}`,'08:00'),end:at(`2026-11-0${day}`,'16:00'),breakMinutes:0}))]},manager.cookie)
 assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft),manager.cookie)
 const csv='date,hour,site,sales\n2026-10-26,8,Ocean Beach,100\n2026-10-19,8,Ocean Beach,100'
 const parsed=await h.cmd('sales.preview',{site,csv});await h.cmd('sales.import',{site,csv,fingerprint:parsed.fingerprint})
 await h.cmd('demandrule.save',{site,roles:'Counter|100|0',staleDays:60})
 const demand=await h.send('/api/lanyard/demand?'+new URLSearchParams({site,date}),undefined,manager.cookie)
 const saved=await h.cmd('demand.save',{site,date,digest:demand.value.live.digest},manager.cookie)
 const increased=await h.cmd('demand.override',{...pin(saved),hour:8,dollars:'300',reason:'Employer reviewed increased counter demand'},manager.cookie)
 const open=await h.cmd('openshift.post',{site,position:'Counter',start:at(date,'08:30'),end:at(date,'09:30'),breakMinutes:0,approval:'manager',order:'all'},manager.cookie)
 const read=async(extra={},cookie=manager.cookie,status=200,headers={})=>{const r=await h.send(path({openShiftId:open.id,...extra}),undefined,cookie,headers);assert.equal(r.status,status,r.text);return r.value}
 const input=v=>({site,date,hour:8,position:'Counter',openShiftId:v.openShift.id,openShiftRevision:v.openShift.revision,digest:v.digest})
 const link=(v,cookie=manager.cookie,status=200)=>h.cmd('demand.coverage.link',input(v),cookie,status)
 return {people,manager,foreign,open,increased,read,input,link}
}
export async function demandCoverageApi(){
 const h=await harness({now})
 try{
  const f=await fixture(h),initial=await h.state(),v=(await f.read()).review
  // USD 300 at USD 100 per labor hour requires 180 minutes. A 120-minute
  // published shift with a 30-minute meal contributes 45 in the first hour.
  // The selected 08:30–09:30 shift contributes 30 in that hour, leaving 105.
  assert.deepEqual([v.reviewed.interval.requiredMinutes,v.reviewed.interval.scheduledMinutes,v.reviewed.interval.uncoveredMinutes,v.plannedMinutes,v.plannedReductionMinutes,v.residualMinutes],[180,45,135,30,30,105])
  assert.deepEqual(v.reviewed.forecast,{id:f.increased.id,revision:f.increased.revision,version:2,digest:f.increased.digest,source:'Manual (SALES-001)'})
  assert.equal(v.reviewed.coverage.length,1);assert.equal(v.reviewed.coverage[0].minutes,90)
  assert.deepEqual(await h.state(),initial,'Review changes no persistent state')
  const refusal=async(fn)=>{const before=await h.state();await fn();assert.deepEqual(await h.state(),before,'Refusal writes nothing, including audit and command records')}
  for(const cookie of [f.people[2].cookie,f.foreign.cookie])await refusal(()=>f.link(v,cookie,cookie===f.foreign.cookie?404:403))
  await f.read({},f.people[2].cookie,403);await f.read({},f.foreign.cookie,404)
  const key=await h.cmd('agent.create',{label:'Preparation without staffing authority'})
  for(const route of [path({openShiftId:f.open.id}),'/app/demand?'+new URLSearchParams({site,date})])assert.equal((await h.send(route,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  assert.equal((await h.send('/api/lanyard/agent/command',{name:'demand.coverage.link',input:f.input(v)},'',{authorization:`Bearer ${key.token}`})).status,403)
  const raced=await Promise.all([h.send('/api/lanyard/command',{name:'demand.coverage.link',input:f.input(v)},h.owner),h.send('/api/lanyard/command',{name:'demand.coverage.link',input:f.input(v)},h.owner)])
  assert.deepEqual(raced.map(x=>x.status).sort(),[200,409],'Concurrent links create one durable case')
  await refusal(()=>h.cmd('demand.coverage.link',{...f.input(v),openShiftRevision:v.openShift.revision+1},f.manager.cookie,409))
  const automatic=await h.cmd('openshift.post',{site,position:'Counter',start:at(date,'08:30'),end:at(date,'09:30'),breakMinutes:0,approval:'auto',order:'all'})
  assert.match((await f.read({openShiftId:automatic.id})).error,/independent manager approval/)
  await refusal(()=>h.cmd('demand.coverage.link',{...f.input(v),openShiftId:automatic.id},f.manager.cookie,409))
  const record=raced.find(x=>x.status===200).value.result
  assert.equal((await f.read()).cases.length,1)
  await refusal(()=>f.link(v,f.manager.cookie,409))
  const afterLink=await h.state();assert.deepEqual(protectedSources(afterLink),protectedSources(initial));assert.deepEqual(afterLink.shifts,initial.shifts);assert.deepEqual(afterLink.openshifts.filter(x=>x.id!==automatic.id),initial.openshifts)
  await h.restart();let tracked=(await f.read()).cases[0]
  assert.equal(tracked.id,record.id);assert.equal(tracked.fresh,true);assert.equal(tracked.clock,null);assert.equal(tracked.status,'awaiting-pickup')
  const no=await h.cmd('openshift.decline',pin(f.open),f.people[3].cookie)
  const losing=await h.cmd('openshift.request',pin(f.open),f.people[1].cookie)
  const winning=await h.cmd('openshift.request',pin(f.open),f.people[2].cookie)
  const managerState=await h.state(f.manager.cookie)
  assert.ok(managerState.pickups.find(x=>x.id===losing.id).overtime,'Existing overtime warning survives the linked case')
  assert.ok(managerState.pickups.find(x=>x.id===losing.id).cost)
  tracked=(await f.read()).cases[0]
  assert.deepEqual(tracked.requests.map(x=>[x.id,x.status]).sort(),[[no.id,'declined'],[losing.id,'requested'],[winning.id,'requested']].sort())
  assert.equal(tracked.clock,null);assert.equal(tracked.approvedReductionMinutes,0);assert.equal(tracked.residualMinutes,135)
  // Recipient state and pages disclose no forecast, digest or linked-case facts.
  const staff=await h.state(f.people[2].cookie)
  assert.deepEqual(staff.demandcoverage,[]);assert.deepEqual(staff.demandCoverageCases,[]);assert.deepEqual(staff.demandforecasts,[])
  assert.ok(!JSON.stringify(staff).includes(record.id));assert.ok(!JSON.stringify(staff).includes(f.increased.digest))
  const employeePage=await h.send(`/app/schedule?week=${date}`,undefined,f.people[2].cookie)
  assert.ok(!employeePage.text.includes('Reviewed coverage plan'));assert.ok(!employeePage.text.includes(f.increased.digest))
  // Saved versions, live input changes and changed published coverage each
  // invalidate an existing review. Pending requests remain for a fresh review.
  const raised=await h.cmd('demand.override',{...pin(f.increased),hour:8,dollars:'400',reason:'Second reviewed demand increase'})
  await refusal(()=>h.cmd('openshift.approve',pin(winning),f.manager.cookie,409))
  await refusal(()=>f.link(v,f.manager.cookie,409))
  let review=(await f.read()).review
  assert.equal(review.reviewed.interval.uncoveredMinutes,195)
  let updated=await h.cmd('demand.coverage.review',{...f.input(review),...pin(record)},f.manager.cookie)
  const source=(await h.state()).sales.find(x=>x.date==='2026-10-26')
  await h.cmd('sales.save',{...pin(source),value:'150'})
  assert.match((await f.read()).error,/Forecast sources changed/)
  await refusal(()=>h.cmd('openshift.approve',pin(winning),f.manager.cookie,409))
  const live=(await h.send('/api/lanyard/demand?'+new URLSearchParams({site,date}),undefined,f.manager.cookie)).value.live
  const refreshed=await h.cmd('demand.save',{site,date,digest:live.digest})
  await h.cmd('demand.override',{...pin(refreshed),hour:8,dollars:'300',reason:'Explicit refreshed manual demand'})
  review=(await f.read()).review
  updated=await h.cmd('demand.coverage.review',{...f.input(review),...pin(updated)},f.manager.cookie)
  // A new publication replaces the reviewed baseline; it cannot silently inherit approval.
  const beforePublish=await h.state(),oldRows=beforePublish.shifts.filter(x=>x.status==='published')
  const newDraft=await h.cmd('roster.prepare',{week:date,shifts:oldRows.map(({staffId,site,start,end,breakMinutes})=>({staffId,site,start,end,breakMinutes}))})
  await h.cmd('roster.publish',pin(newDraft))
  await refusal(()=>h.cmd('openshift.approve',pin(winning),f.manager.cookie,409))
  review=(await f.read()).review
  updated=await h.cmd('demand.coverage.review',{...f.input(review),...pin(updated)},f.manager.cookie)
  // Custom grants do not expand this native manager-only workflow.
  const level=await h.cmd('access.level.save',{site,name:'Scoped staffing',permissions:['draft.view','draft.edit','schedule.publish','reports.view','wages.view']})
  const grant=await h.cmd('access.grant',{site,staffId:f.manager.id,levelId:level.id})
  await f.read({},f.manager.cookie,403)
  await refusal(()=>h.cmd('demand.coverage.review',{...f.input(review),...pin(updated)},f.manager.cookie,403))
  assert.deepEqual((await h.state(f.manager.cookie)).demandCoverageCases,[])
  await h.cmd('access.revoke',pin(grant));await f.read({},f.manager.cookie,403)
  await h.cmd('access.restore',{staffId:f.manager.id})
  const selfRequest=await h.cmd('openshift.request',pin(f.open),f.people[2].cookie,409)
  assert.ok(selfRequest.error)
  // Existing independent approval remains required even if a manager can request.
  const managerPerson=(await h.state()).staff.find(x=>x.id===f.people[2].id)
  await h.cmd('staff.save',{...pin(managerPerson),name:managerPerson.name,email:managerPerson.email,payrollId:managerPerson.payrollId,role:'manager',active:true,site,position:'Counter',hourlyRate:'20.00'})
  await refusal(()=>h.cmd('openshift.approve',pin(winning),f.people[2].cookie,403))
  const beforeApproval=await h.state(),filled=await h.cmd('openshift.approve',pin(winning),f.manager.cookie)
  assert.equal(filled.shift.staffId,f.people[2].id)
  await refusal(()=>h.cmd('openshift.approve',pin(losing),f.manager.cookie,409))
  tracked=(await f.read()).cases[0]
  assert.deepEqual([tracked.status,tracked.fresh,tracked.clock,tracked.approvedReductionMinutes,tracked.residualMinutes],['assigned',true,null,30,105])
  assert.equal(tracked.requests.find(x=>x.id===losing.id).status,'closed');assert.equal(tracked.requests.find(x=>x.id===winning.id).status,'approved');assert.equal(tracked.requests.find(x=>x.id===no.id).status,'declined')
  assert.deepEqual(protectedSources(await h.state()),protectedSources(beforeApproval))
  assert.deepEqual((await h.state()).shifts.filter(x=>x.id!==filled.shift.id),beforeApproval.shifts,'Unrelated assignments remain identical')
  // A received capture explicitly observed at another cafe cannot prove this arrival.
  await h.cmd('clocknet.save',{site:'Mission',mode:'flag',ranges:'203.0.113.0/24'})
  const foreignClock=await h.cmd('clock.in',{commandId:'synthetic-lanyard-3',capturedAt:at(date,'08:31')},f.people[2].cookie,200,{...when(at(date,'08:32')),'cf-connecting-ip':'203.0.113.9'})
  assert.equal(foreignClock.seenAt,'Mission')
  assert.equal((await f.read({},f.manager.cookie,200,when(at(date,'08:33')))).cases[0].clock,null)
  await h.cmd('clock.out',{commandId:'synthetic-lanyard-4',capturedAt:at(date,'08:32'),breakMinutes:0},f.people[2].cookie,200,when(at(date,'08:33')))
  const clockInput={commandId:'synthetic-lanyard-1',capturedAt:at(date,'08:34')}
  const clock=await h.cmd('clock.in',clockInput,f.people[2].cookie,200,when(at(date,'09:00')))
  assert.equal((await h.cmd('clock.in',clockInput,f.people[2].cookie,200,when(at(date,'09:01')))).id,clock.id)
  const earlier=(await f.read({},f.manager.cookie,200,when(at(date,'08:45')))).cases[0]
  assert.equal(earlier.clock,null,'A capture not yet received cannot establish arrival')
  tracked=(await f.read({},f.manager.cookie,200,when(at(date,'09:05')))).cases[0]
  assert.deepEqual([tracked.status,tracked.clock.clockId,tracked.clock.start,tracked.clock.receivedAt],['arrived',clock.id,at(date,'08:34'),at(date,'09:00')])
  assert.equal(tracked.residualMinutes,105,'Arrival cannot erase residual demand or claim a service outcome')
  await h.restart();assert.equal((await f.read({},f.manager.cookie,200,when(at(date,'09:05')))).cases[0].clock.clockId,clock.id)
  // Deactivation fences the already-issued session on both read and mutation.
  const person=(await h.state()).staff.find(x=>x.id===f.manager.id)
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'manager',active:false,site,position:'Manager'})
  await f.read({},f.manager.cookie,403);await refusal(()=>f.link(v,f.manager.cookie,403))
  assert.equal((await f.read({},h.owner)).cases.length,1)
  assert.equal(raised.version,3)
 }finally{await h.close()}
}
export async function demandCoverageBrowser({proof=false}={}){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of proof?[1440,390]:[1440]){
  const h=await harness({now}),manager=await browser.newContext({viewport:{width,height:1000}}),employee=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fixture(h);let browserNow=now
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded',...when(now)},body:'confirm=yes',redirect:'manual'})
   for(const [context,cookie] of [[manager,f.manager.cookie],[employee,f.people[2].cookie]]){
    const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
    await context.route('**/*',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.startsWith('/fonts/')||pathname.startsWith('/brand/')||/\.(css|js)$/.test(pathname))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',pathname.slice(1))),contentType:pathname.endsWith('.css')?'text/css':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue({headers:{...route.request().headers(),...when(browserNow)}})})
   }
   const page=await manager.newPage(),staff=await employee.newPage()
   const submit=async(p,button,command)=>{const [response]=await Promise.all([p.waitForResponse(r=>r.url().includes('/app/action?name='+command)),button.click()]);assert.equal(response.status(),200);assert.ok(!(await response.text()).includes('class="notice error"'));await p.waitForLoadState('networkidle')}
   const shot=async(name,p,selector)=>{await p.locator(selector).scrollIntoViewIfNeeded();if(width===1440)assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.DEMAND_COVERAGE_SCREENS){await mkdir(process.env.DEMAND_COVERAGE_SCREENS,{recursive:true});await p.screenshot({path:join(process.env.DEMAND_COVERAGE_SCREENS,`demand-coverage-${name}-${width}.png`)})}}
   await page.goto(h.origin+'/app/demand?'+new URLSearchParams({site,date,hour:'8',position:'Counter'}),{waitUntil:'networkidle'})
   await page.locator('#demand-coverage').getByLabel('Existing open shift').selectOption(f.open.id)
   await page.locator('#demand-coverage').getByRole('button',{name:'Review selected shift',exact:true}).click();await page.waitForLoadState('networkidle')
   if(width===1440){const text=await page.locator('[data-demand-coverage-review]').innerText();assert.match(text,/180 required minutes/);assert.match(text,/45 published minutes/);assert.match(text,/reduction: 30 minutes/);assert.match(text,/Residual demand if assigned: 105 minutes/)}
   await page.locator('[data-demand-coverage-review]').getByText('Reviewed sources',{exact:true}).click()
   await shot('review',page,'[data-demand-coverage-review]')
   await page.locator('[data-demand-coverage-review]').getByText('Reviewed sources',{exact:true}).click()
   await submit(page,page.getByRole('button',{name:'Link reviewed open shift',exact:true}),'demand.coverage.link')
   await h.cmd('openshift.request',pin(f.open),f.people[1].cookie);await h.cmd('openshift.decline',pin(f.open),f.people[3].cookie)
   await staff.goto(h.origin+`/app/schedule?week=${date}`,{waitUntil:'networkidle'})
   const offered=staff.locator('#open-shifts li').filter({has:staff.locator(`input[name=id][value="${f.open.id}"]`)})
   await submit(staff,offered.getByRole('button',{name:'Request',exact:true}),'openshift.request')
   await shot('pickup',staff,'#open-shifts')
   await page.goto(h.origin+`/app/schedule?week=${date}&site=${encodeURIComponent(site)}`,{waitUntil:'networkidle'})
   const request=(await h.state()).pickups.find(x=>x.staffId===f.people[2].id&&x.openShiftId===f.open.id)
   await shot('approval',page,'#open-shifts')
   await submit(page,page.locator('#open-shifts .request').filter({has:page.locator(`input[name=id][value="${request.id}"]`)}).getByRole('button',{name:'Approve Casey',exact:true}),'openshift.approve')
   await page.goto(h.origin+'/app/demand?'+new URLSearchParams({site,date}),{waitUntil:'networkidle'})
   if(width===1440){const text=await page.locator('[data-demand-coverage-case]').innerText();assert.match(text,/Approved deficit reduction: 30 minutes/);assert.match(text,/Residual demand: 105 minutes/);assert.match(text,/arrival unverified/);assert.match(text,/Blair: closed/);assert.match(text,/Declan: declined/)}
   await shot('assigned',page,'[data-demand-coverage-case]')
   await h.cmd('clock.in',{commandId:'synthetic-lanyard-2',capturedAt:at(date,'08:31')},f.people[2].cookie,200,when(at(date,'09:00')))
   browserNow=at(date,'09:05');await page.reload({waitUntil:'networkidle'})
   if(width===1440){assert.match(await page.locator('[data-demand-coverage-case]').innerText(),/Received clock-in/);assert.match(await page.locator('[data-demand-coverage-case]').innerText(),/Residual demand: 105 minutes/)}
   await shot('arrival',page,'[data-demand-coverage-case]')
  }finally{await manager.close();await employee.close();await h.close()}
 }}finally{await browser.close()}
}

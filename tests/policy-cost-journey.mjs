import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days,monday} from './workforce-journey.mjs'

async function fixture(h){
 // A pinned service Monday makes actual work, future assignments and native
 // approvals deterministic even when CI runs near a venue or UTC boundary.
 const week=monday(new Date().toISOString().slice(0,10)),now=week+'T12:30:00.000Z',head={'x-test-now':String(Date.parse(now))}
 const cmd=(name,input,cookie=h.owner,status=200)=>h.cmd(name,input,cookie,status,head)
 const read=async(path,cookie=h.owner,status=200)=>{const r=await h.send(path,undefined,cookie,head);assert.equal(r.status,status,r.text);return r.value}
 const state=(cookie=h.owner)=>read('/api/lanyard/state',cookie)
 await cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),casey=await h.person('Casey'),jordan=await h.person('Jordan'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager'),west=await h.person('Lee','manager')
 const wage=async(p,rate)=>{const current=(await state()).staff.find(x=>x.id===p.id);return cmd('staff.save',{...pin(current),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Third':p===west?'West':'East',position:p.role==='staff'?'Service':'Manager',hourlyRate:rate})}
 for(const p of [alex,ben,casey,jordan,manager,foreign,west])await wage(p,p===casey?'24.00':'20.00')
 const job=await cmd('job.save',{name:'Counter service',skills:['service'],certifications:[]})
 for(const p of [alex,ben,casey])await cmd('workforce.save',{staffId:p.id,jobs:[job.id],skills:['service'],certifications:[],sites:['East','West'],preferences:[],minHours:0,maxHours:168,classification:'hourly employee',employmentType:'part-time',startDate:'2020-01-01',rates:[]})
 for(const p of [alex,ben,casey,jordan])await cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:days(week,7)+'T00:00:00Z'})
 const policies=[]
 for(const site of ['East','West'])policies.push(await cmd('policy.save',{site,preset:'CA',from:'2026-01-01',reviewReason:'Reviewed California daily and workweek overtime across the service cafes'}))
 const shift=(p,on,start,hours,site='East')=>({staffId:p.id,job:job.id,site,start:`${on}T${String(start).padStart(2,'0')}:00:00.000Z`,end:new Date(Date.parse(on+'T00:00:00Z')+(start+hours)*3600000).toISOString(),breakMinutes:0})
 const first=await cmd('time.prepare',{...shift(alex,week,8,4),reason:'Signed opening-service time'}),approved=await cmd('time.approve',pin(first))
 const benTime=await cmd('time.prepare',{...shift(ben,week,7,5),reason:'Signed bakery opening time'});await cmd('time.approve',pin(benTime))
 await wage(alex,'30.00')
 const draft=await cmd('roster.prepare',{week,shifts:[shift(alex,week,8,4),shift(alex,week,13,4),shift(alex,week,17,5,'West')]})
 await cmd('roster.publish',pin(draft))
 const alerts=async(cookie=h.owner,asOf=now)=> (await read(`/api/lanyard/overtime?week=${week}&asOf=${asOf}`,cookie)).alerts
 return {week,now,head,cmd,read,state,wage,shift,alerts,alex,ben,casey,jordan,manager,foreign,west,policies,approved}
}

export async function policyCostApi(){
 const h=await harness()
 try{
  const f=await fixture(h),{cmd,state,alerts,alex,ben,casey,jordan,manager,foreign,west,week}=f
  let a=(await alerts()).find(x=>x.staffId===alex.id)
  assert.deepEqual([a.actualMinutes,a.scheduledMinutes,a.projectedMinutes,a.overtimeMinutes,a.doubleMinutes,a.premiumCents],[240,540,780,240,60,8077])
  assert.equal(a.days[week],780,'daily totals combine actual work and remaining shifts at both cafes')
  assert.ok(a.policy.parts.some(p=>p.timeId===f.approved.id&&p.cents===2000),'approved work retains its earlier rate')
  assert.ok(a.policy.parts.filter(p=>p.timeId!==f.approved.id).every(p=>p.cents===3000))
  assert.ok(a.policy.parts.every(p=>p.rules.every(r=>f.policies.some(v=>v.id===r.id&&v.revision===r.revision&&v.presetVersion===r.version)&&r.source.startsWith('https://'))))
  assert.deepEqual(a.remaining.map(r=>r.substitutes.map(p=>p.staffId)),[[casey.id],[casey.id]],'Ben is below 40 weekly hours but gains daily overtime; Jordan lacks the job qualification')
  const scoped=(await alerts(west.cookie)).find(x=>x.staffId===alex.id)
  assert.ok(scoped,'the remaining cafe manager sees cross-site risk')
  assert.equal(scoped.policy.parts,undefined,'full actual classifications stay owner-only')
  assert.ok(scoped.policy.sources.every(r=>r.version&&r.source.startsWith('https://')))
  assert.deepEqual(await alerts(foreign.cookie),[])
  await f.read(`/api/lanyard/overtime?week=${week}&asOf=${f.now}`,alex.cookie,403)
  const correction=await cmd('time.prepare',{...f.shift(alex,week,8,3),corrects:f.approved.id,reason:'Opening supervisor confirmed a duplicate hour'})
  a=(await alerts()).find(x=>x.staffId===alex.id)
  assert.deepEqual([a.actualMinutes,a.projectedMinutes,a.overtimeMinutes,a.doubleMinutes,a.premiumCents],[180,720,240,0,5500])
  assert.ok(a.policy.parts.some(p=>p.timeId===correction.id&&p.cents===2000),'pending correction replaces its source while retaining its original rate')
  assert.ok(!a.policy.parts.some(p=>p.timeId===f.approved.id))
  await cmd('time.approve',pin(correction))
  assert.equal((await alerts()).find(x=>x.staffId===alex.id).premiumCents,5500)
  const open=await cmd('openshift.post',{...f.shift(ben,week,13,4),staffId:undefined,position:'Service',approval:'manager'})
  const request=await cmd('openshift.request',pin(open),ben.cookie)
  const pickup=(await state(manager.cookie)).pickups.find(x=>x.id===request.id).cost
  assert.deepEqual([pickup.projectedMinutes,pickup.overtimeMinutes,pickup.doubleMinutes,pickup.premiumCents],[540,60,0,1000])
  await cmd('openshift.approve',pin(request),manager.cookie)
  assert.ok((await alerts()).some(x=>x.staffId===ben.id&&x.overtimeMinutes===60),'overtime is shown and pickup approval still succeeds')
  const remaining=(await alerts()).find(x=>x.staffId===alex.id).remaining[0]
  await cmd('overtime.substitute',{shiftId:remaining.shiftId,revision:remaining.revision,staffId:jordan.id},manager.cookie,409)
  await cmd('overtime.substitute',{shiftId:remaining.shiftId,revision:remaining.revision,staffId:casey.id},foreign.cookie,403)
  const moved=await cmd('overtime.substitute',{shiftId:remaining.shiftId,revision:remaining.revision,staffId:casey.id},manager.cookie)
  assert.equal((await alerts()).some(x=>x.staffId===alex.id),false)
  assert.equal(moved.confirmedAt,undefined,'replacement starts without the former assignee confirmation')
  let swap=await cmd('swap.propose',{shiftId:moved.id,revision:moved.revision,to:alex.id},casey.cookie)
  swap=await cmd('swap.respond',{...pin(swap),decision:'accepted'},alex.cookie)
  const swapCost=(await state(manager.cookie)).swaps.find(x=>x.id===swap.id).cost[0]
  assert.deepEqual([swapCost.projectedMinutes,swapCost.overtimeMinutes,swapCost.doubleMinutes,swapCost.premiumCents],[720,240,0,5500],'swap prices the receiving person and preserves the other remaining shift')
  assert.equal(swapCost.policy.parts,undefined,'pending manager decisions receive aggregate cost without owner-only classifications')
  assert.ok(swapCost.policy.sources.every(r=>r.version&&r.source.startsWith('https://')))
  await cmd('swap.decide',{...pin(swap),decision:'approved'},manager.cookie)
  assert.equal((await alerts()).find(x=>x.staffId===alex.id).overtimeMinutes,240,'overtime does not refuse the swap')
  for(const p of [alex,casey]){const own=await state(p.cookie);assert.ok(!own.overtime?.length);assert.ok(own.swaps.every(x=>!x.cost));assert.ok(own.pickups.every(x=>!x.cost));assert.deepEqual(own.policies,[])}
  const key=await cmd('agent.create',{label:'Service schedule preparation'})
  const context=await h.send('/api/lanyard/agent/context',undefined,'',{...f.head,authorization:`Bearer ${key.token}`})
  assert.equal(context.status,200);assert.ok(!context.value.overtime?.length);assert.deepEqual(context.value.swaps,[]);assert.deepEqual(context.value.pickups,[])
 }finally{await h.close()}
 await openPunchProjection()
 await consecutiveProjection()
}

async function consecutiveProjection(){
 const h=await harness()
 try{
  const f=await fixture(h),{cmd,week}=f,riley=await h.person('Riley')
  await cmd('staff.save',{...pin(riley),name:riley.name,email:riley.email,payrollId:riley.payrollId,role:'staff',active:true,site:'Denver',hourlyRate:'20.00'})
  await cmd('policy.save',{site:'Denver',preset:'CO',from:'2026-01-01',reviewReason:'Reviewed consecutive work across midnight and the workweek boundary'})
  const start=days(week,-1)+'T18:00:00Z',end=week+'T06:00:00Z'
  const time=await cmd('time.prepare',{staffId:riley.id,site:'Denver',start,end,breakMinutes:0,reason:'Reviewed continuous overnight opening work'});await cmd('time.approve',pin(time))
  await cmd('availability.save',{staffId:riley.id,start,end:days(week,7)+'T00:00:00Z'})
  const existing=(await f.state()).shifts.filter(x=>x.status==='published').map(x=>({staffId:x.staffId,job:x.job,site:x.site,start:x.start,end:x.end,breakMinutes:x.breakMinutes}))
  const draft=await cmd('roster.prepare',{week,shifts:[...existing,{staffId:riley.id,site:'Denver',start:end,end:week+'T08:00:00Z',breakMinutes:0}]});await cmd('roster.publish',pin(draft))
  const a=(await f.alerts(h.owner,end)).find(x=>x.staffId===riley.id)
  assert.deepEqual([a.actualMinutes,a.scheduledMinutes,a.projectedMinutes,a.overtimeMinutes,a.doubleMinutes,a.premiumCents],[360,120,480,120,0,2000],'prior-week work supplies consecutive context without entering this week’s payable total')
  assert.equal(a.policy.overtimeBasis,'consecutive hours and weekly')
 }finally{await h.close()}
}

async function openPunchProjection(){
 const h=await harness()
 try{
  const f=await fixture(h),{cmd,casey,week,alerts}=f
  await cmd('closerule.save',{site:'East',graceMinutes:15,capHours:10})
  await cmd('clock.in',{commandId:'policy-cost-open',capturedAt:week+'T00:30:00Z'},casey.cookie)
  let a=(await alerts()).find(x=>x.staffId===casey.id)
  assert.deepEqual([a.actualMinutes,a.overtimeMinutes,a.doubleMinutes,a.premiumCents],[600,120,0,2400])
  a=(await alerts(f.manager.cookie,days(week,2)+'T12:30:00Z')).find(x=>x.staffId===casey.id)
  assert.deepEqual([a.actualMinutes,a.overtimeMinutes,a.doubleMinutes],[600,120,0],'a provisional cap cannot manufacture later daily or weekly overtime')
 }finally{await h.close()}
}

export async function policyCostBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),f=await fixture(h),context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:f.head})
  try{
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,...f.head,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=f.manager.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.POLICY_COST_SCREENS){await mkdir(process.env.POLICY_COST_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_COST_SCREENS,`${label}-${width}.png`),fullPage:true})}}
   await page.goto(h.origin+`/app/schedule?week=${f.week}`,{waitUntil:'networkidle'})
   const card=page.locator('#overtime');assert.match(await card.innerText(),/13\.0 hrs projected \(4\.0 recorded \+ 9\.0 scheduled\).*4\.0 hr overtime.*1\.0 hr double time.*\$80\.77/s)
   assert.doesNotMatch(await card.innerText(),/projected over 40|against a 40-hour/)
   assert.equal(await card.getByRole('button',{name:/Give to Ben/}).count(),0)
   assert.equal(await card.getByRole('button',{name:/Give to Casey/}).count(),2)
   await card.scrollIntoViewIfNeeded();await shot('policy-cost-risk')
   await card.getByText('Policy and estimate inputs',{exact:true}).click();assert.match(await card.innerText(),/Weighted regular rate: \$26\.92/);assert.ok(await card.getByRole('link',{name:'Rule source',exact:true}).count());await shot('policy-cost-inputs')
   const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('policy-cost-tooltip')
   await card.scrollIntoViewIfNeeded()
   const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('name=overtime.substitute')),card.getByRole('button',{name:/Give to Casey/}).first().click()]);assert.equal(response.status(),200);await page.waitForLoadState('networkidle')
   assert.match(await card.innerText(),/9\.0 hrs projected \(4\.0 recorded \+ 5\.0 scheduled\).*1\.0 hr overtime.*0\.0 hr double time/s);await card.scrollIntoViewIfNeeded();await shot('policy-cost-reassigned')
   assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

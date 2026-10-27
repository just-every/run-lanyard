import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {browserAssets} from './policy-settings-journey.mjs'
const now='2026-10-27T12:00:00Z',site='Pike Street Cafe',week='2026-11-02'
const pin=r=>({id:r.id,revision:r.revision})
const coverage=(preset,more={})=>({site,preset,industry:preset==='San-Jose'?'all':'food-service',employees:preset==='San-Jose'?36:500,locations:40,localEmployees:18,subjectToBusinessTax:true,reason:'Reviewed employer headcount and cafe industry against the official source',...more})
async function fixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const maya=await h.person('MayaRivera'),manager=await h.person('RileyBrooks','manager')
 for(const [p,name,role]of [[maya,'Maya Rivera','staff'],[manager,'Riley Brooks','manager']])await h.cmd('staff.save',{...pin(p),name,email:p.email,payrollId:p.payrollId,role,active:true,site,position:'Barista',hourlyRate:'22.00'})
 await h.cmd('availability.save',{start:week+'T00:00:00Z',end:'2026-11-08T23:59:00Z'},maya.cookie)
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:maya.id,site,start:week+'T20:00:00Z',end:week+'T23:00:00Z',breakMinutes:0},{staffId:maya.id,site,start:'2026-11-03T08:00:00Z',end:'2026-11-03T12:00:00Z',breakMinutes:0}]})
 await h.cmd('roster.publish',pin(draft));const state=await h.state(),shift=state.shifts.find(x=>x.start==='2026-11-03T08:00:00.000Z'&&x.status==='published')
 const posting=await h.cmd('schedule.post',{week,site})
 return {maya,manager,shift,posting}
}
export async function fairworkApi(){
 const outbound=[]
 const h=await harness({now,observeOutbound:request=>outbound.push(request.url)})
 try{
 const receipts=[],owner=(await h.state()).actor
 const f=await fixture(h),input={shiftId:f.shift.id,shiftRevision:f.shift.revision,action:'change',start:'2026-11-03T07:00:00Z',end:'2026-11-03T12:00:00Z',reason:'Employer proposes an earlier opening for the market event'}
 const unchanged=async operation=>{const before=await h.state(),sent=outbound.length;await operation();assert.equal(outbound.length,sent,'refusal sends nothing');assert.deepEqual(await h.state(),before,'refusal retains the full decision history, audit and version')}
 const record=async(name,input)=>{
  const before=await h.state(),sent=outbound.length,value=await h.cmd(name,input),after=await h.state()
  assert.equal(outbound.length,sent,'coverage decisions and consequence reviews send nothing')
  for(const field of ['shifts','rosters','timesheets','batches','premiuminputs','notices'])assert.deepEqual(after[field],before[field],'review cannot authorize changes to '+field)
  assert.equal(value.by,owner.id,'decision retains its authenticated actor')
  assert.equal(value.at,new Date(now).toISOString(),'decision retains its committed time')
  assert.equal(value.reason,input.reason,'decision retains the explicit review reason')
  assert.equal(value.site,site,'decision retains its site')
  const events=after.events.filter(e=>!before.events.some(old=>old.id===e.id))
  assert.equal(events.length,1,'each accepted decision has exactly one atomic audit event')
  const {id,...event}=events[0];assert.ok(id)
  assert.deepEqual(event,{actorId:owner.id,actorRole:'owner',action:name,entityId:value.id,at:new Date(now).toISOString()},'audit binds the decision, actor, action and time')
  assert.equal(after.version,before.version+1)
  const stored=after[name==='fairwork.save'?'fairworkpolicies':'fairworkreviews'].find(r=>r.id===value.id)
  assert.deepEqual(stored,value,'returned and durable decisions agree')
  receipts.push({name,value,event:events[0]});return value
 }
 for(const cookie of [f.manager.cookie,f.maya.cookie])for(const [name,body]of [['fairwork.save',coverage('Seattle')],['fairwork.preview',input]])await unchanged(()=>h.cmd(name,body,cookie,403))
 for(const [name,body]of [['fairwork.save',coverage('Seattle')],['fairwork.preview',input]]){
  await unchanged(()=>h.cmd(name,body,'',401))
  await unchanged(()=>h.cmd(name,body,h.owner,403,{origin:'https://foreign.example'}))
 }

 let prior
 for(const [preset,covered,missing]of [['Seattle',500,499],['Oregon',500,499],['San-Jose',36,35]]){
  const low=await record('fairwork.save',coverage(preset,{employees:missing,...(prior?{revision:prior.revision}:{})}))
  assert.equal(low.covered,false);assert.equal(Boolean((await h.state()).offerrules.find(x=>x.site===site)?.accessToHours),false)
  const no=await record('fairwork.preview',input);assert.deepEqual(no.premiumInputs,[]);assert.deepEqual(no.shortRest,[]);assert.equal(no.consentRequired,false)
  const policy=await record('fairwork.save',coverage(preset,{employees:covered,revision:low.revision}))
  assert.equal(policy.covered,true);assert.ok(policy.rule.source.startsWith('https://'));assert.ok(policy.rule.version)
  assert.deepEqual(policy.versions.at(-1),(({versions,...value})=>value)(low),'the exact previous employer decision survives revision')
  for(const field of ['preset','industry','employees','locations','localEmployees','subjectToBusinessTax'])assert.equal(policy[field],coverage(preset,{employees:covered})[field],'retained employer fact: '+field)
  assert.equal(policy.rule.id,preset);assert.ok(policy.rule.version.length>0);assert.ok(policy.rule.source.length>0)
  const result=await record('fairwork.preview',input)
  assert.deepEqual(result.policy,(({versions,...value})=>value)(policy),'preview retains the exact cited rule and current employer facts');assert.equal(result.policyId,policy.id)
  assert.equal(result.shiftId,f.shift.id);assert.equal(result.action,input.action);assert.deepEqual(result.before,{start:f.shift.start,end:f.shift.end,minutes:240});assert.deepEqual(result.proposed,{start:'2026-11-03T07:00:00.000Z',end:'2026-11-03T12:00:00.000Z',breakMinutes:0,minutes:300});assert.equal(result.status,'review-only')
  assert.equal(result.policyRevision,policy.revision);assert.equal(result.shiftRevision,f.shift.revision)
  assert.deepEqual(result.postings,[{id:f.posting.id,revision:f.posting.revision,postedAt:f.posting.postedAt}])
  assert.equal(result.insideNotice,preset!=='San-Jose');assert.equal(result.consentRequired,preset!=='San-Jose')
  assert.deepEqual(result.premiumInputs,preset==='San-Jose'?[]:[{kind:'change',minutes:60,multiplier:1}])
  assert.deepEqual(result.shortRest,preset==='San-Jose'?[]:[{shiftId:(await h.state()).shifts.find(x=>x.start===week+'T20:00:00.000Z'&&x.status==='published').id,minutes:480}])
  const cancel=await record('fairwork.preview',{shiftId:f.shift.id,shiftRevision:f.shift.revision,action:'cancel',reason:'Review the proposed cancellation'})
  assert.deepEqual(cancel.premiumInputs,preset==='San-Jose'?[]:[{kind:'lost-hours',minutes:240,multiplier:0.5}])
  if(preset!=='Oregon')assert.equal((await h.state()).offerrules.find(x=>x.site===site).accessToHours,true)
  if(preset==='Oregon'){
   const small=await record('fairwork.preview',{...input,start:'2026-11-03T07:30:00Z'});assert.deepEqual(small.premiumInputs,[],'Oregon additions of at most thirty minutes do not earn change pay')
  }
  prior=policy
 }
 const state=await h.state()
 await unchanged(()=>h.cmd('fairwork.preview',{...input,exception:'Emergency'},h.owner,409))
 await unchanged(()=>h.cmd('fairwork.preview',{...input,shiftRevision:f.shift.revision+1},h.owner,409))
 await unchanged(()=>h.cmd('fairwork.preview',{...input,reason:''},h.owner,400))
 const full=await record('fairwork.save',coverage('Seattle',{revision:prior.revision,industry:'full-service-restaurant',locations:39}));assert.equal(full.covered,false)
 const qualifies=await record('fairwork.save',coverage('Seattle',{revision:full.revision,industry:'full-service-restaurant',locations:40}));assert.equal(qualifies.covered,true)
 const wrong=await record('fairwork.save',coverage('Oregon',{revision:qualifies.revision,industry:'construction'}));assert.equal(wrong.covered,false)
 const unknown=await record('fairwork.save',coverage('Unlisted city',{revision:wrong.revision}));assert.equal(unknown.covered,false);assert.match(unknown.label,/unmaintained/)
 await unchanged(()=>h.cmd('fairwork.save',coverage('Seattle',{revision:1}),h.owner,409))
 await unchanged(()=>h.cmd('fairwork.save',coverage('Seattle',{revision:unknown.revision,reason:''}),h.owner,400))
 for(const cookie of [f.manager.cookie,f.maya.cookie]){const hidden=await h.state(cookie);assert.deepEqual(hidden.fairworkpolicies,[]);assert.deepEqual(hidden.fairworkreviews,[])}
 const agent=await h.cmd('agent.create',{label:'synthetic-lanyard-1'}),headers={authorization:`Bearer ${agent.token}`}
 const agentContext=await h.send('/api/lanyard/agent/context',undefined,'',headers);assert.equal(agentContext.status,200);assert.deepEqual(agentContext.value.fairworkpolicies,[]);assert.deepEqual(agentContext.value.fairworkreviews,[])
 for(const [name,body]of [['fairwork.save',coverage('Seattle',{revision:unknown.revision})],['fairwork.preview',input]])await unchanged(async()=>{const r=await h.send('/api/lanyard/agent/command',{name,input:body},'',headers);assert.equal(r.status,403)})
 const active=(await h.state()).staff.find(p=>p.id===f.manager.id)
 await h.cmd('staff.save',{...active,active:false,hourlyRate:undefined,hourlyRateCents:undefined,erasedAt:undefined})
 for(const [name,body]of [['fairwork.save',coverage('Seattle',{revision:unknown.revision})],['fairwork.preview',input]])await unchanged(()=>h.cmd(name,body,f.manager.cookie,403))
 const current=await h.state()
 for(const receipt of receipts.filter(r=>r.name==='fairwork.preview'))assert.deepEqual(current.fairworkreviews.find(r=>r.id===receipt.value.id),receipt.value,'later coverage decisions cannot rewrite earlier consequences or cited facts')
 const raceReasons=['First reviewed revision','Second reviewed revision']
 const races=await Promise.all(raceReasons.map(reason=>h.send('/api/lanyard/command',{name:'fairwork.save',input:coverage('Seattle',{revision:unknown.revision,reason})},h.owner)))
 assert.deepEqual(races.map(r=>r.status).sort(),[200,409],'concurrent decisions accept exactly one current revision')
 const winner=races.find(r=>r.status===200).value.result,afterRace=await h.state()
 assert.equal(afterRace.version,current.version+1)
 const raceEvents=afterRace.events.filter(e=>!current.events.some(old=>old.id===e.id))
 assert.equal(raceEvents.length,1);assert.deepEqual(raceEvents.map(({id,...e})=>e),[{actorId:owner.id,actorRole:'owner',action:'fairwork.save',entityId:winner.id,at:new Date(now).toISOString()}],'losing concurrent decision leaves no orphan audit')
 assert.equal(winner.reason,raceReasons[races.findIndex(r=>r.status===200)],'the retained reason belongs to the accepted concurrent request')
 assert.equal(winner.by,owner.id);assert.equal(winner.at,new Date(now).toISOString());assert.equal(winner.site,site)
 assert.deepEqual(afterRace.fairworkpolicies,[winner],'the durable coverage and response identify the same winning decision')
 assert.deepEqual(afterRace.fairworkpolicies[0].versions.map(v=>v.reason),[...unknown.versions.map(v=>v.reason),unknown.reason],'the losing reason leaves no coverage-history entry')
 assert.equal(winner.versions.length,unknown.versions.length+1)
 assert.deepEqual(winner.versions.at(-1),(({versions,...value})=>value)(unknown))
 assert.deepEqual(afterRace.fairworkreviews,current.fairworkreviews)
 const retained=await h.state()
 const signedOut=await h.send('/auth/signout',{},h.owner);assert.equal(signedOut.status,204)
 const renewed=await h.signIn('owner@venue.example')
 for(const [name,body]of [['fairwork.save',coverage('Seattle',{revision:winner.revision})],['fairwork.preview',input]]){
  const before=await h.state(renewed);await h.cmd(name,body,h.owner,401);assert.deepEqual(await h.state(renewed),before,'revoked owner session cannot commit a retained review')
 }
 await h.restart();const restored=await h.state(renewed);assert.equal(restored.fairworkreviews.length,10);assert.equal(restored.fairworkpolicies[0].id,unknown.id)
 assert.deepEqual(restored.fairworkpolicies,retained.fairworkpolicies);assert.deepEqual(restored.fairworkreviews,retained.fairworkreviews);assert.deepEqual(restored.events,retained.events,'audit and decisions survive restart together')
 assert.equal(receipts.length,20,'all accepted coverage and consequence operations were checked')
 assert.deepEqual(restored.shifts,state.shifts,'consequence review does not publish a proposed change');assert.equal(restored.batches.length,0)
 }finally{await h.close()}
}
export async function fairworkBrowser({widths=[1440]}={}){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of widths){
 const h=await harness({now}),context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse(now))}})
 try{
  const f=await fixture(h);await h.cmd('fairwork.save',coverage('Seattle'))
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  await browserAssets(context)
  const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
  const page=await context.newPage();await page.goto(h.origin+'/app/settings?site='+encodeURIComponent(site),{waitUntil:'networkidle'})
  const account=page.getByLabel('Account',{exact:true});await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
  const panel=page.locator('#fairwork');await panel.scrollIntoViewIfNeeded()
  assert.match(await panel.locator('[data-fairwork-coverage]').innerText(),/Covered/)
   const form=panel.locator('[data-fairwork-preview]');await form.getByLabel('Published shift',{exact:true}).selectOption(f.shift.id+'|'+f.shift.revision)
  await form.getByLabel('Proposed start',{exact:true}).fill('2026-11-03T07:00');await form.getByLabel('Proposed end',{exact:true}).fill('2026-11-03T12:00');await form.getByLabel('Change review reason',{exact:true}).fill('Earlier opening requested for the Pike Street market event')
  await form.getByRole('button',{name:'Record consequence preview',exact:true}).click();await page.waitForLoadState('networkidle')
  assert.equal(await page.locator('.notice.error').count(),0)
  const record=page.locator('[data-fairwork-review]').first();await record.evaluate(el=>el.scrollIntoView({block:'start'}))
  const text=await record.innerText();assert.match(text,/Employee consent required/);assert.match(text,/Short rest requires review/);assert.match(text,/60 minutes × 1/);assert.match(text,/1 posting records linked/)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  if(process.env.FAIRWORK_SCREENS){await mkdir(process.env.FAIRWORK_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.FAIRWORK_SCREENS,`review-${width}.png`)});await panel.locator('[data-fairwork-coverage]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:join(process.env.FAIRWORK_SCREENS,`coverage-${width}.png`)})}
  const cancelForm=panel.locator('[data-fairwork-preview]');await cancelForm.getByLabel('Published shift',{exact:true}).selectOption(f.shift.id+'|'+f.shift.revision);await cancelForm.getByLabel('Proposed change',{exact:true}).selectOption('cancel');await cancelForm.getByLabel('Change review reason',{exact:true}).fill('Review cancellation before publishing any change')
  await cancelForm.getByRole('button',{name:'Record consequence preview',exact:true}).click();await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0)
  const canceled=page.locator('[data-fairwork-review]').first();assert.match(await canceled.innerText(),/lost-hours · 240 minutes × 0.5/);await canceled.evaluate(el=>el.scrollIntoView({block:'start'}))
  if(process.env.FAIRWORK_SCREENS)await page.screenshot({path:join(process.env.FAIRWORK_SCREENS,`cancellation-${width}.png`)})
  const config=panel.locator('[data-fairwork-config]');await config.getByLabel('Fair-workweek jurisdiction',{exact:true}).selectOption('custom');await config.getByLabel('Coverage review reason',{exact:true}).fill('Unlisted city requires employer-maintained review');await config.getByRole('button',{name:'Save coverage review',exact:true}).click();await page.waitForLoadState('networkidle');assert.match(await page.locator('[data-fairwork-coverage]').innerText(),/unmaintained/)
  if(process.env.FAIRWORK_SCREENS){await page.locator('[data-fairwork-coverage]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:join(process.env.FAIRWORK_SCREENS,`unmaintained-${width}.png`)})}
 }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

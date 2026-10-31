import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {optimizationFixture} from './fairness-optimization-fixture.mjs'
import {overtimeFixture} from './tradeoff-journey.mjs'
import {days,local,pin} from './workforce-journey.mjs'

const grant={label:'Comparison planner',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true}
const scopedPath=f=>f.path.replace('/fairness/','/agent/fairness/')
async function read(h,f,key,status=200,headers={}) {
 const r=await h.send(scopedPath(f),undefined,'',{authorization:`Bearer ${key.token}`,...headers})
 assert.equal(r.status,status,r.text);return r
}
function privateFieldsAbsent(value,people) {
 function walk(v,path=[]) {
  if(!v||typeof v!=='object')return
  for(const [key,child] of Object.entries(v)){
   assert.ok(!/rate|payroll|contact|qualification|certification|feedback|protected|digest|preferredMinutes|payGroup|inputs|patterns|requests|offerIds|request(ed)?Share|offeredShare/i.test(key),`Forbidden ${[...path,key].join('.')}`)
   if(/requestedMinutes|offeredMinutes/i.test(key))assert.ok(['totalOfferedMinutes','totalRequestedMinutes'].includes(key),key)
   if(key==='cents')assert.ok(['known','small-cell','unknown'].includes(v.status),'Cents only occur in an alternative-level Money cell')
   walk(child,[...path,key])
  }
 }
 walk(value)
 const text=JSON.stringify(value)
 for(const p of people)for(const privateValue of [p.name,p.email,p.payrollId])assert.ok(!text.includes(privateValue),privateValue)
}
function moneyEquals(cell,native,contributors) {
 assert.equal(cell.status,native===null?'unknown':contributors<3?'small-cell':'known')
 assert.equal(cell.cents,cell.status==='known'?native:null)
 if(cell.status==='unknown')assert.ok(cell.reasons.length)
}
function fairnessEquals(a,n) {
 assert.deepEqual(a.measures.totals,n.measures.totals)
 assert.deepEqual(a.assignments,n.assignments)
 assert.deepEqual(a.coverage,n.coverage)
 for(const p of a.measures.people){const source=n.measures.rows.find(x=>x.staffId===p.staffId&&x.week===p.week&&x.cohortId===p.cohortId);assert.equal(p.gapMinutes,source.gapMinutes);assert.equal(p.preferNotShifts,source.preferNotShifts)}
 for(const group of a.measures.undesirable.groups){const source=n.measures.undesirable.groups.find(x=>x.position===group.position);assert.equal(group.spread,source.spread);assert.deepEqual(group.counts.map(x=>[x.staffId,x.count]),source.counts.map(x=>[x.staffId,x.count]))}
 for(const group of a.measures.equity.groups){const source=n.measures.equity.groups.find(x=>x.position===group.position);assert.equal(group.totalOfferedMinutes,source.totalOfferedMinutes);assert.equal(group.totalRequestedMinutes,source.totalRequestedMinutes);assert.ok(!('rows' in group))}
 for(const g of a.scheduledOvertime.groups){const source=n.scheduledOvertime.groups.find(x=>x.staffId===g.staffId&&x.week===g.week);assert.equal(g.overtimeMinutes,source.overtimeMinutes);assert.deepEqual(g.reasons,source.reasons)}
}
export async function comparisonScopeApi(h) {
 const f=await optimizationFixture(h),plain=await h.cmd('agent.create',{label:'Preparation only'})
 assert.deepEqual(plain.scopes,[]);assert.deepEqual(plain.cafes,[])
 await read(h,f,plain,404)
 for(const cookie of [f.manager.cookie,f.alex.cookie])await h.cmd('agent.create',grant,cookie,403)
 for(const input of [{...grant,comparisonConsent:false},{...grant,cafes:[]},{...grant,cafes:['*']},{...grant,cafes:['Other cafe']},{...grant,scopes:['wages.read']},{...grant,scopes:[]}])await h.cmd('agent.create',input,h.owner,400)
 const csv='staff_id,name,email,payroll_id\nsynthetic-scope-import,Synthetic import,scope-import@venue.example,SYNTHETIC-IMPORT\n'
 const preview=await h.cmd('import.preview',{csv});await h.cmd('import.apply',{csv,fingerprint:preview.fingerprint})
 await read(h,f,plain,404)
 const creation={...grant,requestId:'synthetic-comparison-creation'}
 const key=await h.cmd('agent.create',creation),repeat=await h.cmd('agent.create',creation)
 assert.equal(repeat.id,key.id);assert.ok(!('token' in repeat),'A repeated creation never returns a credential again')
 await h.cmd('agent.create',{...creation,label:'Changed grant'},h.owner,409)
 const native=await f.read(),before=await h.state()
 const r=await read(h,f,key),v=r.value
 assert.equal(v.status,'known');privateFieldsAbsent(v,[f.alex,f.ben,f.manager,f.foreign])
 for(const priority of ['low','high']){fairnessEquals(v[priority],native[priority]);moneyEquals(v[priority].cost.total,native[priority].cost.costCents,1);moneyEquals(v[priority].scheduledOvertime.premium,native[priority].scheduledOvertime.premiumCents,0)}
 assert.equal(v.difference.cost.status,'small-cell');assert.equal(v.difference.cost.cents,null)
 assert.equal((await h.send(scopedPath(f).replace('Ocean%20Beach','Mission'),undefined,'',{authorization:`Bearer ${key.token}`})).status,404)
 assert.equal((await h.send(scopedPath(f),undefined,h.owner)).status,401,'Browser owner authority cannot grant a scoped bearer read')
 assert.equal((await h.send(f.path,undefined,'',{authorization:`Bearer ${key.token}`})).status,401,'Scoped bearer cannot read raw native comparison')
 assert.equal((await h.send('/api/lanyard/agent/fairness',undefined,'',{authorization:`Bearer ${key.token}`})).status,404)
 for(const name of ['fairness.prepare','roster.publish','agent.create'])for(const path of ['/api/lanyard/agent/command','/api/lanyard/command']){
  const result=await h.send(path,{name,input:{week:f.week,site:'Ocean Beach',digest:native.digest,priority:'high'}},'',{authorization:`Bearer ${key.token}`});assert.equal(result.status,path.includes('/agent/')?403:401)
 }
 const after=await h.state();assert.deepEqual(after.rosters,before.rosters);assert.deepEqual(after.shifts,before.shifts);assert.equal(after.version,before.version)
 const event=after.events.find(e=>e.action==='comparison.read');assert.deepEqual(JSON.parse(event.entityId),{keyId:key.id,site:'Ocean Beach',week:f.week});assert.equal(event.actorRole,'agent')
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 const ownerPage=await h.send('/app/agent',undefined,h.owner);assert.ok(ownerPage.text.includes('Comparison read activity'));assert.ok(ownerPage.text.includes(f.week))
 assert.equal((await h.state(f.manager.cookie)).events.some(e=>e.id===event.id),false)
 const context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.equal(context.status,200);assert.deepEqual(context.value.fairnesscohorts,[]);assert.deepEqual(context.value.agentKeys,[])
 // Real credential expiry against the clock edge, including the exclusive expiry boundary.
 await read(h,f,key,200,{'x-test-now':String(key.expiresAt-1)})
 await read(h,f,key,401,{'x-test-now':String(key.expiresAt)})
 await h.cmd('agent.revoke',{id:key.id});await read(h,f,key,401)
 const active=await h.cmd('agent.create',grant)
 // Scheduled overtime unknowns survive projection, without exposing missing rate inputs.
 const {shifts,publish}=await overtimeFixture(h,f)
 await h.cmd('paygroup.save',{name:'Sunday scope workweek',cadence:'weekly',from:days(f.week,-1),payDays:3,workweekStart:0,staffIds:[f.alex.id,f.ben.id]})
 await publish([...shifts,{staffId:f.alex.id,site:'Ocean Beach',start:local(days(f.week,6),'08:00'),end:local(days(f.week,6),'09:00'),breakMinutes:0}])
 let unknown=(await read(h,f,active)).value
 assert.equal(unknown.low.scheduledOvertime.premium.status,'unknown');assert.ok(unknown.low.scheduledOvertime.groups.some(g=>g.overtimeMinutes===null&&g.reasons.some(r=>r.includes('unpublished'))));privateFieldsAbsent(unknown,[f.alex,f.ben])
 const profile=(await h.state()).workforce.find(p=>p.staffId===f.alex.id)
 await h.cmd('workforce.save',{...pin(profile),staffId:f.alex.id,jobs:[],skills:[],certifications:[],sites:['Ocean Beach','Mission'],preferences:[],minHours:0,maxHours:60,classification:'hourly',rates:[]})
 const alex=(await h.state()).staff.find(p=>p.id===f.alex.id)
 await h.cmd('staff.save',{...pin(alex),name:alex.name,email:alex.email,payrollId:alex.payrollId,role:alex.role,active:true,site:'Ocean Beach',position:'Counter',hourlyRate:'',employmentType:'part-time'})
 await publish(shifts)
 unknown=(await read(h,f,active)).value
 assert.equal(unknown.low.cost.total.status,'unknown');assert.equal(unknown.low.scheduledOvertime.premium.status,'unknown');assert.ok(unknown.low.scheduledOvertime.groups.some(g=>g.reasons.some(r=>r.includes('base rate is missing'))))
 // Missing fairness evidence remains a reason, never a fabricated zero or schedule.
 await h.cmd('pattern.save',{from:f.week,blocks:f.full,preferredHours:'',maxHours:60},f.ben.cookie)
 unknown=(await read(h,f,active)).value
 const missing=unknown.low.measures.people.find(p=>p.staffId===f.ben.id&&p.week===f.week);assert.equal(missing.gapMinutes,null);assert.ok(missing.reasons.some(r=>r.includes('Preferred hours missing')));assert.ok(unknown.low.measures.totals.gapExcluded>0)
 await h.cmd('pattern.save',{from:f.week,blocks:f.full,preferredHours:'',maxHours:60},f.alex.cookie)
 const incomplete=await h.send(scopedPath(f)+'&weeks=1',undefined,'',{authorization:`Bearer ${active.token}`});assert.equal(incomplete.status,200);assert.equal(incomplete.value.status,'unknown');assert.equal(incomplete.value.low,null);assert.ok(incomplete.value.reasons.some(r=>r.includes('preference inputs')))
 // Owner deactivation/reactivation changes its version; even active again, old keys remain invalid.
 const ownerId=(await h.state()).actor.id
 const freshOwner=await h.signIn(h.auth.OWNER_EMAIL)
 const invite=await h.send('/auth/invite',{email:'second-owner@venue.example',displayName:'Second owner',role:'owner'},freshOwner);assert.equal(invite.status,202,invite.text)
 const second=await h.confirmMail('second-owner@venue.example')
 assert.equal((await h.send('/auth/operator/status',{operatorId:ownerId,status:'inactive'},second)).status,200)
 await read(h,f,active,401)
 assert.equal((await h.send('/auth/operator/status',{operatorId:ownerId,status:'active'},second)).status,200)
 await read(h,f,active,401)
 // At least three distinct nonzero contributors expose an aggregate, still without individual money.
 const other=await harness();try{await threePersonTotals(other)}finally{await other.close()}
}
async function threePersonTotals(h) {
 const f=await optimizationFixture(h),cy=await h.person('Cy')
 await h.cmd('staff.save',{...pin(cy),name:cy.name,email:cy.email,payrollId:cy.payrollId,role:'staff',active:true,site:'Ocean Beach',position:'Counter',hourlyRate:'30.00',employmentType:'part-time'})
 for(const p of [f.alex,f.ben,cy])await h.cmd('pattern.save',{from:f.week,blocks:f.full,preferredHours:44,maxHours:60},p.cookie)
 await h.cmd('pattern.save',{from:f.first,blocks:f.full,preferredHours:44,maxHours:60},cy.cookie)
 const cohort=(await h.state()).fairnesscohorts[0]
 await h.cmd('fairness.cohort.save',{...pin(cohort),site:'Ocean Beach',position:'Counter',from:f.first,staffIds:[f.alex.id,f.ben.id,cy.id]})
 await h.cmd('fairness.request.save',{staffId:cy.id,from:f.first,minutes:120},cy.cookie)
 const shifts=[f.alex,f.ben,cy].flatMap(p=>[0,1,2,3,4,5].map(d=>({staffId:p.id,site:'Ocean Beach',start:local(days(f.week,d),'08:00'),end:local(days(f.week,d),d===5?'12:00':'16:00'),breakMinutes:0})))
 const draft=await h.cmd('roster.prepare',{week:f.week,shifts});assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft))
 const key=await h.cmd('agent.create',grant),native=await f.read(),v=(await read(h,f,key)).value
 privateFieldsAbsent(v,[f.alex,f.ben,cy])
 for(const priority of ['low','high']){
  fairnessEquals(v[priority],native[priority]);moneyEquals(v[priority].cost.total,native[priority].cost.costCents,3);moneyEquals(v[priority].scheduledOvertime.premium,native[priority].scheduledOvertime.premiumCents,3)
  assert.equal(v[priority].scheduledOvertime.premium.cents,15000,'Three four-hour premiums at $20, $25 and $30 hourly')
 }
 assert.equal(v.difference.cost.status,'small-cell','Zero changed people cannot disclose a difference as zero')
}

export async function comparisonScopeBrowser() {
 const browser=await chromium.launch({headless:true,...(process.env.LANYARD_CHROMIUM?{executablePath:process.env.LANYARD_CHROMIUM}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await optimizationFixture(h),page=await context.newPage()
   await context.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname
    if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   // Synthetic native session created through this test's invitation/bootstrap doors.
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.TRADEOFF_SCREENS){await mkdir(process.env.TRADEOFF_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.TRADEOFF_SCREENS,`${key}-${width}.png`),fullPage:true})}}
   await page.goto(h.origin+'/app/agent',{waitUntil:'networkidle'})
   const form=page.locator('form[action*="name=agent.create"]')
   assert.equal(await form.getByRole('checkbox',{name:'Allow comparison.read',exact:true}).isChecked(),false)
   assert.equal(await form.getByRole('checkbox',{name:/I understand/}).isChecked(),false)
   assert.ok((await form.innerText()).includes('Repeated aggregate cost reads can narrow down individual pay'))
   await shot('comparison-consent')
   await form.getByLabel('Credential label').fill('Scoped browser planner')
   await form.getByRole('checkbox',{name:'Allow comparison.read',exact:true}).check()
   await form.getByRole('checkbox',{name:'Ocean Beach',exact:true}).check()
   await form.getByRole('button',{name:'Create agent credential'}).click();await page.waitForLoadState('networkidle')
   assert.ok((await page.locator('body').innerText()).includes('Consent to the repeated aggregate cost disclosure'))
   assert.equal((await h.state()).agentKeys.length,0)
   const retry=page.locator('form[action*="name=agent.create"]')
   await retry.getByLabel('Credential label').fill('Scoped browser planner');await retry.getByRole('checkbox',{name:'Allow comparison.read',exact:true}).check();await retry.getByRole('checkbox',{name:'Ocean Beach',exact:true}).check();await retry.getByRole('checkbox',{name:/I understand/}).check()
   await retry.getByRole('button',{name:'Create agent credential'}).click();await page.waitForLoadState('networkidle')
   const token=(await page.locator('.credential').innerText()).trim(),key=(await h.state()).agentKeys[0]
   assert.deepEqual(key.scopes,['comparison.read']);assert.deepEqual(key.cafes,['Ocean Beach'])
   await read(h,f,{token})
   await page.reload({waitUntil:'networkidle'})
   assert.equal(await page.locator('.credential').count(),0,'Reload never redisplays the credential')
   assert.equal((await h.state()).agentKeys.length,1,'Reload cannot create a duplicate grant')
   assert.ok((await page.locator('body').innerText()).includes(`Scoped browser planner · Ocean Beach · week ${f.week}`))
   await shot('comparison-grant-activity')
   await page.getByRole('button',{name:'Revoke',exact:true}).click();await page.waitForLoadState('networkidle');await read(h,f,{token},401)
   assert.ok((await page.locator('body').innerText()).includes('Revoked'));await shot('comparison-revoked')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

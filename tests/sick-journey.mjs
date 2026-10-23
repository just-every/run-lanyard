import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,local} from './workforce-journey.mjs'
const add=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
export async function sickFixture(h,preset='CA',count=2,workedHours=48){
 const alex=await h.person('Alex'),ben=await h.person('Ben'),morgan=await h.person('Morgan','manager')
 for(const p of [alex,ben,morgan])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'Ocean Beach',position:'Service',hourlyRate:'20.00',startDate:'2020-01-01'})
 const policy=await h.cmd('sickpolicy.save',{site:'Ocean Beach',from:'2025-01-01',preset,code:'SICK-'+preset})
 const entries=[]
 for(let i=0;i<count;i++){
  const start=local(add('2025-01-01',i*7),'00:00'),end=new Date(Date.parse(start)+workedHours*3600000).toISOString()
  const t=await h.cmd('time.prepare',{staffId:alex.id,start,end,site:'Ocean Beach',breakMinutes:0,reason:'Synthetic approved work for annual accrual reconciliation'})
  entries.push(await h.cmd('time.approve',pin(t)))
 }
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,morgan,policy,entries,request:{policyId:policy.id,start:local('2026-01-09','09:00'),end:local('2026-01-09','11:00'),minutes:120,purpose:policy.reasons[0]}}
}
export async function sickApi(){
 const cases=[['CA',4800,4800],['CO',2880,2880],['IL',2400,2400],['NY',3360,3360],['OR',2400,2400],['WA',3744,2400],['NYC',3360,3360],['CHICAGO',2400,2400],['SEATTLE',4992,4320],['SF',4800,4800],['LA',4800,4800],['PHILADELPHIA',2400,2400]]
 for(const [preset,earned,carried]of cases){const h=await harness();try{
  const f=await sickFixture(h,preset,52),{alex,ben,morgan,policy,entries,request}=f
  const report=async on=>{const r=await h.send('/api/lanyard/sick-balances?asOf='+on,undefined,h.owner);assert.equal(r.status,200,r.text);return r.value.find(x=>x.staffId===alex.id&&x.policyId===policy.id)}
  const before=await report('2025-12-31'),after=await report('2026-01-01')
  assert.equal(before.balanceMinutes,earned,preset+' accrual/balance cap');assert.equal(after.balanceMinutes,carried,preset+' year carryover');assert.equal(after.annualAccrued,0);assert.equal(after.annualUsed,0)
  assert.equal(before.sources.filter(x=>x.kind==='work').reduce((n,x)=>n+x.minutes,0),149760)
  assert.equal(before.sources.reduce((n,x)=>n+(x.creditedMinutes??0),0),earned)
  const use=await h.cmd('sick.request',request,alex.cookie)
  await h.cmd('leave.decide',{id:use.leaveId,revision:1,decision:'approved'},morgan.cookie,403)
  await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-6-'+preset},morgan.cookie,403)
  const paid=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-6-'+preset})
  const balance=await report('2026-01-09');assert.equal(balance.balanceMinutes,carried-120);assert.equal(balance.annualUsed,120)
  const batch=await h.cmd('payroll.prepare',{}),competing=await h.cmd('payroll.prepare',{}),line=batch.lines.find(l=>l.sickUseId===use.id)
  assert.deepEqual([line.minutes,line.costCents,line.payCode,line.balanceMinutes],[120,4000,'SICK-'+preset,carried-120])
  if(preset==='CA'){
   assert.ok(!(await h.state(morgan.cookie)).batches.some(b=>b.id===batch.id),'private paid-leave batch is owner-only')
   await h.cmd('payroll.export',pin(batch),morgan.cookie,403)
   const key=await h.cmd('agent.create',{label:'Private leave preparation fence'}),prepared=await h.send('/api/lanyard/agent/command',{name:'payroll.prepare',input:{}},'',{authorization:`Bearer ${key.token}`});assert.equal(prepared.status,200,prepared.text);assert.ok(prepared.value.result.lines.every(l=>!l.sickLine),'agent preparation does not receive private paid-leave lines')
  }
  const sent=await h.cmd('payroll.export',pin(batch));await h.cmd('payroll.export',pin(competing),h.owner,409)
  if(preset==='CA')assert.equal((await h.send('/api/lanyard/batches/'+sent.id+'.csv',undefined,morgan.cookie)).status,403)
  assert.match(sent.csv,/leave_earnings_cents,leave_balance_minutes,leave_policy_id,leave_rule_version/)
  const csv=await h.send('/api/lanyard/sick-balances.csv?asOf=2026-01-09',undefined,h.owner);assert.equal(csv.status,200);assert.ok(csv.text.includes('SICK-'+preset));assert.ok(csv.text.includes(entries[0].id));assert.ok(!csv.text.includes('purpose'))
  assert.equal((await h.send('/api/lanyard/sick-balances.csv',undefined,ben.cookie)).status,403)
  assert.equal((await h.send('/api/lanyard/sick-balances',undefined,morgan.cookie)).status,403)
  assert.ok((await h.state(ben.cookie)).sickuses.length===0);assert.ok((await h.state(morgan.cookie)).sickuses.length===0)
  if(preset==='CA'){
   const plan=await h.cmd('aca.plan.save',{name:'Paid leave reconciliation',start:'2026-01-01',end:'2026-12-31',adminEnd:'2026-12-31',stabilityEnd:'2027-12-31',staffIds:[alex.id]})
   await h.cmd('aca.credit.save',{staffId:alex.id,date:'2026-01-09',minutes:120,category:'illness',reference:paid.reference,reason:'Same source already recorded; do not duplicate'})
   const aca=(await h.send('/api/lanyard/aca/'+plan.id,undefined,h.owner)).value.rows[0];assert.equal(aca.paidLeaveMinutes,120);assert.equal(aca.sources.filter(x=>x.reference===paid.reference).length,1)
   await h.cmd('sick.correct',{...pin(paid),minutes:0,reason:'Employer-reviewed cancellation'})
   const reversal=await h.cmd('payroll.prepare',{});assert.deepEqual(reversal.lines.map(l=>[l.minutes,l.costCents]),[[-120,-4000]]);await h.cmd('payroll.export',pin(reversal));assert.equal((await report('2026-01-09')).balanceMinutes,carried)
   assert.equal((await h.send('/api/lanyard/aca/'+plan.id,undefined,h.owner)).value.rows[0].paidLeaveMinutes,0)
   // Cross-site worked time earns each location's bank once, not the employee's home bank.
   // Waiting periods and increments are enforced without creating a request.
   const person=(await h.state()).staff.find(p=>p.id===ben.id);await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site:'Ocean Beach',hourlyRate:'20.00',startDate:'2026-01-08'})
   const waiting=await h.cmd('sick.request',{...request,start:local('2026-01-10','09:00'),end:local('2026-01-10','11:00')},ben.cookie,409);assert.match(waiting.error,/Waiting period/)
   const increment=await h.cmd('sick.request',{...request,start:local('2026-01-10','09:00'),end:local('2026-01-10','11:00'),minutes:61},alex.cookie,409);assert.match(increment.error,/increment/)
   const second=await h.cmd('sickpolicy.save',{site:'Mission',from:'2025-01-01',preset:'WA',code:'MISSION-SICK'})
   const t=await h.cmd('time.prepare',{staffId:alex.id,start:local('2026-02-01','08:00'),end:local('2026-02-01','16:00'),site:'Mission',breakMinutes:0,reason:'Actual work at second jurisdiction'});await h.cmd('time.approve',pin(t))
   const both=(await h.send('/api/lanyard/sick-balances?asOf=2026-02-01',undefined,h.owner)).value.filter(x=>x.staffId===alex.id);assert.equal(both.find(x=>x.policyId===second.id).balanceMinutes,12);assert.equal(both.find(x=>x.policyId===policy.id).balanceMinutes,carried)
   const approved=(await h.state()).timesheets.find(x=>x.id===t.id),correction=await h.cmd('time.prepare',{staffId:alex.id,start:t.start,end:local('2026-02-01','12:00'),breakMinutes:0,corrects:approved.id,reason:'Corrected second-site work'})
   assert.equal((await h.send('/api/lanyard/sick-balances?asOf=2026-02-01',undefined,h.owner)).value.find(x=>x.staffId===alex.id&&x.policyId===second.id).balanceMinutes,12,'pending correction does not accrue')
   await h.cmd('time.approve',pin(correction));assert.equal((await h.send('/api/lanyard/sick-balances?asOf=2026-02-01',undefined,h.owner)).value.find(x=>x.staffId===alex.id&&x.policyId===second.id).balanceMinutes,6,'current corrected source accrues once')
   const unlisted=await h.cmd('sickpolicy.save',{site:'Unlisted city',from:'2025-01-01',preset:'employer',code:'CUSTOM',denominator:40,annualAccrual:2400,bankCap:4800,carry:2400,annualUse:2400,wait:90,increment:60});assert.equal(unlisted.label,'Employer-configured, unmaintained')
   const agent=await h.cmd('agent.create',{label:'Paid leave test'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`});assert.deepEqual(context.value.sickuses,[]);assert.deepEqual(context.value.sickBalances,[])
   await h.cmd('sickpolicy.save',{},alex.cookie,403)
   await h.cmd('earnings.save',{estimates:false,statementUrl:'',payDays:''});const hidden=await h.state(alex.cookie);assert.ok(hidden.sickBalances.every(b=>b.sources.every(s=>s.rateCents===undefined&&s.costCents===undefined)));assert.ok(hidden.sickuses.every(u=>u.rateCents===undefined&&u.costCents===undefined))
  }
 }finally{await h.close()}}
}
export async function sickBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
 try{const f=await sickFixture(h,'CA',12,8),page=await context.newPage()
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.C35_SCREENS){await mkdir(process.env.C35_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C35_SCREENS,`${name}-${width}.png`)})}}
 await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'});const card=page.locator('#sick-policies');await card.getByText('Add a leave policy',{exact:true}).click();const form=card.locator('form').filter({has:page.getByRole('button',{name:'Save leave policy',exact:true})}).last();await form.getByLabel('Cafe',{exact:true}).fill('Unlisted city');await form.getByLabel('Effective from',{exact:true}).fill('2025-01-01');await form.getByLabel('Jurisdiction preset').selectOption('employer');await form.getByLabel('Mapped leave payroll code').fill('CUSTOM');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),form.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);await page.locator('#sick-policies').getByText('Unlisted city · employer · 2025-01-01',{exact:true}).click();assert.ok((await page.locator('#sick-policies').innerText()).includes('Employer-configured, unmaintained'));await page.locator('#sick-policies').scrollIntoViewIfNeeded();await shot('sick-policy')
 await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2026-01-05',{waitUntil:'networkidle'});await page.locator('#sick-own').getByText('Request partial-day paid leave',{exact:true}).click();const request=page.locator('#sick-own form');await request.getByLabel('Absence begins').fill('2026-01-09T09:00');await request.getByLabel('Absence ends').fill('2026-01-09T11:00');await request.getByLabel('Paid minutes',{exact:true}).fill('120');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.request')),request.getByRole('button',{name:'Request paid leave'}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);assert.ok((await page.locator('#sick-own').innerText()).includes('2.0 hrs pending'));await page.locator('#sick-own').scrollIntoViewIfNeeded();await shot('sick-own-request')
 await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'});const approve=page.locator('#sick-policies form').filter({has:page.getByRole('button',{name:'Approve paid leave',exact:true})});await approve.getByLabel('Paid-service source reference').fill('synthetic-lanyard-7');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.decide')),approve.getByRole('button',{name:'Approve paid leave',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);await page.locator('#sick-policies').scrollIntoViewIfNeeded();await shot('sick-approved')
 const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(batch));await page.reload({waitUntil:'networkidle'});assert.ok((await page.locator('.batch').first().innerText()).includes('paid leave, not worked time'));await page.locator('.batch').first().scrollIntoViewIfNeeded();await shot('sick-export')
 const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('sick-tooltip')
 await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2026-01-05',{waitUntil:'networkidle'});assert.ok((await page.locator('#earnings').innerText()).includes('Paid sick / safe leave (approved)'));assert.ok((await page.locator('#earnings').innerText()).includes('$40.00'));await page.locator('#earnings').scrollIntoViewIfNeeded();await shot('sick-earnings')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,local} from './workforce-journey.mjs'
const add=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10)
export async function sickFixture(h,preset='CA',count=2,workedHours=48,options={}){
 const alex=await h.person('Alex'),ben=await h.person('Ben'),morgan=await h.person('Morgan','manager')
 for(const p of [alex,ben,morgan])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'Ocean Beach',position:'Service',hourlyRate:'20.00',startDate:'2020-01-01'})
 const policy=await h.cmd('sickpolicy.save',{site:'Ocean Beach',from:'2025-01-01',preset,code:'SICK-'+preset,...(options.normalDayMinutes?{normalDayMinutes:options.normalDayMinutes}:{})})
 const entries=[]
 for(let i=0;i<count;i++){
  const start=local(add('2025-01-01',i*(options.spacingDays??7)),'00:00'),end=new Date(Date.parse(start)+workedHours*3600000).toISOString()
  const t=await h.cmd('time.prepare',{staffId:alex.id,start,end,site:'Ocean Beach',breakMinutes:0,reason:'Synthetic approved work for annual accrual reconciliation'})
  entries.push(await h.cmd('time.approve',pin(t)))
 }
 const setup=await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded',...(options.now?{'x-test-now':String(Date.parse(options.now))}:{})},body:'confirm=yes',redirect:'manual'});await setup.arrayBuffer()
 return {alex,ben,morgan,policy,entries,request:{policyId:policy.id,start:local('2026-01-09','09:00'),end:local('2026-01-09','11:00'),minutes:120,purpose:policy.reasons[0]}}
}
export async function sickApi(){
 const cases=[['CA',4800,4800],['CO',2880,2880],['IL',2400,2400],['NY',3360,3360],['NY40',2400,2400],['OR',2400,2400],['WA',3744,2400],['NYC',3360,3360],['NYC40',2400,2400],['CHICAGO',2400,2400],['SEATTLE',4992,4320],['SEATTLE1',3744,2400],['SEATTLE2',3744,3360],['SEATTLE_PTO1',5616,2400],['SEATTLE_PTO2',5616,3360],['SEATTLE_PTO3',7488,6480],['SF',4800,4800],['LA',4800,4800],['PHILADELPHIA',2400,2400]]
 for(const [preset,earned,carried]of cases){const h=await harness();try{
  const combined=preset.startsWith('SEATTLE_PTO'),count=combined?78:52
  const f=await sickFixture(h,preset,count,48,combined?{spacingDays:4}:{}),{alex,ben,morgan,policy,entries,request}=f
  const report=async on=>{const r=await h.send('/api/lanyard/sick-balances?asOf='+on,undefined,h.owner);assert.equal(r.status,200,r.text);return r.value.find(x=>x.staffId===alex.id&&x.policyId===policy.id)}
  const before=await report('2025-12-31'),after=await report('2026-01-01')
  assert.equal(before.balanceMinutes,earned,preset+' accrual/balance cap');assert.equal(after.balanceMinutes,carried,preset+' year carryover');assert.equal(after.annualAccrued,0);assert.equal(after.annualUsed,0)
  assert.equal(before.sources.filter(x=>x.kind==='work').reduce((n,x)=>n+x.minutes,0),count*48*60)
  assert.equal(before.sources.reduce((n,x)=>n+(x.creditedMinutes??0),0),earned)
  const use=await h.cmd('sick.request',{...request,...(combined?{purpose:'employer-approved PTO'}:{})},alex.cookie)
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
   // The California catalog includes the state-floor purposes, with no medical
   // free text. Correcting each reviewed use keeps the balance probe independent.
   for(const [i,purpose]of ['preventive care','jury duty','court witness'].entries()){
    const day=add('2026-01-20',i),u=await h.cmd('sick.request',{...request,start:local(day,'09:00'),end:local(day,'10:00'),minutes:60,purpose},alex.cookie)
    const decided=await h.cmd('sick.decide',{...pin(u),decision:'approved',reference:'synthetic-lanyard-70-'+i})
    assert.equal(decided.purpose,purpose);assert.equal(decided.minutes,60)
    await h.cmd('sick.correct',{...pin(decided),minutes:0,reason:'Reviewed category proof cancellation'})
   }
   const refusedPurpose=await h.cmd('sick.request',{...request,start:local('2026-01-25','09:00'),end:local('2026-01-25','10:00'),minutes:60,purpose:'Unlisted category'},alex.cookie,400);assert.match(refusedPurpose.error,/permitted reason/)
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
   await h.cmd('earnings.save',{estimates:false,statementUrl:'',payDays:''});const hidden=await h.state(alex.cookie);assert.ok(hidden.sickBalances.every(b=>b.sources.every(s=>s.rateCents===undefined&&s.costCents===undefined)));assert.ok(hidden.sickuses.every(u=>u.rateCents===undefined&&u.costCents===undefined));assert.doesNotMatch(JSON.stringify([hidden.sickuses,hidden.sickBalances]),/"(?:rateCents|costCents)":/,'estimate-off redaction includes retained leave correction versions, not just the current amount')
  }
 }finally{await h.close()}}
 await sickDayFloors()
 await sickUnpaid()
 await sickReasons()
 await sickSupplement()
 await sickPrenatal()
}
export async function sickBrowser(){
 const now='2026-10-27T12:00:00Z'
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox',...['--use-mock-keychain','--password-store=basic']]})
 try{for(const width of process.env.C35_SCREENS?[1440,390]:[1440]){const h=await harness({now}),context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse(now))}})
 try{const f=await sickFixture(h,'CA',12,8,{now}),page=await context.newPage()
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.C35_SCREENS){await mkdir(process.env.C35_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C35_SCREENS,`${name}-${width}.png`)})}}
 await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'});const card=page.locator('#sick-policies');await card.getByText('Ocean Beach · CA · 2025-01-01',{exact:true}).click();const california=card.locator('details[open] form').first();await california.getByLabel('Effective from',{exact:true}).fill('2025-01-02');await california.getByLabel('Longest normal workday at this cafe (minutes)').fill('600');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),california.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));const saved=(await h.state()).sickpolicies.find(p=>p.id===f.policy.id);assert.deepEqual([saved.normalDayMinutes,saved.annualUse,saved.bankCap,saved.carry],[600,3000,6000,6000]);assert.equal(saved.versions[0].normalDayMinutes,480);await card.getByText('Ocean Beach · CA · 2025-01-02',{exact:true}).click();await card.locator('details[open] form').first().scrollIntoViewIfNeeded();await shot('sick-normal-day');await card.getByText('Add a leave policy',{exact:true}).click();const form=card.locator('form').filter({has:page.getByRole('button',{name:'Save leave policy',exact:true})}).last();await form.getByLabel('Cafe',{exact:true}).fill('Unlisted city');await form.getByLabel('Effective from',{exact:true}).fill('2025-01-01');await form.getByLabel('Jurisdiction preset').selectOption('employer');await form.getByLabel('Mapped leave payroll code').fill('CUSTOM');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),form.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));await page.locator('#sick-policies').getByText('Unlisted city · employer · 2025-01-01',{exact:true}).click();assert.ok((await page.locator('#sick-policies').innerText()).includes('Employer-configured, unmaintained'));await page.locator('#sick-policies').scrollIntoViewIfNeeded();await shot('sick-policy')
 await card.getByText('Add a leave policy',{exact:true}).click();const combined=card.locator('form').last();await combined.getByLabel('Cafe',{exact:true}).fill('Seattle');await combined.getByLabel('Effective from',{exact:true}).fill('2025-01-01');await combined.getByLabel('Jurisdiction preset').selectOption('SEATTLE_PTO3');await combined.getByLabel('Mapped leave payroll code').fill('PTO');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),combined.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));const pto=(await h.state()).sickpolicies.find(p=>p.site==='Seattle');assert.deepEqual([pto.preset,pto.denominator,pto.carry,pto.annualUse],['SEATTLE_PTO3',30,6480,null]);await card.getByText('Seattle · SEATTLE_PTO3 · 2025-01-01',{exact:true}).click();await card.locator('details[open]').last().scrollIntoViewIfNeeded();await shot('sick-combined-pto')
 await card.getByText('Add a leave policy',{exact:true}).click();const unpaid=card.locator('form').last();await unpaid.getByLabel('Cafe',{exact:true}).fill('Small Oregon');await unpaid.getByLabel('Effective from',{exact:true}).fill('2025-01-01');await unpaid.getByLabel('Jurisdiction preset').selectOption('OR_UNPAID');await unpaid.getByLabel('Mapped leave payroll code').fill('UNPAID-OR');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),unpaid.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));await card.getByText('Small Oregon · OR_UNPAID · 2025-01-01',{exact:true}).click();await card.locator('details[open]').last().scrollIntoViewIfNeeded();assert.ok((await card.innerText()).includes('unpaid protected time'));await shot('sick-unpaid-policy')
 const work=await h.cmd('time.prepare',{staffId:f.alex.id,start:local('2026-01-02','08:00'),end:local('2026-01-03','14:00'),site:'Small Oregon',breakMinutes:0,reason:'Cross-site unpaid eligibility bank'});await h.cmd('time.approve',pin(work))
 await card.getByText('Add a leave policy',{exact:true}).click();const supplemental=card.locator('form').last();await supplemental.getByLabel('Cafe',{exact:true}).fill('NYC');await supplemental.getByLabel('Effective from',{exact:true}).fill('2026-02-22');await supplemental.getByLabel('Jurisdiction preset').selectOption('NYC_UPFRONT');await supplemental.getByLabel('Mapped leave payroll code').fill('UNPAID-NYC');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),supplemental.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));await card.getByText('NYC · NYC_UPFRONT · 2026-02-22',{exact:true}).click();assert.ok((await card.innerText()).includes('32.0 hrs immediately available each calendar year'));await card.getByText('NYC · NYC_UPFRONT · 2026-02-22',{exact:true}).scrollIntoViewIfNeeded();await shot('sick-supplemental-policy')
 await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2026-01-05',{waitUntil:'networkidle'});const own=page.locator(`[data-policy-id="${f.policy.id}"]`);await own.getByText('Request partial-day paid leave',{exact:true}).click();const request=own.locator('form');await request.getByLabel('Absence begins').fill('2026-01-09T09:00');await request.getByLabel('Absence ends').fill('2026-01-09T11:00');await request.getByLabel('Paid minutes',{exact:true}).fill('120');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.request')),request.getByRole('button',{name:'Request paid leave'}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));assert.ok((await page.locator('#sick-own').innerText()).includes('2.0 hrs pending'));await page.locator('#sick-own').scrollIntoViewIfNeeded();await shot('sick-own-request')
 await page.locator('#sick-own').getByText('Request partial-day unpaid leave',{exact:true}).click();const unpaidRequest=page.locator('#sick-own form').filter({has:page.getByRole('button',{name:'Request unpaid leave',exact:true})});await unpaidRequest.getByLabel('Absence begins').fill('2026-01-10T09:00');await unpaidRequest.getByLabel('Absence ends').fill('2026-01-10T10:00');await unpaidRequest.getByLabel('Unpaid minutes',{exact:true}).fill('60');await unpaidRequest.getByLabel('Permitted purpose').selectOption('blood donation');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.request')),unpaidRequest.getByRole('button',{name:'Request unpaid leave',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));await page.locator('#sick-own').scrollIntoViewIfNeeded();await shot('sick-unpaid-request')
 await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'});const approve=page.locator('#sick-policies form').filter({has:page.getByRole('button',{name:'Approve paid leave',exact:true})});await approve.getByLabel('Paid-service source reference').fill('synthetic-lanyard-7');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.decide')),approve.getByRole('button',{name:'Approve paid leave',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));await page.locator('#sick-policies').scrollIntoViewIfNeeded();await shot('sick-approved')
 const unpaidApprove=page.locator('#sick-policies form').filter({has:page.getByRole('button',{name:'Approve unpaid leave',exact:true})});await unpaidApprove.getByLabel('Leave source reference').fill('synthetic-lanyard-8');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.decide')),unpaidApprove.getByRole('button',{name:'Approve unpaid leave',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));const unpaidUse=(await h.state()).sickuses.find(u=>u.paid===false);assert.deepEqual([unpaidUse.status,unpaidUse.minutes,unpaidUse.costCents],['approved',60,0]);await page.locator('#sick-policies').scrollIntoViewIfNeeded();await shot('sick-unpaid-approved')
 await card.getByText('Add a leave policy',{exact:true}).click();const prenatalForm=card.locator('form').filter({has:page.getByRole('button',{name:'Save leave policy',exact:true})}).last();await prenatalForm.getByLabel('Cafe',{exact:true}).fill('Ocean Beach');await prenatalForm.getByLabel('Effective from',{exact:true}).fill('2025-01-01');await prenatalForm.getByLabel('Jurisdiction preset').selectOption('NY_PRENATAL');await prenatalForm.getByLabel('Mapped leave payroll code').fill('PRENATAL');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sickpolicy.save')),prenatalForm.getByRole('button',{name:'Save leave policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));const prenatal=(await h.state()).sickpolicies.find(p=>p.preset==='NY_PRENATAL');await card.getByText('Ocean Beach · NY_PRENATAL · 2025-01-01',{exact:true}).click();await card.getByText('Ocean Beach · NY_PRENATAL · 2025-01-01',{exact:true}).scrollIntoViewIfNeeded();await shot('sick-prenatal-policy')
 await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2026-01-12',{waitUntil:'networkidle'});const prenatalOwn=page.locator(`[data-policy-id="${prenatal.id}"]`);await prenatalOwn.getByText('Request partial-day paid leave',{exact:true}).click();const prenatalRequest=prenatalOwn.locator('form');await prenatalRequest.getByLabel('Absence begins').fill('2026-01-12T09:00');await prenatalRequest.getByLabel('Absence ends').fill('2026-01-12T10:00');await prenatalRequest.getByLabel('Paid minutes',{exact:true}).fill('60');await prenatalRequest.getByLabel('Permitted purpose').selectOption('prenatal care');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.request')),prenatalRequest.getByRole('button',{name:'Request paid leave',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));await page.locator(`[data-policy-id="${prenatal.id}"]`).scrollIntoViewIfNeeded();await shot('sick-prenatal-request')
 await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'});const prenatalApprove=page.locator('#sick-policies form').filter({has:page.getByRole('button',{name:'Approve paid leave',exact:true})});await prenatalApprove.getByLabel('Paid-service source reference').fill('synthetic-lanyard-9');await Promise.all([page.waitForResponse(r=>r.url().includes('name=sick.decide')),prenatalApprove.getByRole('button',{name:'Approve paid leave',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,(await page.locator('.notice.error').allTextContents()).join('; '));assert.equal((await h.state()).sickuses.find(u=>u.policyId===prenatal.id).costCents,2000);await card.scrollIntoViewIfNeeded();await shot('sick-prenatal-approved')
 const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(batch));await page.reload({waitUntil:'networkidle'});assert.ok((await page.locator('.batch').first().innerText()).includes('paid leave, not worked time'));await page.locator('.batch').first().scrollIntoViewIfNeeded();await shot('sick-export')
 const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('sick-tooltip')
 await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2026-01-05',{waitUntil:'networkidle'});assert.ok((await page.locator('#earnings').innerText()).includes('Paid sick / safe leave (approved)'));assert.ok((await page.locator('#earnings').innerText()).includes('$40.00'));await page.locator('#earnings').scrollIntoViewIfNeeded();await shot('sick-earnings')
 await page.goto(h.origin+'/app/time?week=2026-01-12',{waitUntil:'networkidle'});assert.ok((await page.locator('#earnings').innerText()).includes('$20.00'));assert.ok((await page.locator(`[data-policy-id="${prenatal.id}"]`).innerText()).includes('next bank available 2027-01-11'));await page.locator(`[data-policy-id="${prenatal.id}"]`).scrollIntoViewIfNeeded();await shot('sick-prenatal-balance')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

async function sickDayFloors(){
 const h=await harness()
 try{
  const {alex,policy}=await sickFixture(h,'CA',78,48,{normalDayMinutes:600,spacingDays:4})
  assert.deepEqual([policy.annualUse,policy.bankCap,policy.carry],[3000,6000,6000],'five and ten ten-hour normal days exceed the hour floors')
  const report=(await h.send('/api/lanyard/sick-balances?asOf=2026-01-01',undefined,h.owner)).value.find(r=>r.staffId===alex.id)
  assert.equal(report.balanceMinutes,6000,'100-hour bank survives the year boundary')
  for(let i=0;i<5;i++){
   const day=add('2026-01-09',i),use=await h.cmd('sick.request',{policyId:policy.id,start:local(day,'08:00'),end:local(day,'18:00'),minutes:600,purpose:'illness'},alex.cookie)
   await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-30-'+i})
  }
  const capped=await h.cmd('sick.request',{policyId:policy.id,start:local('2026-01-15','09:00'),end:local('2026-01-15','10:00'),minutes:60,purpose:'illness'},alex.cookie,409)
  assert.match(capped.error,/Annual paid-leave use limit/)
  const batch=await h.cmd('payroll.prepare',{}),leave=batch.lines.filter(l=>l.sickLine)
  assert.equal(leave.reduce((n,l)=>n+l.minutes,0),3000)
  for(const preset of ['SF','LA']){
   const localPolicy=await h.cmd('sickpolicy.save',{site:preset,from:'2025-01-01',preset,normalDayMinutes:600,code:'SICK-'+preset})
   assert.equal(localPolicy.bankCap,6000);assert.equal(localPolicy.carry,6000)
   assert.equal(localPolicy.annualUse,preset==='SF'?null:3000)
  }
  const next=await h.cmd('sickpolicy.save',{...pin(policy),site:policy.site,from:'2026-02-01',preset:'CA',normalDayMinutes:480,code:'SICK-CA'})
  assert.equal(next.versions[0].normalDayMinutes,600,'effective changes retain the old day floor')
  const old=(await h.send('/api/lanyard/sick-balances?asOf=2026-01-14',undefined,h.owner)).value.find(r=>r.policyId===policy.id&&r.staffId===alex.id)
  assert.equal(old.annualUsed,3000);assert.equal(old.balanceMinutes,3000)
 }finally{await h.close()}
}

// These public-door scenarios extend the existing clause registration, keeping the test cap.
export async function sickUnpaid(){
 for(const preset of ['NY40_UNPAID','NYC40_UNPAID','OR_UNPAID','PHILADELPHIA_UNPAID']){
  const h=await harness({now:'2026-02-01T12:00:00Z'})
  try{
   const {alex,ben,morgan,policy,request}=await sickFixture(h,preset,52)
   assert.equal(policy.paid,false)
   const report=async on=>(await h.send('/api/lanyard/sick-balances?asOf='+on,undefined,h.owner)).value.find(r=>r.staffId===alex.id&&r.policyId===policy.id)
   assert.equal((await report('2025-12-31')).balanceMinutes,2400,preset+' earns protected time through the annual cap')
   assert.equal((await report('2026-01-01')).balanceMinutes,2400,preset+' carries the protected balance across January')
   const use=await h.cmd('sick.request',request,alex.cookie)
   await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-80'},morgan.cookie,403)
   await h.cmd('sick.correct',{...pin(use),minutes:0,reason:'Not approved yet'},h.owner,409)
   const approved=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-80'})
   assert.deepEqual([approved.paid,approved.minutes,approved.costCents,approved.rateCents],[false,120,0,0])
   assert.equal((await report('2026-01-09')).balanceMinutes,2280)
   assert.equal((await h.state()).leave.find(l=>l.id===use.leaveId).reason,'Unpaid leave')
   const batch=await h.cmd('payroll.prepare',{});assert.ok(batch.lines.length>0);assert.deepEqual(batch.lines.filter(l=>l.sickLine),[],'protected unpaid time must not become paid payroll hours')
   const csv=await h.send('/api/lanyard/sick-balances.csv?asOf=2026-01-09',undefined,h.owner);assert.equal(csv.status,200);assert.ok(csv.text.includes('"false","SICK-'+preset+'"'));assert.ok(csv.text.includes('"2280"'))
   const plan=await h.cmd('aca.plan.save',{name:'Unpaid is not paid service',start:'2026-01-01',end:'2026-12-31',adminEnd:'2026-12-31',stabilityEnd:'2027-12-31',staffIds:[alex.id]})
   assert.equal((await h.send('/api/lanyard/aca/'+plan.id,undefined,h.owner)).value.rows[0].paidLeaveMinutes,0)
   await h.cmd('aca.credit.save',{staffId:alex.id,date:'2026-01-09',minutes:120,category:'illness',reference:approved.reference,reason:'Must not reclassify unpaid leave'},h.owner,409)
   const earnings=await h.send('/api/lanyard/state?week=2026-01-05',undefined,alex.cookie);assert.equal(earnings.status,200,earnings.text);assert.equal(earnings.value.ownEarnings.paidLeave.minutes,0)
   assert.deepEqual((await h.state(ben.cookie)).sickuses,[])
   await h.cmd('sick.correct',{...pin(approved),minutes:60,reason:'Unauthorized correction'},morgan.cookie,403)
   const corrected=await h.cmd('sick.correct',{...pin(approved),minutes:60,reason:'Reviewed unpaid reduction'});assert.equal(corrected.costCents,0);assert.equal(corrected.versions[0].minutes,120);assert.equal((await report('2026-01-09')).balanceMinutes,2340)
   const next=await h.cmd('sickpolicy.save',{...pin(policy),site:policy.site,from:'2026-02-01',preset:preset.replace('_UNPAID',''),code:'PAID-NEXT'})
   assert.equal(next.paid,true);assert.equal(next.versions[0].paid,false)
   assert.deepEqual((await h.cmd('payroll.prepare',{})).lines.filter(l=>l.sickLine),[],'a later paid policy must not turn retained unpaid use into wages')
  }finally{await h.close()}
 }
}
export async function sickReasons(){
 const health=['illness','care','safe','preventive care']
 const cases=[
  ['CO',[...health,'public health closure','bereavement','school or care closure','evacuation']],
  ['NY40',health],['NY',health],
  ['OR',[...health,'bereavement','parental leave','public health closure','public health exclusion','evacuation','hazardous air or heat','blood donation']],
  ['WA',[...health,'public health closure','emergency closure','immigration proceeding']],
  ['NYC40',[...health,'public health closure','childcare','public disaster','housing or benefits proceeding']],
  ['NYC',[...health,'public health closure','childcare','public disaster','housing or benefits proceeding']],
  ['CHICAGO',[...health,'public health closure','public health exclusion']],
  ...['SEATTLE1','SEATTLE2','SEATTLE'].map(id=>[id,[...health,'public health closure','school or care closure']]),
  ...['SEATTLE_PTO1','SEATTLE_PTO2','SEATTLE_PTO3'].map(id=>[id,[...health,'public health closure','school or care closure','employer-approved PTO']]),
  ['PHILADELPHIA',health]
 ]
 for(const [preset,reasons] of cases){const h=await harness();try{
  const {alex,policy,request}=await sickFixture(h,preset)
  for(const [i,purpose] of reasons.entries()){
   const day=add('2026-01-09',i),use=await h.cmd('sick.request',{...request,start:local(day,'09:00'),end:local(day,'10:00'),minutes:60,purpose},alex.cookie)
   const approved=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-90-'+i});assert.equal(approved.purpose,purpose);assert.equal(approved.minutes,60)
   await h.cmd('sick.correct',{...pin(approved),minutes:0,reason:'Reviewed category cancellation'})
  }
  const before=(await h.state()).sickuses.length
  await h.cmd('sick.request',{...request,start:local('2026-02-10','09:00'),end:local('2026-02-10','10:00'),minutes:60,purpose:'Unlisted category'},alex.cookie,400)
  assert.equal((await h.state()).sickuses.length,before,'an unsupported purpose creates no request')
 }finally{await h.close()}}
}

export async function sickSupplement(){
 const h=await harness({now:'2027-02-01T12:00:00Z'})
 try{
  const {alex,ben,policy,request}=await sickFixture(h,'NYC40',0)
  await h.cmd('sickpolicy.save',{site:policy.site,from:'2026-02-21',preset:'NYC_UPFRONT',code:'UNPAID-SUPPLEMENT'},h.owner,400)
  const supplement=await h.cmd('sickpolicy.save',{site:policy.site,from:'2026-02-22',preset:'NYC_UPFRONT',code:'UNPAID-SUPPLEMENT'})
  assert.notEqual(supplement.id,policy.id,'supplement must coexist with the accrued bank at the same site')
  const balances=async on=>{const r=await h.send('/api/lanyard/sick-balances?asOf='+on,undefined,h.owner);assert.equal(r.status,200,r.text);return r.value.filter(r=>r.staffId===alex.id)}
  assert.deepEqual((await balances('2026-02-22')).map(r=>[r.preset,r.balanceMinutes]).sort(),[['NYC40',0],['NYC_UPFRONT',1920]])
  await h.cmd('sick.request',request,alex.cookie,409)
  const use=await h.cmd('sick.request',{...request,start:local('2026-02-28','09:00'),end:local('2026-02-28','11:00'),policyId:supplement.id,purpose:'childcare'},alex.cookie)
  const approved=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-100'})
  assert.deepEqual([approved.paid,approved.costCents],[false,0])
  assert.equal((await balances('2026-02-28')).find(r=>r.policyId===supplement.id).balanceMinutes,1800)
  assert.equal((await balances('2027-01-01')).find(r=>r.policyId===supplement.id).balanceMinutes,1920,'the new annual grant replaces unused hours rather than carrying them')
  const future=(await h.state()).staff.find(p=>p.id===ben.id)
  await h.cmd('staff.save',{...pin(future),name:future.name,email:future.email,payrollId:future.payrollId,role:'staff',active:true,site:policy.site,startDate:'2026-03-01'})
  await h.cmd('sick.request',{...request,start:local('2026-02-28','09:00'),end:local('2026-02-28','11:00'),policyId:supplement.id},ben.cookie,409)
  const corrected=await h.cmd('sick.correct',{...pin(approved),minutes:0,reason:'Reviewed supplemental cancellation'})
  assert.equal(corrected.versions[0].minutes,120)
  assert.equal((await balances('2026-02-28')).find(r=>r.policyId===supplement.id).balanceMinutes,1920)
  await h.restart()
  assert.equal((await balances('2026-02-28')).find(r=>r.policyId===supplement.id).balanceMinutes,1920)
  for(const [day,end,minutes] of [['2026-03-02','2026-03-03',1440],['2026-03-03','2026-03-04',480]]){
   const request=await h.cmd('sick.request',{policyId:supplement.id,start:local(day,'00:00'),end:local(end,'00:00'),minutes,purpose:'childcare'},alex.cookie)
   await h.cmd('sick.decide',{...pin(request),decision:'approved',reference:'synthetic-lanyard-101-'+day})
  }
  assert.equal((await balances('2026-03-03')).find(r=>r.policyId===supplement.id).balanceMinutes,0)
  await h.cmd('sick.request',{policyId:supplement.id,start:local('2026-03-04','09:00'),end:local('2026-03-04','10:00'),minutes:60,purpose:'childcare'},alex.cookie,409)
  assert.equal((await balances('2027-01-01')).find(r=>r.policyId===supplement.id).balanceMinutes,1920)

 }finally{await h.close()}
}

export async function sickPrenatal(){
 const h=await harness({now:'2027-02-01T12:00:00Z'})
 try{
  const {alex,policy}=await sickFixture(h,'NYC40',0)
  const prenatal=await h.cmd('sickpolicy.save',{site:policy.site,from:'2025-01-01',preset:'NY_PRENATAL',code:'PRENATAL'})
  const balances=async on=>{const r=await h.send('/api/lanyard/sick-balances?asOf='+on,undefined,h.owner);assert.equal(r.status,200,r.text);return r.value.find(r=>r.staffId===alex.id&&r.policyId===prenatal.id)}
  assert.equal((await balances('2025-12-30')).balanceMinutes,1200,'separate prenatal bank needs no worked-time accrual')
  const use=await h.cmd('sick.request',{policyId:prenatal.id,start:local('2025-12-31','09:00'),end:local('2025-12-31','11:00'),minutes:120,purpose:'prenatal care'},alex.cookie)
  const approved=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-110'})
  assert.equal((await balances('2026-01-01')).balanceMinutes,1080,'January does not replenish a prenatal period')
  assert.equal((await balances('2026-12-29')).balanceMinutes,1080)
  assert.equal((await balances('2026-12-30')).balanceMinutes,1200,'52 elapsed weeks replenish the separate bank')
  const batch=await h.cmd('payroll.prepare',{});assert.deepEqual(batch.lines.map(l=>[l.minutes,l.costCents,l.payCode]),[[120,4000,'PRENATAL']]);await h.cmd('payroll.export',pin(batch))
  const corrected=await h.cmd('sick.correct',{...pin(approved),minutes:60,reason:'Reviewed prenatal duration'})
  assert.equal(corrected.versions[0].minutes,120)
  const adjustment=await h.cmd('payroll.prepare',{});assert.deepEqual(adjustment.lines.map(l=>[l.minutes,l.costCents]),[[-60,-2000]])
  assert.equal((await balances('2026-01-01')).balanceMinutes,1140)
  const remaining=await h.cmd('sick.request',{policyId:prenatal.id,start:local('2026-01-02','00:00'),end:local('2026-01-02','19:00'),minutes:1140,purpose:'prenatal care'},alex.cookie)
  await h.cmd('sick.decide',{...pin(remaining),decision:'approved',reference:'synthetic-lanyard-111'})
  assert.equal((await balances('2026-01-02')).balanceMinutes,0)
  await h.cmd('sick.request',{policyId:prenatal.id,start:local('2026-01-03','09:00'),end:local('2026-01-03','10:00'),minutes:60,purpose:'prenatal care'},alex.cookie,409)
  assert.equal((await balances('2026-12-30')).balanceMinutes,1200)
 }finally{await h.close()}
}

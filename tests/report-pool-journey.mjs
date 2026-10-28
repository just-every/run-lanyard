import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

export async function poolFixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const day='2026-10-12',job=await h.cmd('job.save',{name:'Service',skills:[],certifications:[]}),people=[]
 const business=await h.cmd('organization.business.save',{name:'Service group'})
 for(const site of ['East','West'])await h.cmd('organization.location.save',{name:site,site,timezone:'UTC',businessId:business.id})
 for(let i=0;i<3;i++){
  const person=await h.person('synthetic-lanyard-'+(101+i))
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site:'East',hourlyRate:'3.00'})
  await h.cmd('workforce.save',{staffId:person.id,jobs:[job.id],skills:[],certifications:[],sites:['East'],preferences:[],minHours:0,maxHours:168,classification:'hourly employee',employmentType:'part-time',startDate:'2020-01-01',rates:[{job:job.id,from:'2020-01-01',cents:300}]})
  people.push(person)
 }
 const manager=await h.person('synthetic-lanyard-104','manager'),foreign=await h.person('synthetic-lanyard-105','manager')
 for(const person of [manager,foreign])await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'manager',active:true,site:person===manager?'East':'West',hourlyRate:'25.00'})
 const west=await h.cmd('time.prepare',{staffId:foreign.id,site:'West',job:job.id,start:day+'T09:00:00Z',end:day+'T10:00:00Z',breakMinutes:0,reason:'Approved second-location work'})
 await h.cmd('time.approve',pin(west))
 const question=await h.cmd('question.save',{site:'East',position:'',when:'out',kind:'tips',text:'Cash tips declared',required:false})
 await h.cmd('availability.save',{staffId:people[0].id,start:day+'T00:00:00Z',end:day+'T23:00:00Z'})
 const roster=await h.cmd('roster.prepare',{week:day,shifts:[{staffId:people[0].id,site:'East',job:job.id,start:day+'T08:00:00Z',end:day+'T09:00:00Z',breakMinutes:0}]})
 await h.cmd('roster.publish',pin(roster))
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-106',capturedAt:day+'T08:00:00Z'},people[0].cookie)
 const punch=await h.cmd('clock.out',{commandId:'synthetic-lanyard-107',capturedAt:day+'T09:00:00Z',breakMinutes:0,answers:{[question.id]:'3.01'}},people[0].cookie)
 const times=[await h.cmd('time.approve',pin(punch.timesheet))]
 for(let i=1;i<3;i++){
  const draft=await h.cmd('time.prepare',{staffId:people[i].id,site:'East',job:job.id,start:day+'T08:00:00Z',end:day+`T${10+i-1}:00:00Z`,breakMinutes:0,reason:'Approved service work'})
  times.push(await h.cmd('time.approve',pin(draft)))
 }
 const input={site:'East',date:day,jobs:[job.id],participants:people.map(p=>p.id),inputs:[{reference:'synthetic-lanyard-108',cents:700}],declarationIds:[times[0].id],reason:'Employer reviewed ordinary employee eligibility and cash input; allocate by approved service minutes'}
 return {day,job,people,manager,foreign,times,input}
}

export async function reportsPoolApi(){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const f=await poolFixture(h),{people,day,input,manager,foreign}=f
  const records=async()=>JSON.stringify((await h.db.prepare('SELECT kind,id,revision,data FROM l_records ORDER BY kind,id').all()).results)
  const read=async(cookie=h.owner)=>{const r=await h.send('/api/lanyard/reports?'+new URLSearchParams({site:'East',kind:'tips',from:day,through:day}),undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
  const before=await records()
  for(const cookie of [people[0].cookie,manager.cookie,foreign.cookie])await h.cmd('tip.pool.prepare',input,cookie,403)
  await h.cmd('tip.pool.prepare',{...input,participants:[manager.id]},h.owner,409)
  assert.equal(await records(),before,'Refused preparation changes no source or audit subject')
  const draft=await h.cmd('tip.pool.prepare',input)
  assert.deepEqual(draft.allocations.map(a=>a.cents).sort((a,b)=>a-b),[167,334,500])
  assert.equal(draft.allocations.reduce((n,a)=>n+a.cents,0),1001)
  assert.equal((await read()).rows.some(r=>r.status==='pool approved'),false,'A draft is not an approved report source')
  for(const cookie of [people[0].cookie,manager.cookie])await h.cmd('tip.pool.approve',{...pin(draft),consent:true},cookie,403)
  await h.cmd('tip.pool.approve',{...pin(draft),consent:false},h.owner,403)
  const approved=await h.cmd('tip.pool.approve',{...pin(draft),consent:true})
  const report=await read(),allocations=report.rows.filter(r=>r.status==='pool approved')
  assert.deepEqual(people.map(p=>allocations.find(r=>r.staffId===p.id).amountCents),[167,334,500])
  assert.equal(report.totals.find(r=>r.kind==='tips').knownAmountCents,1001)
  assert.equal(report.totals.find(r=>r.kind==='tips').declaredAmountCents,301,'Original declaration stays separate from its pool allocation')
  assert.ok(allocations.every(r=>r.sourceId===approved.id&&r.revision===approved.revision))
  assert.deepEqual(allocations.flatMap(r=>JSON.parse(r.detail).sources).map(s=>s.revision).sort(),f.times.map(t=>t.revision).sort())
  assert.equal((await read(manager.cookie)).totals.find(r=>r.kind==='tips').knownAmountCents,1001)
  const state=await h.state(),payinputs=state.payinputs.filter(p=>p.tipPoolId===approved.id)
  assert.equal(payinputs.length,3);assert.equal(payinputs.reduce((n,p)=>n+p.amountCents,0),1001)
  for(const p of people){
   const mine=(await h.send('/api/lanyard/state?week='+day,undefined,p.cookie)).value
   assert.equal(mine.ownEarnings.tips.costCents,allocations.find(r=>r.staffId===p.id).amountCents)
   assert.deepEqual(mine.tippools,[]);assert.deepEqual(mine.payinputs,[])
   assert.equal(JSON.stringify(mine.ownEarnings).includes(people.find(v=>v.id!==p.id).id),false)
  }
  await h.cmd('tipcredit.save',{site:'East',state:'TX',minimumWage:'10.00',from:day,tippedJobs:[f.job.id]})
  const checks=(await h.state()).tipChecks
  assert.deepEqual(people.map(p=>checks.find(r=>r.staffId===p.id).tipsCents),[167,334,500],'Pooled declarations are replaced by allocations in make-up checks')
  const template=await h.cmd('payroll.template.save',{approved:true,name:'Reviewed pool payroll',classification:'policy',header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Earning'},{field:'minutes',header:'Minutes'},{field:'amount',header:'USD'}],groupBy:[],employees:Object.fromEntries([...people,foreign].map((p,i)=>[p.id,{id:'synthetic-lanyard-'+(120+i),workflow:'W-2'}])),codes:{regular:'REG',overtime:'OT','double time':'DT',tips:'TIP','tip make-up':'MAKEUP'},jobs:{[f.job.id]:'SERVICE'},locations:{East:'EAST',West:'WEST'}})
  const batch=await h.cmd('payroll.prepare',{templateId:template.id})
  assert.deepEqual(people.map(p=>batch.lines.find(l=>l.payInputId&&l.staffId===p.id).costCents),[167,334,500])
  await h.cmd('payroll.export',pin(batch))
  const duplicate=await records()
  await h.cmd('tip.pool.prepare',input,h.owner,409)
  await h.cmd('tip.pool.approve',{...pin(approved),consent:true},h.owner,409)
  await h.cmd('payroll.input.save',{...pin(payinputs[0]),staffId:payinputs[0].staffId,date:day,kind:'tips',minutes:0,amountCents:999,reference:payinputs[0].reference,reason:'Bypass pool review'},h.owner,409)
  assert.equal(await records(),duplicate,'Replayed approval and direct input edits cannot duplicate or alter pool money')
  const correctionInput={...input,corrects:approved.id,inputs:[{...input.inputs[0],cents:999}]}
  const pending=await h.cmd('tip.pool.prepare',correctionInput)
  assert.equal((await read()).totals.find(r=>r.kind==='tips').knownAmountCents,1001,'Pending pool correction preserves approved amounts')
  const preparedTime=await h.cmd('time.prepare',{staffId:people[1].id,site:'East',job:f.job.id,start:day+'T08:00:00Z',end:day+'T09:00:00Z',breakMinutes:0,reason:'Correct service duration',corrects:f.times[1].id})
  const beforePending=await records();await h.cmd('tip.pool.approve',{...pin(pending),consent:true},h.owner,409);assert.equal(await records(),beforePending)
  await h.cmd('time.approve',pin(preparedTime))
  const beforeStale=await records();await h.cmd('tip.pool.approve',{...pin(pending),consent:true},h.owner,409);assert.equal(await records(),beforeStale,'Changed time refuses the old exact allocation without writes')
  const changedWork=await read()
  assert.ok(changedWork.rows.filter(r=>r.status==='pool approved').every(r=>r.incomplete),'Changed approved work marks retained pool allocations incomplete')
  const reviewState=(await h.send('/api/lanyard/state?week='+day,undefined,people[0].cookie)).value
  assert.equal(reviewState.ownEarnings.tips.reviewRequired,true);assert.equal(reviewState.ownEarnings.estimateCents,null)
  assert.ok((await h.state()).tipChecks.every(r=>r.poolReviewRequired&&r.makeUpCents===null))
  const beforeRefusedPayroll=await records()
  await h.cmd('payroll.prepare',{templateId:template.id},h.owner,409);assert.equal(await records(),beforeRefusedPayroll)
  const refreshed=await h.cmd('tip.pool.prepare',correctionInput),corrected=await h.cmd('tip.pool.approve',{...pin(refreshed),consent:true})
  const current=await read();assert.equal(current.rows.some(r=>r.sourceId===approved.id),false)
  assert.equal(current.totals.find(r=>r.kind==='tips').knownAmountCents,1300)
  assert.deepEqual(people.map(p=>current.rows.find(r=>r.status==='pool approved'&&r.staffId===p.id).amountCents),[260,260,780])
  assert.ok(current.rows.filter(r=>r.status==='pool approved').every(r=>r.sourceId===corrected.id))
  const delta=await h.cmd('payroll.prepare',{templateId:template.id})
  assert.deepEqual(people.map(p=>delta.lines.find(l=>l.payInputId&&l.staffId===p.id).costCents),[93,-74,280])
  assert.equal(delta.lines.filter(l=>l.payInputId).reduce((n,l)=>n+l.costCents,0),299,'A pool correction exports only the signed difference')
  await h.cmd('payroll.export',pin(delta))
  const correctedState=await h.state();assert.equal(correctedState.tippools.find(r=>r.id===approved.id).totalCents,1001)
  assert.equal(correctedState.payinputs.filter(p=>p.tipPoolRootId===approved.rootId).reduce((n,p)=>n+p.amountCents,0),1300)
  assert.ok(correctedState.payinputs.filter(p=>p.tipPoolRootId===approved.rootId).every(p=>p.versions.length===1))
  const beforeReads=await records()
  const csv=await h.send('/api/lanyard/reports.csv?'+new URLSearchParams({site:'East',kind:'tips',from:day,through:day}),undefined,manager.cookie)
  assert.equal(csv.status,200);assert.ok(csv.text.includes(corrected.id));assert.ok(!csv.text.includes('"'+approved.id+'","'+approved.revision+'","pool approved"'))
  assert.equal((await h.send('/api/lanyard/reports.csv?'+new URLSearchParams({site:'East',kind:'tips',from:day,through:day}),undefined,foreign.cookie)).status,404)
  assert.equal(await records(),beforeReads,'Report reads and refused foreign reads leave pool and work unchanged')
  await h.restart();assert.deepEqual((await read()).rows,current.rows)
  const moved=(await h.state()).staff.find(p=>p.id===people[2].id)
  await h.cmd('staff.save',{...pin(moved),name:moved.name,email:moved.email,payrollId:moved.payrollId,role:'staff',active:true,site:'West'})
  const scoped=await read(manager.cookie)
  assert.equal(scoped.rows.some(r=>r.staffId===moved.id),false)
  assert.equal(scoped.totals.find(r=>r.kind==='tips').knownAmountCents,520)
  assert.ok(scoped.rows.filter(r=>r.status==='pool approved').every(r=>JSON.parse(r.detail).totalCents===null),'Pool totals never disclose tips outside the current reader scope')
  const person=(await h.state()).staff.find(p=>p.id===manager.id)
  await h.cmd('staff.save',{...pin(person),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'manager',active:false,site:'East'})
  assert.equal((await h.send('/api/lanyard/reports.csv?'+new URLSearchParams({site:'East',kind:'tips',from:day,through:day}),undefined,manager.cookie)).status,403)
 }finally{await h.close()}
 await poolPayrollReview()
}

export async function reportsPoolBrowser(browser){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const f=await poolFixture(h),{people,day,input}=f
  const draft=await h.cmd('tip.pool.prepare',input),approved=await h.cmd('tip.pool.approve',{...pin(draft),consent:true})
  await h.cmd('tipcredit.save',{site:'East',state:'TX',minimumWage:'10.00',from:day,tippedJobs:[f.job.id]})
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}})
  try{
   const {readFile,mkdir}=await import('node:fs/promises'),{join}=await import('node:path'),{iconTooltips}=await import('./browser-controls.mjs')
   await context.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname
    if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   const signIn=async cookie=>{const [name,...value]=cookie.split('=');await context.clearCookies();await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const proof=async label=>{
    await iconTooltips(page)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    for(const width of [1440,390]){
     await page.setViewportSize({width,height:1000})
     if(process.env.REPORT_SCREENS){await mkdir(process.env.REPORT_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.REPORT_SCREENS,`${label}-${width}.png`),fullPage:true})}
    }
    await page.setViewportSize({width:1440,height:1000})
   }
   await signIn(h.owner)
   const query=new URLSearchParams({site:'East',kind:'tips',from:day,through:day})
   await page.goto(h.origin+'/app/reports?'+query,{waitUntil:'networkidle'})
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/\$10\.01/)
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/Declared separately: \$3\.01/)
   assert.equal(await page.locator('[data-kind="tips"]').count(),4)
   for(const [i,cents] of [167,334,500].entries()){
    const row=page.locator(`[data-kind="tips"][data-source="${approved.id}"]`).filter({hasText:people[i].name})
    assert.match(await row.first().innerText(),new RegExp('\\$'+(cents/100).toFixed(2).replace('.','\\.')))
   }
   await proof('approved-pool-report')
   await page.getByLabel('Person',{exact:true}).selectOption(people[1].id)
   await page.getByLabel('Job',{exact:true}).selectOption(f.job.id)
   await page.getByRole('button',{name:'Show report',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('[data-kind="tips"]').count(),1)
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/\$3\.34/)
   const download=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download matching CSV'}).click()])
   const csv=await readFile(await download[0].path(),'utf8')
   assert.ok(csv.includes('"334"'));assert.ok(csv.includes(people[1].id));assert.ok(!csv.includes(people[0].id))
   assert.equal(csv,(await h.send('/api/lanyard/reports.csv?'+new URL(page.url()).searchParams,undefined,h.owner)).text)
   const correction=await h.cmd('tip.pool.prepare',{...input,corrects:approved.id,inputs:[{...input.inputs[0],cents:999}]})
   await page.reload({waitUntil:'networkidle'});assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/\$3\.34/)
   const corrected=await h.cmd('tip.pool.approve',{...pin(correction),consent:true})
   await h.restart();await page.reload({waitUntil:'networkidle'})
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/\$4\.33/)
   assert.equal(await page.locator(`[data-source="${corrected.id}"]`).count(),1)
   assert.match(await page.locator(`[data-source="${corrected.id}"]`).innerText(),/Revision 2/)
   await proof('corrected-pool-report')
   await page.getByLabel('Site scope',{exact:true}).selectOption('all')
   await page.getByLabel('Person',{exact:true}).selectOption('')
   await page.getByLabel('Job',{exact:true}).selectOption('')
   await page.getByLabel('Report kind',{exact:true}).selectOption('worked')
   await page.getByRole('button',{name:'Show report',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('[data-kind="worked"]').count(),4)
   assert.match(await page.locator('[data-total-kind="worked"]').innerText(),/420 min/)
   assert.match(await page.locator('.report-sources').innerText(),/West/)
   const allQuery=new URL(page.url()).searchParams
   const allApi=await h.send('/api/lanyard/reports?'+allQuery,undefined,h.owner)
   assert.equal(allApi.value.site,null);assert.equal(allApi.value.totals.find(r=>r.kind==='worked').minutes,420)
   const allLink=await page.getByRole('link',{name:'Download matching CSV'}).getAttribute('href')
   assert.equal(new URL(allLink,h.origin).searchParams.get('scope'),'all')
   assert.equal((await h.send(allLink,undefined,h.owner)).text,(await h.send('/api/lanyard/reports.csv?'+allQuery,undefined,h.owner)).text)
   assert.equal((await h.send('/api/lanyard/reports?'+allQuery,undefined,f.manager.cookie)).status,404)
   await proof('owner-two-location-report')
   await page.goto(h.origin+'/app/payroll#tip-credit',{waitUntil:'networkidle'})
   assert.deepEqual(await page.locator('.tip-checks [data-label="Approved pools"]').allTextContents(),['$2.17','$4.33','$6.50'])
   assert.deepEqual(await page.locator('.tip-checks [data-label="Declared tips"]').allTextContents(),['$0.00','$0.00','$0.00'])
   await proof('pool-make-up-check')
   await signIn(people[0].cookie);await page.goto(h.origin+'/app/time?week='+day,{waitUntil:'networkidle'})
   const earnings=page.locator('#earnings')
   assert.match(await earnings.getByRole('row').filter({hasText:'Tip pool allocation (approved)'}).innerText(),/\$2\.17/)
   assert.ok(!(await earnings.innerText()).includes(people[1].name))
   await proof('employee-approved-pool')
   const timeCorrection=await h.cmd('time.prepare',{staffId:people[0].id,site:'East',job:f.job.id,start:day+'T08:00:00Z',end:day+'T09:30:00Z',breakMinutes:0,reason:'Approved service correction',corrects:f.times[0].id})
   await h.cmd('time.approve',pin(timeCorrection));await page.reload({waitUntil:'networkidle'})
   assert.match(await earnings.innerText(),/owner must review a pool correction/);assert.match(await earnings.innerText(),/Tip pool allocation \(review required\)/)
   await proof('employee-pool-review-required')
   await signIn(h.owner);await page.goto(h.origin+'/app/reports?'+query,{waitUntil:'networkidle'})
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/Incomplete/);assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/\$13\.00/)
   assert.match(await page.locator(`[data-source="${corrected.id}"]`).first().innerText(),/fresh owner review required/)
   await proof('changed-pool-sources')
   await page.goto(h.origin+'/app/payroll#tip-credit',{waitUntil:'networkidle'})
   assert.ok((await page.locator('.tip-checks [data-label="Make-up pay input"]').allTextContents()).every(value=>value.includes('review changed tip pool sources')))
   assert.deepEqual(errors,[])
  }finally{await context.close()}
 }finally{await h.close()}
}

async function poolPayrollReview(){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const f=await poolFixture(h),draft=await h.cmd('tip.pool.prepare',f.input),approved=await h.cmd('tip.pool.approve',{...pin(draft),consent:true})
  const template=await h.cmd('payroll.template.save',{approved:true,name:'Exact pool review',header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Earning'},{field:'minutes',header:'Minutes'},{field:'amount',header:'USD'}],groupBy:[],employees:Object.fromEntries([...f.people,f.foreign].map((p,i)=>[p.id,{id:'synthetic-lanyard-'+(130+i),workflow:'W-2'}])),codes:{regular:'REG',tips:'TIP'},jobs:{[f.job.id]:'SERVICE'},locations:{East:'EAST',West:'WEST'}})
  const staleBatch=await h.cmd('payroll.prepare',{templateId:template.id})
  const correction=await h.cmd('tip.pool.prepare',{...f.input,corrects:approved.id,inputs:[{...f.input.inputs[0],cents:999}]})
  await h.cmd('tip.pool.approve',{...pin(correction),consent:true})
  const records=async()=>JSON.stringify((await h.db.prepare('SELECT kind,id,revision,data FROM l_records ORDER BY kind,id').all()).results)
  const beforeStaleExport=await records()
  await h.cmd('payroll.export',pin(staleBatch),h.owner,409);assert.equal(await records(),beforeStaleExport,'A pool correction invalidates an earlier payroll review without claims or money changes')
  assert.equal((await h.db.prepare('SELECT count(*) n FROM l_payroll_claims').first()).n,0)
  const fresh=await h.cmd('payroll.prepare',{templateId:template.id});await h.cmd('payroll.export',pin(fresh))
  const retired=(await h.state()).staff.find(p=>p.id===f.people[0].id)
  await h.cmd('staff.save',{...pin(retired),name:retired.name,email:retired.email,payrollId:retired.payrollId,role:'staff',active:false,site:'East'})
  const later=await h.cmd('time.prepare',{staffId:f.people[1].id,site:'East',job:f.job.id,start:'2026-10-13T08:00:00Z',end:'2026-10-13T09:00:00Z',breakMinutes:0,reason:'Next service after employee retirement'})
  await h.cmd('time.approve',pin(later))
  const next=await h.cmd('payroll.prepare',{templateId:template.id})
  assert.equal(next.lines.some(l=>l.payInputId),false,'Settled tips never export again or block later payroll after staff deactivation')
  assert.equal(next.lines.reduce((n,l)=>n+l.minutes,0),60);await h.cmd('payroll.export',pin(next))
 }finally{await h.close()}
}

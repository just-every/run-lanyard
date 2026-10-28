import {iconTooltips} from './browser-controls.mjs'
import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days} from './workforce-journey.mjs'

export async function fixture(h){
 const week='2026-10-12'
 await h.cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'West':'East',position:'Service',hourlyRate:p===ben?'22.00':'20.00'})
 const bar=await h.cmd('job.save',{name:'Barista',skills:[],certifications:[]}),counter=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]})
 const input={staffId:alex.id,jobs:[bar.id,counter.id],skills:[],certifications:[],sites:['East'],preferences:[],minHours:0,maxHours:168,classification:'hourly employee',employmentType:'part-time',startDate:'2020-01-01',rates:[{job:bar.id,from:'2020-01-01',cents:2000},{job:bar.id,from:days(week,1),cents:2500},{job:counter.id,from:'2020-01-01',cents:1800}]}
 const profile=await h.cmd('workforce.save',input)
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:days(week,28)+'T00:00:00Z'})
 const shift=(i,hours=8,p=alex)=>({staffId:p.id,site:'East',job:p===alex?i===4?counter.id:bar.id:'',start:days(week,i)+'T08:00:00Z',end:days(week,i)+`T${String(8+hours).padStart(2,'0')}:00:00Z`,breakMinutes:0})
 const forecast=await h.cmd('forecast.save',{week,site:'East',days:Array(7).fill(1000),budgetPercent:10,burdenPercent:10,burdenPerHourCents:100,revision:0,jobBudgets:[{job:bar.id,weeklyCents:80000,days:[10000,null,null,null,null,null,null]}]})
 const draft=await h.cmd('roster.prepare',{week,shifts:[...Array.from({length:5},(_,i)=>shift(i)),shift(5,8,ben)]})
 await h.cmd('roster.publish',pin(draft))
 const called=(await h.state()).shifts.find(x=>x.rosterId===draft.id&&x.staffId===ben.id)
 await h.cmd('shift.callout',{...pin(called),note:'Cannot attend the Saturday shift'},ben.cookie,200,{'x-test-now':String(Date.parse(days(week,5)+'T06:00:00Z'))})
 const times=[]
 for(let i=0;i<5;i++){
  const prepared=await h.cmd('time.prepare',{...shift(i,i===1?10:8),reason:'Signed service time'})
  times.push(await h.cmd('time.approve',pin(prepared)))
 }
 const read=async(cookie=h.owner,atWeek=week,site='East',status=200,view='published')=>{const r=await h.send(`/api/lanyard/cost?week=${atWeek}&site=${site}&view=${view}`,undefined,cookie);assert.equal(r.status,status,r.text);return r.value}
 return {week,alex,ben,manager,foreign,bar,counter,input,profile,shift,forecast,times,read}
}

export async function costApi(){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try {
  const f=await fixture(h),{week,alex,ben,manager,foreign,read}=f
  let r=await read()
  assert.deepEqual([r.scheduled.minutes,r.actual.minutes,r.approved.minutes],[2880,2520,2520])
  assert.deepEqual([r.scheduled.wageCents,r.actual.wageCents,r.actual.overtimeMinutes,r.actual.overtimeCents],[108000,95400,120,2271])
  assert.deepEqual([r.scheduled.burdenCents,r.scheduled.totalCents,r.actual.burdenCents,r.actual.totalCents],[15600,123600,13967,111638])
  assert.equal(r.variance.actualMinusScheduledCents,-11962)
  assert.equal(r.providerReconciled,null,'native approvals never imply provider-applied payroll')
  assert.ok(r.facts.actual.every(x=>x.staffId!==ben.id),'unworked call-out contributes no actual hours or wages')
  assert.deepEqual(r.jobs.map(x=>[x.name,x.actual.minutes]).sort((a,b)=>a[0].localeCompare(b[0])),[['Barista',2040],['Counter',480],['No assigned job',0]])
  assert.equal(r.days[0].actual.wageCents,16000)
  assert.equal(r.days[1].actual.wageCents,25000)
  assert.ok(r.facts.actual.some(x=>x.rate.from===days(week,1)&&x.rate.cents===2500))
  assert.ok(r.overBudget)
  const barCost=r.jobs.find(x=>x.job===f.bar.id)
  assert.deepEqual([barCost.budgetCents,barCost.overBudget,barCost.days[0].budgetCents,barCost.days[0].overBudget],[80000,true,10000,true])
  assert.equal(r.jobs.find(x=>x.job===f.counter.id).budgetCents,null)
  await h.cmd('forecast.save',{week,site:'East',days:Array(7).fill(1000),budgetPercent:90,revision:f.forecast.revision,jobBudgets:[{job:f.bar.id,weeklyCents:80000,days:[10000,null,null,null,null,null,null]}]},foreign.cookie,404)
  await h.cmd('forecast.save',{week,site:'East',days:Array(7).fill(1000),budgetPercent:90,revision:0,jobBudgets:[]},h.owner,409)

  const scoped=await read(manager.cookie);assert.equal(scoped.actual.totalCents,r.actual.totalCents)
  await read(alex.cookie,week,'East',403);await read(foreign.cookie,week,'East',404)
  const key=await h.cmd('agent.create',{label:'Prepare service drafts'})
  assert.equal((await h.send(`/api/lanyard/cost?week=${week}&site=East`,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  const approvedBefore=r.approved.totalCents
  const correction=await h.cmd('time.prepare',{...f.shift(1,9),corrects:f.times[1].id,reason:'Supervisor confirmed one duplicate hour'})
  r=await read()
  assert.deepEqual([r.actual.minutes,r.actual.wageCents,r.actual.overtimeMinutes,r.actual.overtimeCents,r.actual.totalCents],[2460,92900,60,1133,107536])
  assert.equal(r.approved.totalCents,approvedBefore)
  assert.ok(r.facts.actual.some(x=>x.sourceId===correction.id));assert.ok(!r.facts.actual.some(x=>x.sourceId===f.times[1].id))
  await h.cmd('workforce.save',{...f.input,...pin(f.profile),rates:f.input.rates.map(x=>({...x,cents:9900}))})
  assert.equal((await read()).actual.totalCents,r.actual.totalCents,'retroactive profile edits preserve historical cost bases')
  await h.cmd('time.approve',pin(correction));r=await read();assert.equal(r.approved.totalCents,r.actual.totalCents)
  assert.equal(r.facts.approved.filter(x=>x.sourceId===f.times[1].id).length,0)
  await h.cmd('forecast.save',{week,site:'East',days:Array(7).fill(1000),budgetPercent:10,burdenPercent:11,burdenPerHourCents:100,revision:f.forecast.revision+1},h.owner,409)
  const next=days(week,7),template=await h.cmd('template.save',{week,name:'Full service week'})
  await h.cmd('forecast.save',{week:next,site:'East',days:Array(7).fill(10000),budgetPercent:90,burdenPercent:10,revision:0,jobBudgets:[{job:f.bar.id,weeklyCents:100,days:[1,null,null,null,null,null,null]}]})
  const applied=await h.cmd('template.apply',{id:template.id,week:next})
  const review=(await h.state()).scheduleReviews.find(x=>x.week===next)
  assert.ok(review.warnings.some(x=>x.kind==='job budget'&&x.message.includes('weekly')),'template costs warn against the job cap even below the site budget')
  assert.ok(review.warnings.some(x=>x.kind==='job budget'&&x.date===next),'daily job cap warns independently')
  assert.equal(review.warnings.some(x=>x.kind==='budget'),false)
  assert.ok(!(await h.state(ben.cookie)).shifts.some(x=>x.rosterId===applied.id),'template draft stays private')
  const copyWeek=days(week,14);await h.cmd('forecast.save',{week:copyWeek,site:'East',days:Array(7).fill(100),budgetPercent:10,revision:0,jobBudgets:[{job:f.bar.id,weeklyCents:100,days:Array(7).fill(null)}]})
  await h.cmd('roster.copy',{fromWeek:week,week:copyWeek})
  assert.ok((await h.state()).scheduleReviews.find(x=>x.week===copyWeek).warnings.some(x=>x.kind==='budget'))
  assert.ok((await h.state()).scheduleReviews.find(x=>x.week===copyWeek).warnings.some(x=>x.kind==='job budget'))
  const recurringWeek=days(week,21)
  await h.cmd('forecast.save',{week:recurringWeek,site:'East',days:Array(7).fill(10000),budgetPercent:90,revision:0,jobBudgets:[{job:f.bar.id,weeklyCents:0,days:Array(7).fill(null)}]})
  await h.cmd('recurrence.save',{staffId:alex.id,days:[0],start:'08:00',end:'10:00',breakMinutes:0,site:'East',job:f.bar.id,from:recurringWeek,until:days(recurringWeek,6)})
  await h.cmd('recurrence.apply',{week:recurringWeek})
  assert.ok((await h.state()).scheduleReviews.find(x=>x.week===recurringWeek).warnings.some(x=>x.kind==='job budget'))
  const beforeNonWork=(await read()).actual.totalCents
  const paid={staffId:alex.id,date:week,kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-10',reason:'Employer approved paid non-work hours'}
  const input=await h.cmd('payroll.input.save',paid)
  r=await read()
  assert.deepEqual([r.paidNonWork.minutes,r.paidNonWork.earningsCents,r.paidNonWork.burdenCents,r.paidNonWork.totalCents],[120,4000,600,4600])
  assert.equal(r.actual.totalCents,beforeNonWork,'paid non-work never becomes worked time')
  assert.equal(r.employerCostCents,beforeNonWork+4600)
  assert.deepEqual(r.paidNonWork.sources.map(x=>[x.id,x.revision]),[[input.id,input.revision]])
  assert.equal((await read(manager.cookie)).paidNonWork,null,'existing owner-only payroll inputs are not disclosed to managers')
  await h.cmd('payroll.input.save',{...paid,...pin(input),minutes:60,amountCents:2000,reason:'Correct one paid hour'})
  assert.deepEqual([(await read()).paidNonWork.minutes,(await read()).paidNonWork.totalCents],[60,2300])
  const sick=await h.cmd('sickpolicy.save',{site:'East',from:week,preset:'employer',code:'PAID',denominator:1,annualAccrual:2400,bankCap:2400,carry:2400,annualUse:2400,wait:0,increment:60})
  const requested=await h.cmd('sick.request',{policyId:sick.id,start:days(week,6)+'T08:00:00Z',end:days(week,6)+'T09:00:00Z',minutes:60,purpose:'employer-approved'},alex.cookie)
  const use=await h.cmd('sick.decide',{...pin(requested),decision:'approved',reference:'synthetic-lanyard-11'})
  await h.cmd('holiday.save',{site:'East',date:days(week,6),name:'Employer paid holiday',enabled:true})
  await h.cmd('holidayrule.save',{site:'East',from:week,mode:'multiplier',value:1,nonWorkMinutes:60,beforeAfter:false,code:'HOL'})
  const holiday=(await h.state()).holidayReviews.find(r=>r.staffId===ben.id&&r.date===days(week,6)&&r.kind==='non-work')
  const holidayPay=await h.cmd('holidaypay.approve',{staffId:ben.id,site:'East',date:days(week,6),reference:paid.reference,digest:holiday.digest})
  r=await read();assert.equal(r.paidNonWork.duplicateReference,true);assert.equal(r.paidNonWork.totalCents,null,'duplicate references across source families need reconciliation')
  const corrected=(await h.state()).payinputs.find(p=>p.id===input.id)
  await h.cmd('payroll.input.save',{...paid,...pin(corrected),minutes:60,amountCents:2000,reference:'synthetic-lanyard-12',reason:'Separate the independently approved source reference'})
  r=await read();assert.deepEqual([r.paidNonWork.minutes,r.paidNonWork.earningsCents,r.paidNonWork.burdenCents,r.paidNonWork.totalCents],[180,6200,920,7120])
  assert.deepEqual(r.paidNonWork.sources.map(x=>x.sourceKind).sort(),['employer PTO','non-work holiday','paid leave'])
  await h.cmd('sick.correct',{...pin(use),minutes:0,reason:'Employer cancelled paid leave'})
  assert.equal((await read()).paidNonWork.totalCents,4820)
  await h.cmd('holidaypay.correct',{...pin(holidayPay),minutes:0,reason:'Employer cancelled holiday pay'})
  assert.equal((await read()).paidNonWork.totalCents,2300)
  const noRate=await h.person('Riley')
  await h.cmd('staff.save',{...pin(noRate),name:noRate.name,email:noRate.email,payrollId:noRate.payrollId,role:'staff',active:true,site:'East'})
  await h.cmd('time.prepare',{...f.shift(6,2,noRate),reason:'Recorded closing time awaiting a rate'})
  r=await read();assert.equal(r.actual.totalCents,null);assert.ok(r.actual.knownCents>0);assert.ok(r.actual.unpricedSources>0)
  await h.restart();assert.equal((await read()).actual.totalCents,null)
  const current=(await h.state()).forecasts.find(x=>x.week===week&&x.site==='East')
  const capInput={week,site:'East',days:current.days,budgetPercent:current.budgetPercent,revision:current.revision,jobBudgets:current.jobBudgets}
  const managed=await h.cmd('forecast.save',capInput,manager.cookie)
  assert.deepEqual(managed.jobBudgets,current.jobBudgets,'existing home-cafe manager command authority is preserved')
  const refusedBefore=await h.state(),attempt={...capInput,revision:managed.revision,jobBudgets:[]}
  await h.cmd('forecast.save',attempt,foreign.cookie,404)
  await h.cmd('forecast.save',attempt,alex.cookie,403)
  await h.cmd('forecast.save',attempt,'',401,{authorization:`Bearer ${key.token}`})
  assert.equal((await h.state()).version,refusedBefore.version)
  assert.deepEqual((await h.state()).forecasts,refusedBefore.forecasts)
  assert.equal((await read(manager.cookie)).paidNonWork,null)
  const person=(await h.state()).staff.find(p=>p.id===manager.id)
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'manager',active:false,site:'East'})
  const revokedBefore=await h.state()
  await h.cmd('forecast.save',attempt,manager.cookie,403)
  assert.equal((await h.state()).version,revokedBefore.version,'revoked native authority cannot change caps')

 }finally{await h.close()}
}

export async function costBrowser(width=1440){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  const h=await harness({now:'2026-10-26T12:00:00Z'}),f=await fixture(h),context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}})
  try{
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await h.cmd('payroll.input.save',{staffId:f.alex.id,date:f.week,kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-20',reason:'Approved paid hours for cost review'})
   const page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
   const shot=async label=>{await iconTooltips(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.COST_SCREENS){await mkdir(process.env.COST_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.COST_SCREENS,`${label}-${width}.png`)})}}
   await page.goto(h.origin+`/app/schedule?site=East&week=${f.week}`,{waitUntil:'networkidle'})
   const card=page.locator('#labor-cost');assert.match(await card.innerText(),/Worked estimate/);assert.match(await card.innerText(),/\$1,116\.38/);assert.match(await card.innerText(),/Approved paid non-work: 2\.0 hours/);assert.match(await card.innerText(),/\$1,162\.38/)
   await card.getByText('Days and jobs',{exact:true}).click();assert.match(await card.innerText(),/Barista/);assert.match(await card.innerText(),/Counter/);assert.equal(await card.locator('th').filter({hasText:'Weekly job cap'}).count(),1);assert.match(await card.innerText(),/\$800\.00/);await card.scrollIntoViewIfNeeded();await shot('cost-worked')
   const capRow=card.locator('tbody tr').filter({hasText:'Barista'}).last();assert.match(await capRow.innerText(),/scheduled over cap/);await capRow.scrollIntoViewIfNeeded();await shot('cost-job-caps')
   await card.getByText('Calculation inputs',{exact:true}).click();assert.match(await card.innerText(),/Unworked shifts are excluded/);assert.match(await card.innerText(),/Provider-applied payroll is unknown/)
   await card.getByRole('link',{name:'Configure burden estimate',exact:true}).click();await page.waitForLoadState('networkidle')
   const settings=page.locator('#labor-burden');await settings.getByLabel('Employer burden %',{exact:true}).fill('12.5');await settings.getByLabel('Additional burden per hour (USD cents)').focus()
   await settings.getByRole('status').getByText('Saved',{exact:true}).waitFor({state:'visible'});assert.equal((await f.read()).burden.percent,12.5);assert.equal((await f.read()).jobs.find(j=>j.job===f.bar.id).budgetCents,80000);await settings.scrollIntoViewIfNeeded();await shot('cost-settings')
   await costSettingsEditor(h,f,page,settings,shot)
   const next=days(f.week,7),template=await h.cmd('template.save',{week:f.week,name:'Next service week'})
   await h.cmd('forecast.save',{week:next,site:'East',days:Array(7).fill(100),budgetPercent:10});await h.cmd('template.apply',{id:template.id,week:next})
   await page.goto(h.origin+`/app/schedule?site=East&week=${next}&view=draft`,{waitUntil:'networkidle'})
   const review=page.locator('[data-saved-review]');assert.match(await review.innerText(),/exceeds the forecast labor budget/);await review.scrollIntoViewIfNeeded();await shot('cost-template-warning')
   assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }finally{await browser.close()}
}

async function costSettingsEditor(h,f,page,settings,shot){
 const form=page.locator('[data-job-budgets]'),caps=form.locator('[data-job-cap]'),status=form.getByRole('status')
 const snapshot=async()=>{const s=await h.state();return Object.fromEntries(['timesheets','clocks','batches','claims','payinputs','sickuses','holidaypay','shifts','rosters'].map(k=>[k,s[k]]))}
 const original=await snapshot(),forecast=async()=>(await h.state()).forecasts.find(x=>x.week===f.week&&x.site==='East')
 const before=await forecast(),expectedDays=[0,null,20000,null,null,null,null]
 assert.equal(await caps.count(),1)
 await caps.first().getByLabel('Weekly cap (USD cents)',{exact:true}).fill('110000')
 await caps.first().locator('[name=dailyCents]').nth(0).fill('0')
 await caps.first().locator('[name=dailyCents]').nth(2).fill('20000')
 await form.getByRole('button',{name:'Add job cap',exact:true}).click()
 await caps.nth(1).getByLabel('Job',{exact:true}).selectOption(f.counter.id)
 await caps.nth(1).getByLabel('Weekly cap (USD cents)',{exact:true}).fill('15000')
 await form.getByRole('button',{name:'Save job caps',exact:true}).click()
 await status.getByText('Job caps saved',{exact:true}).waitFor().catch(async e=>{throw new Error(e.message+' · '+await status.innerText())})
 const expected=[{job:f.bar.id,weeklyCents:110000,days:expectedDays},{job:f.counter.id,weeklyCents:15000,days:Array(7).fill(null)}]
 assert.deepEqual((await forecast()).jobBudgets,expected)
 assert.deepEqual([(await forecast()).days,(await forecast()).budgetPercent,(await forecast()).burdenPercent,(await forecast()).burdenPerHourCents],[before.days,before.budgetPercent,12.5,100])
 await page.reload({waitUntil:'networkidle'})
 assert.equal(await caps.count(),2)
 assert.equal(await caps.first().locator('[name=dailyCents]').nth(0).inputValue(),'0')
 assert.equal(await caps.first().locator('[name=dailyCents]').nth(1).inputValue(),'')
 await form.scrollIntoViewIfNeeded();await shot('cost-settings-job-caps')
 let r=await f.read(),bar=r.jobs.find(j=>j.job===f.bar.id),counter=r.jobs.find(j=>j.job===f.counter.id)
 assert.deepEqual([bar.scheduled.totalCents,bar.actual.totalCents,bar.overBudget,bar.actualOverBudget],[88700,94525,false,false])
 assert.deepEqual([bar.days[0].budgetCents,bar.days[0].scheduled.totalCents,bar.days[0].overBudget,bar.days[0].actual.totalCents,bar.days[0].actualOverBudget],[0,18800,true,18800,true])
 assert.deepEqual([bar.days[1].budgetCents,bar.days[1].overBudget,bar.days[2].scheduled.totalCents,bar.days[2].budgetCents,bar.days[2].overBudget],[null,null,23300,20000,true])
 assert.deepEqual([counter.scheduled.totalCents,counter.budgetCents,counter.overBudget],[17000,15000,true])
 // Review a real draft through the schedule door; caps and warnings reconcile.
 await h.cmd('roster.prepare',{week:f.week,shifts:[...Array.from({length:5},(_,i)=>f.shift(i)),f.shift(5,8,f.ben)]})
 const warnings=(await h.state()).scheduleReviews.find(x=>x.week===f.week).warnings.filter(x=>x.kind==='job budget')
 assert.deepEqual(warnings.map(x=>[x.site,x.date??null,x.message]).sort(),[
  ['East',f.week,'Barista scheduled labor exceeds its daily job budget on '+f.week+'.'],
  ['East',days(f.week,2),'Barista scheduled labor exceeds its daily job budget on '+days(f.week,2)+'.'],
  ['East',null,'Counter scheduled labor exceeds its weekly job budget.']
 ].sort())
 await page.goto(h.origin+`/app/schedule?site=East&week=${f.week}&view=draft`,{waitUntil:'networkidle'})
 const review=page.locator('[data-saved-review]');assert.match(await review.innerText(),/Counter scheduled labor exceeds its weekly job budget/);assert.match(await review.innerText(),/Barista scheduled labor exceeds its daily job budget/)
 await review.scrollIntoViewIfNeeded();await shot('cost-edited-cap-warnings')
 // The draft is a fixture action; only Settings saves are checked for source preservation.
 const afterDraft=await snapshot()
 assert.deepEqual({...afterDraft,shifts:original.shifts,rosters:original.rosters},original)
 await page.goto(h.origin+`/app/settings?site=East&week=${f.week}`,{waitUntil:'networkidle'})
 // Failed transport retains the draft and can be retried without resetting it.
 await caps.nth(1).getByLabel('Weekly cap (USD cents)',{exact:true}).fill('18000')
 await page.route('**/api/lanyard/command',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Service temporarily unavailable'})}),{times:1})
 const unchanged=await h.state()
 await form.getByRole('button',{name:'Save job caps',exact:true}).click()
 await status.getByText(/Service temporarily unavailable/).waitFor()
 assert.equal((await h.state()).version,unchanged.version)
 assert.equal(await caps.nth(1).getByLabel('Weekly cap (USD cents)',{exact:true}).inputValue(),'18000')
 assert.equal(await form.getByRole('link',{name:'Reload saved cost settings'}).isVisible(),true)
 await form.getByRole('button',{name:'Retry job cap save',exact:true}).click()
 await status.getByText('Job caps saved',{exact:true}).waitFor().catch(async e=>{throw new Error(e.message+' · '+await status.innerText())})
 assert.equal((await forecast()).jobBudgets[1].weeklyCents,18000)
 // A newer forecast cannot be overwritten by this stale browser form.
 const current=await forecast(),changed=await h.cmd('forecast.save',{week:f.week,site:'East',days:[2000,1000,1000,1000,1000,1000,1000],budgetPercent:15,burdenPercent:9,burdenPerHourCents:75,revision:current.revision})
 await caps.first().getByLabel('Weekly cap (USD cents)',{exact:true}).fill('1')
 const staleBefore=await h.state()
 const refused=page.waitForResponse(response=>response.url().endsWith('/api/lanyard/command')&&response.request().method()==='POST')
 await form.getByRole('button',{name:'Save job caps',exact:true}).click()
 assert.equal((await refused).status(),409)
 await status.getByText(/reload before saving/).waitFor()
 assert.equal((await h.state()).version,staleBefore.version)
 assert.deepEqual(await forecast(),changed)
 assert.equal(await caps.first().getByLabel('Weekly cap (USD cents)',{exact:true}).inputValue(),'1')
 assert.equal(await form.getByRole('button',{name:'Retry job cap save',exact:true}).isDisabled(),true)
 await form.scrollIntoViewIfNeeded();await shot('cost-stale-cap-recovery')
 await form.getByRole('link',{name:'Reload saved cost settings'}).click();await page.waitForLoadState('networkidle')
 assert.equal(await caps.first().getByLabel('Weekly cap (USD cents)',{exact:true}).inputValue(),'110000')
 assert.equal(await settings.getByLabel('Employer burden %',{exact:true}).inputValue(),'9')
 await caps.nth(1).getByRole('button',{name:'Remove job cap',exact:true}).click()
 await caps.first().locator('[name=dailyCents]').nth(0).fill('')
 await form.getByRole('button',{name:'Save job caps',exact:true}).click();await status.getByText('Job caps saved',{exact:true}).waitFor().catch(async e=>{throw new Error(e.message+' · '+await status.innerText())})
 assert.deepEqual((await forecast()).jobBudgets,[{...expected[0],days:[null,null,20000,null,null,null,null]}])
 assert.deepEqual([(await forecast()).days,(await forecast()).budgetPercent,(await forecast()).burdenPercent,(await forecast()).burdenPerHourCents],[changed.days,15,9,75])
 await caps.first().getByRole('button',{name:'Remove job cap',exact:true}).click()
 await form.getByRole('button',{name:'Save job caps',exact:true}).click();await status.getByText('Job caps saved',{exact:true}).waitFor().catch(async e=>{throw new Error(e.message+' · '+await status.innerText())})
 assert.deepEqual((await forecast()).jobBudgets,[])
 await h.restart();await page.reload({waitUntil:'networkidle'});assert.equal(await caps.count(),0)
 assert.deepEqual((await forecast()).jobBudgets,[])
 r=await f.read();assert.ok(r.jobs.every(j=>j.budgetCents===null&&j.days.every(d=>d.budgetCents===null)))
 assert.deepEqual(await snapshot(),afterDraft,'cost Settings never rewrite time, payroll or schedule sources')
 assert.equal((await f.read(f.manager.cookie)).paidNonWork,null,'paid-source privacy is unchanged')
 for(const cookie of [f.manager.cookie,f.alex.cookie,f.foreign.cookie]){
  const view=await h.send(`/app/settings?site=East&week=${f.week}`,undefined,cookie)
  assert.ok(!view.text.includes('data-job-budgets'),'the native Settings editor remains owner-only')
 }
 // Add the unassigned-job cap through the same editor and persist it on restart.
 await form.getByRole('button',{name:'Add job cap',exact:true}).click()
 await caps.first().getByLabel('Job',{exact:true}).selectOption('__unassigned__')
 await caps.first().getByLabel('Weekly cap (USD cents)',{exact:true}).fill('0')
 await form.getByRole('button',{name:'Save job caps',exact:true}).click();await status.getByText('Job caps saved',{exact:true}).waitFor().catch(async e=>{throw new Error(e.message+' · '+await status.innerText())})
 await h.restart();await page.reload({waitUntil:'networkidle'})
 assert.equal(await caps.first().getByLabel('Weekly cap (USD cents)',{exact:true}).inputValue(),'0')
 assert.deepEqual((await forecast()).jobBudgets,[{job:'',weeklyCents:0,days:Array(7).fill(null)}])
 await form.scrollIntoViewIfNeeded();await shot('cost-restarted-job-caps')
}

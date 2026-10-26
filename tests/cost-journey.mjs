import {iconTooltips} from './browser-controls.mjs'
import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days} from './workforce-journey.mjs'

async function fixture(h){
 const week='2026-10-12'
 await h.cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'West':'East',position:'Service',hourlyRate:p===ben?'22.00':'20.00'})
 const bar=await h.cmd('job.save',{name:'Barista',skills:[],certifications:[]}),counter=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]})
 const input={staffId:alex.id,jobs:[bar.id,counter.id],skills:[],certifications:[],sites:['East'],preferences:[],minHours:0,maxHours:168,classification:'hourly employee',employmentType:'part-time',startDate:'2020-01-01',rates:[{job:bar.id,from:'2020-01-01',cents:2000},{job:bar.id,from:days(week,1),cents:2500},{job:counter.id,from:'2020-01-01',cents:1800}]}
 const profile=await h.cmd('workforce.save',input)
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:days(week,28)+'T00:00:00Z'})
 const shift=(i,hours=8,p=alex)=>({staffId:p.id,site:'East',job:p===alex?i===4?counter.id:bar.id:'',start:days(week,i)+'T08:00:00Z',end:days(week,i)+`T${String(8+hours).padStart(2,'0')}:00:00Z`,breakMinutes:0})
 const forecast=await h.cmd('forecast.save',{week,site:'East',days:Array(7).fill(1000),budgetPercent:10,burdenPercent:10,burdenPerHourCents:100})
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
  await h.cmd('forecast.save',{week:next,site:'East',days:Array(7).fill(100),budgetPercent:10,burdenPercent:10})
  const applied=await h.cmd('template.apply',{id:template.id,week:next})
  const review=(await h.state()).scheduleReviews.find(x=>x.week===next)
  assert.ok(review.warnings.some(x=>x.kind==='budget'),'template costs warn before publication')
  assert.ok(!(await h.state(ben.cookie)).shifts.some(x=>x.rosterId===applied.id),'template draft stays private')
  const copyWeek=days(week,14);await h.cmd('forecast.save',{week:copyWeek,site:'East',days:Array(7).fill(100),budgetPercent:10})
  await h.cmd('roster.copy',{fromWeek:week,week:copyWeek})
  assert.ok((await h.state()).scheduleReviews.find(x=>x.week===copyWeek).warnings.some(x=>x.kind==='budget'))
  const noRate=await h.person('Riley')
  await h.cmd('staff.save',{...pin(noRate),name:noRate.name,email:noRate.email,payrollId:noRate.payrollId,role:'staff',active:true,site:'East'})
  await h.cmd('time.prepare',{...f.shift(6,2,noRate),reason:'Recorded closing time awaiting a rate'})
  r=await read();assert.equal(r.actual.totalCents,null);assert.ok(r.actual.knownCents>0);assert.ok(r.actual.unpricedSources>0)
  await h.restart();assert.equal((await read()).actual.totalCents,null)
 }finally{await h.close()}
}

export async function costBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now:'2026-10-26T12:00:00Z'}),f=await fixture(h),context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}})
  try{
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async label=>{await iconTooltips(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.COST_SCREENS){await mkdir(process.env.COST_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.COST_SCREENS,`${label}-${width}.png`)})}}
   await page.goto(h.origin+`/app/schedule?site=East&week=${f.week}`,{waitUntil:'networkidle'})
   const card=page.locator('#labor-cost');assert.match(await card.innerText(),/Worked estimate/);assert.match(await card.innerText(),/\$1,116\.38/)
   await card.getByText('Days and jobs',{exact:true}).click();assert.match(await card.innerText(),/Barista/);assert.match(await card.innerText(),/Counter/);await card.scrollIntoViewIfNeeded();await shot('cost-worked')
   await card.getByText('Calculation inputs',{exact:true}).click();assert.match(await card.innerText(),/Unworked shifts are excluded/);assert.match(await card.innerText(),/Provider-applied payroll is unknown/)
   await card.getByRole('link',{name:'Configure burden estimate',exact:true}).click();await page.waitForLoadState('networkidle')
   const settings=page.locator('#labor-burden');await settings.getByLabel('Employer burden %',{exact:true}).fill('12.5');await settings.getByLabel('Additional burden per hour (USD cents)').focus()
   await settings.getByRole('status').getByText('Saved',{exact:true}).waitFor({state:'visible'});assert.equal((await f.read()).burden.percent,12.5);await settings.scrollIntoViewIfNeeded();await shot('cost-settings')
   const next=days(f.week,7),template=await h.cmd('template.save',{week:f.week,name:'Next service week'})
   await h.cmd('forecast.save',{week:next,site:'East',days:Array(7).fill(100),budgetPercent:10});await h.cmd('template.apply',{id:template.id,week:next})
   await page.goto(h.origin+`/app/schedule?site=East&week=${next}&view=draft`,{waitUntil:'networkidle'})
   const review=page.locator('[data-saved-review]');assert.match(await review.innerText(),/exceeds the forecast labor budget/);await review.scrollIntoViewIfNeeded();await shot('cost-template-warning')
   assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

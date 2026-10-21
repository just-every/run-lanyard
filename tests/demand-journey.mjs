import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const plus=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
export async function demandFixture(h) {
 const today=new Date().toISOString().slice(0,10),T=plus(today,3),now=Date.parse(today+'T12:00:00Z')
 const head=(date=today,time='12:00')=>({'x-test-now':String(Date.parse(date+'T'+time+':00Z'))})
 const cmd=(n,p,c=h.owner,status=200,when=head())=>h.cmd(n,p,c,status,when)
 const read=async(site,date,c=h.owner,when=head(),path='/api/lanyard/demand')=>h.send(`${path}?site=${encodeURIComponent(site)}&date=${date}`,undefined,c,when)
 await cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),priya=await h.person('Priya','manager'),omar=await h.person('Omar','manager')
 for(const [p,site] of [[alex,'Ocean Beach'],[priya,'Ocean Beach'],[omar,'Elsewhere']])await cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,active:true,role:p.role,site})
 // Hourly history for two cafes entered as manual SALES-001 uploads: four prior same-weekday days at Ocean Beach, three at Pier.
 const rows=['date,hour,site,sales']
 const ob={10:[100,110,90,100],11:[200,200,200,200]},pier={10:[50,50,50]}
 for(const [hour,values] of Object.entries(ob))values.forEach((v,i)=>rows.push(`${plus(T,-7*(i+1))},${hour},Ocean Beach,${v}`))
 pier[10].forEach((v,i)=>rows.push(`${plus(T,-7*(i+2))},10,Pier,${v}`))
 rows.push(`${plus(today,-1)},9,Ocean Beach,80`) // yesterday's entry keeps the history fresh
 const csv=rows.join('\n'),preview=await cmd('sales.preview',{csv,site:''})
 await cmd('sales.import',{csv,site:'',fingerprint:preview.fingerprint})
 return {today,T,now,head,cmd,read,alex,priya,omar,plus,rows}
}
export async function demandApi(h) {
 const f=await demandFixture(h),{T,cmd,read,head}=f
 const rule={site:'Ocean Beach',events:`${T}|Street fair|50`,roles:'Barista|100|1\nCook|200|0'}
 await cmd('demandrule.save',rule,f.alex.cookie,403);await cmd('demandrule.save',{...rule,site:'Pier'},f.priya.cookie,403)
 const saved=await cmd('demandrule.save',rule,f.priya.cookie)
 await cmd('demandrule.save',{...rule,revision:saved.revision,roles:'Barista|0|1'},f.priya.cookie,400)
 // An event day is forecast from the mean of four prior same-weekday hours, widened by one standard deviation and lifted 50%.
 let r=(await read('Ocean Beach',T)).value
 assert.equal(r.live.status,'complete');assert.equal(r.live.source,'Manual (SALES-001)')
 const at=(x,hour)=>x.hours.find(v=>v.hour===hour)
 assert.deepEqual([at(r.live,10).baseCents,at(r.live,10).lowCents,at(r.live,10).highCents,at(r.live,10).confidence,at(r.live,10).samples],[15000,13939,16061,'high',4])
 assert.deepEqual([at(r.live,11).baseCents,at(r.live,11).confidence],[30000,'high'])
 assert.equal(at(r.live,12).baseCents,null,'an hour with no history is unknown, never zero')
 assert.deepEqual(at(r.live,10).roles,[{position:'Barista',requiredMinutes:90,headcount:1.5},{position:'Cook',requiredMinutes:45,headcount:0.8}])
 assert.deepEqual(r.live.totals,{salesCents:45000,requiredMinutes:405,byRole:{Barista:270,Cook:135}})
 assert.deepEqual(r.live.assumptions.event,{date:T,name:'Street fair',upliftPercent:50})
 // Saving needs the reviewed digest; the forecast writes no schedule or worked time.
 const before=await h.state(),stale=r.live.digest.replace(/./,c=>c==='0'?'1':'0')
 await cmd('demand.save',{site:'Ocean Beach',date:T,digest:stale},f.priya.cookie,409)
 await cmd('demand.save',{site:'Ocean Beach',date:T,digest:r.live.digest},f.alex.cookie,403)
 const v1=await cmd('demand.save',{site:'Ocean Beach',date:T,digest:r.live.digest},f.priya.cookie)
 assert.equal(v1.version,1)
 const v2=await cmd('demand.override',{...pin(v1),hour:11,dollars:'350',reason:'Parade passes at noon'},f.priya.cookie)
 assert.deepEqual([v2.version,v2.kind,v2.hours[11].salesCents,v2.hours[11].override.computedCents,v2.hours[11].override.reason],[2,'override',35000,30000,'Parade passes at noon'])
 assert.deepEqual(v2.totals,{salesCents:50000,requiredMinutes:450,byRole:{Barista:300,Cook:150}})
 await cmd('demand.override',{...pin(v1),hour:10,dollars:'200',reason:'x'},f.priya.cookie,409)
 await cmd('demand.override',{...pin(v2),hour:10,dollars:'200',reason:''},f.priya.cookie,400)
 const after=await h.state()
 assert.deepEqual([after.rosters,after.shifts,after.clocks,after.timesheets,after.forecasts],[before.rosters,before.shifts,before.clocks,before.timesheets,before.forecasts])
 // A corrected day changes the current forecast from the entered sales; the saved version stays and is marked behind.
 const entry=(await h.state()).sales.find(x=>x.site==='Ocean Beach'&&x.date===f.plus(T,-7)&&x.hour===10)
 await cmd('sales.save',{...pin(entry),value:'130'},f.priya.cookie)
 r=(await read('Ocean Beach',T)).value
 assert.equal(at(r.live,10).baseCents,16125);assert.equal(r.changedSinceSaved,true)
 assert.equal(at(r.saved,10).salesCents,15000);assert.equal(r.saved.version,2);assert.deepEqual(r.versions.map(x=>x.version),[2,1])
 assert.ok((await h.state()).sales.every(x=>x.source==='csv'||x.source==='form'),'every input is labelled manual')
 // A stale cafe is explicitly incomplete and withholds staffing; entering a fresh day but only one prior sample at an hour keeps it incomplete.
 let pier=(await read('Pier',T)).value
 assert.equal(pier.live.status,'incomplete');assert.match(pier.live.reasons.join(' '),/stale inputs/);assert.equal(pier.live.totals.requiredMinutes,null);assert.deepEqual([at(pier.live,10).baseCents,at(pier.live,10).confidence],[5000,'medium'])
 await cmd('sales.save',{site:'Pier',date:f.plus(f.today,-1),hour:9,metric:'sales',value:'10'},h.owner)
 await cmd('sales.save',{site:'Pier',date:f.plus(T,-14),hour:12,metric:'sales',value:'60'},h.owner)
 pier=(await read('Pier',T)).value
 assert.equal(pier.live.status,'incomplete');assert.deepEqual(pier.live.reasons,['12:00: 1 prior day of sales, 2 needed'])
 const none=(await read('Ocean Beach',f.plus(T,1))).value
 assert.equal(none.live.status,'incomplete');assert.ok(none.live.hours.every(x=>x.salesCents===null))
 // Scope: the owner and that cafe's managers only.
 assert.equal((await read('Ocean Beach',T,f.alex.cookie)).status,403);assert.equal((await read('Pier',T,f.priya.cookie)).status,404);assert.equal((await read('Ocean Beach',T,f.omar.cookie)).status,404)
 const key=await h.cmd('agent.create',{label:'Preparation only'})
 assert.equal((await h.send(`/api/lanyard/demand?site=Ocean%20Beach&date=${T}`,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
 const forecastInput={site:'Ocean Beach',date:T,digest:r.live.digest},overrideInput={...pin(v2),hour:10,dollars:'200',reason:'Attempt outside authority'}
 await cmd('demand.override',overrideInput,f.alex.cookie,403)
 const scoped=await h.cmd('agent.create',{label:'Forecast planner',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true})
 const bearer=(path,key=scoped,body,when=head())=>h.send(path,body,'',{...when,authorization:`Bearer ${key.token}`})
 const path=`/api/lanyard/agent/demand?site=Ocean%20Beach&date=${T}`
 assert.equal((await bearer(path,key)).status,403)
 assert.equal((await bearer(path.replace('Ocean%20Beach','Pier'))).status,404)
 const view=(await bearer(path)).value
 assert.equal(view.live.status,r.live.status);assert.deepEqual(view.live.totals,r.live.totals)
 assert.deepEqual(view.saved.totals,r.saved.totals);assert.deepEqual(view.versions.map(x=>x.version),[2,1])
 assert.deepEqual(view.saved.hours[10].roles,r.saved.hours[10].roles)
 const noPrivate=v=>{for(const [k,x] of Object.entries(v??{})){assert.ok(!/rate|payroll|email|contact|laborPercent|salesPerLaborHour|savedBy|overrideReason|inputs|sources|assumptions|digest/.test(k),k);if(x&&typeof x==='object')noPrivate(x)}}
 noPrivate(view)
 for(const name of ['demand.save','demand.override','demandrule.save']) {
  const response=await bearer('/api/lanyard/agent/command',scoped,{name,input:name==='demand.override'?overrideInput:forecastInput})
  assert.equal(response.status,403,response.text)
 }
 const event=(await h.state()).events.find(x=>x.action==='comparison.read'&&JSON.parse(x.entityId).kind==='demand')
 assert.deepEqual(JSON.parse(event.entityId),{keyId:scoped.id,site:'Ocean Beach',kind:'demand',date:T});assert.equal(event.actorRole,'agent')
 await h.cmd('agent.revoke',{id:scoped.id});assert.equal((await bearer(path)).status,401)
 return {...f,v1,v2,rule:saved}
}
export async function demandOutcomes(h) {
 const f=await demandApi(h),{T,cmd,read,head}=f
 // REPORT-003 carries the saved forecast hours beside scheduled and actual hours.
 await cmd('availability.save',{staffId:f.alex.id,start:`${f.plus(T,-1)}T00:00:00Z`,end:`${f.plus(T,2)}T00:00:00Z`})
 const monday=plus(T,-((new Date(T+'T12:00:00Z').getUTCDay()+6)%7))
 const draft=await cmd('roster.prepare',{week:monday,shifts:[{staffId:f.alex.id,start:`${T}T10:00:00Z`,end:`${T}T12:00:00Z`,breakMinutes:0}]})
 await cmd('roster.publish',pin(draft))
 const intervals=async(size,when)=>(await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${T}&size=${size}`,undefined,h.owner,when)).value
 let report=await intervals(60,head())
 assert.deepEqual([report.forecast.version,report.forecast.status],[2,'complete'])
 assert.deepEqual([report.intervals[10].forecast.requiredMinutes,report.intervals[10].scheduled.minutes,report.intervals[11].forecast.requiredMinutes,report.intervals[11].scheduled.minutes],[135,60,315,60])
 report=await intervals(30,head());assert.deepEqual([report.intervals[20].forecast.requiredMinutes,report.intervals[20].forecast.salesCents,report.intervals[20].forecast.basis],[67.5,7500,'hourly forecast split evenly'])
 // After service, actual sales and worked hours are compared against the version saved before the day.
 await cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:`${T}T10:00:00Z`},f.alex.cookie,200,head(T,'10:00'))
 await cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:`${T}T12:00:00Z`,breakMinutes:0},f.alex.cookie,200,head(T,'12:00'))
 const actual=`date,hour,site,sales\n${T},10,Ocean Beach,160\n${T},11,Ocean Beach,340`,pre=await cmd('sales.preview',{csv:actual,site:''},h.owner,200,head(plus(T,1)))
 await cmd('sales.import',{csv:actual,site:'',fingerprint:pre.fingerprint},h.owner,200,head(plus(T,1)))
 let o=(await read('Ocean Beach',T,h.owner,head(plus(T,1)))).value.outcome
 assert.equal(o.status,'compared');assert.equal(o.version,2)
 const hour=n=>o.hours.find(x=>x.hour===n)
 assert.deepEqual([hour(10).forecastCents,hour(10).actualCents,hour(10).errorCents],[15000,16000,1000])
 assert.deepEqual([hour(11).forecastCents,hour(11).computedCents,hour(11).overridden,hour(11).actualCents,hour(11).errorCents],[35000,30000,true,34000,-1000])
 assert.deepEqual(o.summary.overrides,[{hour:11,computedErrorCents:4000,overrideErrorCents:-1000}])
 assert.deepEqual([o.summary.meanAbsoluteErrorCents,o.summary.observedHours,o.summary.signedErrorCents],[1000,2,0])
 assert.deepEqual(o.summary.staffing,{hours:2,requiredMinutes:450,scheduledMinutes:120,actualMinutes:120})
 assert.equal(o.hours.filter(x=>x.hour===10||x.hour===11).every(x=>x.scheduledMinutes===60&&x.actualMinutes===60),true)
 const key=await h.cmd('agent.create',{label:'Outcome planner',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true})
 const delta=await h.send(`/api/lanyard/agent/demand?site=Ocean%20Beach&date=${T}`,undefined,'',{...head(plus(T,1)),authorization:`Bearer ${key.token}`})
 assert.equal(delta.status,200,delta.text);assert.equal(delta.value.demandDelta.status,'compared')
 assert.deepEqual(delta.value.demandDelta.hours.map(x=>[x.hour,x.errorCents,x.requiredMinutes,x.scheduledMinutes,x.actualMinutes]),[[10,1000,135,60,60],[11,-1000,315,60,60]])
 // A day before any saved forecast, and a day not yet over, stay explicit and unknown.
 assert.equal((await read('Ocean Beach',T,h.owner,head())).value.outcome.status,'service-day-not-complete')
 assert.equal((await read('Ocean Beach',f.plus(f.today,-1),h.owner,head())).value.outcome.status,'unknown')
 return f
}
export async function demandBrowser() {
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const f=await demandOutcomes(h)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1100},extraHTTPHeaders:f.head(f.plus(f.T,1))})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async key=>{if(process.env.DEMAND_SCREENS){await mkdir(process.env.DEMAND_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.DEMAND_SCREENS,`${key}-${width}.png`),fullPage:true})}}
   await page.goto(h.origin+`/app/demand?site=Ocean%20Beach&date=${f.T}`,{waitUntil:'networkidle'})
   const text=await page.locator('main, body').first().innerText()
   for(const expected of ['Complete forecast','Manual (SALES-001)','Street fair','Saved version 2','overridden from $300.00: Parade passes at noon','Forecast against actual','mean absolute error $10.00'])assert.ok(text.includes(expected),expected)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('forecast')
   await page.goto(h.origin+`/app/demand?site=Pier&date=${f.T}`,{waitUntil:'networkidle'})
   const stale=await page.locator('body').innerText();assert.ok(stale.includes('Incomplete forecast'));assert.ok(stale.includes('12:00: 1 prior day of sales, 2 needed'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('incomplete')
   await page.goto(h.origin+`/app/intervals?site=Ocean%20Beach&date=${f.T}&size=60`,{waitUntil:'networkidle'})
   assert.ok(await page.locator('td[data-label="Forecast hours"]').count()>=2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('interval')
   // Override form on the saved version.
   // The assumptions form saves through the screen and returns to it.
   await page.goto(h.origin+`/app/demand?site=Ocean%20Beach&date=${f.T}`,{waitUntil:'networkidle'})
   await page.getByText('Edit assumptions',{exact:true}).click();await page.locator('form[action*="name=demandrule.save"] [name=growthPercent]').fill(String(width===1440?5:7))
   await Promise.all([page.waitForNavigation(),page.locator('form[action*="name=demandrule.save"]').getByRole('button',{name:'Save assumptions'}).click()])
   assert.equal(await page.locator('.notice.error').count(),0);assert.ok((await page.locator('body').innerText()).includes('Demand forecast'))
   assert.equal((await h.state()).demandrules.find(r=>r.site==='Ocean Beach').growthPercent,width===1440?5:7);assert.deepEqual(errors,[]);await context.close()
  }
 }finally{await browser.close();await h.close()}
}

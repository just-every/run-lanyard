import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
export const pin=r=>({id:r.id,revision:r.revision})
export const days=(d,n)=>new Date(Date.parse(d+'T12:00Z')+n*86400000).toISOString().slice(0,10)
export const monday=d=>days(d,-((new Date(d+'T12:00Z').getUTCDay()+6)%7))
export function local(date,time){const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',timeZoneName:'longOffset'}).formatToParts(new Date(date+'T12:00Z')).find(p=>p.type==='timeZoneName').value,match=zone.match(/GMT([+-])(\d{2}):(\d{2})/),offset=match?(Number(match[2])*60+Number(match[3]))*(match[1]==='-'?-1:1):0;return new Date(Date.parse(date+'T'+time+':00Z')-offset*60000).toISOString()}
export async function workforceFixture(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:'Counter',hourlyRate:'20.00'})
 const week=days(monday(new Date().toISOString().slice(0,10)),14),expiry=days(week,2)
 const bar=await h.cmd('job.save',{name:'Barista',skills:['espresso'],certifications:['food safety']}),counter=await h.cmd('job.save',{name:'Counter',skills:['service'],certifications:[]})
 const input={staffId:alex.id,jobs:[bar.id,counter.id],skills:['espresso','service'],certifications:[{name:'food safety',expires:expiry}],sites:['Ocean Beach'],preferences:['Barista mornings','Ocean Beach'],minHours:12,maxHours:36,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[{job:bar.id,from:'2020-01-01',cents:2400},{job:bar.id,from:days(week,1),cents:2700},{job:counter.id,from:'2020-01-01',cents:2100}]}
 const profile=await h.cmd('workforce.save',input,manager.cookie)
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:days(week,-1)+'T00:00:00Z',end:days(week,35)+'T00:00:00Z'})
 const shift=(date,extra={})=>({staffId:alex.id,job:bar.id,site:'Ocean Beach',start:date+'T16:00:00Z',end:date+'T20:00:00Z',breakMinutes:0,label:'Morning service',...extra})
 return {alex,ben,manager,foreign,week,expiry,bar,counter,input,profile,shift}
}
export async function workforceApi(h) {
 const f=await workforceFixture(h),{alex,ben,manager,foreign,week,expiry,bar,counter,input,profile,shift}=f
 assert.equal(profile.classification,'hourly employee');assert.deepEqual(profile.preferences,['Barista mornings','Ocean Beach']);assert.equal(profile.minHours,12);assert.equal(profile.maxHours,36)
 const employment=(await h.state()).employment.find(r=>r.staffId===alex.id);assert.equal(employment.type,'part-time');assert.equal(employment.startDate,'2024-01-01')
 await h.cmd('workforce.save',{...input,...pin(profile)},alex.cookie,403)
 await h.cmd('workforce.save',{...input,...pin(profile)},foreign.cookie,403)
 await h.cmd('job.save',{name:'Private edit',skills:[],certifications:[]},ben.cookie,403)
 let draft=await h.cmd('roster.prepare',{week,shifts:[shift(week),shift(days(week,1)),shift(days(week,2),{job:counter.id})]})
 assert.deepEqual(draft.conflicts,[])
 assert.deepEqual(draft.shifts.map(x=>x.rateBasis.costCents),[9600,10800,8400],'different jobs and effective dates price independently')
 const read=await h.state(),review=read.scheduleReviews.find(r=>r.week===week);assert.equal(review.sites[0].costCents,28800);assert.equal(review.warnings.some(w=>w.kind==='minimum hours'),false)
 await h.cmd('roster.publish',pin(draft))
 const first=(await h.state()).shifts.find(x=>x.rosterId===draft.id&&x.staffId===alex.id&&x.start.startsWith(week))
 // Every swap stage must independently recheck current qualifications.
 await h.cmd('swap.propose',{shiftId:first.id,revision:first.revision,to:ben.id},alex.cookie,409)
 const benInput={...input,staffId:ben.id,certifications:[{name:'food safety',expires:days(week,30)}]}
 let benProfile=await h.cmd('workforce.save',benInput)
 let swap=await h.cmd('swap.propose',{shiftId:first.id,revision:first.revision,to:ben.id},alex.cookie)
 benProfile=await h.cmd('workforce.save',{...benInput,...pin(benProfile),skills:['service']})
 await h.cmd('swap.respond',{...pin(swap),decision:'accepted'},ben.cookie,409)
 benProfile=await h.cmd('workforce.save',{...benInput,...pin(benProfile)})
 swap=await h.cmd('swap.respond',{...pin(swap),decision:'accepted'},ben.cookie)
 benProfile=await h.cmd('workforce.save',{...benInput,...pin(benProfile),sites:['Mission']})
 await h.cmd('swap.decide',{...pin(swap),decision:'approved'},manager.cookie,409)
 benProfile=await h.cmd('workforce.save',{...benInput,...pin(benProfile)})
 await h.cmd('swap.decide',{...pin(swap),decision:'approved'},manager.cookie)
 assert.equal((await h.state()).shifts.find(x=>x.id===first.id).rateBasis.staffId,ben.id)
 // Expiry is inclusive but an overnight shift touching the next day fails.
 draft=await h.cmd('roster.prepare',{week,shifts:[shift(expiry)]});assert.deepEqual(draft.conflicts,[])
 const invalid=await h.cmd('roster.prepare',{week,shifts:[shift(days(expiry,1)),shift(expiry,{start:local(expiry,'22:00'),end:local(days(expiry,1),'02:00')})]})
 assert.equal(invalid.conflicts.filter(c=>c.reason==='Certification missing or expired').length,2)
 await h.cmd('roster.publish',pin(invalid),h.owner,409)
 const omitted=await h.cmd('roster.prepare',{week,shifts:[shift(week,{job:''})]});assert.ok(omitted.conflicts.some(c=>c.reason==='Choose a job for this employee'));await h.cmd('roster.publish',pin(omitted),h.owner,409)
 const wrong=await h.cmd('roster.prepare',{week,shifts:[shift(week,{site:'Mission'})]});assert.ok(wrong.conflicts.some(c=>c.reason==='Not eligible at this site'))
 // Template, copy and recurrence keep job ids and route back through the same checks.
 draft=await h.cmd('roster.prepare',{week,shifts:[shift(expiry)]})
 const template=await h.cmd('template.save',{week,name:'Certified Wednesday'})
 const next=days(week,7),applied=await h.cmd('template.apply',{id:template.id,week:next})
 assert.equal(applied.shifts[0].job,bar.id);assert.ok(applied.conflicts.some(c=>c.reason==='Certification missing or expired'));await h.cmd('roster.publish',pin(applied),h.owner,409)
 const copied=await h.cmd('roster.copy',{fromWeek:week,week:days(week,14)});assert.ok(copied.conflicts.some(c=>c.reason==='Certification missing or expired'))
 await h.cmd('recurrence.save',{staffId:alex.id,job:bar.id,site:'Ocean Beach',days:[0],start:'09:00',end:'13:00',breakMinutes:0,from:days(week,21),until:days(week,27)})
 const recurring=await h.cmd('recurrence.apply',{week:days(week,21)});assert.ok(recurring.conflicts.some(c=>c.reason==='Certification missing or expired'))
 // Pickup checks at request and final approval, including changes after request.
 const open=await h.cmd('openshift.post',{site:'Ocean Beach',position:'Counter',job:bar.id,start:days(week,3)+'T16:00:00Z',end:days(week,3)+'T20:00:00Z',breakMinutes:0,approval:'manager'})
 await h.cmd('openshift.request',pin(open),alex.cookie,409)
 const pickup=await h.cmd('openshift.request',pin(open),ben.cookie)
 benProfile=await h.cmd('workforce.save',{...benInput,...pin(benProfile),skills:['service']})
 await h.cmd('openshift.approve',pin(pickup),manager.cookie,409)
 benProfile=await h.cmd('workforce.save',{...benInput,...pin(benProfile)})
 const assigned=await h.cmd('openshift.approve',pin(pickup),manager.cookie);assert.equal(assigned.shift.job,bar.id);assert.equal(assigned.shift.rateBasis.costCents,10800)
 // Minimum is an explicit warning; a maximum is an assignment conflict.
 let changed=await h.cmd('workforce.save',{...input,...pin(profile),minHours:8,maxHours:8})
 const maximum=await h.cmd('roster.prepare',{week,shifts:[shift(week),shift(days(week,1)),shift(expiry,{job:counter.id})]})
 assert.ok(maximum.conflicts.some(c=>c.reason==='Over maximum weekly hours'))
 const minimum=await h.cmd('roster.prepare',{week,shifts:[shift(week)]})
 assert.ok((await h.state()).scheduleReviews.find(r=>r.week===week).warnings.some(w=>w.kind==='minimum hours'))
 assert.equal(minimum.shifts[0].rateBasis.costCents,9600)
 const overnight=await h.cmd('roster.prepare',{week,shifts:[shift(week,{start:local(week,'23:00'),end:local(days(week,1),'02:00'),breakMinutes:30})]})
 assert.deepEqual(overnight.shifts[0].rateBasis.segments.map(x=>[x.date,x.minutes,x.cents]),[[week,50,2400],[days(week,1),100,2700]],'overnight payable minutes and effective rates split at venue midnight')
 assert.equal(overnight.shifts[0].rateBasis.costCents,6500)
 await h.cmd('roster.prepare',{week,shifts:[shift(week)]})
 const priorCost=JSON.stringify(minimum.shifts[0].rateBasis)
 changed=await h.cmd('workforce.save',{...input,...pin(changed),rates:[{job:bar.id,from:'2020-01-01',cents:9900}]})
 assert.equal(changed.versions.length,2);assert.equal(JSON.stringify((await h.state()).shifts.find(x=>x.id===minimum.shifts[0].id).rateBasis),priorCost,'rate edits never rewrite the reviewed draft cost')
 assert.equal((await h.state()).scheduleReviews.find(r=>r.week===week).sites[0].costCents,9600)
 await h.cmd('workforce.save',{...input,...pin(profile)},h.owner,409)
 // Approved time and payroll preparations retain their basis through later rate edits.
 const year=new Date().getUTCFullYear()-1,on=`${year}-06-03`
 let time=await h.cmd('time.prepare',{staffId:alex.id,job:bar.id,site:'Ocean Beach',start:on+'T16:00:00Z',end:on+'T20:00:00Z',breakMinutes:0,reason:'Verified employer service'})
 time=await h.cmd('time.approve',pin(time));assert.equal(time.rateBasis.costCents,39600)
 const batch=await h.cmd('payroll.prepare',{ids:[time.id]});assert.equal(batch.lines[0].rateBasis.costCents,39600)
 changed=await h.cmd('workforce.save',{...input,...pin(changed)})
 assert.equal((await h.state()).timesheets.find(x=>x.id===time.id).rateBasis.costCents,39600)
 assert.equal((await h.state()).batches.find(x=>x.id===batch.id).lines[0].rateBasis.costCents,39600)
 await h.cmd('payroll.export',pin(batch))
 const historical=await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${on}&size=60`,undefined,h.owner);assert.equal(historical.status,200);assert.equal(historical.value.intervals.reduce((n,x)=>n+x.actual.cents,0),39600,'interval report retains approved job-rate costs after retroactive edits')
 const sales=await h.send(`/api/lanyard/sales?site=Ocean%20Beach&week=${week}`,undefined,h.owner);assert.equal(sales.status,200);assert.equal(sales.value.days[0].laborCents,9600,'published costs survive profile edits and reassignment')
 const dashboard=await h.send(`/api/lanyard/dashboard?site=Ocean%20Beach&asOf=${week}T18:00:00Z`,undefined,h.owner);assert.equal(dashboard.status,200);assert.equal(dashboard.value.labor[0].scheduledCents,39600,'three published assignments plus the filled pickup retain their respective rates')
 await h.cmd('earnings.save',{estimates:false,statementUrl:''})
 const hidden=await h.state(alex.cookie);assert.deepEqual(hidden.workforce[0].rates,[]);assert.ok(hidden.workforce[0].versions.every(v=>!v.rates),'disabled estimates hide historical rates too')
 await h.cmd('earnings.save',{revision:hidden.earnings[0].revision,estimates:true,statementUrl:''})
 const a=await h.state(alex.cookie),b=await h.state(ben.cookie)
 const foreignState=await h.state(foreign.cookie);assert.equal(foreignState.workforce.length,0);assert.ok(foreignState.shifts.every(x=>!x.rateBasis));assert.ok(foreignState.timesheets.every(x=>!x.rateBasis));assert.ok(foreignState.batches.every(b=>b.lines.every(x=>!x.rateBasis)));assert.deepEqual(foreignState.rateSnapshots,[])
 assert.equal(a.workforce.length,1);assert.equal(a.workforce[0].staffId,alex.id);assert.equal(b.workforce.length,1);assert.equal(b.workforce[0].staffId,ben.id)
 assert.ok(a.shifts.every(x=>!('rateBasis'in x)));assert.ok(a.timesheets.every(x=>!('rateBasis'in x)));assert.deepEqual(a.rateSnapshots,[])
 const key=await h.cmd('agent.create',{label:'Workforce preparation'}),agent=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})
 const proposed=await h.send('/api/lanyard/agent/command',{name:'roster.prepare',input:{week,shifts:[shift(week)]}},'',{authorization:`Bearer ${key.token}`});assert.equal(proposed.status,200);assert.ok(proposed.value.result.shifts.every(x=>!x.rateBasis))
 assert.equal(agent.status,200);assert.deepEqual(agent.value.workforce,[]);assert.ok(agent.value.shifts.every(x=>!x.rateBasis));assert.ok(agent.value.timesheets.every(x=>!x.rateBasis));assert.ok(agent.value.batches.every(b=>b.lines.every(x=>!x.rateBasis)))
 return f
}
export async function workforceBrowser() {
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {
  const f=await workforceFixture(h),draft=await h.cmd('roster.prepare',{week:f.week,shifts:[f.shift(f.week),f.shift(days(f.week,1))]})
  await h.cmd('roster.publish',pin(draft));await h.cmd('roster.prepare',{week:f.week,shifts:[f.shift(f.week),f.shift(days(f.week,1))]})
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hourCycle:'h23'}).format(new Date(f.shift(f.week).start)))
  for(let i=0;i<4;i++)await h.cmd('sales.save',{site:'Ocean Beach',date:f.week,hour:hour+i,metric:'sales',value:'1000.00'})
  // Changing the rate after review must leave the browser's cost unchanged.
  await h.cmd('workforce.save',{...f.input,...pin(f.profile),rates:[{job:f.bar.id,from:'2020-01-01',cents:9900}]})
  const oldDay=`${new Date().getUTCFullYear()-1}-06-03`;await h.cmd('time.prepare',{staffId:f.alex.id,job:f.bar.id,site:'Ocean Beach',start:local(oldDay,'09:00'),end:local(oldDay,'13:00'),breakMinutes:0,reason:'Job-rate review evidence'})
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  for(const width of [1440,390]) {
   const current=(await h.state()).workforce.find(p=>p.staffId===f.alex.id),reset=await h.cmd('workforce.save',{...f.input,...pin(current)})
   await h.cmd('roster.prepare',{week:f.week,shifts:[f.shift(f.week),f.shift(days(f.week,1))]})
   await h.cmd('workforce.save',{...f.input,...pin(reset),rates:[{job:f.bar.id,from:'2020-01-01',cents:9900}]})
   const context=await browser.newContext({viewport:{width,height:1000}}),[name,...value]=h.owner.split('=')
   await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.goto(h.origin+`/app/schedule?week=${f.week}&site=Ocean%20Beach&view=draft`,{waitUntil:'networkidle'})
   const review=page.locator('[data-saved-review]');assert.ok((await review.innerText()).includes('$204.00'));assert.ok((await review.innerText()).includes('effective USD job-rate basis'));assert.ok((await review.innerText()).includes('below employer-recorded minimum'))
   assert.ok((await page.locator('.week .foot .total').innerText()).includes('$204.00'),'grid and review share retained costs')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'PEOPLE-002 retained-cost screen fits viewport')
   if(process.env.WORKFORCE_SCREENS){await mkdir(process.env.WORKFORCE_SCREENS,{recursive:true});await review.scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`review-${width}.png`)});await review.screenshot({path:join(process.env.WORKFORCE_SCREENS,`review-section-${width}.png`)});await page.locator('.week').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`grid-${width}.png`)})}
   await page.goto(h.origin+`/app/intervals?site=Ocean%20Beach&date=${f.week}&size=60`,{waitUntil:'networkidle'});assert.ok((await page.locator('#intervals').innerText()).includes('2.4%'),'interval labor uses retained $24 job rate, not the edited $99 rate');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.WORKFORCE_SCREENS)await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`intervals-${width}.png`),fullPage:true})
   await page.goto(h.origin+'/app/time?site=Ocean%20Beach',{waitUntil:'networkidle'});assert.ok((await page.locator('#approve .review').first().innerText()).includes('Barista at Ocean Beach'));assert.ok((await page.locator('#approve .review').first().innerText()).includes('cost $396.00'),'pending manual time uses the selected job rate');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.WORKFORCE_SCREENS){await page.locator('#approve').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.WORKFORCE_SCREENS,`time-${width}.png`)});await page.locator('#approve').screenshot({path:join(process.env.WORKFORCE_SCREENS,`time-section-${width}.png`)})}
   await page.goto(h.origin+`/app/schedule?week=${f.week}&site=Ocean%20Beach&view=draft`,{waitUntil:'networkidle'})
   const editor=page.locator('[data-roster-form]');await editor.locator('[data-shift=label]').first().fill('Updated service label')
   const [saved]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name=roster.prepare')),editor.getByRole('button',{name:'Prepare draft',exact:true}).click()]);assert.equal(saved.status(),200)
   const state=await h.state(),prepared=state.rosters.find(r=>r.week===f.week&&r.status==='draft');assert.ok(state.shifts.filter(x=>x.rosterId===prepared.id&&x.status==='draft').every(x=>x.job===f.bar.id),'PEOPLE-002: visual edits preserve assigned jobs through the real form door');assert.equal(await page.locator('.notice.error').count(),0)
   assert.deepEqual(errors,[]);await context.close()
  }
  assert.equal(draft.shifts.length,2)
 } finally {await browser.close();await h.close()}
}

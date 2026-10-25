import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days} from './workforce-journey.mjs'

const week='2026-10-12'
const shift=(id,date,start,hours,site='East')=>({staffId:id,site,start:`${date}T${String(start).padStart(2,'0')}:00:00.000Z`,end:new Date(Date.parse(`${date}T00:00:00Z`)+(start+hours)*3600000).toISOString(),breakMinutes:0})
async function wage(h,p,rate){
 const current=(await h.state()).staff.find(x=>x.id===p.id)
 return h.cmd('staff.save',{...pin(current),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:'East',position:'Service',hourlyRate:rate})
}
async function approve(h,spec){const t=await h.cmd('time.prepare',{...spec,reason:'Recorded service hours reviewed against the signed timesheet'});return h.cmd('time.approve',pin(t))}
async function own(h,person,on=week){const r=await h.send(`/api/lanyard/state?week=${on}`,undefined,person.cookie);assert.equal(r.status,200,r.text);return r.value}
async function fixture(h,rates=['20.00','30.00']){
 await h.cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben')
 await wage(h,alex,rates[0]);await wage(h,ben,'80.00')
 for(const site of ['East','West'])await h.cmd('policy.save',{site,preset:'CA',from:'2026-01-01',reviewReason:'Reviewed California daily and workweek overtime for both service sites'})
 await h.cmd('differential.save',{name:'Monday service',from:'2026-01-01',through:'',site:'',role:'',tag:'',startMinute:0,endMinute:1440,days:[1],mode:'added',value:100,order:0,code:'SERVICE'})
 const first=shift(alex.id,week,8,5),second=shift(alex.id,week,13,8,'West')
 await h.cmd('availability.save',{staffId:alex.id,start:week+'T00:00:00Z',end:days(week,7)+'T00:00:00Z'})
 const roster=await h.cmd('roster.prepare',{week,shifts:[first,second]});await h.cmd('roster.publish',pin(roster))
 const approved=await approve(h,first);await wage(h,alex,rates[1]);await approve(h,second)
 await approve(h,shift(ben.id,week,8,13))
 await h.cmd('clock.in',{commandId:'policy-earnings-pending-in',capturedAt:days(week,1)+'T08:00:00Z'},alex.cookie)
 await h.cmd('clock.out',{commandId:'policy-earnings-pending-out',capturedAt:days(week,1)+'T10:00:00Z',breakMinutes:0},alex.cookie)
 await wage(h,alex,'99.00')
 const settings=await h.cmd('earnings.save',{estimates:true,statementUrl:'https://payroll.example/statements',payDays:5})
 return {alex,ben,approved,settings}
}

// Policy amounts reach the employee through the native state and page routes.
export async function policyEarningsApi(){
 const h=await harness()
 try{
  const {alex,ben,approved,settings}=await fixture(h),report=await h.cmd('policy.review',{staffId:alex.id,week}),s=await own(h,alex),e=s.ownEarnings
  assert.deepEqual([e.requestedWeek,e.week,e.end,e.payDate],[week,week,days(week,6),days(week,11)])
  assert.deepEqual([e.scheduledMinutes,e.regularMinutes,e.overtimeMinutes,e.doubleMinutes,e.pendingMinutes],[780,480,240,60,120])
  assert.equal(report.breakPremiumMinutes,60,'unreviewed missed meals produce a review estimate only')
  assert.equal(e.estimateCents,report.estimateCents+1300,'retained mixed rates plus the approved differential, excluding meal-review estimates')
  assert.equal(e.differential.costCents,1300)
  assert.equal(e.regularCostCents+e.overtimeCostCents+e.doubleCostCents+e.differential.costCents,e.estimateCents,'displayed categories reconcile to gross')
  assert.ok(!e.approvedIds.some(id=>s.timesheets.find(t=>t.id===id)?.staffId===ben.id))
  assert.ok(s.timesheets.every(t=>t.staffId===alex.id))
  assert.deepEqual(s.policies,[],'employee never receives employer policy configuration')
  assert.doesNotMatch(JSON.stringify(e),/"(?:rules|policyId|rateReference|parts|facts|staffId)":/,'earnings projection carries only own totals and source ids')
  await h.cmd('policy.review',{staffId:alex.id,week},alex.cookie,403)
  const correction=await h.cmd('time.prepare',{...shift(alex.id,week,8,4),corrects:approved.id,reason:'Supervisor confirmed one hour was entered twice'})
  assert.equal((await own(h,alex)).ownEarnings.estimateCents,e.estimateCents,'pending correction leaves approved earnings in place')
  await h.cmd('time.approve',pin(correction))
  const corrected=await own(h,alex),revised=await h.cmd('policy.review',{staffId:alex.id,week})
  assert.deepEqual([corrected.ownEarnings.regularMinutes,corrected.ownEarnings.overtimeMinutes,corrected.ownEarnings.doubleMinutes],[480,240,0])
  assert.equal(corrected.ownEarnings.estimateCents,revised.estimateCents+1200)
  const dana=await h.person('Dana');await approve(h,shift(dana.id,week,8,4))
  const unrated=(await own(h,dana)).ownEarnings;assert.equal(unrated.estimateCents,null);assert.equal(unrated.rateCents,null)
  await h.cmd('earnings.save',{revision:settings.revision,estimates:false,statementUrl:settings.statementUrl,payDays:5})
  const hidden=await own(h,alex),off=hidden.ownEarnings
  assert.equal(off.estimateCents,null);assert.equal(off.rateCents,null);assert.equal(hidden.staff[0].hourlyRateCents,undefined)
  for(const field of ['regularCostCents','overtimeCostCents','doubleCostCents'])assert.equal(off[field],null)
  for(const field of ['paidLeave','differential','jurisdiction','holiday'])assert.equal(off[field].costCents,null,'no monetary totals while estimates are off')
  assert.deepEqual([off.regularMinutes,off.overtimeMinutes,off.doubleMinutes,off.pendingMinutes],[480,240,0,120])
  const agent=await h.cmd('agent.create',{label:'Scheduling preparation'})
  const context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`})
  assert.equal(context.value.ownEarnings,null,'preparation agent receives no employee earnings')
 }finally{await h.close()}
 await earningsRounding()
 await splitPeriod()
}

async function earningsRounding(){
 const h=await harness()
 try{
  const {alex}=await fixture(h,['20.03','30.02']),e=(await own(h,alex)).ownEarnings
  assert.equal(e.estimateCents,43184,'retained earnings round once to cents')
  assert.equal(e.regularCostCents+e.overtimeCostCents+e.doubleCostCents+e.differential.costCents,e.estimateCents,'visible categories allocate the rounding cent without losing pay')
 }finally{await h.close()}
}

async function splitPeriod(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'});const alex=await h.person('Alex');await wage(h,alex,'20.00')
  await h.cmd('policy.save',{site:'East',preset:'federal',from:'2026-01-01',reviewReason:'Reviewed workweek overtime across the first partial pay period'})
  await h.cmd('paygroup.save',{name:'Semimonthly service',cadence:'semimonthly',from:'2026-10-16',payDays:5,workweekStart:1,staffIds:[alex.id]})
  for(let i=0;i<4;i++)await approve(h,shift(alex.id,days(week,i),8,10))
  await approve(h,shift(alex.id,days(week,4),8,8))
  const e=(await own(h,alex,'2026-10-19')).ownEarnings
  assert.deepEqual([e.week,e.end,e.payDate],['2026-10-16','2026-10-31','2026-11-05'])
  assert.deepEqual([e.regularMinutes,e.overtimeMinutes,e.doubleMinutes,e.estimateCents],[0,480,0,24000],'earlier workweek hours establish overtime, but do not enter this period pay')
  assert.equal((await own(h,alex,'2026-11-02')).ownEarnings.estimateCents,0,'empty later period cannot inherit earlier pay')
  const ben=await h.person('Ben');await wage(h,ben,'20.00');await approve(h,shift(ben.id,'2026-10-18',22,4))
  assert.equal((await own(h,ben)).ownEarnings.regularMinutes,240,'unassigned overnight record stays in the week of its venue start')
  assert.equal((await own(h,ben,'2026-10-19')).ownEarnings.regularMinutes,0,'overnight tail is not counted again in the next unassigned week')
 }finally{await h.close()}
}

export async function policyEarningsBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fixture(h),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=f.alex.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await page.goto(h.origin+`/app/time?week=${week}`,{waitUntil:'networkidle'})
   const card=page.locator('#earnings'),row=label=>card.getByRole('row').filter({has:page.getByRole('rowheader',{name:label,exact:true})})
   assert.match(await row('Regular (approved)').innerText(),/8\.0 hrs/)
   assert.match(await row('Overtime (approved)').innerText(),/4\.0 hrs/)
   assert.match(await row('Double time (approved)').innerText(),/1\.0 hrs/)
   assert.match(await row('Pending approval (not in the estimate)').innerText(),/2\.0 hrs/)
   assert.match(await card.innerText(),/\$431\.46/);assert.match(await card.innerText(),/weighted-average estimate/)
   assert.equal(await card.getByRole('link',{name:'Open your pay statement'}).getAttribute('href'),'https://payroll.example/statements')
   const shot=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.POLICY_EARNINGS_SCREENS){await mkdir(process.env.POLICY_EARNINGS_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_EARNINGS_SCREENS,`${label}-${width}.png`)})}}
   await card.scrollIntoViewIfNeeded();await shot('policy-earnings')
   const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('policy-earnings-tooltip')
   await h.cmd('earnings.save',{revision:f.settings.revision,estimates:false,statementUrl:f.settings.statementUrl,payDays:5});await page.reload({waitUntil:'networkidle'})
   assert.doesNotMatch(await card.innerText(),/\$/);assert.match(await card.innerText(),/turned off pay estimates/);await card.scrollIntoViewIfNeeded();await shot('policy-earnings-off')
   const current=(await h.state()).earnings[0];await h.cmd('earnings.save',{revision:current.revision,estimates:true,statementUrl:f.settings.statementUrl,payDays:5})
   const sitePolicy=(await h.state()).policies.find(p=>p.site==='East'),change={...pin(sitePolicy),site:'East',from:'2026-01-01',staffId:f.alex.id,...Object.fromEntries(['federalOvertime','stateWeekly','stateDaily','stateConsecutive','stateSeventh','meal','rest','weeklyRest'].map(k=>[k,'covered'])),federalOvertime:'reviewed-not-applicable',legalBasis:'Employer-recorded federal applicability decision; other cafe evidence remains unresolved',evidenceReference:'synthetic-lanyard-1 applicability evidence',reviewReason:'Review this employee at every worked cafe'}
   const preview=await h.cmd('policy.worker.preview',change);await h.cmd('policy.worker.save',{...change,reviewDigest:preview.digest})
   await page.reload({waitUntil:'networkidle'});const unresolved=(await own(h,f.alex)).ownEarnings;assert.equal(unresolved.policyReviewRequired,true);assert.equal(unresolved.estimateCents,null);assert.equal(await card.locator('.estimate').count(),0)
   await card.getByText('Your employer needs to review policy inputs before a pay estimate can be shown.',{exact:true}).scrollIntoViewIfNeeded();await shot('policy-earnings-review')
   assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,days} from './workforce-journey.mjs'
import {browserAssets} from './policy-settings-journey.mjs'

const site='River Cafe',week='2026-10-12'
const coverageKinds=['federalOvertime','stateWeekly','stateDaily','stateConsecutive','stateSeventh','meal','rest','weeklyRest']
const legalBasis='Employer-reviewed 240-minute normal workday for Maria Chen; WAC 296-126-092(3) additional meal review'
const evidenceReference='synthetic-lanyard-1 River Cafe retained normal workday schedule'
const reviewReason='Reviewed Maria Chen’s normal workday and recorded meals independently of the five-hour meal spacing rule'
const samples=[
 {name:'Additional meal missing at three extra worked hours',span:450,meals:[[120,30]],rests:[60,240,375],minutes:420,mealExceptions:1},
 {name:'Additional meal taken during overtime',span:480,meals:[[120,30],[360,30]],rests:[60,240,420],minutes:420,mealExceptions:0},
 {name:'One minute below three extra worked hours',span:449,meals:[[120,30]],rests:[60,240,375],minutes:419,mealExceptions:0},
 {name:'Two meals still require five-hour spacing',span:700,meals:[[120,30],[500,30]],rests:[60,240,400,620],minutes:640,mealExceptions:1},
]
const mealExceptions=review=>review.issues.filter(i=>i.kind==='meal'&&i.state==='exception')
const normalUnknown=review=>review.issues.some(i=>i.state==='unknown'&&/normal.?workday/i.test(i.message))
const dayReview=(report,index)=>{
 const review=report.breakReviews.find(r=>r.date===days(week,index))
 assert.ok(review,'the recorded work period has a retained break review')
 return review
}

async function person(h,key,name,cafe=site){
 const p=await h.person(key)
 await h.cmd('staff.save',{...pin(p),name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:cafe,hourlyRate:'22.00'})
 return {...p,name}
}
const configureWA=(h,cafe=site,extra={})=>h.cmd('policy.save',{site:cafe,preset:'WA',from:'2026-01-01',reviewReason:'Reviewed covered Washington cafe meal and paid rest rules',...extra})
const changeFor=(policy,p,extra={})=>({...pin(policy),site:policy.site,from:policy.from,staffId:p.id,...Object.fromEntries(coverageKinds.map(k=>[k,'covered'])),normalWorkdayMinutes:240,legalBasis,evidenceReference,reviewReason,...extra})

async function capture(h,p,sample,index){
 const at=minute=>new Date(Date.parse(days(week,index)+'T08:00:00Z')+minute*60000).toISOString()
 const id=`washington-${p.id}-${index}`
 await h.cmd('clock.in',{commandId:id+'-in',capturedAt:at(0)},p.cookie)
 const breaks=[...sample.meals.map(([start,length])=>({kind:'meal',start,length})),...sample.rests.map(start=>({kind:'rest',start,length:10}))].sort((a,b)=>a.start-b.start)
 for(const [i,b]of breaks.entries()){
  await h.cmd('clock.breakStart',{commandId:`${id}-break-${i}`,capturedAt:at(b.start),kind:b.kind},p.cookie)
  await h.cmd('clock.breakEnd',{commandId:`${id}-end-${i}`,capturedAt:at(b.start+b.length)},p.cookie)
 }
 const out=await h.cmd('clock.out',{commandId:id+'-out',capturedAt:at(sample.span),breakMinutes:0},p.cookie)
 assert.equal(out.timesheet.minutes,sample.minutes,'only unpaid meals reduce captured paid minutes')
 return h.cmd('time.approve',pin(out.timesheet))
}

async function fixture(h,count=samples.length){
 await h.cmd('settings.save',{timezone:'UTC'})
 const maria=await person(h,'MariaChen','Maria Chen'),policy=await configureWA(h)
 for(const [i,sample]of samples.slice(0,count).entries())await capture(h,maria,sample,i)
 return {maria,policy}
}

// One native owner and staff journey covers the worked-minute boundary, independent
// meal spacing, exact review approval, retained sources and private evidence.
export async function policyWashingtonApi(){
 const h=await harness()
 try{
  const f=await fixture(h),before=await h.cmd('policy.review',{staffId:f.maria.id,week})
  for(const i of [0,1,2]){
   const review=dayReview(before,i)
   assert.ok(normalUnknown(review),'an unreviewed normal day leaves additional-meal eligibility unknown')
   assert.equal(mealExceptions(review).length,0,'missing normal-day evidence never invents an additional meal violation')
  }
  assert.equal(mealExceptions(dayReview(before,3)).length,1,'ordinary five-hour spacing remains reviewable without normal-day evidence')
  let change=changeFor(f.policy,f.maria)
  for(const patch of [{legalBasis:''},{evidenceReference:''},{reviewReason:''}])await h.cmd('policy.worker.preview',{...change,...patch},h.owner,400)
  const {rest,...incomplete}=change
  await h.cmd('policy.worker.preview',incomplete,h.owner,400)
  await h.cmd('policy.worker.preview',{...change,mealWaiver:true},h.owner,400)
  await h.cmd('policy.preview',{...pin(f.policy),site,preset:'WA',from:f.policy.from,industry:'factory',reviewReason},h.owner,400)
  await h.cmd('policy.worker.save',change,h.owner,409)
  const retained=await h.state()
  let preview=await h.cmd('policy.worker.preview',change)
  assert.deepEqual((await h.state()).policies,retained.policies,'preview does not save the normal workday')
  assert.equal(preview.worker.normalWorkdayMinutes,240)
  const calculation=preview.calculations.find(c=>c.staffId===f.maria.id&&c.week===week)
  assert.ok(calculation)
  for(const [i,sample]of samples.entries()){
   const review=dayReview(calculation.after,i)
   assert.equal(mealExceptions(review).length,sample.mealExceptions,sample.name)
   assert.equal(normalUnknown(review),false,sample.name+' has reviewed normal-day evidence')
   assert.equal(review.issues.filter(i=>i.kind==='rest').length,0,'captured paid rests isolate the meal obligation')
  }
  // A new pending source invalidates approval even though approved totals agree.
  const pending=await h.cmd('time.prepare',{staffId:f.maria.id,site,start:'2026-10-16T08:00:00Z',end:'2026-10-16T09:00:00Z',breakMinutes:0,reason:'Later River Cafe source arrived after the applicability preview'})
  await h.cmd('policy.worker.save',{...change,reviewDigest:preview.digest},h.owner,409)
  assert.deepEqual((await h.state()).policies,retained.policies)
  preview=await h.cmd('policy.worker.preview',change)
  let policy=await h.cmd('policy.worker.save',{...change,reviewDigest:preview.digest})
  const profile=policy.coverage.find(p=>p.staffId===f.maria.id)
  assert.equal(profile.normalWorkdayMinutes,240)
  assert.equal(profile.evidenceReference,evidenceReference)
  assert.equal(profile.legalBasis,legalBasis)
  assert.equal(policy.releaseReview.digest,preview.digest)
  const {versions,...prior}=f.policy
  assert.deepEqual(policy.versions.at(-1),prior,'the earlier policy remains available for historical review')
  const actual=await h.cmd('policy.review',{staffId:f.maria.id,week})
  const reviewed=preview.calculations.find(c=>c.staffId===f.maria.id&&c.week===week).after
  for(const [i,sample]of samples.entries())assert.deepEqual(dayReview(actual,i).issues,dayReview(reviewed,i).issues,sample.name+' applies the reviewed result')
  assert.equal(actual.coverage.inputs.find(i=>i.profile.staffId===f.maria.id).profile.normalWorkdayMinutes,240)
  assert.equal(actual.minutes,samples.reduce((n,s)=>n+s.minutes,0),'paid rest minutes survive the recalculation')
  const saved=await h.state()
  assert.deepEqual(saved.clocks,retained.clocks)
  for(const t of retained.timesheets)assert.deepEqual(saved.timesheets.find(r=>r.id===t.id),t,'applicability never rewrites approved captures or rate inputs')
  assert.equal(saved.timesheets.find(r=>r.id===pending.id).status,'submitted')
  // Zero explicitly clears the normal day; an omitted field retains the reviewed input.
  change=changeFor(policy,f.maria,{normalWorkdayMinutes:0,legalBasis:'',evidenceReference:''})
  const zero=await h.cmd('policy.worker.preview',change)
  assert.ok(normalUnknown(dayReview(zero.calculations.find(c=>c.staffId===f.maria.id).after,0)))
  await h.cmd('policy.worker.save',change,h.owner,409)
  const {normalWorkdayMinutes,...omitted}=changeFor(policy,f.maria)
  const retainedInput=await h.cmd('policy.worker.preview',omitted)
  assert.equal(retainedInput.worker.normalWorkdayMinutes,240)
  assert.equal(normalUnknown(dayReview(retainedInput.calculations.find(c=>c.staffId===f.maria.id).after,0)),false)
  assert.equal((await h.state()).policies.find(r=>r.id===policy.id).coverage.find(p=>p.staffId===f.maria.id).normalWorkdayMinutes,240)
  // Historical releases do not acquire a new normal-day meal obligation.
  const legacySite='River Cafe Annex',leo=await person(h,'LeoChen','Leo Chen',legacySite)
  let historical=await configureWA(h,legacySite,{breakVersion:'2026-10-26'})
  await capture(h,leo,samples[0],0)
  const historicalBefore=await h.cmd('policy.review',{staffId:leo.id,week})
  change=changeFor(historical,leo,{legalBasis:'Employer-reviewed 240-minute normal workday for Leo Chen',evidenceReference:'synthetic-lanyard-2 River Cafe Annex historical schedule'})
  preview=await h.cmd('policy.worker.preview',change)
  historical=await h.cmd('policy.worker.save',{...change,reviewDigest:preview.digest})
  const historicalAfter=await h.cmd('policy.review',{staffId:leo.id,week})
  assert.deepEqual(historicalAfter.breakReviews[0].issues,historicalBefore.breakReviews[0].issues)
  assert.equal(mealExceptions(historicalAfter.breakReviews[0]).length,0)
  assert.equal(normalUnknown(historicalAfter.breakReviews[0]),false)
  assert.equal(historicalAfter.coverage.inputs[0].profile.normalWorkdayMinutes,240)
  const other=await h.cmd('policy.save',{site:'River Cafe Oregon',preset:'OR',from:'2026-01-01',reviewReason:'Reviewed Oregon coverage independently'})
  await h.cmd('policy.worker.preview',changeFor(other,f.maria),h.owner,400)
  for(const staff of [f.maria,leo]){
   const state=await h.state(staff.cookie)
   assert.deepEqual(state.policies,[])
   assert.ok(!JSON.stringify(state).includes(evidenceReference),'private employer evidence is absent from staff state')
   const settings=await h.send('/app/settings',undefined,staff.cookie)
   assert.equal(settings.status,403)
   assert.ok(!settings.text.includes(evidenceReference))
   await h.cmd('policy.review',{staffId:f.maria.id,week},staff.cookie,403)
   await h.cmd('policy.worker.preview',changeFor(policy,f.maria),staff.cookie,403)
  }
  assert.equal((await h.state()).batches.length,0,'policy review produces no payroll submission')
 }finally{await h.close()}
}

export async function policyWashingtonBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await fixture(h,1)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await browserAssets(context)
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage(),shot=async label=>{if(process.env.POLICY_SCREENS){await mkdir(process.env.POLICY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_SCREENS,`Washington-normal-${label}-${width}.png`)})}}
   await page.goto(h.origin+'/app/schedule',{waitUntil:'networkidle'})
   const account=page.getByLabel('Account',{exact:true});await account.focus()
   await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
   await account.click();await page.getByRole('link',{name:'Settings',exact:true}).click();await page.waitForLoadState('networkidle')
   const picker=page.locator('#policy-pick')
   await picker.getByLabel('Cafe',{exact:true}).selectOption(site)
   await picker.getByLabel('Policy preset',{exact:true}).selectOption('WA')
   await picker.getByRole('button',{name:'Open policy',exact:true}).click();await page.waitForLoadState('networkidle')
   const worker=page.locator('#worker-policy')
   await worker.getByLabel('Review a person',{exact:true}).selectOption(f.maria.id)
   await worker.getByRole('button',{name:'Open applicability review',exact:true}).click();await page.waitForLoadState('networkidle')
   const editor=page.locator('[data-worker-editor]'),normal=editor.getByLabel('Normal workday (minutes)',{exact:true})
   await normal.fill('240')
   await editor.getByLabel('Legal basis for any rule not applied',{exact:true}).fill(legalBasis)
   await editor.getByLabel('Employer evidence reference',{exact:true}).fill(evidenceReference)
   await editor.getByLabel('Applicability review reason',{exact:true}).fill(reviewReason)
   await normal.scrollIntoViewIfNeeded();await shot('config')
   await editor.getByRole('button',{name:'Preview applicability',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   assert.equal((await h.state()).policies.find(p=>p.id===f.policy.id).revision,f.policy.revision)
   const preview=page.locator('#worker-preview'),apply=page.locator('[data-worker-apply]')
   const payload=await apply.evaluate(form=>Object.fromEntries(new FormData(form)))
   const review=await h.cmd('policy.worker.preview',{...payload,revision:Number(payload.revision),normalWorkdayMinutes:Number(payload.normalWorkdayMinutes)})
   const calculation=review.calculations.find(c=>c.staffId===f.maria.id&&c.week===week)
   assert.ok(normalUnknown(calculation.before.breakReviews[0]))
   assert.equal(mealExceptions(calculation.after.breakReviews[0]).length,1)
   await preview.getByText('Calculation inputs and retained sources',{exact:true}).click()
   const sources=await preview.locator('pre').innerText(),source=JSON.parse(sources)
   assert.equal(source.after.coverage.inputs[0].profile.normalWorkdayMinutes,240,'the visible source disclosure contains the actual proposed worker profile')
   assert.ok(sources.includes(evidenceReference))
   await preview.scrollIntoViewIfNeeded();await shot('preview')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   const digest=await apply.locator('[name=reviewDigest]').inputValue()
   await apply.locator('input[type=checkbox]').check()
   await apply.getByRole('button',{name:'Apply reviewed applicability',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   const policy=(await h.state()).policies.find(p=>p.id===f.policy.id),profile=policy.coverage.find(p=>p.staffId===f.maria.id)
   assert.equal(profile.normalWorkdayMinutes,240)
   assert.equal(profile.evidenceReference,evidenceReference)
   assert.equal(policy.releaseReview.digest,digest)
   assert.equal((await h.cmd('policy.review',{staffId:f.maria.id,week})).coverage.inputs[0].profile.normalWorkdayMinutes,240)
   await worker.getByText('Current employer decision',{exact:true}).click()
   await worker.scrollIntoViewIfNeeded();await shot('applied')
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

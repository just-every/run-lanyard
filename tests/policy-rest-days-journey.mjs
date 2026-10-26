import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const week='2026-10-12',at=(date,time)=>`${date}T${time}:00Z`
async function cafe(h,p,site){
 const current=(await h.state()).staff.find(r=>r.id===p.id)
 await h.cmd('staff.save',{...pin(current),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site,hourlyRate:'20.00'})
}
async function capture(h,p,site,date,start,end,rests=[]){
 await cafe(h,p,site)
 await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:at(date,start)},p.cookie)
 for(const [begin,finish]of rests){
  await h.cmd('clock.breakStart',{commandId:crypto.randomUUID(),capturedAt:at(date,begin),kind:'rest'},p.cookie)
  await h.cmd('clock.breakEnd',{commandId:crypto.randomUUID(),capturedAt:at(date,finish)},p.cookie)
 }
 const out=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:at(date,end),breakMinutes:0},p.cookie)
 return h.cmd('time.approve',pin(out.timesheet))
}
const review=(h,p,on=week)=>h.cmd('policy.review',{staffId:p.id,week:on})
const daily=(report,date)=>report.breakReviews.find(r=>r.workdayDate===date&&r.requiredRests!==undefined)

// Public policy review sees all retained service at both cafes. Neither an
// off-clock interval nor another source record proves a paid rest occurred.
export async function policyRestDaysApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  for(const site of ['East','West'])await h.cmd('policy.save',{site,preset:'CA',from:'2026-01-01',workdayStart:'04:00',reviewReason:'Reviewed fixed employer workday for daily California rest entitlement'})
  const split=await h.person('RestSplit')
  const east=await capture(h,split,'East',week,'08:00','10:00')
  const west=await capture(h,split,'West',week,'13:00','15:00')
  let report=await review(h,split),day=daily(report,week)
  assert.ok(day,'split service receives a daily rest review')
  assert.deepEqual([day.workedMinutes,day.requiredRests,day.recordedRests,day.restPremiumMinutes],[240,1,0,60])
  assert.deepEqual(new Set(day.timeIds),new Set([east.id,west.id]))
  assert.equal(day.issues.find(i=>i.kind==='rest').state,'exception')
  assert.equal(report.minutes,240,'the service gap does not become paid time')
  assert.equal(report.breakPremiumMinutes,60,'two cafes produce one daily rest premium')

  const rested=await h.person('RestTaken')
  await capture(h,rested,'East',week,'08:00','10:00',[['09:00','09:10']])
  await capture(h,rested,'West',week,'13:00','15:00')
  report=await review(h,rested);day=daily(report,week)
  assert.deepEqual([day.requiredRests,day.recordedRests,day.restPremiumMinutes,report.minutes],[1,1,0,240],'one captured paid rest satisfies the split day without deducting paid minutes')

  const manual=await h.person('RestUntimed')
  await cafe(h,manual,'East')
  for(const [site,start,end]of [['East','08:00','10:00'],['West','13:00','15:00']]){
   const time=await h.cmd('time.prepare',{staffId:manual.id,site,start:at(week,start),end:at(week,end),breakMinutes:0,reason:'Employer-reviewed untimed split service'})
   await h.cmd('time.approve',pin(time))
  }
  day=daily(await review(h,manual),week)
  assert.deepEqual([day.requiredRests,day.recordedRests,day.restPremiumMinutes],[1,0,0])
  assert.equal(day.issues.find(i=>i.kind==='rest').state,'unknown','manual rows cannot establish missed or taken rest timing')

  const multiple=await h.person('RestDailyCap')
  await capture(h,multiple,'East',week,'07:00','11:00')
  await capture(h,multiple,'West',week,'13:00','17:00')
  report=await review(h,multiple);day=daily(report,week)
  assert.deepEqual([day.requiredRests,day.restPremiumMinutes,report.breakPremiumMinutes],[2,60,60],'multiple missed rests and source rows retain one rest premium for the workday')

  const boundary=await h.person('RestPriorContext')
  await capture(h,boundary,'East','2026-10-10','08:00','10:00')
  await capture(h,boundary,'East','2026-10-11','22:00','23:59')
  await capture(h,boundary,'West',week,'00:00','02:01')
  report=await review(h,boundary);day=daily(report,'2026-10-11')
  assert.deepEqual([day.workedMinutes,day.requiredRests,day.restPremiumMinutes],[240,1,60],'prior workweek context supplies the rest entitlement before the 04:00 boundary')
  assert.equal(report.minutes,121,'prior context does not replay paid minutes in the current week')
  assert.equal(day.premiumWeek,'2026-10-05','the first retained paid venue date owns the estimate')
  assert.equal(report.breakPremiumMinutes,0,'prior workday context cannot repeat its premium in the next workweek')
  const previous=await review(h,boundary,'2026-10-05')
  assert.equal(daily(previous,'2026-10-11').premiumWeek,'2026-10-05')
  assert.equal(previous.breakPremiumMinutes,60,'the owning workweek retains the premium once')
  assert.equal(previous.breakPremiumMinutes+report.breakPremiumMinutes,60,'combined weekly reports reconcile to one rest premium')
  await h.restart()
  assert.equal((await review(h,boundary)).breakPremiumMinutes,0,'restart preserves estimate ownership without writing a payroll claim')
  assert.ok(!report.breakReviews.some(r=>r.workdayDate==='2026-10-10'),'unrelated prior workdays stay outside the selected week')

  const straddle=await h.person('RestAcrossAnchor')
  await cafe(h,straddle,'East')
  await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:at(week,'00:00')},straddle.cookie)
  await h.cmd('clock.breakStart',{commandId:crypto.randomUUID(),capturedAt:at(week,'03:55'),kind:'rest'},straddle.cookie)
  await h.cmd('clock.breakEnd',{commandId:crypto.randomUUID(),capturedAt:at(week,'04:05')},straddle.cookie)
  const out=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:at(week,'08:00'),breakMinutes:0},straddle.cookie)
  await h.cmd('time.approve',pin(out.timesheet))
  report=await review(h,straddle)
  for(const date of ['2026-10-11',week]){
   day=daily(report,date)
   assert.deepEqual([day.requiredRests,day.recordedRests,day.restPremiumMinutes],[1,0,0],'a rest crossing the anchor requires review rather than double credit or a fabricated premium')
   assert.equal(day.issues.find(i=>i.kind==='rest').state,'unknown')
  }
  assert.equal(report.minutes,480,'rest placement review preserves all paid work')
  assert.equal((await h.state()).batches.length,0,'rest review never creates payroll')
 }finally{await h.close()}
}

// Captures remain native across both cafe transfers and the workweek boundary.
export async function mealBoundaryFixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 for(const site of ['East','West'])await h.cmd('policy.save',{site,preset:'CA',from:'2026-01-01',workdayStart:'04:00',breakVersion:'2026-10-26.2',reviewReason:'Retained reviewed employer day before cross-week meal context release'})
 const missed=await h.person('BoundaryMealMissing'),taken=await h.person('BoundaryMealTaken')
 for(const p of [missed,taken])for(const [site,start,end,breaks]of [
  ['East','2026-10-11T22:00:00Z','2026-10-12T02:00:00Z',p.id===taken.id?[['rest','2026-10-11T23:50:00Z','2026-10-12T00:00:00Z']]:[]],
  ['West','2026-10-12T02:00:00Z','2026-10-12T06:00:00Z',p.id===taken.id?[['meal','2026-10-12T02:00:00Z','2026-10-12T02:30:00Z'],['rest','2026-10-12T04:50:00Z','2026-10-12T05:00:00Z']]:[]],
 ]){
  await cafe(h,p,site)
  await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:start},p.cookie)
  for(const [kind,begin,finish]of breaks){
   await h.cmd('clock.breakStart',{commandId:crypto.randomUUID(),capturedAt:begin,kind},p.cookie)
   await h.cmd('clock.breakEnd',{commandId:crypto.randomUUID(),capturedAt:finish},p.cookie)
  }
  const out=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:end,breakMinutes:0},p.cookie)
  await h.cmd('time.approve',pin(out.timesheet))
 }
 return {missed,taken}
}

export async function policyMealBoundaryApi(){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const {missed,taken}=await mealBoundaryFixture(h),retained=await h.state()
  const changes=retained.policies.map(p=>({...pin(p),site:p.site,preset:'CA',from:p.from,workdayStart:'04:00',reviewReason:'Reviewed cross-week meal context and unchanged captured service'}))
  for(const change of changes){
   const preview=await h.cmd('policy.preview',change)
   await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
   assert.equal((await review(h,missed)).breakPremiumEstimateCents,null,'a cafe still on the prior release cannot reset the continuous meal obligation')
  }
  for(const on of ['2026-10-05',week]){
   const report=await review(h,missed,on),meal=report.breakReviews.find(r=>r.premiumDayUnknown)
   assert.ok(meal,'a cross-day meal violation remains visible in every affected workweek')
   assert.equal(report.breakPremiumEstimateCents,null,'unresolved employer-day allocation cannot become a known zero or a priced premium')
   assert.deepEqual(new Set(meal.records.map(r=>r.site)),new Set(['East','West']))
   assert.equal(meal.issues.filter(i=>i.message.includes('meal premium allocation')).length,1)
   const compliant=await review(h,taken,on)
   assert.ok(!compliant.breakReviews.some(r=>r.premiumDayUnknown),'a compliant recorded meal needs no violation allocation')
   assert.equal(compliant.breakPremiumMinutes,0)
   assert.equal(compliant.breakPremiumEstimateCents,0)
  }
  const previous=await review(h,missed,'2026-10-05'),current=await review(h,missed)
  assert.deepEqual([previous.minutes,current.minutes],[120,360],'context does not replay prior-week paid time')
  const state=await h.state()
  assert.deepEqual(state.timesheets,retained.timesheets,'release adoption never changes approved source minutes or rates')
  assert.deepEqual(state.clocks,retained.clocks)
  assert.equal(state.batches.length,0)
  assert.ok(state.policies.every(p=>p.versions.some(v=>v.breakVersion==='2026-10-26.2')))
  await h.restart()
  assert.equal((await review(h,missed)).breakPremiumEstimateCents,null,'restart preserves unresolved allocation')
  // A later effective adoption leaves the earlier reviewed release intact.
  const legacy=await harness({now:'2026-10-26T12:00:00Z'})
  try{
   const people=await mealBoundaryFixture(legacy)
   const before=await review(legacy,people.missed)
   for(const p of (await legacy.state()).policies){
    const change={...pin(p),site:p.site,preset:'CA',from:'2026-10-19',workdayStart:'04:00',reviewReason:'Future adoption retains historical meal review'}
    const preview=await legacy.cmd('policy.preview',change)
    await legacy.cmd('policy.save',{...change,reviewDigest:preview.digest})
   }
   assert.deepEqual(await review(legacy,people.missed),before,'historical rule calculations remain reproducible')
  }finally{await legacy.close()}
 }finally{await h.close()}
}

export async function policyMealBoundaryBrowser(){
 const {chromium}=await import('@playwright/test'),{browserAssets}=await import('./policy-settings-journey.mjs')
 const {mkdir}=await import('node:fs/promises'),{join}=await import('node:path')
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now:'2026-10-26T12:00:00Z'}),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const {missed,taken}=await mealBoundaryFixture(h)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await browserAssets(context)
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage()
   await page.goto(h.origin+'/app/settings?site=East&preset=CA',{waitUntil:'networkidle'})
   const account=page.getByLabel('Account',{exact:true})
   await account.hover()
   await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
   await page.mouse.move(0,0);await account.focus()
   await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
   const editor=page.locator('[data-policy-editor]')
   await editor.getByLabel('Meal and rest rule version',{exact:true}).selectOption(await editor.locator('[name=breakVersion] option').last().getAttribute('value'))
   await editor.getByLabel('Review reason',{exact:true}).fill('Reviewed overnight meal context across both cafes and employer days')
   await editor.getByRole('button',{name:'Preview policy changes',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   const current=page.locator('[data-policy-workweek]').filter({has:page.getByRole('heading',{name:missed.name+' · workweek '+week,exact:true})})
   const after=current.locator('[data-label="After applying"]')
   assert.match(await after.innerText(),/break premium estimate Unknown/)
   assert.match(await after.innerText(),/meal premium allocation requires review/)
   const compliant=page.locator('[data-policy-workweek]').filter({has:page.getByRole('heading',{name:taken.name+' · workweek '+week,exact:true})}).locator('[data-label="After applying"]')
   assert.match(await compliant.innerText(),/break premium estimate \$0\.00/)
   assert.doesNotMatch(await compliant.innerText(),/meal premium allocation requires review/)
   const shot=async(label,element)=>{
    await element.scrollIntoViewIfNeeded()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(process.env.POLICY_SCREENS){await mkdir(process.env.POLICY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.POLICY_SCREENS,`${label}-${width}.png`)})}
   }
   await shot('meal-boundary-unresolved',after)
   await shot('meal-boundary-compliant',compliant)
   await page.locator('[data-policy-apply] input[type=checkbox]').check()
   await page.locator('[data-policy-apply]').getByRole('button',{name:'Apply reviewed policy',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   assert.equal((await review(h,missed)).breakPremiumEstimateCents,null)
   const retained=page.locator('#policy-current')
   await retained.getByText('Reviewed recalculation',{exact:true}).click()
   await shot('meal-boundary-retained-review',retained)
   assert.equal((await h.state()).batches.length,0,'the browser review creates no payroll batch')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

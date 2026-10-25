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

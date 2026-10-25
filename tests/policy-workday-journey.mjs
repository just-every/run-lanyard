import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const week='2026-10-12',site='East'
const sum=(rows,key)=>rows.reduce((n,p)=>n+p[key],0)
async function person(h,name){
 const p=await h.person(name)
 await wage(h,p,'20.00')
 return p
}
async function wage(h,p,hourlyRate){
 const current=(await h.state()).staff.find(x=>x.id===p.id)
 return h.cmd('staff.save',{...pin(current),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site,hourlyRate})
}
const policy=(h,workdayStart,extra={})=>h.cmd('policy.save',{site,preset:'CA',from:'2026-01-01',workdayStart,reviewReason:'Reviewed employer-fixed California workday',...extra})
async function approve(h,p,start,end,extra={}){
 const t=await h.cmd('time.prepare',{staffId:p.id,site,start,end,breakMinutes:0,reason:'Employer-reviewed actual workday hours',...extra})
 return h.cmd('time.approve',pin(t))
}
const report=(h,p,on=week)=>h.cmd('policy.review',{staffId:p.id,week:on})
async function lock(h,p,period){
 period=await h.cmd('period.signoff',pin(period),p.cookie)
 period=await h.cmd('period.signoff',pin(period))
 return h.cmd('period.lock',pin(period))
}

// Native API: midnight retains the existing calculation; the employer's 04:00
// workday joins Monday's eight hours to Tuesday's first four across cafes.
export async function policyWorkdayApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const p=await person(h,'WorkdayAlex')
  let east=await policy(h,'00:00'),west=await policy(h,'00:00',{site:'West'})
  await approve(h,p,week+'T05:00:00Z',week+'T13:00:00Z')
  await approve(h,p,'2026-10-13T00:00:00Z','2026-10-13T08:00:00Z',{site:'West'})
  assert.deepEqual([(await report(h,p)).minutes,(await report(h,p)).overtimeMinutes],[960,0])
  // Every cafe's selection is reviewed explicitly; changing just one leaves
  // inconsistent employer-day evidence and must not produce a wage estimate.
  let change={...pin(east),site,preset:'CA',from:'2026-01-01',workdayStart:'04:00',reviewReason:'Reviewed fixed 04:00 employer day'}
  await h.cmd('policy.save',change,h.owner,409)
  let preview=await h.cmd('policy.preview',change)
  const stale=preview.digest
  const pending=await h.cmd('time.prepare',{staffId:p.id,site,start:'2026-10-14T09:00:00Z',end:'2026-10-14T10:00:00Z',breakMinutes:0,reason:'Pending source arrived after workday review'})
  await h.cmd('policy.save',{...change,reviewDigest:stale},h.owner,409)
  preview=await h.cmd('policy.preview',change)
  east=await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
  assert.equal(east.releaseReview.digest,preview.digest)
  const mixed=await report(h,p)
  assert.equal(mixed.classificationIncomplete,true)
  assert.equal(mixed.estimateCents,null)
  change={...pin(west),site:'West',preset:'CA',from:'2026-01-01',workdayStart:'04:00',reviewReason:'Reviewed same fixed workday at the second cafe'}
  preview=await h.cmd('policy.preview',change)
  west=await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
  const joined=await report(h,p)
  assert.deepEqual([joined.minutes,joined.regularMinutes,joined.overtimeMinutes,joined.doubleMinutes],[960,720,240,0])
  assert.equal(joined.classificationIncomplete,false)
  assert.equal(new Set(joined.parts.filter(x=>x.workdayDate===week).map(x=>x.workdayKey)).size,1)
  assert.equal(sum(joined.parts.filter(x=>x.workdayDate===week),'minutes'),720)
  assert.deepEqual([...new Set(joined.parts.map(x=>x.date))],[week,'2026-10-13'],'venue dates remain the payroll dates')
  // A later effective selection retains the old anchor for historical hours.
  change={...pin(east),site,preset:'CA',from:'2026-10-19',workdayStart:'06:00',reviewReason:'Reviewed a future employer day without rewriting historical work'}
  preview=await h.cmd('policy.preview',change)
  east=await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
  assert.ok(east.versions.some(v=>v.workdayStart==='00:00')&&east.versions.some(v=>v.workdayStart==='04:00'))
  assert.equal((await report(h,p)).overtimeMinutes,240)
  await h.cmd('time.approve',pin(pending))
  let period=await h.cmd('period.save',{start:week,end:'2026-10-18'})
  period=await lock(h,p,period)
  const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(batch))
  await h.cmd('period.close',{...pin(period),reference:'Employer-recorded closed run'})
  await h.cmd('policy.preview',{...pin(west),site:'West',preset:'CA',from:week,workdayStart:'05:00',reviewReason:'Attempt to rewrite closed workday'},h.owner,409)
  assert.equal((await report(h,p)).overtimeMinutes,240)
 }finally{await h.close()}
}

export async function policyWorkdayBoundaryApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const p=await person(h,'WorkdayBoundary')
  await policy(h,'04:00')
  const group=await h.cmd('paygroup.save',{name:'Employer Monday workweek',cadence:'weekly',from:'2026-10-05',payDays:5,workweekStart:1,staffIds:[p.id]})
  await approve(h,p,'2026-10-11T05:00:00Z','2026-10-11T13:00:00Z')
  await approve(h,p,week+'T00:00:00Z',week+'T08:00:00Z')
  const before=await report(h,p,'2026-10-05'),after=await report(h,p)
  assert.deepEqual([before.minutes,before.overtimeMinutes,after.minutes,after.regularMinutes,after.overtimeMinutes],[480,0,480,240,240],'Sunday supplies daily context without entering Monday weekly hours')
  assert.ok(after.parts.every(x=>x.date===week),'context never replays prior-week output')
  assert.equal(sum(after.parts.filter(x=>x.workdayDate==='2026-10-11'),'overtimeMinutes'),240)
  const first=await h.cmd('paygroup.period',{groupId:group.id,date:'2026-10-11'}),next=await h.cmd('paygroup.period',{groupId:group.id,date:week})
  await lock(h,p,first);await lock(h,p,next)
  const draft=await h.cmd('payroll.prepare',{})
  assert.equal(sum(draft.lines.filter(x=>!x.payCode),'minutes'),960,'straight-time payroll slices each retained minute once')
 }finally{await h.close()}
}

export async function policyWorkdayAllocationApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const p=await person(h,'WorkdayRates')
  await policy(h,'04:00')
  await approve(h,p,week+'T05:00:00Z',week+'T12:00:00Z')
  const overnight=await approve(h,p,week+'T23:00:00Z','2026-10-13T05:00:00Z',{breakMinutes:1})
  await wage(h,p,'30.00')
  const tie=await approve(h,p,'2026-10-14T03:59:00Z','2026-10-14T04:01:00Z',{breakMinutes:1})
  const r=await report(h,p),parts=r.parts.filter(x=>x.timeId===overnight.id)
  assert.deepEqual([r.minutes,r.overtimeMinutes,r.doubleMinutes],[780,239,0])
  assert.deepEqual([sum(parts.filter(x=>x.date===week),'minutes'),sum(parts.filter(x=>x.date==='2026-10-13'),'minutes')],[60,299],'the pinned overnight venue-date rounding survives recutting')
  assert.ok(parts.every(x=>x.cents===2000),'approved rates survive subsequent wage edits')
  assert.equal(sum(parts,'minutes'),359)
  assert.ok(parts.every(x=>x.intervalStart>=x.date+'T00:00:00.000Z'&&x.intervalEnd<=(x.date===week?'2026-10-13':'2026-10-14')+'T00:00:00.000Z'),'each retained allocation is clipped before anchor splitting')
  const tieParts=r.parts.filter(x=>x.timeId===tie.id)
  assert.deepEqual(tieParts.map(x=>[x.workdayDate,x.minutes]),[['2026-10-13',1],['2026-10-14',0]],'equal remainders assign the whole minute to the earlier interval')
  assert.ok(tieParts.every(x=>x.cents===3000))
 }finally{await h.close()}
}

export async function policyWorkdayDstApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'America/Los_Angeles'})
  const p=await person(h,'WorkdayDst')
  await policy(h,'04:00')
  for(const x of [
   {start:'2026-03-08T08:00:00Z',end:'2026-03-08T13:00:00Z',week:'2026-03-02',day:'2026-03-08',prior:'2026-03-07',minutes:300,before:180,cut:'2026-03-08T11:00:00.000Z'},
   {start:'2026-11-01T07:00:00Z',end:'2026-11-01T14:00:00Z',week:'2026-10-26',day:'2026-11-01',prior:'2026-10-31',minutes:420,before:300,cut:'2026-11-01T12:00:00.000Z'},
  ]){
   const t=await approve(h,p,x.start,x.end),r=await report(h,p,x.week),parts=r.parts.filter(a=>a.timeId===t.id)
   assert.equal(sum(parts,'minutes'),x.minutes)
   assert.deepEqual(parts.map(a=>[a.date,a.workdayDate,a.minutes]),[[x.day,x.prior,x.before],[x.day,x.day,120]],'DST uses venue wall boundaries and elapsed weights')
   assert.equal(parts[0].intervalEnd,x.cut);assert.equal(parts[1].intervalStart,x.cut)
  }
 }finally{await h.close()}
}

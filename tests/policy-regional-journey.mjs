import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const week='2026-10-12',from='2026-09-07'
export const regionalExample=(preset,staffIds)=>({
 kind:preset==='AK'?'AK_FLEX_APPROVED':'NV_4X10',workUnit:'synthetic-lanyard regional service crew',staffIds,
 days:[1,2,3,4].map(day=>({day,minutes:600})),employerAttested:true,effectiveFrom:from,
 reviewer:'Jordan Venue',reviewedOn:'2026-09-01',
 ...(preset==='AK'?{
  approvalOn:'2026-08-03',approvalEvidence:'synthetic-lanyard department-approved plan identifying this employer and recurring hours',
  participationOn:'2026-08-04',participationEvidence:'synthetic-lanyard signed and dated voluntary participation by every selected employee after department approval',ordinaryScheduleOffered:true,
 }:{agreementOn:'2026-08-04',agreementEvidence:'synthetic-lanyard mutual agreement by employer and every selected employee for the recorded four ten-hour days'}),
})
async function person(h,name){
 const p=await h.person(name)
 await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:'East',hourlyRate:'16.00'})
 return p
}
async function approve(h,p,on,hours,site='East',start=8){
 const begin=on+`T${String(start).padStart(2,'0')}:00:00Z`
 const t=await h.cmd('time.prepare',{staffId:p.id,site,start:begin,end:new Date(Date.parse(begin)+hours*3600000).toISOString(),breakMinutes:0,reason:'Reviewed actual regional alternate schedule service'})
 return h.cmd('time.approve',pin(t))
}
async function apply(h,change){
 const preview=await h.cmd('policy.preview',change)
 return h.cmd('policy.save',{...change,reviewDigest:preview.digest})
}
async function workFour(h,p,hours,split=false){
 for(let i=0;i<4;i++){
  const on=`2026-10-${12+i}`
  if(split&&i===0){await approve(h,p,on,5);await approve(h,p,on,hours[i]-5,'West',13)}
  else await approve(h,p,on,hours[i])
 }
}

export async function policyRegionalConfigurationApi(){
 for(const preset of ['AK','NV']){
  const h=await harness()
  try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const manager=await h.person('RegionalManager','manager')
  const inactive=await h.cmd('staff.save',{name:'Inactive regional member',email:'inactive-regional@venue.example',payrollId:'SYNTHETIC-LANYARD-REGIONAL',role:'staff',active:false,site:'East'})
   const p=await person(h,`Regional${preset}`),alternate=regionalExample(preset,[p.id])
   const prior=await h.cmd('policy.save',{site:'East',preset,from,reviewReason:'Reviewed ordinary state overtime'})
   await workFour(h,p,[10,10,10,10])
   const change={...pin(prior),site:'East',preset,from,alternate,reviewReason:'Reviewed employer evidence and employee enrollment'}
   await h.cmd('policy.preview',change,manager.cookie,403)
   const commonInvalid=[{...alternate,employerAttested:false},{...alternate,reviewer:''},
    {...alternate,staffIds:[]},{...alternate,staffIds:[p.id,p.id]},{...alternate,staffIds:[inactive.id]},
    {...alternate,days:[1,2,3].map(day=>({day,minutes:600}))},
    {...alternate,days:[1,1,3,4].map(day=>({day,minutes:600}))}]
   const specific=preset==='AK'?[
    {...alternate,approvalEvidence:''},{...alternate,participationEvidence:''},{...alternate,ordinaryScheduleOffered:false},
    {...alternate,participationOn:'2026-08-02'},
    {...alternate,days:[1,2,3,4].map(day=>({day,minutes:480}))},
   ]:[{...alternate,agreementEvidence:''},{...alternate,agreementOn:'2026-09-08'},
    {...alternate,days:[1,2,3,4].map(day=>({day,minutes:540}))}]
   for(const invalid of [...commonInvalid,...specific])await h.cmd('policy.preview',{...change,alternate:invalid},h.owner,400)
   await h.cmd('policy.preview',{...change,preset:'federal'},h.owner,400)
   await h.cmd('policy.save',change,h.owner,409)
   const preview=await h.cmd('policy.preview',change),calculation=preview.calculations.find(c=>c.staffId===p.id)
   assert.deepEqual([calculation.before.overtimeMinutes,calculation.after.overtimeMinutes],[480,0],'reviewed enrollment recalculates actual four-ten source hours')
   assert.equal((await h.state()).policies.find(r=>r.id===prior.id).revision,prior.revision,'preview preserves the current policy')
   let saved=await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
   assert.equal(saved.releaseReview.digest,preview.digest)
   assert.equal(saved.alternate.enrollment[0].staffId,p.id)
   assert.equal(saved.alternate.enrollment[0].site,'East')
   assert.equal(saved.alternate.kind,alternate.kind)
   saved=await h.cmd('policy.save',{...pin(saved),site:'East',preset,from,minimumRestMinutes:30,reviewReason:'Reviewed rest requirement while retaining regional enrollment'})
   assert.deepEqual(saved.alternate.staffIds,[p.id],'ordinary policy edits retain reviewed enrollment')
   const removed=await apply(h,{...pin(saved),site:'East',preset,from:'2026-10-19',alternate:null,reviewReason:'Reviewed future removal without rewriting past actual hours'})
   assert.equal(removed.alternate,null)
   assert.ok(removed.versions.some(v=>v.alternate?.staffIds.includes(p.id)))
   assert.equal((await h.cmd('policy.review',{staffId:p.id,week})).overtimeMinutes,0,'historical actual hours retain their earlier approved schedule')
  assert.equal((await h.state()).batches.length,0,'policy review does not create payroll')
  }finally{await h.close()}
 }
}

export async function policyRegionalClassificationApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  for(const preset of ['AK','NV']){
   const regular=await person(h,`Regular${preset}`),deviation=await person(h,`Deviation${preset}`),extended=await person(h,`Extended${preset}`),unenrolled=await person(h,`Ordinary${preset}`)
   const alternate=regionalExample(preset,[regular.id,deviation.id,extended.id])
   for(const site of ['East','West']){
    const prior=(await h.state()).policies.find(p=>p.site===site)
    await apply(h,{...(prior?pin(prior):{}),site,preset,from,alternate,reviewReason:'Reviewed regional schedule and explicit enrollment at both worked cafes'})
   }
   await workFour(h,regular,[10,10,10,10],true)
   await workFour(h,deviation,[12,10,8,10])
   await workFour(h,extended,[12,10,10,10])
   await workFour(h,unenrolled,[10,10,10,10])
   const normal=await h.cmd('policy.review',{staffId:regular.id,week})
   assert.deepEqual([normal.regularMinutes,normal.overtimeMinutes,normal.doubleMinutes],[2400,0,0],'completed days combine across cafes for the regular schedule')
   assert.ok(normal.alternateReviews.length&&normal.alternateReviews.every(r=>!r.reviewRequired),'a completed regular four-ten schedule needs no deviation choice')
   const changed=await h.cmd('policy.review',{staffId:deviation.id,week})
   assert.deepEqual([changed.regularMinutes,changed.overtimeMinutes],[1920,480],'unknown employee choice cannot waive daily overtime in a redistributed week')
   assert.equal(changed.classificationIncomplete,true)
   assert.equal(changed.breakPremiumEstimateCents,null,'unresolved alternate treatment withholds the break premium amount as well as wages')
   assert.ok(changed.alternateReviews.every(r=>r.reviewRequired&&r.reviewReason),'the deviation remains unresolved across the affected week')
   const longer=await h.cmd('policy.review',{staffId:extended.id,week})
   assert.equal(longer.overtimeMinutes,preset==='AK'?600:120,'Alaska deviation eligibility needs historical review; Nevada extended first day owes only its excess over ten')
   assert.equal(longer.alternateReviews.some(r=>r.reviewRequired),preset==='AK')
   const ordinary=await h.cmd('policy.review',{staffId:unenrolled.id,week})
   assert.deepEqual([ordinary.regularMinutes,ordinary.overtimeMinutes],[1920,480],'the site schedule never enrolls another employee implicitly')
   const west=(await h.state()).policies.find(p=>p.site==='West')
   await apply(h,{...pin(west),site:'West',preset,from,alternate:null,reviewReason:'Reviewed ordinary daily overtime at the second cafe'})
   const protective=await h.cmd('policy.review',{staffId:regular.id,week})
   assert.equal(protective.parts.filter(p=>p.date===week).reduce((n,p)=>n+p.overtimeMinutes,0),120,'the strongest rule of every worked cafe protects the shared day')
  }
 }finally{await h.close()}
}

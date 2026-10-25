import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin,days} from './workforce-journey.mjs'

const week='2026-10-12',kinds=['federalOvertime','stateWeekly','stateDaily','stateConsecutive','stateSeventh','meal','rest','weeklyRest']
export async function policyCoverageApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const p=await h.person('CoverageAlex')
  await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:'East',hourlyRate:'20.00'})
  let policy=await h.cmd('policy.save',{site:'East',preset:'CA',from:'2026-01-01',reviewReason:'Reviewed covered California core'})
  for(const [i,hours]of [10,9,9,8,6].entries()){
   const start=days(week,i)+'T08:00:00Z',t=await h.cmd('time.prepare',{staffId:p.id,site:'East',start,end:new Date(Date.parse(start)+hours*3600000).toISOString(),breakMinutes:0,reason:'Reviewed source hours for applicability'})
   await h.cmd('time.approve',pin(t))
  }
  assert.equal((await h.cmd('policy.review',{staffId:p.id,week})).overtimeMinutes,240)
  let change={...pin(policy),site:'East',from:'2026-01-01',staffId:p.id,...Object.fromEntries(kinds.map(k=>[k,'covered'])),stateDaily:'reviewed-not-applicable',legalBasis:'Employer reviewed the applicable daily-only exception; federal and state weekly obligations remain covered',evidenceReference:'synthetic-lanyard-1 applicability decision and supporting employment facts',reviewReason:'Review each overtime and break rule family independently'}
  await h.cmd('policy.worker.preview',{...change,legalBasis:''},h.owner,400)
  await h.cmd('policy.worker.save',change,h.owner,409)
  let review=await h.cmd('policy.worker.preview',change)
  assert.deepEqual([review.calculations[0].before.overtimeMinutes,review.calculations[0].after.overtimeMinutes],[240,120],'a state daily exception does not remove weekly overtime')
  policy=await h.cmd('policy.worker.save',{...change,reviewDigest:review.digest})
  let report=await h.cmd('policy.review',{staffId:p.id,week})
  assert.equal(report.overtimeMinutes,120)
  assert.ok(report.breakReviews.some(r=>r.issues.some(i=>i.kind==='meal')),'overtime coverage never silently removes meal coverage')
  change={...change,...pin(policy),...Object.fromEntries(kinds.slice(0,5).map(k=>[k,'reviewed-not-applicable']))}
  review=await h.cmd('policy.worker.preview',change)
  policy=await h.cmd('policy.worker.save',{...change,reviewDigest:review.digest})
  report=await h.cmd('policy.review',{staffId:p.id,week})
  assert.equal(report.overtimeMinutes,0)
  assert.equal(report.regularMinutes,2520)
  assert.equal(report.coverage.inputs[0].profile.evidenceReference,change.evidenceReference)
  assert.equal(report.classificationIncomplete,false)
  assert.ok(policy.versions.some(v=>v.coverage?.some(c=>c.stateDaily==='reviewed-not-applicable'&&c.federalOvertime==='covered')),'prior decisions remain attributable')
  await h.cmd('policy.save',{site:'West',preset:'CA',from:'2026-01-01',reviewReason:'A second cafe has not adopted this individual applicability decision'})
  const t=await h.cmd('time.prepare',{staffId:p.id,site:'West',start:'2026-10-16T14:00:00Z',end:'2026-10-16T16:00:00Z',breakMinutes:0,reason:'Additional work with a different applicability basis'})
  await h.cmd('time.approve',pin(t))
  report=await h.cmd('policy.review',{staffId:p.id,week})
  assert.equal(report.classificationIncomplete,true)
  assert.ok(report.coverage.issues.some(i=>i.includes('Federal weekly overtime')),'another cafe cannot silently inherit an exemption')
  const own=await h.send('/api/lanyard/state?week='+week,undefined,p.cookie)
  assert.equal(own.status,200)
  assert.equal(own.value.ownEarnings.estimateCents,null,'unresolved applicability does not become an employee earnings amount')
  assert.deepEqual(own.value.policies,[])
  assert.equal((await h.state()).batches.length,0,'applicability review creates no payroll')
 }finally{await h.close()}
}

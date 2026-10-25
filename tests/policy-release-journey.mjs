import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

export async function policyReleaseReview(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const alex=await h.person('ReleaseAlex'),week='2026-10-12',site='Release cafe'
  await h.cmd('staff.save',{...pin(alex),name:alex.name,email:alex.email,payrollId:alex.payrollId,active:true,role:'staff',site,hourlyRate:'20.00'})
  const previous=await h.cmd('policy.save',{site,preset:'NY',from:'2026-01-01',breakVersion:'2026-10-26',reviewReason:'Review historical nonfactory meal treatment'})
  await h.cmd('clock.in',{commandId:'release-in',capturedAt:week+'T08:00:00Z'},alex.cookie)
  await h.cmd('clock.breakStart',{commandId:'release-meal',capturedAt:week+'T11:00:00Z',kind:'meal'},alex.cookie)
  await h.cmd('clock.breakEnd',{commandId:'release-meal-end',capturedAt:week+'T11:30:00Z'},alex.cookie)
  const out=await h.cmd('clock.out',{commandId:'release-out',capturedAt:week+'T16:00:00Z',breakMinutes:0},alex.cookie)
  await h.cmd('time.approve',pin(out.timesheet))
  const period=await h.cmd('period.save',{start:week,end:'2026-10-18'})
  const change={...pin(previous),site,preset:'NY',from:'2026-01-01',reviewReason:'Reviewed the maintained noon-meal correction against this open period'}
  await h.cmd('policy.save',change,h.owner,409)
  let preview=await h.cmd('policy.preview',change)
  assert.equal(preview.calculations.length,1)
  assert.equal(preview.calculations[0].before.breakReviews[0].issues.length,1)
  assert.equal(preview.calculations[0].after.breakReviews[0].issues.length,0)
  assert.ok(preview.periods.some(p=>p.id===period.id&&p.status==='open'))
  assert.equal((await h.state()).policies.find(p=>p.id===previous.id).revision,previous.revision,'preview does not apply the release')
  const pending=await h.cmd('time.prepare',{staffId:alex.id,site,start:'2026-10-13T08:00:00Z',end:'2026-10-13T10:00:00Z',breakMinutes:0,reason:'Later source arrived during release review'})
  await h.cmd('policy.save',{...change,reviewDigest:preview.digest},h.owner,409)
  preview=await h.cmd('policy.preview',change)
  const applied=await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
  assert.equal(applied.releaseReview.digest,preview.digest)
  assert.ok((await h.state()).events.some(e=>e.entityId===applied.id&&e.action==='policy.save'&&e.actorId===applied.releaseReview.by&&e.actorRole==='owner'))
  const report=await h.cmd('policy.review',{staffId:alex.id,week})
  assert.equal(report.breakReviews[0].issues.length,0)
  assert.equal(applied.versions[0].breakVersion,previous.breakVersion,'historical rule inputs remain available')
  await h.cmd('time.approve',pin(pending))
  const employeeSigned=await h.cmd('period.signoff',pin(period),alex.cookie)
  const signed=await h.cmd('period.signoff',pin(employeeSigned));await h.cmd('period.lock',pin(signed))
  await h.cmd('policy.preview',{...change,...pin(applied),breakVersion:previous.breakVersion},h.owner,409)
  assert.equal((await h.state()).batches.length,0,'release approval never creates payroll')
 }finally{await h.close()}
}

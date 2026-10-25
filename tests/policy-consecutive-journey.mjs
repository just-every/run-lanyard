import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const week='2026-10-12'
async function person(h,name){
 const p=await h.person(name)
 await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:'East',hourlyRate:'20.00'})
 return p
}
async function approve(h,p,start,end,site='East',breakMinutes=0){
 const t=await h.cmd('time.prepare',{staffId:p.id,start,end,site,breakMinutes,reason:'Reviewed consecutive service records'})
 return h.cmd('time.approve',pin(t))
}
export async function policyConsecutiveApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const old=await h.cmd('policy.save',{site:'East',preset:'CO',presetVersion:'2026-10-24',from:'2026-01-01',reviewReason:'Retained daily-only historical catalog'})
  const alex=await person(h,'Overnight')
  await approve(h,alex,week+'T20:00:00Z','2026-10-13T09:00:00Z')
  assert.equal((await h.cmd('policy.review',{staffId:alex.id,week})).overtimeMinutes,0,'retained daily-only version does not silently change')
  const change={...pin(old),site:'East',preset:'CO',from:'2026-01-01',reviewReason:'Reviewed Colorado consecutive-hours release against open work'}
  const preview=await h.cmd('policy.preview',change)
  assert.deepEqual([preview.calculations[0].before.overtimeMinutes,preview.calculations[0].after.overtimeMinutes],[0,60])
  await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
  await h.cmd('policy.save',{site:'West',preset:'CO',from:'2026-01-01',reviewReason:'Reviewed both employer sites'})
  let report=await h.cmd('policy.review',{staffId:alex.id,week})
  assert.deepEqual([report.regularMinutes,report.overtimeMinutes,report.estimateCents],[720,60,27000])
  assert.ok(report.parts.every(p=>p.rules.some(r=>r.source.startsWith('https://cdle.colorado.gov/')&&r.consecutiveMinutes>0)))
  const transfer=await person(h,'Transfer')
  await approve(h,transfer,week+'T20:00:00Z','2026-10-13T02:00:00Z')
  await approve(h,transfer,'2026-10-13T02:00:00Z','2026-10-13T09:00:00Z','West')
  report=await h.cmd('policy.review',{staffId:transfer.id,week});assert.equal(report.overtimeMinutes,60,'adjacent work at another cafe keeps the run')
  const gap=await person(h,'Separate')
  await approve(h,gap,week+'T20:00:00Z','2026-10-13T02:00:00Z')
  await approve(h,gap,'2026-10-13T03:00:00Z','2026-10-13T10:00:00Z','West')
  assert.equal((await h.cmd('policy.review',{staffId:gap.id,week})).overtimeMinutes,0,'a genuine non-work gap ends the consecutive run')
  const boundary=await person(h,'Boundary')
  await approve(h,boundary,'2026-10-18T20:00:00Z','2026-10-19T09:00:00Z')
  assert.equal((await h.cmd('policy.review',{staffId:boundary.id,week:'2026-10-19'})).overtimeMinutes,60,'the prior workweek supplies consecutive context without carrying weekly totals')
  const meal=await person(h,'Meal'),at=m=>new Date(Date.parse(week+'T20:00:00Z')+m*60000).toISOString()
  await h.cmd('clock.in',{commandId:'consecutive-in',capturedAt:at(0)},meal.cookie)
  await h.cmd('clock.breakStart',{commandId:'consecutive-meal',kind:'meal',capturedAt:at(360)},meal.cookie)
  await h.cmd('clock.breakEnd',{commandId:'consecutive-meal-end',capturedAt:at(390)},meal.cookie)
  const out=await h.cmd('clock.out',{commandId:'consecutive-out',capturedAt:at(810),breakMinutes:0},meal.cookie)
  await h.cmd('time.approve',pin(out.timesheet))
  report=await h.cmd('policy.review',{staffId:meal.id,week})
  assert.deepEqual([report.minutes,report.overtimeMinutes,report.classificationIncomplete],[780,60,false],'recorded qualifying meals subtract without resetting the run')
  const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:alex.id,site:'East',start:week+'T20:00:00Z',end:'2026-10-13T09:00:00Z',breakMinutes:0}]})
  assert.ok(draft.policyWarnings.some(w=>w.message.includes('60 overtime minutes')),'midnight-spanning overtime warns before publication')
  await unknownMeal(h)
 }finally{await h.close()}
}
async function unknownMeal(h){
 const p=await person(h,'Untimed'),t=await approve(h,p,'2026-10-05T20:00:00Z','2026-10-06T09:30:00Z','East',30)
 const report=await h.cmd('policy.review',{staffId:p.id,week:'2026-10-05'})
 assert.equal(report.classificationIncomplete,true,'an untimed deduction cannot establish a qualifying meal')
 let period=await h.cmd('period.save',{start:'2026-10-05',end:'2026-10-11'})
 period=await h.cmd('period.signoff',pin(period),p.cookie);period=await h.cmd('period.signoff',pin(period));await h.cmd('period.lock',pin(period))
 const template=await h.cmd('payroll.template.save',{approved:true,name:'Consecutive meal review',classification:'policy',delimiter:',',header:true,columns:[{field:'employee',header:'Worker'},{field:'code',header:'Earning'},{field:'hours',header:'Hours'}],groupBy:[],dateFormat:'iso',decimals:4,employees:{[p.id]:{id:'synthetic-lanyard-1',workflow:'W-2'}},codes:{regular:'REG',overtime:'OT','double time':'DT'},jobs:{},locations:{East:'EAST'}})
 const refused=await h.cmd('payroll.prepare',{ids:[t.id],templateId:template.id},h.owner,409)
 assert.match(refused.error,/qualifying recorded meal evidence/)
 assert.equal((await h.state()).batches.length,0)
}

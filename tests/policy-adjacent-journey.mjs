import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

export async function policyAdjacentApi(){
 const h=await harness(),week='2026-10-12'
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  for(const [site,breakVersion]of [['East',undefined],['West',undefined],['Historical','2026-10-26.1']])await h.cmd('policy.save',{site,preset:'CA',from:'2026-01-01',...(breakVersion?{breakVersion}:{}),reviewReason:'Reviewed cafe-transfer break obligations'})
  for(const [index,sites,meal]of [[0,['East','West'],false],[1,['East','West'],true],[2,['Historical','Historical'],false]]){
   const person=await h.person('Adjacent'+index)
   await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,active:true,role:'staff',site:sites[0],hourlyRate:'20.00'})
   const at=m=>new Date(Date.parse(week+'T08:00:00Z')+m*60000).toISOString()
   const records=[]
   for(let part=0;part<2;part++){
    // A cafe transfer is represented by two approved native punches. The
    // employee changes their home cafe between otherwise adjacent captures.
    if(part){const p=(await h.state()).staff.find(p=>p.id===person.id);await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,active:true,role:'staff',site:sites[1],hourlyRate:'20.00'})}
    await h.cmd('clock.in',{commandId:`adjacent-in-${index}-${part}`,capturedAt:at(part*240)},person.cookie)
    if(part&&meal){await h.cmd('clock.breakStart',{commandId:'adjacent-meal-'+index,kind:'meal',capturedAt:at(255)},person.cookie);await h.cmd('clock.breakEnd',{commandId:'adjacent-meal-end-'+index,capturedAt:at(285)},person.cookie)}
    const out=await h.cmd('clock.out',{commandId:`adjacent-out-${index}-${part}`,capturedAt:at((part+1)*240),breakMinutes:0},person.cookie)
    records.push(await h.cmd('time.approve',pin(out.timesheet)))
   }
   const review=await h.cmd('policy.review',{staffId:person.id,week})
   assert.equal(review.minutes,480-(meal?30:0),'a transfer preserves approved payable minutes')
   assert.equal(review.breakReviews.filter(r=>r.issues.some(i=>i.kind==='meal')).length,index===0?1:0,'adjacent records share the meal obligation only under the adopted release')
   if(index<2){assert.equal(review.breakReviews.length,1);assert.deepEqual(review.breakReviews[0].timeIds,records.map(r=>r.id));assert.deepEqual(review.breakReviews[0].records.map(r=>r.site),sites)}
   if(index===0){
    const draft=await h.cmd('roster.prepare',{week,shifts:records.map(r=>({staffId:person.id,site:r.site,start:r.start,end:r.end,breakMinutes:0}))})
    assert.ok(draft.policyWarnings.some(w=>w.message.includes('Meal 1: 30 minutes required')),'adjacent short planned shifts expose the combined obligation before publication')
   }
   assert.equal((await h.state()).batches.length,0,'review alone never creates payroll')
  }
 }finally{await h.close()}
}

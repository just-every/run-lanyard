import assert from 'node:assert/strict'
import {days,local,pin} from './workforce-journey.mjs'
export async function optimizationFixture(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:[alex,ben].includes(p)?'Counter':'Manager',hourlyRate:p===ben?'25.00':'20.00',employmentType:'part-time'})
 const first='2026-08-03',week=days(first,49)
 const full=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`${d} available 00:00-24:00`).join('\n')
 for(const [p,hours] of [[alex,8],[ben,4]])await h.cmd('pattern.save',{from:first,blocks:full+'\nMon preferred 08:00-16:00'+(p===alex?'\nMon prefer-not 18:00-22:00':''),preferredHours:hours,maxHours:40},p.cookie)
 await h.cmd('fairness.policy.save',{site:'Ocean Beach',tags:['closing'],closingTime:'22:00',openingTime:'08:00',closeOpenHours:12})
 await h.cmd('fairness.cohort.save',{site:'Ocean Beach',position:'Counter',from:first,staffIds:[alex.id,ben.id]})
 for(const p of [alex,ben])await h.cmd('fairness.request.save',{staffId:p.id,from:first,minutes:p===alex?60:180},p.cookie)
 for(let i=0;i<8;i++){
  const on=days(first,i*7),shifts=[{staffId:alex.id,site:'Ocean Beach',start:local(on,'18:00'),end:local(on,'22:00'),breakMinutes:0},{staffId:alex.id,site:'Ocean Beach',start:local(on,'08:00'),end:local(on,'16:00'),breakMinutes:0}]
  const r=await h.cmd('roster.prepare',{week:on,shifts});assert.deepEqual(r.conflicts,[]);await h.cmd('roster.publish',pin(r))
 }
 const base=`/api/lanyard/fairness?week=${week}&site=Ocean%20Beach`,path=`/api/lanyard/fairness/compare?week=${week}&site=Ocean%20Beach`
 const read=async(p=path,cookie=h.owner)=>{const r=await h.send(p,undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
 return {alex,ben,manager,foreign,first,week,base,path,read,full}
}

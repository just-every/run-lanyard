import assert from 'node:assert/strict'
import {days,local,pin} from './workforce-journey.mjs'
export async function fairnessFixture(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),unknown=await h.person('Casey'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,unknown,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:p===manager?'Manager':'Counter',hourlyRate:'20.00'})
 const first='2026-08-03',week=days(first,49),blocks='Mon preferred 10:00-18:00\nTue available 00:00-24:00\nWed available 00:00-24:00\nThu available 00:00-24:00\nFri available 00:00-24:00\nSat available 00:00-24:00\nSun available 00:00-24:00'
 for(const [p,preferredHours] of [[alex,10],[ben,6]])await h.cmd('pattern.save',{from:first,blocks,preferredHours},p.cookie)
 for(let i=0;i<8;i++){
  const on=days(first,i*7),r=await h.cmd('roster.prepare',{week:on,shifts:[{staffId:alex.id,site:'Ocean Beach',start:local(on,'10:00'),end:local(on,'18:00'),breakMinutes:0},{staffId:ben.id,site:'Ocean Beach',start:local(on,'10:00'),end:local(on,'14:00'),breakMinutes:0}]})
  assert.deepEqual(r.conflicts,[]);await h.cmd('roster.publish',pin(r))
 }
 const path=`/api/lanyard/fairness?week=${week}&site=Ocean%20Beach`,read=async(cookie=h.owner,suffix='')=>{const r=await h.send(path+suffix,undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
 return {alex,ben,unknown,manager,foreign,first,week,blocks,path,read}
}

import {days,monday,local,pin} from './workforce-journey.mjs'
export {pin}
export async function handoverFixture(h,withWork=true,today=new Date().toISOString().slice(0,10)) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:'Service',hourlyRate:'20.00'})
 const counter=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]}),kitchen=await h.cmd('job.save',{name:'Kitchen',skills:['food prep'],certifications:[]})
 const profile=await h.cmd('workforce.save',{staffId:alex.id,jobs:[counter.id,kitchen.id],skills:['food prep'],certifications:[],sites:['Ocean Beach'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[{job:counter.id,from:'2020-01-01',cents:2000},{job:kitchen.id,from:'2020-01-01',cents:2400}]})
 const week=days(monday(today),-7),start=local(week,'09:00'),end=local(week,'17:00')
 await h.cmd('availability.save',{staffId:alex.id,start:local(days(week,-1),'00:00'),end:local(days(week,7),'00:00')})
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:alex.id,job:counter.id,site:'Ocean Beach',start,end,breakMinutes:30,label:'Service and close'}]})
 await h.cmd('roster.publish',pin(draft));let shift=(await h.state()).shifts.find(x=>x.rosterId===draft.id)
 const input={shiftId:shift.id,shiftRevision:shift.revision,notes:'Close the service areas and record any equipment blockers.',tasks:['Sanitize counter','Check kitchen lock'],segments:[{until:240,job:counter.id,area:'Front counter'},{until:480,job:kitchen.id,area:'Kitchen close'}]}
 const work=withWork?await h.cmd('shiftwork.save',input,manager.cookie):null
 shift=(await h.state()).shifts.find(x=>x.id===shift.id)
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,manager,foreign,counter,kitchen,profile,week,start,end,shift,input,work}
}
export async function captureWork(h,f) {
 const start=new Date(Date.parse(f.start)-15*60000).toISOString(),end=new Date(Date.parse(f.end)+15*60000).toISOString()
 await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:start},f.alex.cookie)
 const closed=await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:end,breakMinutes:30},f.alex.cookie)
 return {start,end,time:closed.timesheet}
}

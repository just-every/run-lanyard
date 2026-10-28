import {pin,local} from './workforce-journey.mjs'
export {pin}
export async function holidayFixture(h,approve=true) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),foreign=await h.person('Taylor'),manager=await h.person('Morgan','manager')
 for(const p of [alex,ben,cy,foreign,manager])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:'Service',hourlyRate:'20.00'})
 const counter=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]}),kitchen=await h.cmd('job.save',{name:'Kitchen',skills:[],certifications:[]})
 const profile=await h.cmd('workforce.save',{staffId:alex.id,jobs:[counter.id,kitchen.id],skills:[],certifications:[],sites:['Ocean Beach'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',rates:[{job:counter.id,from:'2020-01-01',cents:2000},{job:kitchen.id,from:'2020-01-01',cents:2400}]})
 await h.cmd('holiday.seed',{site:'Ocean Beach',year:2025});await h.cmd('holiday.seed',{site:'Mission',year:2025})
 const company=await h.cmd('holiday.save',{site:'Ocean Beach',date:'2025-12-01',name:'Company service day',enabled:true})
 const rule=await h.cmd('holidayrule.save',{site:'Ocean Beach',from:'2025-01-01',mode:'multiplier',value:1.5,nonWorkMinutes:480,beforeAfter:true,code:'HOL'})
 const spec=(p,date,start='09:00',end='17:00')=>({staffId:p.id,start:local(date,start),end:local(date,end),breakMinutes:0,site:p===foreign?'Mission':'Ocean Beach',...(p===alex?{job:counter.id}:{})})
 for(const p of [alex,ben,cy,foreign])await h.cmd('availability.save',{staffId:p.id,start:local('2025-11-23','00:00'),end:local('2025-12-03','00:00')})
 const thanksgiving=spec(alex,'2025-11-27'),companyShift=spec(alex,'2025-12-01'),shifts=[...['2025-11-26','2025-11-27','2025-11-28'].flatMap(d=>[alex,ben,...(d==='2025-11-27'?[]:[cy])].map(p=>spec(p,d)))]
 const draft=await h.cmd('roster.prepare',{week:'2025-11-24',shifts});await h.cmd('roster.publish',pin(draft))
 for(const x of (await h.state()).shifts.filter(x=>x.staffId===alex.id&&x.start===thanksgiving.start))await h.cmd('shiftwork.save',{shiftId:x.id,shiftRevision:x.revision,notes:'Holiday service',tasks:[],segments:[{until:240,job:counter.id,area:'Front counter'},{until:480,job:kitchen.id,area:'Kitchen'}]},manager.cookie)
 const next=await h.cmd('roster.prepare',{week:'2025-12-01',shifts:[companyShift,spec(foreign,'2025-12-01'),spec(alex,'2025-12-02')]});await h.cmd('roster.publish',pin(next))
 const after=spec(alex,'2025-11-28'),pendingAfter=approve?await h.cmd('time.prepare',{staffId:alex.id,start:after.start,end:after.end,breakMinutes:0,reason:'Awaiting supervisor review'}):null
 const approved=[];let pendingHeld=false
 const enter=async(x,extra={})=>{const {site,job,...time}=x;const t=await h.cmd('time.prepare',{...time,reason:'Employer-reviewed paper time',...extra});return h.cmd('time.approve',pin(t),x.staffId===foreign.id?h.owner:manager.cookie)}
 if(approve){for(const x of shifts.filter(x=>!(x.staffId===ben.id&&x.start===spec(ben,'2025-11-28').start))){const t=x.staffId===alex.id&&x.start===after.start?await h.cmd('time.approve',pin(pendingAfter),manager.cookie):await enter(x);approved.push(t);if(x.staffId===alex.id&&x.start===thanksgiving.start){await h.cmd('payroll.prepare',{ids:[t.id]},h.owner,409);pendingHeld=true}};approved.push(await enter(companyShift));approved.push(await enter(spec(alex,'2025-12-02')));approved.push(await enter(spec(foreign,'2025-12-01')))}
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,cy,foreign,manager,counter,kitchen,profile,company,rule,thanksgiving,companyShift,approved,enter,spec,pendingHeld}
}

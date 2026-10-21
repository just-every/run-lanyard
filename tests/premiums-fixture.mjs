import {pin,local} from './workforce-journey.mjs'
export {pin,local}
export async function premiumFixture(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),dana=await h.person('Dana'),manager=await h.person('Morgan','manager'),foreign=await h.person('Taylor','manager')
 for(const p of [alex,ben,cy,dana,manager,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:[cy,dana,foreign].includes(p)?'New York':'California',position:'Service',hourlyRate:'16.00'})
 const counter=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]}),kitchen=await h.cmd('job.save',{name:'Kitchen',skills:[],certifications:[]})
 const profiles=[]
 for(const p of [alex,ben])profiles.push(await h.cmd('workforce.save',{staffId:p.id,jobs:[counter.id,kitchen.id],skills:[],certifications:[],sites:['California'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',rates:[{job:counter.id,from:'2020-01-01',cents:p===alex?2000:1600},{job:kitchen.id,from:'2020-01-01',cents:p===alex?2400:1700}]}))
 const caRule=await h.cmd('premiumrule.save',{site:'California',from:'2025-01-01',preset:'CA',minimumCents:1600,codes:{reporting:'CA-REPORT',split:'CA-SPLIT',spread:'CA-SPREAD'}})
 const nyRule=await h.cmd('premiumrule.save',{site:'New York',from:'2025-01-01',preset:'NY-hospitality',minimumCents:1600,codes:{reporting:'NY-CALL',split:'NY-SPLIT',spread:'NY-SPREAD'}})
 const spec=(p,d,start,end,breakMinutes=0)=>({staffId:p.id,start:local(d,start),end:local(d,end),breakMinutes,site:[cy,dana].includes(p)?'New York':'California',...([alex,ben].includes(p)?{job:counter.id}:{})})
 const a=spec(alex,'2025-11-17','09:00','17:00'),b=spec(ben,'2025-11-18','09:00','19:00',240),c=spec(cy,'2025-11-19','07:00','18:00',240),d=spec(dana,'2025-11-20','09:00','13:00')
 for(const p of [alex,ben,cy,dana])await h.cmd('availability.save',{staffId:p.id,start:local('2025-11-16','00:00'),end:local('2025-11-22','00:00')})
 const roster=await h.cmd('roster.prepare',{week:'2025-11-17',shifts:[a,b,c,d]});await h.cmd('roster.publish',pin(roster))
 const shifts=(await h.state()).shifts.filter(t=>t.rosterId===roster.id)
 const shiftOf=p=>shifts.find(t=>t.staffId===p.id)
 for(const p of [alex,ben])await h.cmd('shiftwork.save',{shiftId:shiftOf(p).id,shiftRevision:shiftOf(p).revision,notes:'Employer-directed service areas',tasks:[],segments:p===alex?[{until:30,job:counter.id,area:'Counter'},{until:480,job:kitchen.id,area:'Kitchen'}]:[{until:300,job:counter.id,area:'Counter'},{until:600,job:kitchen.id,area:'Kitchen'}]})
 const enter=async(x,extra={})=>{const {site,job,...w}=x;const t=await h.cmd('time.prepare',{...w,reason:'Employer reviewed recorded work',...extra});return h.cmd('time.approve',pin(t))}
 const at=await enter({...a,end:local('2025-11-17','10:00')}),bt=await enter(b),ct=await enter(c)
 const prepare=async(time,kind,extra={})=>h.cmd('premium.prepare',{timeId:time.id,kind,reason:'Supervisor reviewed source facts',...extra})
 const approve=async(r,cookie=h.owner)=>h.cmd('premium.decide',{...pin(r),decision:'approve',reason:'Supervisor verified facts and retained rates'},cookie)
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,cy,dana,manager,foreign,counter,kitchen,profiles,caRule,nyRule,a,b,c,d,at,bt,ct,shiftOf,enter,prepare,approve}
}

// Public-door workforce/service data shared by ACA-001's API and browser journeys.
import assert from 'node:assert/strict'
export const pin=r=>({id:r.id,revision:r.revision})
export const addDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
export const month=(year,m)=>new Date(Date.UTC(year,m,1)).toISOString().slice(0,10)
export async function acaPeople(h) {
 const alex=await h.person('Alex'),ben=await h.person('Ben'),cy=await h.person('Cy'),priya=await h.person('Priya','manager'),omar=await h.person('Omar','manager')
 for(const p of [alex,ben,cy,priya,omar])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===cy||p===omar?'Mission':'Ocean Beach',position:'Counter',hourlyRate:'22.00'})
 return {alex,ben,cy,priya,omar}
}
export async function acaYear(h,people) {
 const year=new Date().getUTCFullYear()-1,start=`${year}-01-01`,end=`${year}-12-31`,entries=[],days=[]
 for(let d=start;d<=end;d=addDays(d,1))if([1,2,4,5].includes(new Date(d+'T12:00Z').getUTCDay()))days.push(d)
 const create=async(p,date,startTime='16:00',endTime='00:00')=>{
  const t=await h.cmd('time.prepare',{staffId:p.id,start:`${date}T${startTime}:00Z`,end:`${addDays(date,1)}T${endTime}:00Z`,breakMinutes:0,reason:'Approved opening-service record'})
  entries.push(t);return t
 }
 for(const d of days)await create(people.alex,d)
 for(let m=0;m<12;m++){await create(people.ben,month(year,m));await create(people.cy,addDays(month(year,m),1))}
 // An overnight period boundary has 4/12 of 690 payable minutes in January.
 const overnight=await h.cmd('time.prepare',{staffId:people.cy.id,start:`${year}-02-01T04:00:00Z`,end:`${year}-02-01T16:00:00Z`,breakMinutes:30,reason:'Overnight month-boundary service'});entries.push(overnight)
 const approved=await h.cmd('time.approveMany',{items:entries.map(pin)})
 assert.equal(approved.approved.length,entries.length);assert.deepEqual(approved.skipped,[])
 const plan=await h.cmd('aca.plan.save',{name:'Annual variable-hour group',start,end,adminEnd:`${year+1}-01-30`,stabilityEnd:`${year+2}-01-30`,staffIds:[people.alex.id,people.ben.id,people.cy.id]})
 return {year,plan,days,entries,overnight}
}
export async function acaTrending(h,people) {
 const now=new Date(),start=month(now.getUTCFullYear(),now.getUTCMonth()-2),next=month(now.getUTCFullYear(),now.getUTCMonth()+2),end=addDays(next,-1)
 const days=(Date.parse(next)-Date.parse(start))/86400000,threshold=30*60*days/7
 let minutes=Math.floor(threshold)-240,n=0
 while(minutes>0){const amount=Math.min(720,minutes);await h.cmd('aca.credit.save',{staffId:people.ben.id,date:addDays(start,n),minutes:amount,category:'leave',reference:`paid-service-${n++}`,reason:'Employer paid-service ledger for the measurement group'});minutes-=amount}
 const stabilityEnd=addDays(month(now.getUTCFullYear()+1,now.getUTCMonth()+2),-1)
 const plan=await h.cmd('aca.plan.save',{name:'Current variable-hour review',start,end,adminEnd:end,stabilityEnd,staffIds:[people.alex.id,people.ben.id,people.cy.id]})
 const at=new Date(Date.now()+2*86400000);at.setUTCHours(16,0,0,0)
 const shift={staffId:people.ben.id,start:at.toISOString(),end:new Date(at.getTime()+8*3600000).toISOString(),breakMinutes:0,site:'Ocean Beach',label:'Counter service'}
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(at),dow=new Date(local+'T12:00Z').getUTCDay(),week=addDays(local,-((dow+6)%7))
 await h.cmd('availability.save',{staffId:people.ben.id,start:new Date(at.getTime()-86400000).toISOString(),end:new Date(at.getTime()+10*86400000).toISOString()})
 const roster=await h.cmd('roster.prepare',{week,shifts:[shift]});assert.deepEqual(roster.conflicts,[]);await h.cmd('roster.publish',pin(roster))
 return {plan,week,shift,threshold}
}

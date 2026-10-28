import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin,local} from './workforce-journey.mjs'

// One native employment-to-leave journey: earned history survives a prospective
// coverage change, unsupported use is refused, and a reviewed return is usable.
export async function sickEligibilityJourney(){
 const h=await harness({now:'2026-05-05T12:00:00Z'})
 try{
  const review=(input,cookie=h.owner,status=200)=>h.cmd('sickworker.save',input,cookie,status,{'x-test-now':String(Date.parse('2026-05-01T12:00:00Z'))})
  const person=await h.person('EligibilityWorker'),manager=await h.person('EligibilityManager','manager')
  await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site:'Eligibility CA',hourlyRate:'20.00',startDate:'2024-01-01'})
  const cases=[['CA','railroad'],['CO','federal-government'],['IL','school-or-park-district'],['NY','government'],['OR','work-study'],['WA','minimum-wage-act-exclusion'],['NYC','federal-work-study'],['CHICAGO','qualifying-construction-agreement'],['SEATTLE','federal-government'],['SF','independent-contractor'],['LA','independent-contractor'],['PHILADELPHIA','seasonal']]
  const policies=[]
  for(const [index,[preset,classification]] of cases.entries()){
   const site='Eligibility '+preset,policy=await h.cmd('sickpolicy.save',{site,from:'2025-01-01',preset,code:'SICK-'+preset})
   const day=n=>new Date(Date.parse('2025-01-01T00:00:00Z')+(index*14+n)*86400000).toISOString().slice(0,10)
   for(const [start,end] of [[day(0),day(2)],[day(7),day(9)]]){
    const time=await h.cmd('time.prepare',{staffId:person.id,start:local(start,'08:00'),end:local(end,'08:00'),site,breakMinutes:0,reason:'Synthetic eligible workplace service'})
    await h.cmd('time.approve',pin(time))
   }
   policies.push({policy,classification})
  }
  const reports=async on=>(await h.send('/api/lanyard/sick-balances?asOf='+on,undefined,h.owner)).value.filter(r=>r.staffId===person.id)
  const before=await reports('2026-04-30')
  assert.ok(before.every(r=>r.balanceMinutes>=120),'real approved work earns each location’s bank')
  for(const [index,{policy,classification}] of policies.entries()){
   const input={...pin(policy),staffId:person.id,from:'2026-05-01',classification,legalBasis:'Reviewed applicable exclusion against the jurisdiction source',evidenceReference:'synthetic-lanyard-150 employer source',reviewReason:'Prospective employee-specific coverage change'}
   await review(input,manager.cookie,403)
   await review({...input,evidenceReference:''},h.owner,400)
   const excluded=await review(input)
   await review(input,h.owner,409)
   const request={policyId:policy.id,start:local('2026-05-02','09:00'),end:local('2026-05-02','10:00'),minutes:60,purpose:policy.reasons[0]}
   const records=(await h.state()).sickuses.length
   const refused=await h.cmd('sick.request',request,person.cookie,409);assert.match(refused.error,/exclusion/)
   assert.equal((await h.state()).sickuses.length,records,'excluded request writes no absence or private use')
   const work=await h.cmd('time.prepare',{staffId:person.id,start:local('2026-05-02',String(index).padStart(2,'0')+':00'),end:local('2026-05-02',String(index+1).padStart(2,'0')+':00'),site:policy.site,breakMinutes:0,reason:'Worked hours remain recorded during a reviewed exclusion'});await h.cmd('time.approve',pin(work))
   assert.equal((await reports('2026-05-02')).find(r=>r.policyId===policy.id).balanceMinutes,before.find(r=>r.policyId===policy.id).balanceMinutes,'exclusion does not erase earlier earnings or earn new statutory minutes')
   const reviewed=await review({...input,...pin(excluded),from:'2026-05-03',classification:'covered',qualifiedFrom:'2025-01-30',reviewReason:'Reviewed covered employment and prior qualifying service'})
   const use=await h.cmd('sick.request',{...request,start:local('2026-05-04',String(index).padStart(2,'0')+':00'),end:local('2026-05-04',String(index+1).padStart(2,'0')+':00')},person.cookie)
   const approved=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-151-'+policy.preset})
   assert.deepEqual([approved.minutes,approved.costCents],[60,2000])
   assert.equal((await reports('2026-05-04')).find(r=>r.policyId===policy.id).balanceMinutes,before.find(r=>r.policyId===policy.id).balanceMinutes-60)
   assert.equal(reviewed.versions[0].workerCoverage.length,0)
  }
  const own=await h.state(person.cookie),ordinary=await h.state(manager.cookie)
  assert.ok(own.sickpolicies.every(p=>!p.workerCoverage&&!p.versions),'employee projection excludes private employer evidence')
  assert.ok(ordinary.sickpolicies.every(p=>!p.workerCoverage&&!p.versions),'generic manager has no private employer evidence')
  const saved=(await h.state()).sickpolicies
  await h.restart()
  assert.deepEqual((await h.state()).sickpolicies,saved,'effective reviews and their history survive restart')
  const file=await h.send('/api/lanyard/sick-balances.csv?asOf=2026-05-04',undefined,h.owner)
  assert.equal(file.status,200);assert.ok(file.text.includes('SICK-CA'));assert.doesNotMatch(file.text,/employer source|Applicability legal basis/)
 }finally{await h.close()}
}

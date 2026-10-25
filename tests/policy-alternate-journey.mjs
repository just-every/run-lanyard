import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const week='2026-10-12',from='2026-09-07'
export const alternateExample=staffIds=>({
 kind:'CA_WO5_GENERAL',workUnit:'synthetic-lanyard-1 service work unit',staffIds,
 days:[1,2,3,4].map(day=>({day,minutes:600})),employerAttested:true,
 electionOn:'2026-08-03',announcedOn:'2026-08-03',effectiveFrom:from,
 electionEvidence:'synthetic-lanyard-1 written agreement, timely disclosure, secret ballot tally and DIR reporting record',
 implementationEvidence:'synthetic-lanyard-2 implementation record and explicit cafe enrollment roster',
 reviewer:'Jordan Venue',reviewedOn:'2026-09-01',
})
async function person(h,name){
 const p=await h.person(name)
 await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site:'East',hourlyRate:'20.00'})
 return p
}
async function approve(h,p,on,hours,site='East',start=8){
 const begin=on+`T${String(start).padStart(2,'0')}:00:00Z`
 const t=await h.cmd('time.prepare',{staffId:p.id,site,start:begin,end:new Date(Date.parse(begin)+hours*3600000).toISOString(),breakMinutes:0,reason:'Reviewed alternative workweek actual service'})
 return h.cmd('time.approve',pin(t))
}
async function apply(h,change){
 const preview=await h.cmd('policy.preview',change)
 return {preview,policy:await h.cmd('policy.save',{...change,reviewDigest:preview.digest})}
}

export async function policyAlternateApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const alex=await person(h,'Elected'),manager=await h.person('ElectionManager','manager')
  const inactive=await h.cmd('staff.save',{name:'Inactive election member',email:'inactive-election@venue.example',payrollId:'SYNTHETIC-LANYARD-3',role:'staff',active:false,site:'East'})
  const prior=await h.cmd('policy.save',{site:'East',preset:'CA',from,reviewReason:'Reviewed standard California overtime'})
  await approve(h,alex,week,10)
  const alternate=alternateExample([alex.id]),change={...pin(prior),site:'East',preset:'CA',from,alternate,reviewReason:'Reviewed work unit election evidence and employee inclusion'}
  await h.cmd('policy.preview',change,manager.cookie,403)
  for(const invalid of [
   {...alternate,employerAttested:false},
   {...alternate,electionEvidence:''},
   {...alternate,implementationEvidence:''},
   {...alternate,reviewer:''},
   {...alternate,reviewedOn:''},
   {...alternate,announcedOn:'2026-08-25'},
   {...alternate,staffIds:[]},
   {...alternate,staffIds:[alex.id,alex.id]},
   {...alternate,staffIds:['synthetic-lanyard-missing']},
   {...alternate,staffIds:[inactive.id]},
   {...alternate,days:[{day:1,minutes:720}]},
   {...alternate,days:[{day:1,minutes:180}]},
   {...alternate,days:[1,2,3,4,5].map(day=>({day,minutes:600}))},
   {...alternate,days:[{day:1,minutes:600},{day:1,minutes:600}]},
  ])await h.cmd('policy.preview',{...change,alternate:invalid},h.owner,400)
  await h.cmd('policy.preview',{...change,preset:'federal'},h.owner,400)
  await h.cmd('policy.save',change,h.owner,409)
  let preview=await h.cmd('policy.preview',change)
  const calculation=preview.calculations.find(c=>c.staffId===alex.id)
  assert.deepEqual([calculation.before.overtimeMinutes,calculation.after.overtimeMinutes],[120,0],'preview recalculates the enrolled employee from actual source hours')
  assert.equal((await h.state()).policies.find(p=>p.id===prior.id).revision,prior.revision,'preview leaves the active policy unchanged')
  await h.cmd('time.prepare',{staffId:alex.id,site:'East',start:'2026-10-13T08:00:00Z',end:'2026-10-13T10:00:00Z',breakMinutes:0,reason:'New source facts after policy preview'})
  await h.cmd('policy.save',{...change,reviewDigest:preview.digest},h.owner,409)
  preview=await h.cmd('policy.preview',change)
  let saved=await h.cmd('policy.save',{...change,reviewDigest:preview.digest})
  assert.equal(saved.releaseReview.digest,preview.digest)
  assert.equal(saved.releaseReview.by,saved.by)
  assert.deepEqual(saved.alternate.staffIds,[alex.id])
  assert.equal(saved.alternate.enrollment[0].staffId,alex.id)
  assert.equal(saved.alternate.enrollment[0].site,'East')
  assert.equal(saved.alternate.electionEvidence,alternate.electionEvidence)
  assert.ok(saved.alternate.source.startsWith('https://www.dir.ca.gov/'))
  saved=await h.cmd('policy.save',{...pin(saved),site:'East',preset:'CA',from,minimumRestMinutes:30,reviewReason:'Reviewed employer rest requirement while retaining elected coverage'})
  assert.deepEqual(saved.alternate.staffIds,[alex.id],'ordinary site edits retain explicit enrollment')
  assert.ok(saved.versions.some(p=>p.releaseReview?.digest===preview.digest),'release approval remains in retained history')
  const remove={...pin(saved),site:'East',preset:'CA',from:'2026-10-19',alternate:null,reviewReason:'Reviewed removal for future work without rewriting prior actuals'}
  await h.cmd('policy.save',remove,h.owner,409)
  const removed=(await apply(h,remove)).policy
  assert.equal(removed.alternate,null)
  assert.ok(removed.versions.some(p=>p.alternate?.staffIds.includes(alex.id)))
  assert.equal((await h.cmd('policy.review',{staffId:alex.id,week})).overtimeMinutes,0,'later removal retains the earlier elected workday treatment')
  const state=await h.state()
  assert.ok(state.events.some(e=>e.entityId===saved.id&&e.action==='policy.save'&&e.actorId===saved.by&&e.actorRole==='owner'))
  assert.equal(state.batches.length,0,'reviewed configuration never creates payroll')
 }finally{await h.close()}
}

export async function policyAlternateClassificationApi(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  const alex=await person(h,'Scheduled'),ben=await person(h,'Unenrolled'),alternate=alternateExample([alex.id])
  for(const site of ['East','West'])await apply(h,{site,preset:'CA',from,alternate,reviewReason:'Reviewed explicit enrollment at both service cafes'})
  await approve(h,alex,week,5)
  await approve(h,alex,week,5,'West',13)
  await approve(h,alex,'2026-10-13',13)
  await approve(h,alex,'2026-10-14',9)
  await approve(h,alex,'2026-10-16',9,'West')
  await approve(h,ben,week,10,'West')
  const report=await h.cmd('policy.review',{staffId:alex.id,week})
  const totals=on=>report.parts.filter(p=>p.date===on).reduce((n,p)=>[n[0]+p.regularMinutes,n[1]+p.overtimeMinutes,n[2]+p.doubleMinutes],[0,0,0])
  assert.deepEqual(totals(week),[600,0,0],'adjacent cafes share the completed day total rather than appearing as shortened segments')
  assert.deepEqual(totals('2026-10-13'),[600,120,60],'elected day overtime begins at the agreed length and double time after twelve hours')
  assert.deepEqual(totals('2026-10-14'),[480,60,0],'a shortened day uses protective ordinary overtime while its cause requires review')
  assert.equal(report.classificationIncomplete,true,'shortened-day consent cannot be inferred from the timesheet')
  assert.deepEqual(totals('2026-10-16'),[0,480,60],'an additional day pays overtime from the first minute and double time after eight hours')
  const standard=await h.cmd('policy.review',{staffId:ben.id,week})
  assert.deepEqual([standard.regularMinutes,standard.overtimeMinutes,standard.doubleMinutes],[480,120,0],'a cafe policy never enrolls a coworker implicitly')
  const retained=(await h.state()).policies
  assert.ok(retained.filter(p=>['East','West'].includes(p.site)).every(p=>p.alternate.enrollment.some(e=>e.staffId===alex.id)),'each worked cafe retains its own explicit enrollment evidence')
 }finally{await h.close()}
}

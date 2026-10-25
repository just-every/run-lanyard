import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const week='2026-10-12'
const cases=[
 {name:'Nevada six-hour fraction',preset:'NV',span:390,meals:[],rests:[[180,10]],issues:0,restIssues:0,legacyIssues:0,legacyRestIssues:1},
 {name:'Nevada seven-hour boundary',preset:'NV',span:420,meals:[],rests:[[180,10]],issues:0,restIssues:1},
 {name:'Washington rolling meal deadline',preset:'WA',span:700,meals:[[120,30],[500,30]],issues:1,legacyIssues:0},
 {name:'Washington meal after prior meal',preset:'WA',span:720,meals:[[300,30],[620,30]],issues:0,legacyIssues:1},
 {name:'California second worked-hour deadline',preset:'CA',span:750,meals:[[240,30],[615,30]],issues:0,legacyIssues:1},
 {name:'Noon at eleven',preset:'NY',span:480,meals:[[180,30]],issues:0,legacyIssues:1},
 {name:'Evening without noon',preset:'NY',span:720,meals:[[540,20]],issues:1,legacyIssues:2},
 {name:'Noon and evening',preset:'NY',span:720,meals:[[180,30],[540,20]],issues:0},
 {name:'Extra meal before noon',preset:'NY',span:720,meals:[[60,30],[180,30],[540,20]],issues:0},
 {name:'Short noon meal',preset:'NY',span:480,meals:[[180,15]],issues:1},
 {name:'Below ten worked hours',preset:'CA',span:615,meals:[[240,30]],issues:0,legacyIssues:1},
 {name:'Exactly ten worked hours',preset:'CA',span:630,meals:[[240,30]],issues:0},
 {name:'Above ten worked hours',preset:'CA',span:631,meals:[[240,30]],issues:1},
 {name:'Exactly seven working hours',preset:'OR',span:450,meals:[[150,30]],issues:0,legacyIssues:1},
 {name:'Above seven working hours',preset:'OR',span:451,meals:[[150,30]],issues:1},
 {name:'Shorter than six working hours',preset:'OR',span:375,meals:[[60,30]],issues:0},
 {name:'Seven hour completion deadline',preset:'OR',span:450,meals:[[230,30]],issues:1},
 {name:'Longer completion deadline',preset:'OR',span:480,meals:[[280,30]],issues:1},
 {name:'Exactly six working hours rest',preset:'OR',span:390,meals:[[150,30]],rests:[[90,10]],issues:0,restIssues:0},
]

// Real native sessions and timed captures reach the same policy review command
// used for payroll estimates. Historical and current policies coexist at cafes.
export async function policyTimingVariants(){
 const h=await harness()
 try{
  await h.cmd('settings.save',{timezone:'UTC'})
  for(const preset of ['NY','CA','OR','NV','WA'])for(const legacy of [false,true])await h.cmd('policy.save',{
   site:preset+(legacy?' Legacy':' Current'),preset,from:'2026-01-01',
   ...(legacy?{breakVersion:'2026-10-26'}:{}),reviewReason:'Reviewed recorded timing under selected maintained release',
  })
  let number=0
  for(const sample of cases)for(const legacy of sample.legacyIssues===undefined?[false]:[false,true]){
   const name='Timing'+String(++number),site=sample.preset+(legacy?' Legacy':' Current'),person=await h.person(name)
   await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,active:true,role:'staff',site,hourlyRate:'20.00'})
   const at=minute=>new Date(Date.parse(week+'T08:00:00Z')+minute*60000).toISOString()
   await h.cmd('clock.in',{commandId:'timing-in-'+number,capturedAt:at(0)},person.cookie)
   const captures=[...sample.meals.map(([start,length])=>({kind:'meal',start,length})),...(sample.rests??[]).map(([start,length])=>({kind:'rest',start,length}))].sort((a,b)=>a.start-b.start)
   for(const [i,b]of captures.entries()){
    await h.cmd('clock.breakStart',{commandId:`timing-break-${number}-${i}`,capturedAt:at(b.start),kind:b.kind},person.cookie)
    await h.cmd('clock.breakEnd',{commandId:`timing-end-${number}-${i}`,capturedAt:at(b.start+b.length)},person.cookie)
   }
   const capture=await h.cmd('clock.out',{commandId:'timing-out-'+number,capturedAt:at(sample.span),breakMinutes:0},person.cookie)
   await h.cmd('time.approve',pin(capture.timesheet))
   const report=await h.cmd('policy.review',{staffId:person.id,week}),review=report.breakReviews[0]
   assert.equal(review.issues.filter(i=>i.kind==='meal').length,legacy?sample.legacyIssues:sample.issues,sample.name+(legacy?' historical':' current'))
   if(sample.restIssues!==undefined)assert.equal(review.issues.filter(i=>i.kind==='rest').length,legacy?(sample.legacyRestIssues??sample.restIssues):sample.restIssues,sample.name)
   assert.equal(report.minutes,sample.span-sample.meals.reduce((n,[,length])=>n+length,0),'paid rests remain worked time')
   assert.equal((await h.state()).batches.length,0,'timing review does not create payroll')
  }
 }finally{await h.close()}
}

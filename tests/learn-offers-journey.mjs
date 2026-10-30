import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const SITE='Ocean Beach',NOW='2026-10-28T12:00:00Z'
const at=time=>({'x-test-now':String(Date.parse(time))})
const day=n=>`2026-10-${String(n).padStart(2,'0')}`
const protectedFields=['rosters','shifts','offers','forecasts','demandrules','demandforecasts','sales','clocks','timesheets','batches','claims']
async function unchanged(h,before,learningChanged=false){const after=await h.state();for(const field of [...protectedFields,...(learningChanged?[]:['offerrules','learnoffers','version'])])assert.deepEqual(after[field],before[field],field);return after}
export async function offerFixture(h,count=6,review=true) {
 const cmd=(n,p,c=h.owner,status=200,time=NOW)=>h.cmd(n,p,c,status,at(time))
 await cmd('settings.save',{timezone:'UTC'})
 const caller=await h.person('Ada'),responders=[]
 for(const name of ['Bea','Cy','Dee'])responders.push(await h.person(name))
 const manager=await h.person('Priya','manager'),foreign=await h.person('Omar','manager')
 for(const p of [caller,...responders,manager,foreign])Object.assign(p,await cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,active:true,role:p.role,site:p===foreign?'Elsewhere':SITE,position:[manager,foreign].includes(p)?'Manager':'Barista',hourlyRate:'20.00'}))
 for(const p of [caller,...responders])await cmd('availability.save',{staffId:p.id,start:'2026-10-01T00:00:00Z',end:'2026-11-01T00:00:00Z'})
 const saveRule=async(extra={})=>{const old=(await h.state()).offerrules.find(r=>r.site===SITE);return cmd('offerrule.save',{site:SITE,...(old?{revision:old.revision}:{}),order:'tiers',rule:'custom',ranking:responders.map(p=>p.id),size:1,minutes:60,...extra})}
 await saveRule()
 const coverage=async(employees=10,preset='Oregon')=>{const old=(await h.state()).fairworkpolicies.find(r=>r.site===SITE);return cmd('fairwork.save',{site:SITE,...(old?{revision:old.revision}:{}),preset,industry:'food-service',employees,locations:1,localEmployees:10,reason:'Owner reviewed the current employer facts'})}
 if(review)await coverage()
 const dates=[12,13,14,15,16,17,18,19,20,21,29,30,31]
 for(const [week,days] of [['2026-10-12',dates.filter(d=>d<=18)],['2026-10-19',dates.filter(d=>d>=19&&d<=21)],['2026-10-26',dates.filter(d=>d>=29)]]){
  const draft=await cmd('roster.prepare',{week,shifts:days.map(d=>({staffId:caller.id,site:SITE,start:day(d)+'T09:00:00Z',end:day(d)+'T12:00:00Z',breakMinutes:0}))})
  await cmd('roster.publish',pin(draft))
 }
 const round=async(d,latencies=[2,5,9],approve=false)=>{
  const shift=(await h.state()).shifts.find(r=>r.start===day(d)+'T09:00:00.000Z')
  assert.ok(shift,day(d))
  const out=await cmd('shift.callout',{...pin(shift),note:'Native call-out'},caller.cookie,200,d>=29?NOW:day(d)+'T06:00:00Z')
  assert.deepEqual(out.offers.map(o=>o.staffId),responders.map(p=>p.id))
  for(let i=0;i<latencies.length;i++)if(latencies[i]!==null){const o=out.offers[i];out.offers[i]=await cmd('cover.respond',{...pin(o),decision:i===0?'accepted':'declined'},responders[i].cookie,200,new Date(Date.parse(o.opensAt)+latencies[i]*60000).toISOString())}
  if(approve)await cmd('cover.approve',pin(out.offers[0]),h.owner,200,day(d)+'T06:03:00Z')
  return out
 }
 for(let i=0;i<count;i++)await round(12+i)
 const read=(percentile=60,c=manager.cookie)=>h.send(`/api/lanyard/learning/offers?site=${encodeURIComponent(SITE)}${percentile===null?'':`&percentile=${percentile}`}`,undefined,c,at(NOW))
 const propose=async(e,c=manager.cookie,status=200)=>cmd('learn.offer.propose',{site:SITE,percentile:e.targetPercentile,targetReviewed:true,reason:'Reviewed response calibration, without a service-outcome claim',digest:e.digest},c,status)
 return {caller,responders,manager,foreign,cmd,saveRule,coverage,round,read,propose}
}
// Distinct later responses make fitting on held-out evidence observably wrong.
async function offerCalibrationBoundaryApi() {
 const h=await harness({now:NOW})
 try{
  const f=await offerFixture(h,0)
  for(let d=12;d<=15;d++)await f.round(d,[1.25,4.1,10.75])
  assert.equal((await f.read(25)).value.status,'insufficient','four rounds cannot supply a six-round comparison')
  for(let d=16;d<=17;d++)await f.round(d,[7,8,9])
  let e=(await f.read(60)).value
  // Earlier 60th percentile is 4.1 minutes, rounded to 5. None of the later
  // responses meets it: error 60 points, versus 40 at the existing 60 minutes.
  // Pooling later evidence into fitting would choose 8 and invent improvement.
  assert.equal(e.status,'no-improvement')
  assert.equal(e.proposal,null)
  assert.deepEqual([e.evaluation.trainingPercentileMinutes,e.evaluation.currentWithinMinutes,e.evaluation.candidateWithinMinutes,e.evaluation.currentCalibrationErrorPoints,e.evaluation.candidateCalibrationErrorPoints],[4.1,6,0,40,60])
  const before=await h.state()
  await f.propose(e,f.manager.cookie,409)
  await unchanged(h,before)
  e=(await f.read(25)).value
  // Nearest-rank 25th percentile of the twelve earlier responses is 1.25,
  // rounded up to 2 minutes. The six later responses all exceed it: 25 points
  // from the reviewed target, improving on the current interval's 75 points.
  assert.equal(e.status,'proposal')
  assert.deepEqual([e.proposal.from,e.proposal.to,e.evaluation.trainingPercentileMinutes,e.evaluation.currentCalibrationErrorPoints,e.evaluation.candidateCalibrationErrorPoints],[60,2,1.25,75,25])
  const dates=ids=>ids.map(id=>e.rounds.find(r=>r.id===id).openedAt.slice(0,10))
  assert.deepEqual(dates(e.evaluation.trainRounds),[12,13,14,15].map(day))
  assert.deepEqual(dates(e.evaluation.holdoutRounds),[16,17].map(day))
  await f.round(18,[2,null,9])
  let incomplete=(await f.read(25)).value
  assert.deepEqual(incomplete.evaluation,e.evaluation,'a partially answered round supplies no fitting or held-out responses')
  assert.equal(incomplete.unknownRounds,1)
  assert.equal(incomplete.unknownResponses,1)
  assert.ok(incomplete.rounds.some(r=>r.reason==='unanswered'&&r.status==='unknown'))
  // Actual responses alone do not make a still-open future round completed.
  const open=await f.round(29)
  incomplete=(await h.send('/api/lanyard/learning/offers?site=Ocean%20Beach&percentile=25',undefined,f.manager.cookie,at('2026-10-28T20:00:00Z'))).value
  assert.equal(incomplete.rounds.find(r=>r.responses.some(o=>o.offerId===open.offers[0].id)).reason,'round not completed')
  assert.deepEqual(incomplete.evaluation,e.evaluation)
  await h.restart()
  const retained=(await f.read(25)).value
  assert.deepEqual(retained.evaluation,e.evaluation)
  const proposal=await f.propose(retained)
  assert.equal(proposal.explanationVersion,retained.explanationVersion)
  assert.equal(proposal.digest,retained.digest)
  assert.equal(proposal.ruleDigest,retained.ruleDigest)
  assert.deepEqual(proposal.evaluation,e.evaluation)
  assert.deepEqual(proposal.rounds,retained.rounds)
  assert.equal((await h.state()).offerrules[0].minutes,60,'recording calibration does not apply it')
  console.log('PROBE LEARN-001 held-out calibration: earlier fractional responses select 2 minutes for reviewed percentile 25; later-only error 75 -> 25 points; percentile 60 refuses worsening 40 -> 60; partial and active rounds stay unknown through restart')
 }finally{await h.close()}
}
export async function offerApi(h) {
 await offerCalibrationBoundaryApi()
 const f=await offerFixture(h,2,false),{cmd,read,propose,round,manager,foreign,caller,responders,coverage,saveRule}=f
 assert.equal((await read()).value.status,'insufficient')
 assert.equal((await read(null)).value.status,'needs-target')
 assert.equal((await read(0)).status,400)
 for(let d=14;d<=17;d++)await round(d)
 await round(18,[])
 await round(19,[2],true)
 // A pre-retention record is historical input, not an inferred successful response.
 const legacy={id:'synthetic-lanyard-1',revision:1,shiftId:(await h.state()).shifts.find(r=>r.start.startsWith(day(20))).id,shiftRevision:1,status:'declined',createdAt:day(20)+'T06:00:00Z',opensAt:day(20)+'T06:00:00Z',respondedAt:day(20)+'T06:05:00Z',expiresAt:day(20)+'T12:00:00Z'}
 await h.db.prepare('INSERT INTO l_records(kind,id,revision,data) VALUES(?,?,?,?)').bind('offers',legacy.id,1,JSON.stringify(legacy)).run()
 let e=(await read()).value
 assert.deepEqual([e.status,e.comparableRounds,e.unknownRounds,e.unknownResponses],['proposal',6,3,6])
 // Independently: training has four each of 2, 5 and 9 minutes. The 60th percentile is 5;
 // later rounds contain two each. 4 of 6 respond by 5, versus 6 of 6 by 60.
 assert.deepEqual([e.proposal.from,e.proposal.to,e.evaluation.trainRounds.length,e.evaluation.holdoutRounds.length,e.evaluation.trainingResponses,e.evaluation.holdoutResponses,e.evaluation.trainingPercentileMinutes,e.evaluation.currentWithinMinutes,e.evaluation.candidateWithinMinutes],[60,5,4,2,12,6,5,6,4])
 assert.equal(e.evaluation.currentCalibrationErrorPoints,40)
 assert.ok(Math.abs(e.evaluation.candidateCalibrationErrorPoints-20/3)<1e-10)
 assert.deepEqual(e.rounds.filter(r=>r.status==='comparable').map(r=>r.openedAt.slice(0,10)),[12,13,14,15,16,17].map(day))
 assert.ok(e.rounds.some(r=>r.responses.some(o=>o.unknownReason==='missing historical scope or rule')))
 assert.ok(e.rounds.some(r=>r.responses.some(o=>o.unknownReason==='closed before an actual response')))
 assert.equal((await read(100)).value.status,'no-improvement')
 assert.equal((await read(100)).value.proposal,null)
 await propose((await read(100)).value,manager.cookie,409)
 await cmd('learn.offer.propose',{site:SITE,percentile:60,targetReviewed:false,reason:'Unreviewed target',digest:e.digest},manager.cookie,400)
 await cmd('learn.offer.propose',{site:SITE,percentile:60,targetReviewed:true,reason:'Stale digest',digest:'0'.repeat(64)},manager.cookie,409)
 let p=await propose(e)
 let before=await h.state()
 await cmd('learn.offer.decide',{...pin(p),decision:'approved',reason:'No coverage review exists'},manager.cookie,409)
 await unchanged(h,before)
 await coverage()
 await cmd('learn.offer.decide',{...pin(p),decision:'approved',reason:'Coverage changed after review'},manager.cookie,409)
 p=await cmd('learn.offer.decide',{...pin(p),decision:'declined',reason:'Refresh the coverage evidence'},manager.cookie)
 e=(await read()).value;p=await propose(e)
 await round(21)
 before=await h.state()
 await cmd('learn.offer.decide',{...pin(p),decision:'approved',reason:'Evidence changed after review'},manager.cookie,409)
 await unchanged(h,before)
 p=await cmd('learn.offer.decide',{...pin(p),decision:'declined',reason:'New completed responses need review'},manager.cookie)
 e=(await read()).value;p=await propose(e)
 await saveRule()
 before=await h.state()
 await cmd('learn.offer.decide',{...pin(p),decision:'approved',reason:'Rule revision changed'},manager.cookie,409)
 await unchanged(h,before)
 await cmd('learn.offer.decide',{...pin(p),decision:'declined',reason:'Refresh the rule revision'},manager.cookie)
 // Existing nonempty forecast, worked time and once-only payroll are protected history.
 await cmd('forecast.save',{week:'2026-10-12',site:SITE,days:[100,100,100,100,100,100,100],budgetPercent:20})
 const sheet=await cmd('time.prepare',{staffId:caller.id,start:'2026-10-05T09:00:00Z',end:'2026-10-05T11:00:00Z',breakMinutes:0,reason:'Missed clock'})
 const approved=await cmd('time.approve',pin(sheet))
 const batch=await cmd('payroll.prepare',{ids:[approved.id]})
 await cmd('payroll.export',pin(batch))
 const outstanding=await round(31,[])
 assert.deepEqual(outstanding.offers.map(o=>(Date.parse(o.opensAt)-Date.parse(o.createdAt))/60000),[0,60,120])
 e=(await read()).value;p=await propose(e)
 before=await h.state();const originalRule=before.offerrules[0]
 for(const [cookie,status] of [[caller.cookie,403],[foreign.cookie,404]]){
  assert.equal((await read(60,cookie)).status,status)
  await propose(e,cookie,status)
  for(const action of ['decide','revert'])await cmd('learn.offer.'+action,{...pin(p),decision:'approved',reason:'Outside authority'},cookie,status)
 }
 const key=await cmd('agent.create',{label:'Native comparison only',scopes:['comparison.read'],cafes:[SITE],comparisonConsent:true})
 const bearer=(path,body)=>h.send(path,body,'',{...at(NOW),authorization:`Bearer ${key.token}`})
 assert.equal((await bearer('/api/lanyard/learning/offers?site=Ocean%20Beach&percentile=60')).status,401)
 assert.equal((await bearer('/api/lanyard/agent/learning/offers?site=Ocean%20Beach&percentile=60')).status,404)
 for(const action of ['propose','decide','revert'])assert.equal((await bearer('/api/lanyard/agent/command',{name:'learn.offer.'+action,input:{...pin(p),site:SITE,digest:e.digest,percentile:60,targetReviewed:true,reason:'Agent attempt'}})).status,403)
 const context=(await bearer('/api/lanyard/agent/context')).value
 assert.deepEqual(context.learnoffers,[])
 assert.ok(context.offers.every(o=>!('offerRule' in o)&&!('roundId' in o)&&!('response' in o)&&!('site' in o)),'retained calibration facts add no agent access')
 assert.deepEqual((await h.state(caller.cookie)).learnoffers,[])
 assert.deepEqual((await h.state(foreign.cookie)).learnoffers,[])
 await h.restart()
 assert.equal((await read()).value.proposals.find(r=>r.id===p.id).digest,p.digest)
 p=await cmd('learn.offer.decide',{...pin(p),decision:'approved',reason:'Reviewed calibration improves on later rounds'},manager.cookie)
 let after=await unchanged(h,before,true)
 const {id,revision,savedBy,savedAt,minutes,...original}=originalRule,{id:nextId,revision:nextRevision,savedBy:by,savedAt:when,minutes:nextMinutes,...next}=after.offerrules[0]
 assert.deepEqual(next,original);assert.equal(nextMinutes,5);assert.equal(nextRevision,revision+1)
 await cmd('learn.offer.decide',{...pin(p),decision:'approved',reason:'Repeated approval'},manager.cookie,409)
 const issued=await round(29,[])
 assert.deepEqual(issued.offers.map(o=>(Date.parse(o.opensAt)-Date.parse(o.createdAt))/60000),[0,5,10])
 const issuedBefore=await h.state()
 await h.restart()
 p=await cmd('learn.offer.revert',{...pin(p),reason:'Restore the earlier interval'},manager.cookie)
 after=await unchanged(h,issuedBefore,true);assert.equal(after.offerrules[0].minutes,60)
 const restored=await round(30,[])
 assert.deepEqual(restored.offers.map(o=>(Date.parse(o.opensAt)-Date.parse(o.createdAt))/60000),[0,60,120])
 assert.deepEqual((await h.state()).offers.filter(o=>issued.offers.some(x=>x.id===o.id)),issuedBefore.offers.filter(o=>issued.offers.some(x=>x.id===o.id)))
 // Covered, unmaintained and access-to-hours cases acquire no timing or consent authority.
 await coverage(500)
 e=(await read()).value;let held=await propose(e)
 before=await h.state()
 await cmd('learn.offer.decide',{...pin(held),decision:'approved',reason:'Covered timing cannot be waived'},manager.cookie,409)
 await unchanged(h,before)
 await cmd('learn.offer.decide',{...pin(held),decision:'declined',reason:'Statutory prerequisites unavailable'},manager.cookie)
 await coverage(10,'custom')
 e=(await read()).value;held=await propose(e)
 await cmd('learn.offer.decide',{...pin(held),decision:'approved',reason:'Unmaintained applicability'},manager.cookie,409)
 await cmd('learn.offer.decide',{...pin(held),decision:'declined',reason:'Maintained review required'},manager.cookie)
 await coverage()
 e=(await read()).value;held=await propose(e)
 await saveRule({accessToHours:true})
 await cmd('learn.offer.decide',{...pin(held),decision:'approved',reason:'Access to hours cannot be waived'},manager.cookie,409)
 assert.equal((await read()).value.status,'insufficient')
 await cmd('learn.offer.decide',{...pin(held),decision:'declined',reason:'Keep statutory access unchanged'},manager.cookie)
 await saveRule({accessToHours:false})
 // Replaced native authority remains refused after a custom grant is revoked.
 const level=await cmd('access.level.save',{site:SITE,name:'Review withheld',permissions:[]})
 const grant=await cmd('access.grant',{site:SITE,staffId:manager.id,levelId:level.id})
 await cmd('access.revoke',pin(grant))
 assert.equal((await read()).status,403)
 await cmd('learn.offer.revert',{...pin(p),reason:'Revoked role attempt'},manager.cookie,403)
 await cmd('access.restore',{staffId:manager.id})
 await cmd('staff.save',{...pin(manager),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'staff',active:true,site:SITE})
 assert.equal((await read()).status,403)
 await cmd('learn.offer.propose',{site:SITE,percentile:60,targetReviewed:true,reason:'Demoted manager',digest:e.digest},manager.cookie,403)
 const events=(await h.state()).events,managerId=(await h.state(manager.cookie)).actor.id
 for(const action of ['propose','decide','revert'])assert.ok(events.some(x=>x.action==='learn.offer.'+action&&x.entityId===p.id&&x.actorId===managerId&&x.actorRole==='manager'),action)
 assert.equal(p.decision.revertReason,'Restore the earlier interval')
 const ownerEvidence=(await read(60,h.owner)).value
 let owned=await propose(ownerEvidence,h.owner)
 owned=await cmd('learn.offer.decide',{...pin(owned),decision:'approved',reason:'Owner reviewed future minutes'})
 owned=await cmd('learn.offer.revert',{...pin(owned),reason:'Owner restored the future interval'})
 assert.equal(owned.status,'reverted')
 const fresh=(await read(60,h.owner)).value;let changed=await propose(fresh,h.owner)
 changed=await cmd('learn.offer.decide',{...pin(changed),decision:'approved',reason:'Owner checks revert guards'})
 await coverage(500)
 before=await h.state()
 await cmd('learn.offer.revert',{...pin(changed),reason:'Covered consent and timing unavailable'},h.owner,409)
 await unchanged(h,before)
 await coverage()
 await saveRule({minutes:7})
 before=await h.state()
 await cmd('learn.offer.revert',{...pin(changed),reason:'Cannot overwrite a later manual rule'},h.owner,409)
 await unchanged(h,before)
 assert.equal((await h.state()).offerrules[0].minutes,7)
 for(const o of responders)assert.deepEqual((await h.state(o.cookie)).learnoffers,[])
 console.log('PROBE LEARN-001 native timing: 6 comparable rounds, independent 60th-percentile and later calibration, unknown and unsafe refusals, restart, audit, approval and revert passed')
}
export async function offerBrowser(width=1440) {
 const h=await harness({now:NOW}),browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  const f=await offerFixture(h)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width,height:1100},extraHTTPHeaders:at(NOW)})
  const [name,...value]=f.manager.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
  const page=await context.newPage(),errors=[];page.on('pageerror',x=>errors.push(x.message))
  await page.goto(h.origin+'/app/demand?site=Ocean%20Beach&date=2026-10-28',{waitUntil:'networkidle'})
  const card=page.locator('#offer-learning')
  assert.equal(await card.locator('[name=percentile]').inputValue(),'','no implicit response target')
  await card.locator('[name=percentile]').fill('60')
  await Promise.all([page.waitForNavigation(),card.getByRole('button',{name:'Review timing',exact:true}).click()])
  const text=await card.innerText()
  for(const expected of ['6 comparable completed rounds','4 earlier rounds (12 responses)','2 later rounds (6 responses)','60 to 5 minutes','unknown responses are excluded'])assert.ok(text.includes(expected),expected)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  const shot=async state=>{if(process.env.LEARN_OFFERS_SCREENS){await mkdir(process.env.LEARN_OFFERS_SCREENS,{recursive:true});await card.screenshot({path:join(process.env.LEARN_OFFERS_SCREENS,`${state}-${width}.png`)})}}
  await shot('review')
  const record=card.locator('form[action*="name=learn.offer.propose"]')
  await record.locator('[name=reason]').fill('Reviewed the response-percentile target')
  await record.locator('[name=targetReviewed]').check()
  await Promise.all([page.waitForNavigation(),record.getByRole('button',{name:'Record timing proposal'}).click()])
  assert.equal((await h.state()).learnoffers.length,1)
  const decision=card.locator('form[action*="name=learn.offer.decide"]');await decision.locator('[name=reason]').fill('Reviewed the later calibration')
  await Promise.all([page.waitForNavigation(),decision.getByRole('button',{name:'Decide timing'}).click()])
  assert.equal((await h.state()).offerrules[0].minutes,5)
  await card.getByText('Timing proposals and decisions',{exact:true}).click();await shot('approved')
  const revert=card.locator('form[action*="name=learn.offer.revert"]');await revert.locator('[name=reason]').fill('Restore the prior timing')
  await Promise.all([page.waitForNavigation(),revert.getByRole('button',{name:'Revert timing'}).click()])
  assert.equal((await h.state()).offerrules[0].minutes,60)
  await card.getByText('Timing proposals and decisions',{exact:true}).click()
  assert.ok((await card.innerText()).includes('reverted'));await shot('reverted')
  // The existing account icon has an immediate keyboard tooltip and a delayed hover tooltip.
  const account=page.locator('[data-tooltip="Account menu"]');await account.focus();await page.locator('#control-tooltip:not([hidden])').waitFor();assert.equal(await page.locator('#control-tooltip').innerText(),'Account menu')
  assert.deepEqual(errors,[])
  await context.close()
 }finally{await browser.close();await h.close()}
}

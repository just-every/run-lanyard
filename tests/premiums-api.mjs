import assert from 'node:assert/strict'
import {premiumFixture,pin,local} from './premiums-fixture.mjs'
export async function premiumApi(h) {
 const f=await premiumFixture(h),{alex,ben,cy,dana,manager,foreign,at,bt,ct}=f
 const report=await f.prepare(at,'reporting',{shiftId:f.shiftOf(alex).id})
 assert.ok(report.rule.sources.length>0);assert.ok(report.rule.sourceVersion);assert.deepEqual(report.facts.sources.map(x=>[x.id,x.revision]),[[at.id,at.revision]]);assert.equal(report.facts.pieces.reduce((n,p)=>n+p.minutes,0),at.minutes)
 assert.equal(report.minutes,180);assert.equal(report.costCents,6600)
 assert.deepEqual(report.allocations.map(a=>[a.area,a.minutes,a.costCents]),[['Counter',90,3000],['Kitchen',90,3600]])
 await h.cmd('payroll.prepare',{ids:[at.id]},h.owner,409)
 await h.cmd('premium.decide',{...pin(report),decision:'approve',reason:'Foreign manager'},foreign.cookie,403)
 await h.cmd('premium.decide',{...pin(report),decision:'approve',reason:'Self approval'},alex.cookie,403)
 let disputed=await h.cmd('premium.decide',{...pin(report),decision:'dispute',reason:'Verify whether employee chose to leave early'},manager.cookie)
 assert.equal(disputed.status,'disputed');assert.ok(JSON.stringify(disputed).includes('Verify whether employee chose to leave early'))
 await h.cmd('premium.decide',{...pin(report),decision:'approve',reason:'Stale review'},manager.cookie,409)
 const approved=await f.approve(disputed,manager.cookie);assert.equal(approved.status,'approved')
 const split=await f.approve(await f.prepare(bt,'split',{employerSplit:true}))
 // Six payable hours: three at $16 and three at $17. The $3 above minimum
 // offsets one $16 split premium, leaving $13, allocated once per work area.
 assert.equal(split.costCents,1300);assert.equal(split.allocations.reduce((n,a)=>n+a.costCents,0),1300)
 const spread=await f.approve(await f.prepare(ct,'spread'))
 assert.equal(spread.minutes,60);assert.equal(spread.costCents,1600)
 const arrival=await h.cmd('premium.prepare',{kind:'reporting',shiftId:f.shiftOf(dana).id,reportedAt:f.d.start,canceledAt:local('2025-11-20','09:05'),regularlyScheduled:true,reason:'Manager canceled service after employee arrival'})
 assert.equal(arrival.minutes,180);assert.equal(arrival.costCents,4800);await f.approve(arrival)
 // One arrival cannot be submitted twice under a different review id.
 await h.cmd('premium.prepare',{kind:'reporting',shiftId:f.shiftOf(dana).id,reportedAt:f.d.start,canceledAt:local('2025-11-20','09:05'),reason:'Duplicate source'},h.owner,409)
 const staff=await h.state(alex.cookie);assert.ok(staff.premiuminputs.every(r=>r.staffId===alex.id))
 const ownPage=(await h.send('/app/time?week=2025-11-17',undefined,alex.cookie)).text
 assert.match(ownPage,/\$66\.00/)
 const agent=await h.cmd('agent.create',{label:'Premium preparation restrictions'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`})
 assert.deepEqual(context.value.premiuminputs,[]);assert.deepEqual(context.value.premiumrules,[])
 const batch=await h.cmd('payroll.prepare',{}),lines=batch.lines.filter(l=>l.premiumLine)
 assert.equal(lines.reduce((n,l)=>n+l.costCents,0),14300)
 assert.equal(lines.filter(l=>l.rootId===at.rootId).reduce((n,l)=>n+l.minutes,0),180)
 assert.ok(lines.every(l=>l.ruleRevision&&l.ruleId))
 const sent=await h.cmd('payroll.export',pin(batch))
 const file=(await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text
 assert.equal(file,sent.csv);assert.ok(file.includes('CA-REPORT')&&file.includes('CA-SPLIT')&&file.includes('NY-SPREAD')&&file.includes('NY-CALL'))
 await h.cmd('payroll.export',pin(batch),h.owner,409)
 // Changing a future employer rule/rate does not rewrite retained decisions.
 await h.cmd('premiumrule.save',{site:'California',from:'2026-01-01',preset:'CA',minimumCents:1800})
 assert.deepEqual((await h.state()).premiuminputs.find(r=>r.id===approved.id).allocations,approved.allocations)
 // Correction carries the same area plan and retained rule. Re-review is mandatory.
 const corrected=await f.enter({...f.a,end:local('2025-11-17','11:00')},{corrects:at.id})
 await h.cmd('payroll.prepare',{},h.owner,409)
 const correction=await f.approve(await f.prepare(corrected,'reporting',{shiftId:f.shiftOf(alex).id}))
 assert.equal(correction.rule.id,approved.rule.id)
 assert.deepEqual(correction.allocations.map(a=>[a.area,a.minutes]),[['Counter',30],['Kitchen',90]])
 const adjustment=await h.cmd('payroll.prepare',{}),delta=adjustment.lines.filter(l=>l.premiumLine)
 assert.equal(delta.reduce((n,l)=>n+l.minutes,0),-60);assert.equal(delta.reduce((n,l)=>n+l.costCents,0),-2000)
 const applied=await h.cmd('payroll.export',pin(adjustment));await h.cmd('payroll.prepare',{},h.owner,409)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,file)
 const claims=await h.db.prepare('SELECT * FROM l_payroll_claims WHERE root_id=?').bind(at.rootId).all()
 assert.equal(claims.results.length,2);assert.equal(claims.results.reduce((n,r)=>n+r.minutes,0),120)
 assert.ok(applied.lines.some(l=>!l.payCode&&l.minutes===60))
 // A manager sees only their cafe's premium reviews.
 assert.ok((await h.state(manager.cookie)).premiuminputs.every(r=>r.site==='California'))
 // Employer-configured rules use explicit thresholds and source labels.
 const splitCorrection=await f.enter({...f.b,breakMinutes:300},{corrects:bt.id})
 await h.cmd('payroll.prepare',{},h.owner,409)
 const rechecked=await f.approve(await f.prepare(splitCorrection,'split',{employerSplit:true}))
 assert.equal(rechecked.costCents,1350);assert.equal(rechecked.facts.pieces.reduce((n,p)=>n+p.minutes,0),300)
 assert.deepEqual(rechecked.facts.pieces.map(p=>[p.area,p.rateCents,p.minutes]),[['Counter',1600,150],['Kitchen',1700,150]])
 const splitDelta=await h.cmd('payroll.prepare',{});assert.equal(splitDelta.lines.filter(l=>l.premiumLine).reduce((n,l)=>n+l.costCents,0),50);assert.equal(splitDelta.lines.filter(l=>l.premiumLine).reduce((n,l)=>n+l.minutes,0),0);await h.cmd('payroll.export',pin(splitDelta))
 // A daily premium spans separate timesheets; correcting the non-anchor source
 // exports the whole day's signed difference under that correction's one claim.
 const evan=await h.person('Evan');await h.cmd('staff.save',{...pin(evan),name:evan.name,email:evan.email,payrollId:evan.payrollId,role:'staff',active:true,site:'California',hourlyRate:'16.50'})
 const entry=async(date,start,end,corrects)=>f.enter({staffId:evan.id,start:local(date,start),end:local(date,end),breakMinutes:0},corrects?{corrects}:{})
 const morning=await entry('2025-11-21','09:00','12:00'),evening=await entry('2025-11-21','15:00','18:00')
 const daily=await f.approve(await f.prepare(morning,'split',{employerSplit:true}));assert.equal(daily.costCents,1300)
 const dailyBatch=await h.cmd('payroll.prepare',{});assert.ok(dailyBatch.lines.filter(l=>l.premiumLine).every(l=>l.timeId===morning.id));await h.cmd('payroll.export',pin(dailyBatch))
 const shorter=await entry('2025-11-21','15:00','17:00',evening.id);await f.approve(await f.prepare(shorter,'split',{employerSplit:true}));const dailyDelta=await h.cmd('payroll.prepare',{});assert.equal(dailyDelta.lines.filter(l=>l.premiumLine).reduce((n,l)=>n+l.costCents,0),50);assert.ok(dailyDelta.lines.filter(l=>l.premiumLine).every(l=>l.timeId===shorter.id));await h.cmd('payroll.export',pin(dailyDelta))
 // Moving that source to another date reverses the old day's now-absent split.
 const moved=await entry('2025-11-22','15:00','17:00',shorter.id);await h.cmd('payroll.prepare',{},h.owner,409)
 const priorDay=await f.approve(await f.prepare(moved,'split',{reviewDate:'2025-11-21',employerSplit:true}));assert.equal(priorDay.costCents,0)
 const movedDay=await f.approve(await f.prepare(moved,'split',{employerSplit:true}));assert.equal(movedDay.costCents,0)
 const reversal=await h.cmd('payroll.prepare',{});assert.equal(reversal.lines.filter(l=>l.premiumLine).reduce((n,l)=>n+l.costCents,0),-1350);await h.cmd('payroll.export',pin(reversal));await h.cmd('payroll.prepare',{},h.owner,409)
 const custom=await h.cmd('premiumrule.save',{site:'Employer cafe',from:'2025-01-01',preset:'employer',minimumCents:2000,reportingGuaranteeMinutes:120,splitMinutes:60,spreadMinutes:30,spreadThresholdMinutes:600})
 assert.equal(custom.preset,'employer')
}

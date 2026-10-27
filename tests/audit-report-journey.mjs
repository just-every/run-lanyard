import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {tipFixture} from './tipcredit-journey.mjs'
import {pin} from './workforce-journey.mjs'

export async function auditFixture(h){
 const f=await tipFixture(h,'2026-10-27')
 await h.cmd('tipcredit.save',{site:'Austin',state:'TX',minimumWage:'7.25',from:'2020-01-01',tippedJobs:[f.server.id]})
 const alex=await h.person('Alex'),foreign=await h.person('Foreign')
 await h.cmd('minor.save',{staffId:alex.id,birthDate:'2011-01-01',state:'CA',permit:'synthetic-lanyard-permit',permitThrough:'2026-12-31',calendarFrom:'2026-10-01',calendarThrough:'2026-10-31',schoolDays:['2026-10-09'],schoolStart:'08:00',schoolEnd:'15:00'})
 const manual=await h.cmd('time.prepare',{staffId:alex.id,site:'Austin',start:'2026-10-10T08:00:00Z',end:'2026-10-10T16:00:00Z',breakMinutes:30,reason:'Missed phone punch'})
 await h.cmd('time.edit',{...pin(manual),start:manual.start,end:'2026-10-10T15:30:00Z',breakMinutes:30,reason:'Checked closing record'})
 await h.cmd('time.prepare',{staffId:foreign.id,site:'Mission',start:'2026-10-10T08:00:00Z',end:'2026-10-10T16:00:00Z',breakMinutes:0,reason:'Foreign private reason'})
 await h.cmd('roundrule.save',{site:'Austin',from:'2020-01-01',method:'nearest',increment:15,apply:'capture'})
 await h.cmd('breakrule.save',{site:'Austin',mealAfterMinutes:300,mealMinutes:30,waiveUpTo:0,restEveryMinutes:240,restMinutes:10,premium:true})
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-audit-in',capturedAt:'2026-10-22T15:07:00Z'},f.riley.cookie)
 const {timesheet}=await h.cmd('clock.out',{commandId:'synthetic-lanyard-audit-out',capturedAt:'2026-10-22T23:08:00Z',breakMinutes:0},f.riley.cookie)
 const future=await h.cmd('roster.prepare',{week:'2026-11-02',shifts:[{staffId:f.riley.id,site:'Austin',job:f.server.id,start:'2026-11-02T17:00:00Z',end:'2026-11-03T01:00:00Z',breakMinutes:0}]})
 await h.cmd('availability.save',{staffId:f.riley.id,start:'2026-11-01T00:00:00Z',end:'2026-11-04T00:00:00Z'})
 await h.cmd('roster.publish',pin(future))
 await h.cmd('fairwork.save',{site:'Austin',preset:'San-Jose',industry:'all',employees:100,locations:1,localEmployees:10,subjectToBusinessTax:true,reason:'Reviewed source coverage'})
 const published=(await h.state()).shifts.find(x=>x.rosterId===future.id)
 const preview=await h.cmd('fairwork.preview',{shiftId:published.id,shiftRevision:published.revision,action:'cancel',reason:'Review closing change'})
 const policy=await h.cmd('sickpolicy.save',{site:'Austin',from:'2020-01-01',preset:'CA',code:'synthetic-lanyard-leave'})
 const use=await h.cmd('sick.request',{policyId:policy.id,start:'2026-10-25T15:00:00Z',end:'2026-10-25T16:00:00Z',minutes:60,purpose:'illness'},f.riley.cookie)
 await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-service'})
 return {...f,alex,foreign,manual,timesheet,policy,use,preview}
}
const query='site=Austin&from=2026-10-01&through=2026-12-31&jurisdiction=all'
export async function auditApi(h){
 const f=await auditFixture(h),before=await h.state()
 const read=async(q=query,cookie=h.owner,status=200)=>{const r=await h.send('/api/lanyard/audit?'+q,undefined,cookie);assert.equal(r.status,status,r.text);return r.value}
 const r=await read(),by=category=>r.rows.filter(x=>x.category===category)
 assert.equal(r.sourceVersion,before.version)
 assert.deepEqual(by('schedule').map(x=>x.sourceId).sort(),before.shifts.filter(x=>x.site==='Austin'&&x.status==='published').map(x=>x.id).sort())
 assert.deepEqual(by('breaks').map(x=>x.sourceId).sort(),[...f.approved.map(x=>x.id),f.manual.id,f.timesheet.id].sort())
 assert.deepEqual(by('rounding').map(x=>[x.sourceId,x.sourceRevision,x.facts.capturedMinutes,x.facts.minutes,x.facts.netMinutes]),[[f.timesheet.id,f.timesheet.revision,481,495,14]])
 assert.deepEqual(by('breaks').find(x=>x.sourceId===f.timesheet.id).facts.premiums,[{code:'meal premium',minutes:60},{code:'rest premium',minutes:60}])
 assert.deepEqual(by('breaks').find(x=>x.sourceId===f.manual.id).facts.restEvidence,'unknown')
 assert.deepEqual(by('punch-edit').map(x=>[x.sourceId,x.sourceRevision,x.facts.reason,x.facts.captured.minutes,x.facts.minutes]),[[f.manual.id,2,'Checked closing record',450,420]])
 assert.deepEqual(by('tip-credit').map(x=>[x.date,x.facts.tippedMinutes,x.facts.requiredCents,x.facts.cashWageCents,x.facts.tipsCents,x.facts.makeUpCents]),[[f.first,960,11600,3408,2000,6192],[f.second,900,10875,3195,11000,0]])
 assert.deepEqual(by('tip-credit').flatMap(x=>x.facts.sources).map(x=>[x.id,x.revision]).sort(),f.approved.map(x=>[x.id,x.revision]).sort())
 for(const c of r.coverage){assert.equal(c.count,by(c.category).length);assert.equal(c.status,'partial');assert.ok(c.limitation.length)}
 assert.deepEqual(by('minor-exception').map(x=>[x.sourceId,x.sourceRevision,x.jurisdiction]),[[f.manual.id,2,'CA']]);assert.ok(by('minor-exception')[0].facts.exceptions.length>0);assert.deepEqual(by('policy-preview').map(x=>[x.sourceId,x.sourceRevision,x.jurisdiction,x.facts.status,x.facts.reason]),[[f.preview.id,1,'CA','review-only','Review closing change']])
 assert.deepEqual(by('sick-leave').map(x=>[x.sourceId,x.sourceRevision,x.facts.kind,x.facts.creditedMinutes,x.facts.minutes]).sort(),[...f.approved.filter((t,i)=>i!==2).map(t=>[t.id,t.revision,'work',16,480]),[f.approved[2].id,2,'work',14,420],[f.approved[2].id,2,'work',2,60],[f.use.id,2,'use',null,60]].sort())
 assert.ok(!JSON.stringify(r.rows).includes('illness'))
 assert.match(r.retention,/not enforced/)
 for(const privateValue of [f.foreign.id,...before.staff.map(p=>p.email),'Foreign private reason','hourlyRate','payrollId','birthDate','synthetic-lanyard-permit','Cash tips received'])assert.ok(!JSON.stringify(r.rows).includes(privateValue),privateValue)
 const narrow=await read('site=Austin&from=2026-10-22&through=2026-10-22&jurisdiction=CA')
 assert.deepEqual(narrow.rows.map(x=>x.sourceId),[f.timesheet.id,f.timesheet.id]);assert.equal(narrow.rows.filter(x=>x.category==='tip-credit').length,0)
 const empty=await read('site=Austin&from=2025-01-01&through=2025-03-31&jurisdiction=all');assert.deepEqual(empty.rows,[]);assert.equal(empty.coverage.length,8)
 await read(query,f.riley.cookie,403);await read(query,f.taylor.cookie,404)
 const manager=await read(query,f.morgan.cookie);assert.ok(manager.rows.length);assert.ok(manager.rows.every(x=>x.sourceId!==f.manual.id));assert.deepEqual(manager.rows.filter(x=>['sick-leave','policy-preview'].includes(x.category)),[])
 await read('site=Austin&from=2026-02-30&through=2026-03-01',h.owner,400)
 await read('site=Austin&from=2024-01-01&through=2026-03-01',h.owner,400)
 const file=await h.send('/api/lanyard/audit.csv?'+query,undefined,h.owner);assert.equal(file.status,200);assert.match(file.headers.get('content-disposition'),/lanyard-audit.csv/)
 assert.equal(file.text.split('\r\n').filter(x=>x.startsWith('"source"')).length,r.rows.length)
 assert.equal(file.text.split('\r\n').filter(x=>x.startsWith('"coverage"')).length,8)
 assert.ok(file.text.includes('Checked closing record')&&file.text.includes(f.timesheet.id)&&file.text.includes('6192'))
 assert.ok(!file.text.includes('Foreign private reason')&&!file.text.includes(f.foreign.id))
 assert.equal((await h.send('/api/lanyard/audit.csv?'+query,undefined,f.taylor.cookie)).status,404)
 const after=await h.state();assert.equal(after.version,before.version)
 for(const k of ['timesheets','shifts','rosters','clocks','sickuses','sickpolicies','tipcredits','roundrules','breakrules'])assert.deepEqual(after[k],before[k],k+' unchanged')
 assert.equal(after.events.filter(e=>e.action==='audit.download').length,1)
 const retained=await retainAuditProof(h,f,r)
 const updated=await h.cmd('time.edit',{id:f.manual.id,revision:2,start:f.manual.start,end:'2026-10-10T15:00:00Z',breakMinutes:30,reason:'Second reviewed correction'})
 const latest=(await read()).rows.find(x=>x.category==='punch-edit');assert.equal(latest.sourceRevision,updated.revision);assert.equal(latest.facts.reason,'Second reviewed correction');assert.equal(latest.facts.minutes,390)
 assert.equal(latest.facts.editHistoryComplete,true)
 assert.deepEqual(latest.facts.editHistory.map(e=>[e.priorRevision,e.revision,e.before.minutes,e.after.minutes,e.reason]),[[1,2,450,420,'Checked closing record'],[2,3,420,390,'Second reviewed correction']])
 assert.ok(latest.facts.editHistory.every(e=>e.by===updated.edited.by&&e.at==='2026-10-27T12:00:00.000Z'))
 const key=await h.cmd('agent.create',{label:'Synthetic audit boundary'})
 const context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})
 assert.equal(context.status,200)
 assert.equal(Object.hasOwn(context.value.timesheets.find(t=>t.id===f.manual.id),'editHistory'),false)
 assert.equal((await h.send('/api/lanyard/audit?'+query,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
 await h.cmd('time.edit',{id:f.manual.id,revision:2,start:f.manual.start,end:f.manual.end,breakMinutes:30,reason:'Stale history overwrite'},h.owner,409)
 await h.cmd('time.edit',{...pin(updated),start:updated.start,end:updated.end,breakMinutes:30,reason:'Unauthorized overwrite'},f.riley.cookie,403)
 const approvedEdit=await h.cmd('time.approve',pin(updated))
 await h.cmd('time.edit',{...pin(approvedEdit),start:updated.start,end:updated.end,breakMinutes:30,reason:'Wrong state overwrite'},h.owner,409)
 await h.restart()
 const retainedEdit=(await read()).rows.find(x=>x.category==='punch-edit');assert.deepEqual(retainedEdit.facts.editHistory,latest.facts.editHistory)
 const oldPacket=await h.send('/api/lanyard/audit-packets/'+retained.id,undefined,h.owner)
 assert.equal(oldPacket.status,200,oldPacket.text);assert.deepEqual(oldPacket.value,retained)
 assert.equal(oldPacket.value.report.rows.find(x=>x.category==='punch-edit').facts.minutes,420)
 const retainedFile=await h.send('/api/lanyard/audit-packets/'+retained.id+'.csv',undefined,h.owner)
 assert.equal(retainedFile.status,200);assert.equal(retainedFile.text,retained.csv)
 assert.ok(!retainedFile.text.includes('Second reviewed correction'))
 assert.equal((await h.state()).events.filter(e=>e.action==='audit.retained.download'&&e.entityId===retained.id).length,1)
 const historyCsv=await h.send('/api/lanyard/audit.csv?'+query,undefined,h.owner);assert.ok(historyCsv.text.includes('Checked closing record')&&historyCsv.text.includes('Second reviewed correction'))
 await auditBoundary(h,f)
 await auditQuarter(h)
 const level=await h.cmd('access.level.save',{name:'Synthetic report reader',site:'Austin',permissions:['reports.view']})
 await h.cmd('access.grant',{staffId:f.morgan.id,levelId:level.id,site:'Austin'})
 await read(query,f.morgan.cookie,403)
 // Revoking the native manager is immediate too.
 await h.cmd('staff.save',{id:f.morgan.id,revision:before.staff.find(p=>p.id===f.morgan.id).revision,name:f.morgan.name,email:f.morgan.email,payrollId:f.morgan.payrollId,role:'manager',active:false,site:'Austin'})
 await read(query,f.morgan.cookie,403)
 return r
}
async function retainAuditProof(h,f,report){
 const input={site:'Austin',from:'2026-10-01',through:'2026-12-31',jurisdiction:'all',sourceVersion:report.sourceVersion,reason:'Quarter evidence preservation',consent:true}
 const before=await h.state()
 for(const cookie of [f.riley.cookie,f.morgan.cookie,f.taylor.cookie])await h.cmd('audit.retain',input,cookie,403)
 await h.cmd('audit.retain',{...input,consent:false},h.owner,403)
 await h.cmd('audit.retain',{...input,reason:''},h.owner,400)
 await h.cmd('audit.retain',{...input,sourceVersion:report.sourceVersion-1},h.owner,409)
 await h.cmd('audit.retain',{...input,id:'synthetic-lanyard-overwrite'},h.owner,400)
 assert.deepEqual(await h.state(),before,'refused retention never changes sources or audit')
 const packet=await h.cmd('audit.retain',input)
 assert.deepEqual(packet.report,report)
 assert.equal(packet.sourceVersion,report.sourceVersion)
 assert.deepEqual([packet.createdAt,packet.createdBy,packet.reason,packet.revision],['2026-10-27T12:00:00.000Z',before.actor.id,'Quarter evidence preservation',1])
 assert.deepEqual([packet.retention.mode,packet.retention.expiresAt],['indefinite',null])
 assert.equal(packet.csvSha256,createHash('sha256').update(packet.csv).digest('hex'))
 const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v)
 assert.equal(packet.reportSha256,createHash('sha256').update(canonical(report)).digest('hex'))
 const after=await h.state()
 for(const k of ['timesheets','shifts','rosters','clocks','sickuses','sickpolicies','tipcredits','roundrules','breakrules'])assert.deepEqual(after[k],before[k],k+' unchanged by retention')
 assert.deepEqual(after.auditpackets,[packet]);assert.equal(after.version,before.version+1)
 assert.equal(after.events.filter(e=>e.action==='audit.retain'&&e.entityId===packet.id&&e.actorId===before.actor.id).length,1)
 for(const cookie of [f.riley.cookie,f.morgan.cookie,f.taylor.cookie]){
  for(const suffix of ['', '.csv'])assert.equal((await h.send('/api/lanyard/audit-packets/'+packet.id+suffix,undefined,cookie)).status,403)
  assert.deepEqual((await h.state(cookie)).auditpackets,[])
 }
 const key=await h.cmd('agent.create',{label:'Retained audit boundary'})
 for(const path of ['/api/lanyard/audit-packets/'+packet.id,'/api/lanyard/audit-packets/'+packet.id+'.csv']){
  assert.equal((await h.send(path,undefined,'')).status,401)
  assert.equal((await h.send(path,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
 }
 assert.deepEqual((await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})).value.auditpackets,[])
 assert.equal((await h.send('/api/lanyard/audit-packets/synthetic-lanyard-missing',undefined,h.owner)).status,404)
 await h.cmd('audit.retain',input,h.owner,409)
 const headers={'x-test-now':String(Date.parse('2026-10-28T12:00:00Z'))}
 assert.deepEqual((await h.send('/api/lanyard/audit-packets/'+packet.id,undefined,h.owner,headers)).value,packet,'retained copies never expire automatically')
 return packet
}
async function auditBoundary(h,f){
 const person=await h.person('Boundary')
 await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:'staff',active:true,site:'Austin',hourlyRate:'2.13'})
 await h.cmd('workforce.save',{staffId:person.id,jobs:[f.server.id],skills:[],certifications:[],sites:['Austin','Mission'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[{job:'',from:'2020-01-01',cents:213}]})
 await h.cmd('tipcredit.save',{site:'Mission',state:'IL',minimumWage:'8.00',from:'2020-01-01',tippedJobs:[f.server.id]})
 const sources=[]
 for(const [site,on,hours] of [['Austin','2026-09-30',2],['Mission','2026-10-01',3]]){
  const t=await h.cmd('time.prepare',{staffId:person.id,site,job:f.server.id,start:on+'T08:00:00Z',end:on+`T${8+hours}:00:00Z`,breakMinutes:0,reason:'Reviewed boundary work'})
  sources.push(await h.cmd('time.approve',pin(t)))
 }
 const before=await h.state(),q='from=2026-10-01&through=2026-10-01&jurisdiction=all'
 const read=async(site,cookie=h.owner)=>(await h.send('/api/lanyard/audit?site='+site+'&'+q,undefined,cookie)).value
 const report=await read('Austin'),row=report.rows.find(x=>x.category==='tip-credit'&&x.staffId===person.id)
 assert.ok(row,'boundary workweek is retained even when this cafe worked before the filter')
 assert.equal(row.jurisdiction,'IL and TX')
 assert.deepEqual((await h.send('/api/lanyard/audit?site=Austin&from=2026-10-01&through=2026-10-01&jurisdiction=CA',undefined,h.owner)).value.rows.filter(x=>x.category==='tip-credit'&&x.staffId===person.id),[])
 assert.deepEqual([row.date,row.facts.week,row.facts.weekThrough,row.facts.boundaryWeek,row.facts.tippedMinutes,row.facts.requiredCents,row.facts.cashWageCents,row.facts.tipsCents,row.facts.makeUpCents],['2026-10-01','2026-09-28','2026-10-04',true,300,3850,1065,0,2785])
 assert.deepEqual(row.facts.sources.map(x=>[x.id,x.revision]).sort(),sources.map(x=>[x.id,x.revision]).sort())
 assert.deepEqual(row.facts.sites.map(x=>[x.site,x.state,x.minimumWageCents]).sort(),[['Austin','TX',725],['Mission','IL',800]])
 assert.deepEqual((await read('Mission')).rows.find(x=>x.category==='tip-credit'&&x.staffId===person.id).facts,row.facts)
 assert.deepEqual((await read('Austin',f.morgan.cookie)).rows.filter(x=>x.category==='tip-credit'&&x.staffId===person.id),[])
 assert.ok(!JSON.stringify(await read('Austin',f.morgan.cookie)).includes(sources[1].id))
 assert.deepEqual((await h.state()).timesheets,before.timesheets)
 const file=await h.send('/api/lanyard/audit.csv?site=Austin&'+q,undefined,h.owner)
 assert.equal(file.status,200);assert.ok(file.text.includes('2785')&&file.text.includes('2026-09-28')&&file.text.includes(sources[1].id))
 const draft=await h.cmd('time.prepare',{staffId:person.id,site:'Mission',job:f.server.id,start:'2026-10-01T08:00:00Z',end:'2026-10-01T12:00:00Z',breakMinutes:0,reason:'Corrected boundary closing record',corrects:sources[1].id})
 const correction=await h.cmd('time.approve',pin(draft))
 const updated=(await read('Austin')).rows.find(x=>x.category==='tip-credit'&&x.staffId===person.id)
 assert.deepEqual([updated.facts.tippedMinutes,updated.facts.requiredCents,updated.facts.cashWageCents,updated.facts.makeUpCents],[360,4650,1278,3372])
 assert.deepEqual(updated.facts.sources.map(x=>[x.id,x.revision]).sort(),[sources[0],correction].map(x=>[x.id,x.revision]).sort())
 assert.equal((await h.state()).timesheets.find(x=>x.id===sources[1].id).status,'superseded')
 const transfer=await h.person('Transfer')
 await h.cmd('staff.save',{...pin(transfer),name:transfer.name,email:transfer.email,payrollId:transfer.payrollId,role:'staff',active:true,site:'Austin',hourlyRate:'2.13'})
 await h.cmd('workforce.save',{staffId:transfer.id,jobs:[f.server.id],skills:[],certifications:[],sites:['Austin','Boulder'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[{job:'',from:'2020-01-01',cents:213}]})
 await h.cmd('tipcredit.save',{site:'Boulder',state:'CO',minimumWage:'9.00',from:'2020-01-01',tippedJobs:[f.server.id]})
 await h.cmd('availability.save',{staffId:transfer.id,start:'2026-10-03T07:00:00Z',end:'2026-10-03T13:00:00Z'})
 const roster=await h.cmd('roster.prepare',{week:'2026-09-28',shifts:[{staffId:transfer.id,job:f.server.id,site:'Austin',start:'2026-10-03T08:00:00Z',end:'2026-10-03T12:00:00Z',breakMinutes:0}]})
 await h.cmd('roster.publish',pin(roster))
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-transfer-in',capturedAt:'2026-10-03T08:00:00Z'},transfer.cookie)
 await h.cmd('clock.transfer',{commandId:'synthetic-lanyard-transfer-change',capturedAt:'2026-10-03T10:00:00Z',job:f.server.id,site:'Boulder'},transfer.cookie)
 const {timesheet}=await h.cmd('clock.out',{commandId:'synthetic-lanyard-transfer-out',capturedAt:'2026-10-03T12:00:00Z',breakMinutes:0},transfer.cookie)
 const approved=await h.cmd('time.approve',pin(timesheet))
 const transferred=(await read('Boulder')).rows.find(x=>x.category==='tip-credit'&&x.staffId===transfer.id)
 assert.ok(transferred,'a cafe reached only by a job transfer retains its workweek')
 assert.deepEqual([transferred.facts.tippedMinutes,transferred.facts.requiredCents,transferred.facts.cashWageCents,transferred.facts.makeUpCents],[240,3250,852,2398])
 assert.deepEqual(transferred.facts.sources,[{id:approved.id,revision:approved.revision}])
 assert.deepEqual(transferred.facts.sites.map(x=>x.site).sort(),['Austin','Boulder'])
 assert.deepEqual((await read('Austin',f.morgan.cookie)).rows.filter(x=>x.category==='tip-credit'&&x.staffId===transfer.id),[])
}
async function auditQuarter(h){
 const people=[],records=new Map(),postings=new Map()
 for(const [name,site,state] of [['Chicago','Chicago','IL'],['California','California','CA']]){
  const p=await h.person(name)
  await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:'staff',active:true,site,hourlyRate:'20.00'})
  await h.cmd('workforce.save',{staffId:p.id,jobs:[],skills:[],certifications:[],sites:[site],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[{job:'',from:'2020-01-01',cents:2000}]})
  await h.cmd('availability.save',{staffId:p.id,start:'2026-07-01T00:00:00Z',end:'2026-10-01T00:00:00Z'})
  await h.cmd('roundrule.save',{site,from:'2026-07-01',method:'nearest',increment:15,apply:'capture'})
  await h.cmd('breakrule.save',{site,mealAfterMinutes:300,mealMinutes:30,waiveUpTo:0,restEveryMinutes:240,restMinutes:10,premium:true})
  people.push({...p,site,state});records.set(site,[]);postings.set(site,[])
 }
 for(const [week,on] of [['2026-07-13','2026-07-15'],['2026-08-10','2026-08-12'],['2026-09-14','2026-09-16']]){
  const draft=await h.cmd('roster.prepare',{week,shifts:people.map(p=>({staffId:p.id,site:p.site,start:on+'T08:00:00Z',end:on+'T16:00:00Z',breakMinutes:0}))})
  await h.cmd('roster.publish',pin(draft))
  for(const p of people)postings.get(p.site).push(await h.cmd('schedule.post',{week,site:p.site}))
  if(week==='2026-07-13'){
   const source=(await h.state()).shifts.find(x=>x.rosterId===draft.id&&x.site==='Chicago')
   await h.cmd('shift.change',{...pin(source),start:source.start,end:on+'T15:00:00Z',reason:'Quarter coverage adjustment'},h.owner,200,{'x-test-now':String(Date.parse('2026-07-14T12:00:00Z'))})
  }
 }
 for(const p of people){
  await h.cmd('minor.save',{staffId:p.id,birthDate:'2011-01-01',state:p.state,permit:'synthetic-lanyard-quarter',permitThrough:'2026-12-31',calendarFrom:'2026-07-01',calendarThrough:'2026-10-01',schoolDays:[],schoolStart:'08:00',schoolEnd:'15:00'})
  for(const on of ['2026-07-15','2026-07-16','2026-08-12','2026-08-13','2026-09-16']){
   // Record worked facts through the manager door: minor violations are retained for review.
   let t=await h.cmd('time.prepare',{staffId:p.id,site:p.site,start:on+'T08:00:00Z',end:on+'T16:00:00Z',breakMinutes:0,reason:'Quarter closing record'})
   if(on==='2026-09-16')t=await h.cmd('time.edit',{...pin(t),start:t.start,end:on+'T15:00:00Z',breakMinutes:0,reason:'Quarter register correction'})
   records.get(p.site).push(await h.cmd('time.approve',pin(t)))
  }
  const policy=await h.cmd('sickpolicy.save',{site:p.site,from:'2026-07-01',preset:p.state==='IL'?'CHICAGO':'CA',code:'synthetic-lanyard-quarter'})
  const use=await h.cmd('sick.request',{policyId:policy.id,start:'2026-09-20T08:00:00Z',end:'2026-09-20T09:00:00Z',minutes:60,purpose:'illness'},p.cookie)
  p.use=await h.cmd('sick.decide',{...pin(use),decision:'approved',reference:'synthetic-lanyard-quarter-'+p.state})
 }
 const before=await h.state()
 for(const p of people){
  const q=new URLSearchParams({site:p.site,from:'2026-07-01',through:'2026-09-30',jurisdiction:'all'})
  const response=await h.send('/api/lanyard/audit?'+q,undefined,h.owner);assert.equal(response.status,200,response.text)
  const r=response.value,kind=k=>r.rows.filter(x=>x.category===k),expected=records.get(p.site)
  assert.deepEqual(kind('breaks').map(x=>[x.sourceId,x.sourceRevision]).sort(),expected.map(x=>[x.id,x.revision]).sort())
  assert.deepEqual(kind('breaks').map(x=>x.facts.premiums),Array.from({length:5},()=>[{code:'meal premium',minutes:60}]))
  assert.deepEqual(kind('minor-exception').map(x=>[x.sourceId,x.jurisdiction]).sort(),expected.map(x=>[x.id,p.state]).sort())
  assert.equal(kind('schedule').length,4)
  assert.equal(kind('schedule').filter(x=>x.facts.reason==='Quarter coverage adjustment').length,1)
  assert.deepEqual(kind('schedule').map(x=>x.facts.postings.map(y=>y.id)).flat().sort(),postings.get(p.site).map(x=>x.id).sort())
  const leave=kind('sick-leave'),work=leave.filter(x=>x.facts.kind==='work')
  assert.deepEqual(work.map(x=>[x.sourceId,x.sourceRevision]).sort(),expected.map(x=>[x.id,x.revision]).sort())
  assert.deepEqual(work.map(x=>x.facts.creditedMinutes),p.state==='CA'?[16,16,16,16,14]:[13,14,14,13,12])
  assert.deepEqual(leave.filter(x=>x.facts.kind==='use').map(x=>[x.sourceId,x.sourceRevision,x.facts.minutes,x.facts.status]),[[p.use.id,2,60,'approved']])
  assert.ok(!JSON.stringify(leave).includes('illness'))
  assert.deepEqual(kind('punch-edit').map(x=>[x.facts.reason,x.facts.editHistory[0].before.minutes,x.facts.editHistory[0].after.minutes]),[['Quarter register correction',480,420]])
  const other=people.find(x=>x.id!==p.id)
  for(const privateValue of [other.id,other.email,'synthetic-lanyard-quarter','birthDate','hourlyRate','payrollId'])assert.ok(!JSON.stringify(r.rows).includes(privateValue),privateValue)
  const csv=await h.send('/api/lanyard/audit.csv?'+q,undefined,h.owner);assert.equal(csv.status,200);assert.equal(csv.text.split('\r\n').filter(x=>x.startsWith('"source"')).length,r.rows.length)
  assert.match(r.retention,/not enforced/);assert.match(r.auditorAccess,/No auditor grant/)
 }
 for(const key of ['timesheets','shifts','rosters','postings','minors','sickuses','sickpolicies'])assert.deepEqual((await h.state())[key],before[key])
}
export async function auditBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.CLOUD_CHROMIUM?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{} )})
 const h=await harness({now:'2026-10-27T12:00:00Z'})
 try{
  const fixture=await auditFixture(h)
  await auditBoundary(h,fixture)
  await h.cmd('time.edit',{id:fixture.manual.id,revision:2,start:fixture.manual.start,end:'2026-10-10T15:00:00Z',breakMinutes:30,reason:'Second reviewed correction'})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  try{
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.goto(h.origin+'/app/audit?'+query,{waitUntil:'networkidle'})
   assert.equal(await page.getByRole('heading',{name:'Audit records',exact:true}).count(),1)
   assert.ok((await page.locator('main').innerText()).includes('Checked closing record'))
   assert.ok((await page.locator('main').innerText()).includes('Preset-required retention is not enforced'))
   await page.getByLabel('From',{exact:true}).fill('2026-10-22');await page.getByLabel('Through',{exact:true}).fill('2026-10-22')
   await page.getByRole('button',{name:'Show report'}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('table tbody tr').count(),3)
   const account=page.locator('[data-tooltip="Account menu"]');assert.equal(await account.count(),1);await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();await account.blur()
   await page.goto(h.origin+'/app/audit?'+query,{waitUntil:'networkidle'})
   assert.ok((await page.locator('table').innerText()).includes('Review closing change'))
   assert.ok((await page.locator('table').innerText()).includes('sick-leave'))
   assert.ok((await page.locator('table').innerText()).includes('Whole workweek across cafes'))
   assert.ok((await page.locator('table').innerText()).includes('Second reviewed correction'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(process.env.AUDIT_SCREENS){await mkdir(process.env.AUDIT_SCREENS,{recursive:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(process.env.AUDIT_SCREENS,`audit-${width}.png`)})
     await page.locator('tbody tr').filter({hasText:'Second reviewed correction'}).first().scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.AUDIT_SCREENS,`audit-edits-${width}.png`)})
     await page.locator('tbody tr').filter({hasText:'Whole workweek across cafes'}).first().scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.AUDIT_SCREENS,`audit-workweek-${width}.png`)})}}
   assert.deepEqual(errors,[])
  }finally{await context.close()}
 }finally{await h.close();await browser.close()}
}

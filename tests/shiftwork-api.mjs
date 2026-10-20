import assert from 'node:assert/strict'
import {days,local} from './workforce-journey.mjs'
import {handoverFixture,captureWork,pin} from './shiftwork-fixture.mjs'
export async function handoverApi(h) {
 const f=await handoverFixture(h),{work,input,shift,alex,ben,manager,foreign}=f
 const planned=(await h.state()).shifts.find(x=>x.id===shift.id);assert.equal(planned.rateBasis.costCents,16500,'planned labor uses both job rates without adding the enclosing shift')
 const scheduled=await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${f.week}&size=60`,undefined,manager.cookie);assert.equal(scheduled.value.intervals.reduce((n,p)=>n+p.scheduled.cents,0),16500)
 const notes=await h.state(alex.cookie);assert.deepEqual(notes.shiftwork[0].segments.map(p=>p.until),[240,480])
 for(const segments of [[{until:479,job:f.counter.id,area:'Short'}],[{until:240,job:f.counter.id,area:'Counter'},{until:240,job:f.kitchen.id,area:'Duplicate'}],[{until:480,job:'unknown',area:'Unknown'}]])await h.cmd('shiftwork.save',{...input,shiftRevision:shift.revision,revision:work.revision,segments},manager.cookie,segments[0].job==='unknown'?409:400)
 const answer=await h.cmd('shiftwork.respond',{shiftId:shift.id,shiftRevision:shift.revision,revision:work.revision,completed:work.tasks.map(t=>t.id),blocker:'Kitchen lock is jammed',attachment:{name:'lock.txt',type:'text/plain',data:Buffer.from('Maintenance inspected the lock').toString('base64')}},alex.cookie)
 const file=`/api/lanyard/handover/${answer.id}/files/${answer.attachment.id}`
 for(const reader of [alex.cookie,manager.cookie,h.owner]){const r=await h.send(file,undefined,reader);assert.equal(r.status,200);assert.equal(r.text,'Maintenance inspected the lock');assert.match(r.headers.get('content-disposition'),/attachment/)}
 for(const reader of [ben.cookie,foreign.cookie])assert.equal((await h.send(file,undefined,reader)).status,404)
 assert.equal((await h.send(file,undefined,'')).status,401)
 const captured=await captureWork(h,f)
 // Editing instructions after capture cannot replace the plan retained with the time.
 const changed=await h.cmd('shiftwork.save',{...input,shiftRevision:shift.revision,revision:work.revision,notes:'A new handover',segments:[{until:480,job:f.counter.id,area:'All counter'}]},manager.cookie)
 let approved=await h.cmd('time.approve',pin(captured.time),manager.cookie)
 assert.equal(approved.segmentPlan.workRevision,work.revision)
 assert.deepEqual(approved.workSegments.map(p=>[p.job,p.area,p.minutes,p.rateBasis.costCents]),[[f.counter.id,'Front counter',240,8000],[f.kitchen.id,'Kitchen close',240,9600]])
 assert.equal(approved.workSegments.reduce((n,p)=>n+p.minutes,0),approved.minutes);assert.equal(approved.minutes,480);assert.equal(approved.rateBasis.costCents,17600)
 const privateState=await h.state(ben.cookie);assert.deepEqual(privateState.taskanswers,[]);assert.deepEqual(privateState.shiftwork,[])
 const mine=(await h.state(alex.cookie)).timesheets[0];assert.ok(mine.workSegments.every(p=>!p.rateBasis),'employee mutation/state responses never disclose protected rate snapshots')
 const report=await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${f.week}&size=60`,undefined,manager.cookie)
 assert.equal(report.status,200);assert.equal(report.value.intervals.reduce((n,p)=>n+p.actual.cents,0),17600,'labor counts each actual job segment, not the enclosing time again')
 const batch=await h.cmd('payroll.prepare',{ids:[approved.id]}),competing=await h.cmd('payroll.prepare',{ids:[approved.id]})
 assert.deepEqual(batch.lines.map(l=>[l.job,l.area,l.minutes]),[[f.counter.id,'Front counter',240],[f.kitchen.id,'Kitchen close',240]])
 const exported=await h.cmd('payroll.export',pin(batch),manager.cookie)
 await h.cmd('payroll.export',pin(competing),manager.cookie,409)
 const first=await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,manager.cookie),second=await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,manager.cookie)
 assert.equal(first.text,second.text);assert.ok(first.text.includes(f.counter.id)&&first.text.includes(f.kitchen.id));assert.ok(first.text.includes('Front counter')&&first.text.includes('Kitchen close'))
 const correction=await h.cmd('time.prepare',{staffId:alex.id,start:captured.start,end:captured.end,breakMinutes:59,reason:'Agreed meal correction',corrects:approved.id})
 approved=await h.cmd('time.approve',pin(correction),manager.cookie)
 assert.deepEqual(approved.workSegments.map(p=>p.minutes),[226,225],'one remaining payable minute goes to the earlier area on a tied remainder');assert.equal(approved.minutes,451)
 const delta=await h.cmd('payroll.prepare',{ids:[approved.id]});assert.deepEqual(delta.lines.map(l=>l.minutes),[-14,-15]);assert.equal(delta.lines.reduce((n,l)=>n+l.minutes,0),approved.exportMinutes)
 await h.cmd('payroll.export',pin(delta),manager.cookie)
 assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,manager.cookie)).text,first.text)
 const posted=await h.cmd('schedule.post',{week:f.week,site:'Ocean Beach'}),pdf=await h.send(`/api/lanyard/postings/${posted.id}.pdf`,undefined,manager.cookie),wall=await h.send(`/app/wall?week=${f.week}&site=Ocean%20Beach`,undefined,manager.cookie)
 for(const out of [pdf.text,wall.text,JSON.stringify(posted)])for(const secret of [input.notes,changed.notes,answer.blocker,answer.attachment.name,...work.tasks.map(t=>t.text)])assert.ok(!out.includes(secret))
 // A new assignee must qualify for every inherited area, not merely the enclosing job.
 const future=days(f.week,21),start=local(future,'09:00'),end=local(future,'17:00')
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:local(future,'00:00'),end:local(days(future,1),'00:00')})
 await h.cmd('workforce.save',{staffId:ben.id,jobs:[f.counter.id],skills:[],certifications:[],sites:['Ocean Beach'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[]})
 const futureDraft=await h.cmd('roster.prepare',{week:future,shifts:[{staffId:alex.id,job:f.counter.id,site:'Ocean Beach',start,end,breakMinutes:30,label:'Service'}]});await h.cmd('roster.publish',pin(futureDraft))
 let futureShift=(await h.state()).shifts.find(x=>x.rosterId===futureDraft.id)
 await h.cmd('shiftwork.save',{...input,shiftId:futureShift.id,shiftRevision:futureShift.revision})
 futureShift=(await h.state()).shifts.find(x=>x.id===futureShift.id)
 await h.cmd('shift.change',{...pin(futureShift),staffId:ben.id,reason:'Cover both areas'},manager.cookie,409)
 assert.equal((await h.state()).shifts.find(x=>x.id===futureShift.id).staffId,alex.id)
 // Transfer revokes instruction access immediately; historical answers/files stay with their author.
 await h.cmd('staff.save',{...pin((await h.state()).staff.find(p=>p.id===manager.id)),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'manager',active:true,site:'Mission',position:'Service'})
 assert.equal((await h.send(file,undefined,manager.cookie)).status,404)
 assert.equal((await h.send(file,undefined,alex.cookie)).status,200)
 await h.cmd('staff.save',{...pin((await h.state()).staff.find(p=>p.id===alex.id)),name:alex.name,email:alex.email,payrollId:alex.payrollId,role:'staff',active:false,site:'Ocean Beach',position:'Service'})
 assert.equal((await h.send(file,undefined,alex.cookie)).status,403)
}

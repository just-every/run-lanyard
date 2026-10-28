import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {fixture} from './cost-journey.mjs'
import {pin} from './workforce-journey.mjs'

export async function reportsDeliveryApi(){
 let outcome=202
 const h=await harness({now:'2026-10-26T12:00:00Z',auth:{MAIL_PROVIDER:'sendgrid'},sendgridOutbound:()=>new Response(null,{status:outcome,headers:{'x-message-id':'synthetic-lanyard-2'}})})
 try{
  const f=await fixture(h),{manager,foreign,alex,week}=f
  const at='2026-10-26T12:00:00.000Z',input={label:'Weekly approved work',recipient:manager.id,site:'East',kind:'worked',job:'',person:'',periodDays:14,cadenceDays:7,nextDue:at,consent:true}
  const tick=async when=>{const result=await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(when),cron:'*/15 * * * *'});assert.equal(result.outcome,'ok')}
  const sources=async()=>JSON.stringify((await h.db.prepare("SELECT kind,id,revision,data FROM l_records WHERE kind NOT IN ('reportschedules','reportdeliveries') ORDER BY kind,id").all()).results)
  await h.cmd('report.schedule.save',input,manager.cookie,403)
  await h.cmd('report.schedule.save',input,alex.cookie,403)
  await h.cmd('report.schedule.save',{...input,consent:false},h.owner,403)
  await h.cmd('report.schedule.save',{...input,recipient:foreign.id},h.owner,403)
  await h.cmd('report.schedule.save',{...input,kind:'PTO'},h.owner,403)
  await h.cmd('report.schedule.save',{...input,kind:'payroll'},h.owner,403)
  const agent=await h.cmd('agent.create',{label:'Preparation cannot schedule reports'})
  const refused=await h.send('/api/lanyard/agent/command',{name:'report.schedule.save',input},'',{authorization:'Bearer '+agent.token});assert.equal(refused.status,403)
  const schedule=await h.cmd('report.schedule.save',input)
  await h.cmd('report.schedule.save',{...input,...pin(schedule),revision:schedule.revision+1},h.owner,409)
  const before=await sources(),mailCount=h.mailbox.length
  await tick('2026-10-26T11:59:59Z');assert.equal(h.mailbox.length,mailCount)
  await tick(at);assert.equal(h.mailbox.length,mailCount+1)
  let state=await h.state(),receipt=state.reportdeliveries[0]
  assert.deepEqual([receipt.status,receipt.filter.from,receipt.filter.through,receipt.filter.site],['accepted',week,'2026-10-25','East'])
  assert.equal(state.events.some(e=>e.action==='report.schedule.save'&&e.entityId===schedule.id),true)
  assert.equal(state.events.some(e=>e.action==='report.delivery.result'&&e.entityId===receipt.id),true)
  const message=h.mailbox.at(-1);assert.deepEqual(message.to,[manager.email])
  for(const privateValue of [alex.id,alex.name,foreign.email,'2520'])assert.equal(message.text.includes(privateValue),false)
  const link=new URL(message.text.match(/https?:\/\/\S+/)[0]),path=link.pathname+link.search
  assert.equal(JSON.stringify(state).includes(link.searchParams.get('token')),false,'Raw link secrets never enter state or command results')
  const csv=await h.send(path,undefined,manager.cookie)
  assert.equal(csv.status,200,csv.text)
  assert.equal(csv.text,(await h.send('/api/lanyard/reports.csv?'+new URLSearchParams(receipt.filter),undefined,manager.cookie)).text)
  assert.ok(csv.text.includes(alex.id));assert.ok(!csv.text.includes(foreign.id))
  assert.equal((await h.send(path,undefined,h.owner)).status,404,'Forwarded link grants the owner no recipient session')
  assert.equal((await h.send(path,undefined,foreign.cookie)).status,404)
  assert.equal((await h.send(path,undefined,alex.cookie)).status,404)
  assert.equal((await h.send(path)).status,401)
  assert.equal((await h.send(link.pathname+'?token=synthetic-lanyard-3',undefined,manager.cookie)).status,404)
  assert.deepEqual((await h.state(manager.cookie)).reportschedules,[])
  assert.deepEqual((await h.state(alex.cookie)).reportdeliveries,[])
  await tick(at);await h.restart();await tick(at)
  assert.equal(h.mailbox.length,mailCount+1,'A repeated tick and restart never submit again')
  assert.equal(await sources(),before,'Report delivery never changes approved time or other operational sources')
  const correction=await h.cmd('time.prepare',{...f.shift(1,9),corrects:f.times[1].id,reason:'Confirmed one duplicate hour'})
  assert.equal((await h.send(path,undefined,manager.cookie)).text,csv.text)
  await h.cmd('time.approve',pin(correction))
  const corrected=await h.send(path,undefined,manager.cookie);assert.equal(corrected.status,200)
  assert.ok(corrected.text.includes(correction.id));assert.ok(!corrected.text.includes(f.times[1].id))
  await h.restart();assert.equal((await h.send(path,undefined,manager.cookie)).text,corrected.text)
  const downloads=async()=>(await h.db.prepare("SELECT count(*) n FROM l_events WHERE action='reports.download'").first()).n
  const auditBefore=await downloads()
  assert.equal((await h.send(path,undefined,manager.cookie,{'x-test-now':String(Date.parse('2026-10-27T12:00:00Z'))})).status,404,'Expiration is inclusive')
  await h.cmd('report.delivery.revoke',pin(receipt),manager.cookie,403)
  await h.cmd('report.delivery.revoke',pin(receipt))
  assert.equal((await h.send(path,undefined,manager.cookie)).status,404)
  assert.equal(await downloads(),auditBefore,'Refused downloads write no successful download audit')
  await h.cmd('report.schedule.pause',pin((await h.state()).reportschedules[0]))
  await tick('2026-11-02T12:00:00Z');assert.equal(h.mailbox.length,mailCount+1)
  let current=(await h.state()).reportschedules[0]
  const resumed=await h.cmd('report.schedule.save',{...input,...pin(current)})
  outcome=429;await tick(at)
  receipt=(await h.state()).reportdeliveries.find(r=>r.scheduleRevision===resumed.revision)
  assert.equal(receipt.status,'rate_limited');await tick(at);assert.equal(h.mailbox.length,mailCount+2,'Rate limiting never triggers an automatic duplicate submission')
  outcome=202
  current=(await h.state()).reportschedules[0]
  await h.cmd('report.schedule.save',{...input,...pin(current)})
  const managerRecord=(await h.state()).staff.find(p=>p.id===manager.id)
  await h.cmd('staff.save',{...pin(managerRecord),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'manager',active:false,site:'East'})
  await tick(at)
  assert.equal(h.mailbox.length,mailCount+2,'Deactivated recipient is never submitted')
  assert.equal((await h.state()).reportdeliveries.filter(r=>r.status==='blocked').length,1)
  assert.equal((await h.send(path,undefined,manager.cookie)).status,403)
  const latestManager=(await h.state()).staff.find(p=>p.id===manager.id)
  await h.cmd('staff.save',{...pin(latestManager),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'manager',active:true,site:'East'})
  const newSession=await h.signIn(manager.email)
  const newlyApproved=await h.cmd('report.schedule.save',{...input,...pin((await h.state()).reportschedules[0])})
  await tick(at)
  const currentMessage=h.mailbox.findLast(m=>m.subject==='Your scheduled Lanyard report'),currentLink=new URL(currentMessage.text.match(/https?:\/\/\S+/)[0]),currentPath=currentLink.pathname+currentLink.search
  assert.equal((await h.send(currentPath,undefined,newSession)).status,200)
  const move=async site=>{const p=(await h.state()).staff.find(p=>p.id===manager.id);return h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site})}
  await move('West');assert.equal((await h.send(currentPath,undefined,newSession)).status,403)
  await move('East');assert.equal((await h.send(currentPath,undefined,newSession)).status,403,'Restoring a prior site never resurrects an earlier approved link')
  const beforeStaleTick=h.mailbox.length
  await tick('2026-11-02T12:00:00Z')
  assert.equal(h.mailbox.length,beforeStaleTick,'Authority changes require new owner approval before later sends')
  assert.ok((await h.state()).reportdeliveries.some(r=>r.scheduleId===newlyApproved.id&&r.due==='2026-11-02T12:00:00.000Z'&&r.status==='blocked'))
 }finally{await h.close()}
}

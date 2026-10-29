import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {iconTooltips} from './browser-controls.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const NOW='2026-11-02T18:00:00Z'
async function fixture(h){
 const alex=await h.person('Alex'),bea=await h.person('Bea'),manager=await h.person('Morgan','manager')
 const period=await h.cmd('period.save',{start:'2026-10-26',end:'2026-11-01'})
 await h.cmd('breakrule.save',{site:'',mealAfterMinutes:300,mealMinutes:30,restEveryMinutes:0,restMinutes:10,premium:false})
 const time=await h.cmd('time.request',{start:'2026-10-26T16:00:00Z',end:'2026-10-27T00:00:00Z',breakMinutes:0,reason:'Opening punch was missed; employee confirmed actual work',attest:true},alex.cookie)
 const clock=await h.cmd('clock.in',{commandId:'synthetic-lanyard-1',capturedAt:'2026-10-27T16:00:00Z'},bea.cookie)
 const spec={name:'Reviewed native hours',approved:true,header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Earning'},{field:'minutes',header:'Minutes'}],groupBy:[],employees:{},codes:{},jobs:{},locations:{}}
 const template=await h.cmd('payroll.template.save',spec)
 const read=async(cookie=h.owner,status=200,headers={})=>{const r=await h.send('/api/lanyard/cutoffs?periodId='+period.id,undefined,cookie,headers);assert.equal(r.status,status,r.text);return status===200?r.value[0]:r}
 const configure=async(p=period,t=template,revision=0,cutoffAt=NOW,extra={},cookie=h.owner,status=200)=>h.cmd('cutoff.save',{periodId:p.id,periodRevision:p.revision,templateId:t.id,templateRevision:t.revision,revision,cutoffAt,reason:'Owner reviewed provider deadline separately; native monitoring only',reviewed:true,...extra},cookie,status)
 return {alex,bea,manager,period,time,clock,spec,template,read,configure}
}
const sourceBytes=async h=>JSON.stringify({records:(await h.db.prepare("SELECT kind,id,revision,data FROM l_records WHERE kind IN ('clocks','timesheets','periods','paytemplates','batches') ORDER BY kind,id").all()).results,claims:(await h.db.prepare('SELECT * FROM l_payroll_claims ORDER BY time_id,time_revision').all()).results})

export async function cutoffApi(){
 const clock={now:NOW},h=await harness(clock)
 try{
  const f=await fixture(h),{alex,bea,manager,read,configure}=f
  let {period,time,template}=f
  const noCutoff=await read();assert.equal(noCutoff.timing,'no_cutoff');assert.equal(noCutoff.nativeReadiness,'no_cutoff');assert.equal(noCutoff.providerState,'unknown')
  const beforeInvalid=await sourceBytes(h)
  for(const cookie of [alex.cookie,bea.cookie,manager.cookie]){await read(cookie,403);await configure(period,template,0,NOW,{},cookie,403)}
  await configure(period,template,0,NOW,{reviewed:false},h.owner,400)
  await configure(period,template,0,NOW,{periodRevision:99},h.owner,409)
  await configure(period,template,0,NOW,{templateRevision:99},h.owner,409)
  await configure(period,template,0,'2026-11-01T01:30:00',{},h.owner,400)
  assert.equal(await sourceBytes(h),beforeInvalid)
  let config=await configure()
  const before=await sourceBytes(h),readState=await h.state()
  for(const [at,timing,milliseconds] of [['2026-11-02T17:59:00Z','before',60000],[NOW,'at',0],['2026-11-02T18:01:00Z','after',-60000]]){
   const r=await read(h.owner,200,{'x-test-now':String(Date.parse(at))});assert.equal(r.timing,timing);assert.equal(r.remainingMilliseconds,milliseconds);assert.equal(r.providerState,'unknown')
  }
  let report=await read()
  for(const kind of ['open_punch','exception','approval','employee_signoff','manager_signoff','period_lock','mapping'])assert.ok(report.issues.some(i=>i.kind===kind),kind)
  assert.ok(report.issues.some(i=>i.message.includes('missed meal break')))
  assert.ok(report.issues.every(i=>i.source.id&&i.source.revision&&i.href.startsWith('/app/')))
  assert.equal(await sourceBytes(h),before,'monitoring does not edit time, claims, periods, templates or payroll bytes')
  assert.deepEqual((await h.state()).batches,readState.batches)
  await h.restart();assert.equal((await read()).configuration.cutoffAt,'2026-11-02T18:00:00.000Z')
  // The two independently specified UTC instants are both 01:30 in Pacific time
  // on the fall-back day, but are one real hour apart.
  for(const [instant,other] of [['2026-11-01T08:30:00Z','2026-11-01T09:30:00Z'],['2026-11-01T09:30:00Z','2026-11-01T08:30:00Z']]){
   config=await configure(period,template,config.revision,instant)
   const r=await read(h.owner,200,{'x-test-now':String(Date.parse(other))});assert.equal(r.remainingMilliseconds,instant.includes('08:')?-3600000:3600000)
   assert.equal((await read(h.owner,200,{'x-test-now':String(Date.parse(instant))})).timing,'at')
  }
  config=await configure(period,template,config.revision)
  const stopped=await h.cmd('clock.out',{commandId:'synthetic-lanyard-2',capturedAt:'2026-10-27T17:00:00Z',breakMinutes:0},bea.cookie)
  assert.ok(!(await read()).issues.some(i=>i.kind==='open_punch'))
  time=await h.cmd('time.approve',pin(time),manager.cookie)
  assert.ok((await read()).issues.some(i=>i.kind==='exception'&&i.source.id===time.id),'approval alone does not resolve a break or missed-punch case')
  await h.cmd('time.resolve',{...pin(time),reason:'Employee facts reviewed; missed meal retained without inventing a break'},alex.cookie,403)
  time=await h.cmd('time.resolve',{...pin(time),reason:'Employee facts reviewed; missed meal retained without inventing a break'},manager.cookie)
  await h.cmd('time.approve',pin(stopped.timesheet),bea.cookie,403)
  const second=await h.cmd('time.approve',pin(stopped.timesheet),manager.cookie)
  assert.ok(!(await read()).issues.some(i=>i.kind==='exception'||i.kind==='approval'))
  const fullSpec={...f.spec,employees:{[alex.id]:{id:'synthetic-lanyard-3',workflow:'W-2'},[bea.id]:{id:'synthetic-lanyard-4',workflow:'W-2'}},codes:{regular:'REG'}}
  template=await h.cmd('payroll.template.save',{...fullSpec,...pin(template)})
  assert.ok(!(await read()).issues.some(i=>i.kind==='mapping'));assert.ok((await read()).issues.some(i=>i.kind==='configuration'))
  await configure(period,template,config.revision,NOW,{templateRevision:template.revision-1},h.owner,409)
  config=await configure(period,template,config.revision)
  for(const cookie of [alex.cookie,bea.cookie,manager.cookie])period=await h.cmd('period.signoff',pin(period),cookie)
  // A later native correction invalidates earlier signoffs, without changing its facts.
  const edited=await h.cmd('time.prepare',{staffId:alex.id,start:time.start,end:'2026-10-26T23:00:00Z',breakMinutes:0,corrects:time.id,reason:'Employee reported the true earlier finish'})
  let corrected=await h.cmd('time.approve',pin(edited),manager.cookie)
  corrected=await h.cmd('time.acknowledge',pin(corrected),alex.cookie)
  assert.ok((await read()).issues.some(i=>i.kind==='employee_signoff'&&i.staffId===alex.id))
  assert.ok((await read()).issues.some(i=>i.kind==='manager_signoff'))
  await h.cmd('period.lock',pin(period),h.owner,409)
  if(corrected.exceptions?.length)corrected=await h.cmd('time.resolve',{...pin(corrected),reason:'Reasoned break review on the corrected facts'},manager.cookie)
  for(const cookie of [alex.cookie,manager.cookie])period=await h.cmd('period.signoff',pin(period),cookie)
  period=await h.cmd('period.lock',pin(period))
  report=await read();assert.equal(report.nativeReadiness,'ready',JSON.stringify(report.issues));assert.equal(report.providerState,'unknown')
  const noWrites=await sourceBytes(h);await read();await h.state();assert.equal(await sourceBytes(h),noWrites)
  await h.cmd('time.prepare',{staffId:alex.id,start:corrected.start,end:corrected.end,breakMinutes:30,corrects:corrected.id,reason:'A locked period cannot change'},h.owner,409)
  const exported=await h.cmd('payroll.export',pin(await h.cmd('payroll.prepare',{templateId:template.id})))
  period=await h.cmd('period.close',{...pin(period),reference:'synthetic-lanyard-5 owner-recorded reference only'})
  assert.equal((await read()).providerState,'unknown','manual closure is not provider readback')
  const locked=structuredClone(period),paid=await sourceBytes(h)
  let late=await h.cmd('time.prepare',{staffId:alex.id,start:corrected.start,end:'2026-10-26T22:00:00Z',breakMinutes:0,corrects:corrected.id,reason:'Later employee-confirmed correction after the recorded run'})
  assert.equal((await read()).nativeReadiness,'needs_attention')
  assert.equal((await h.state()).batches.find(b=>b.id===exported.id).csv,exported.csv)
  late=await h.cmd('time.acknowledge',pin(late),alex.cookie)
  if(late.exceptions?.length)late=await h.cmd('time.resolve',{...pin(late),reason:'Review later corrected break facts'},manager.cookie)
  late=await h.cmd('time.approve',pin(late),manager.cookie)
  const delta=await h.cmd('payroll.prepare',{ids:[late.id],templateId:template.id});assert.equal(delta.lines.reduce((n,l)=>n+l.minutes,0),-60)
  await h.cmd('payroll.export',pin(delta));assert.equal((await read()).nativeReadiness,'ready')
  assert.deepEqual((await h.state()).periods.find(p=>p.id===period.id).locked,locked.locked)
  assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text,exported.csv)
  assert.notEqual(await sourceBytes(h),paid)
  const key=await h.cmd('agent.create',{label:'Preparation only'})
  const agent=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.deepEqual(agent.value.cutoffs,[]);assert.deepEqual(agent.value.cutoffReports,[])
  assert.equal((await h.send('/api/lanyard/agent/command',{name:'cutoff.save',input:{}},'',{authorization:`Bearer ${key.token}`})).status,403)
  for(const cookie of [alex.cookie,manager.cookie]){const state=await h.state(cookie);assert.deepEqual(state.cutoffs,[]);assert.deepEqual(state.cutoffReports,[])}
  await h.cmd('agent.revoke',{id:key.id});assert.equal((await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  await h.restart();assert.equal((await read()).nativeReadiness,'ready');assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text,exported.csv)
  assert.equal(second.minutes,60)
 }finally{await h.close()}
}

import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {iconTooltips} from './browser-controls.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const NOW='2026-11-02T18:00:00Z'
async function fixture(h,{policy=false}={}){
 const alex=await h.person('Alex'),bea=await h.person('Bea'),manager=await h.person('Morgan','manager')
 if(policy){
  for(const p of [alex,bea])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,hourlyRate:'20.00'})
  await h.cmd('policy.save',{site:'',from:'2026-10-01',preset:'CA',reviewReason:'Employer reviewed maintained overtime core'})
 }
 const period=await h.cmd('period.save',{start:'2026-10-26',end:'2026-11-01'})
 await h.cmd('breakrule.save',{site:'',mealAfterMinutes:300,mealMinutes:30,restEveryMinutes:0,restMinutes:10,premium:false})
 const time=await h.cmd('time.request',{start:'2026-10-26T16:00:00Z',end:policy?'2026-10-27T05:00:00Z':'2026-10-27T00:00:00Z',breakMinutes:0,reason:'Opening punch was missed; employee confirmed actual work',attest:true},alex.cookie)
 const clock=await h.cmd('clock.in',{commandId:'synthetic-lanyard-1',capturedAt:'2026-10-27T16:00:00Z'},bea.cookie)
 const spec={name:'Reviewed native hours',classification:policy?'policy':'source',approved:true,header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Earning'},{field:'minutes',header:'Minutes'}],groupBy:[],employees:{},codes:{},jobs:{},locations:{}}
 const template=await h.cmd('payroll.template.save',spec)
 const read=async(cookie=h.owner,status=200,headers={})=>{const r=await h.send('/api/lanyard/cutoffs?periodId='+period.id,undefined,cookie,headers);assert.equal(r.status,status,r.text);return status===200?r.value[0]:r}
 const configure=async(p=period,t=template,revision=0,cutoffAt=NOW,extra={},cookie=h.owner,status=200)=>h.cmd('cutoff.save',{periodId:p.id,periodRevision:p.revision,templateId:t.id,templateRevision:t.revision,revision,cutoffAt,reason:'Owner reviewed provider deadline separately; native monitoring only',reviewed:true,...extra},cookie,status)
 return {alex,bea,manager,period,time,clock,spec,template,read,configure}
}
const sourceBytes=async h=>JSON.stringify({records:(await h.db.prepare("SELECT kind,id,revision,data FROM l_records ORDER BY kind,id").all()).results,claims:(await h.db.prepare('SELECT * FROM l_payroll_claims ORDER BY time_id,time_revision').all()).results})

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
  const configuredBytes=await sourceBytes(h)
  await configure(period,template,0,NOW,{},h.owner,409)
  assert.equal(await sourceBytes(h),configuredBytes)
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
  const job=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]})
  await h.cmd('availability.save',{staffId:alex.id,start:'2026-10-25T00:00:00Z',end:'2026-11-02T20:00:00Z'})
  const shifts=[{staffId:alex.id,start:'2026-11-01T08:30:00Z',end:'2026-11-01T10:30:00Z',breakMinutes:0,label:'Actual work must be confirmed separately'}]
  const draft=await h.cmd('roster.prepare',{week:'2026-10-26',shifts});await h.cmd('roster.publish',pin(draft))
  const originalCount=(await h.state()).timesheets.length
  assert.ok((await read()).issues.some(i=>i.kind==='missing_punch'&&i.source.kind==='shifts'))
  assert.equal((await h.state()).timesheets.length,originalCount,'monitoring never turns scheduled hours into worked hours')
  let factual=await h.cmd('time.prepare',{staffId:alex.id,start:shifts[0].start,end:shifts[0].end,breakMinutes:0,job:job.id,site:'East',reason:'Employee supplied actual fallback-day work; awaiting confirmation'})
  assert.ok(!(await read()).issues.some(i=>i.kind==='missing_punch'))
  assert.ok((await read()).issues.some(i=>i.kind==='confirmation'&&i.source.id===factual.id))
  assert.ok((await read()).issues.some(i=>i.kind==='mapping'&&i.message.startsWith('Unmapped job')))
  assert.ok((await read()).issues.some(i=>i.kind==='mapping'&&i.message.startsWith('Unmapped location')))
  factual=await h.cmd('time.acknowledge',pin(factual),alex.cookie)
  assert.ok(!(await read()).issues.some(i=>i.kind==='confirmation'&&i.source.id===factual.id))
  await h.cmd('time.approve',pin(factual),alex.cookie,403)
  await h.cmd('time.approve',pin(factual),manager.cookie,403)
  await h.cmd('time.approve',pin(factual))
  const stopped=await h.cmd('clock.out',{commandId:'synthetic-lanyard-2',capturedAt:'2026-10-27T17:00:00Z',breakMinutes:0},bea.cookie)
  assert.ok(!(await read()).issues.some(i=>i.kind==='open_punch'))
  time=await h.cmd('time.approve',pin(time),manager.cookie)
  assert.ok((await read()).issues.some(i=>i.kind==='exception'&&i.source.id===time.id),'approval alone does not resolve a break or missed-punch case')
  await h.cmd('time.resolve',{...pin(time),reason:'Employee facts reviewed; missed meal retained without inventing a break'},alex.cookie,403)
  time=await h.cmd('time.resolve',{...pin(time),reason:'Employee facts reviewed; missed meal retained without inventing a break'},manager.cookie)
  await h.cmd('time.approve',pin(stopped.timesheet),bea.cookie,403)
  const second=await h.cmd('time.approve',pin(stopped.timesheet),manager.cookie)
  assert.ok(!(await read()).issues.some(i=>i.kind==='exception'||i.kind==='approval'))
  const fullSpec={...f.spec,employees:{[alex.id]:{id:'synthetic-lanyard-3',workflow:'W-2'},[bea.id]:{id:'synthetic-lanyard-4',workflow:'W-2'}},codes:{regular:'REG'},jobs:{[job.id]:'COUNTER'},locations:{East:'EAST'}}
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
  let personalSignoff
  for(const cookie of [alex.cookie,manager.cookie]){
   period=await h.cmd('period.signoff',pin(period),cookie)
   if(cookie===alex.cookie)personalSignoff=period
  }
  const retained=(await h.state()).periods.find(p=>p.id===period.id)
  assert.ok(retained.signoffHistory.some(x=>x.role==='manager'&&x.sources.includes(second.id)),'owner retains the full manager review history')
  assert.deepEqual((await h.state(manager.cookie)).periods.find(p=>p.id===period.id).signoffHistory,retained.signoffHistory)
  const beforePrivateReads=await sourceBytes(h)
  for(const person of [alex,bea]){
   const visible=(await h.state(person.cookie)).periods.find(p=>p.id===period.id)
   assert.deepEqual(visible.signoffHistory,retained.signoffHistory.filter(x=>x.role==='employee'&&x.staffId===person.id))
   assert.ok(!JSON.stringify(visible).includes(person===alex?second.id:corrected.id),'snapshot excludes coworker revisions after renewed signoff')
  }
  assert.ok(!JSON.stringify(personalSignoff).includes(second.id),'employee signoff response excludes coworker time and manager sources')
  assert.ok(personalSignoff.signoffHistory.length>0,'employee keeps their earlier signoff')
  assert.equal(await sourceBytes(h),beforePrivateReads,'private reads preserve retained review history')
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
  const agent=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.deepEqual(agent.value.cutoffs,[]);assert.deepEqual(agent.value.cutoffReports,[]);assert.ok(agent.value.periods.every(p=>p.signoffHistory.length===0),'agent context excludes retained signoff sources')
  assert.equal((await h.send('/api/lanyard/agent/command',{name:'cutoff.save',input:{}},'',{authorization:`Bearer ${key.token}`})).status,403)
  for(const cookie of [alex.cookie,manager.cookie]){const state=await h.state(cookie);assert.deepEqual(state.cutoffs,[]);assert.deepEqual(state.cutoffReports,[])}
  await h.cmd('agent.revoke',{id:key.id});assert.equal((await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  const beforeInput=(await h.state()).batches
  await h.cmd('payroll.input.save',{staffId:alex.id,date:'2026-11-01',kind:'PTO',minutes:60,amountCents:2000,reference:'synthetic-lanyard-40',reason:'Separately reviewed non-work input'})
  assert.ok((await read()).issues.some(i=>i.kind==='mapping'&&i.message==='Unmapped earning code: PTO'))
  template=await h.cmd('payroll.template.save',{...fullSpec,...pin(template),codes:{regular:'REG',PTO:'VAC'}})
  config=await configure(period,template,config.revision)
  assert.equal((await read()).nativeReadiness,'ready')
  assert.deepEqual((await h.state()).batches,beforeInput,'native monitoring never exports a newly reviewed input')
  const inputBatch=await h.cmd('payroll.prepare',{templateId:template.id});assert.deepEqual(inputBatch.lines.map(l=>[l.payCode,l.minutes]),[['PTO',60]])
  await h.cmd('payroll.export',pin(inputBatch))
  const currentAlex=(await h.state()).staff.find(p=>p.id===alex.id)
  await h.cmd('staff.save',{...pin(currentAlex),name:alex.name,email:alex.email,payrollId:alex.payrollId,role:'staff',active:false})
  await read(alex.cookie,403)
  await h.restart();assert.equal((await read()).nativeReadiness,'ready');assert.ok(!(await h.state(bea.cookie)).periods.some(p=>JSON.stringify(p.signoffHistory).includes(corrected.id)),'private history remains filtered after restart');assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text,exported.csv)
  assert.equal(second.minutes,60)
 }finally{await h.close()}
}

export async function cutoffBrowser(){
 const h=await harness({now:NOW}),browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  const f=await fixture(h,{policy:true}),{alex,bea,manager}=f
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse(NOW))}})
  try{
   await context.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname
    if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   const [name,...cookie]=h.owner.split('=');await context.addCookies([{name,value:cookie.join('='),url:h.origin}])
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const open=path=>page.goto(h.origin+path,{waitUntil:'networkidle'})
   const proof=async(label)=>{
    if(!process.env.CUTOFF_SCREENS)return
    await mkdir(process.env.CUTOFF_SCREENS,{recursive:true})
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(process.env.CUTOFF_SCREENS,`${label}-${width}.png`),fullPage:true})}
    await page.setViewportSize({width:1440,height:1000})
   }
   await open('/app/payroll');assert.match(await page.locator('#pay-cutoff-monitor').innerText(),/No cutoff configured/)
   const initial=await sourceBytes(h);await open('/app/payroll');assert.equal(await sourceBytes(h),initial)
   await open('/app/settings#pay-cutoffs')
   const configure=page.locator('#pay-cutoffs form')
   await page.locator('#pay-cutoffs summary').click()
   await configure.getByLabel('Cutoff instant in UTC').fill(NOW)
   await configure.getByLabel('Owner-approved export template').selectOption(f.template.id+'|1')
   await configure.getByLabel('Review reason',{exact:true}).fill('Owner reviewed UTC cutoff and selected native template')
   await configure.getByRole('checkbox').check()
   let period=await h.cmd('period.signoff',pin(f.period),manager.cookie)
   await configure.getByRole('button',{name:'Save reviewed cutoff'}).click();await page.waitForLoadState('networkidle')
   assert.match(await page.locator('.notice.error').innerText(),/Revision changed/);assert.equal((await h.state()).cutoffs.length,0)
   await page.locator('#pay-cutoffs summary').click()
   await configure.getByLabel('Cutoff instant in UTC').fill(NOW)
   await configure.getByLabel('Owner-approved export template').selectOption(f.template.id+'|1')
   await configure.getByLabel('Review reason',{exact:true}).fill('Reviewed refreshed period and exact UTC cutoff')
   await configure.getByRole('checkbox').check()
   await configure.getByRole('button',{name:'Save reviewed cutoff'}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0);assert.equal((await h.state()).cutoffs.length,1)
   await proof('cutoff-settings')
   await open('/app/payroll')
   const monitor=page.locator('#pay-cutoff-monitor')
   const visible=await monitor.innerText();for(const fact of ['Native review needs attention','Provider state: unknown','no confirmed end','missed meal break','Unmapped employee'])assert.ok(visible.includes(fact),fact)
   const href=await monitor.getByRole('link',{name:'Review source'}).first().getAttribute('href');assert.ok(href.startsWith('/app/time?week=2026-10-26'))
   await monitor.getByRole('link',{name:'Review source'}).first().click();await page.waitForLoadState('networkidle');assert.equal(new URL(page.url()).pathname,'/app/time')
   await open('/app/payroll');await iconTooltips(page)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await proof('cutoff-needs-attention')
   await open('/app/settings#template-'+f.template.id)
   const mappings=page.locator('#template-'+f.template.id)
   await mappings.locator('summary').click()
   for(const [i,p] of [alex,bea,manager].entries()){
    const group=mappings.locator('fieldset').filter({has:page.locator('legend',{hasText:p.name})})
    if(p===manager)continue
    await group.getByLabel('Provider employee ID',{exact:true}).fill('synthetic-lanyard-'+(i+30))
    await group.getByLabel('Reviewed worker treatment').selectOption('W-2')
   }
   await mappings.getByLabel('Earning code · regular',{exact:true}).fill('REG')
   await mappings.getByRole('checkbox').check();await mappings.getByRole('button',{name:'Approve export mappings'}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   assert.equal((await h.state()).paytemplates.find(t=>t.id===f.template.id).employees[alex.id].id,'synthetic-lanyard-30')
   await open('/app/payroll');assert.match(await monitor.innerText(),/selected export template changed/)
   const ended=await h.cmd('clock.out',{commandId:'synthetic-lanyard-20',capturedAt:'2026-10-27T17:00:00Z',breakMinutes:0},bea.cookie)
   await h.cmd('time.approve',pin(ended.timesheet),manager.cookie)
   let time=await h.cmd('time.approve',pin(f.time),manager.cookie)
   time=await h.cmd('time.resolve',{...pin(time),reason:'Reviewed missed punch and missed meal without inventing time'},manager.cookie)
   for(const cookie of [alex.cookie,bea.cookie,manager.cookie])period=await h.cmd('period.signoff',pin(period),cookie)
   period=await h.cmd('period.lock',pin(period))
   await open('/app/settings#pay-cutoffs');await page.locator('#pay-cutoffs summary').click()
   await configure.getByLabel('Review reason',{exact:true}).fill('Reviewed locked period and current mappings')
   await configure.getByRole('checkbox').check();await configure.getByRole('button',{name:'Save reviewed cutoff'}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   for(const [code,mapped] of [['overtime','OT'],['double time','DT']]){
    await open('/app/payroll')
    const warning=monitor.locator('li').filter({hasText:'Unmapped earning code: '+code})
    assert.equal(await warning.count(),1,'native classification reports the missing '+code+' mapping')
    await warning.getByRole('link',{name:'Review source'}).click();await page.waitForLoadState('networkidle')
    await mappings.locator('summary').click()
    const earning=mappings.getByLabel('Earning code · '+code,{exact:true})
    assert.equal(await earning.count(),1,'Settings provides a correction for policy-generated '+code)
    const beforeMapping=await h.state()
    await earning.fill(mapped)
    await proof('cutoff-map-'+mapped)
    await mappings.getByRole('checkbox').check();await mappings.getByRole('button',{name:'Approve export mappings'}).click();await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('.notice.error').count(),0)
    const afterMapping=await h.state()
    assert.deepEqual(afterMapping.timesheets,beforeMapping.timesheets)
    assert.deepEqual(afterMapping.batches,beforeMapping.batches)
    await open('/app/payroll');assert.match(await monitor.innerText(),/selected export template changed/)
    await open('/app/settings#pay-cutoffs');await page.locator('#pay-cutoffs summary').click()
    await configure.getByLabel('Review reason',{exact:true}).fill('Reviewed current native earning mappings without submitting payroll')
    await configure.getByRole('checkbox').check();await configure.getByRole('button',{name:'Save reviewed cutoff'}).click();await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('.notice.error').count(),0)
   }
   const beforeReady=await sourceBytes(h);await open('/app/payroll')
   assert.match(await monitor.innerText(),/Native review complete/);assert.match(await monitor.innerText(),/Provider state: unknown/)
   assert.equal(await sourceBytes(h),beforeReady)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await iconTooltips(page);assert.deepEqual(errors,[])
   await proof('cutoff-native-review-complete')
   await h.restart()
   const template=(await h.state()).paytemplates.find(t=>t.id===f.template.id)
   assert.deepEqual(template.codes,{regular:'REG',overtime:'OT','double time':'DT'})
   const prepared=await h.cmd('payroll.prepare',{templateId:template.id})
   assert.deepEqual(prepared.classificationLines.filter(l=>l.staffId===alex.id).map(l=>[l.earningCode,l.minutes]),[['regular',480],['overtime',240],['double time',60]])
   const exported=await h.cmd('payroll.export',pin(prepared))
   for(const row of ['synthetic-lanyard-30,REG,480','synthetic-lanyard-30,OT,240','synthetic-lanyard-30,DT,60','synthetic-lanyard-31,REG,60'])assert.ok(exported.csv.split('\r\n').includes(row),row)
   assert.equal((await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text,exported.csv)
  }finally{await context.close()}
 }finally{await browser.close();await h.close()}
}

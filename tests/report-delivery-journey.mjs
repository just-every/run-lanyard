import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {fixture} from './cost-journey.mjs'
import {pin} from './workforce-journey.mjs'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {iconTooltips} from './browser-controls.mjs'

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

export async function reportsDeliveryBrowser(browser){
 const h=await harness({now:'2026-10-26T12:00:00Z',auth:{MAIL_PROVIDER:'sendgrid'}})
 try{
  const f=await fixture(h),{manager,alex}=f
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}})
  try{
   await context.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname
    if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   const signIn=async cookie=>{const [name,...value]=cookie.split('=');await context.clearCookies();await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   await signIn(h.owner)
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
   await page.goto(h.origin+'/app/settings',{waitUntil:'networkidle'})
   const card=page.locator('#report-delivery-settings')
   await card.getByText('Create report schedule',{exact:true}).click()
   const form=card.locator('form[data-report-schedule]').last()
   await form.getByLabel('Report name',{exact:true}).fill('Approved service report')
   await form.getByLabel('Recipient',{exact:true}).selectOption(manager.id)
   await form.getByLabel('Report cafe',{exact:true}).selectOption('East')
   await form.getByLabel('Scheduled report kind',{exact:true}).selectOption('worked')
   await form.getByLabel('Report job',{exact:true}).selectOption(f.bar.id)
   await form.getByLabel('Report person',{exact:true}).selectOption(alex.id)
   await form.getByLabel('First run (venue time)',{exact:true}).fill('2026-10-26T12:15')
   await form.getByRole('checkbox').check()
   await form.getByRole('button',{name:'Approve report schedule',exact:true}).click();await page.waitForLoadState('networkidle')
   const schedule=(await h.state()).reportschedules[0]
   await page.reload({waitUntil:'networkidle'});assert.equal((await h.state()).reportschedules.length,1,'Refreshing the successful save cannot repeat it')
   const tick=await (await h.mf.getWorker()).scheduled({scheduledTime:new Date('2026-10-26T12:15:00Z'),cron:'*/15 * * * *'});assert.equal(tick.outcome,'ok')
   await page.reload({waitUntil:'networkidle'})
   const receipt=(await h.state()).reportdeliveries[0]
   assert.equal(receipt.status,'accepted');assert.match(await card.locator(`[data-report-delivery-id="${receipt.id}"]`).innerText(),/Provider accepted; mailbox delivery unconfirmed/)
   await iconTooltips(page)
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(process.env.REPORT_SCREENS){await mkdir(process.env.REPORT_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.REPORT_SCREENS,`accepted-report-link-${width}.png`)})}
   }
   await page.setViewportSize({width:1440,height:1000})
   const message=h.mailbox.findLast(m=>m.subject==='Your scheduled Lanyard report'),link=new URL(message.text.match(/https?:\/\/\S+/)[0]),path=link.pathname+link.search
   await signIn(manager.cookie)
   const download=page.waitForEvent('download')
   await page.goto(h.origin+path).catch(error=>assert.match(error.message,/ERR_ABORTED|Download is starting/))
   const downloaded=await download,csv=await readFile(await downloaded.path(),'utf8')
   assert.equal(csv,(await h.send('/api/lanyard/reports.csv?'+new URLSearchParams(receipt.filter),undefined,manager.cookie)).text)
   assert.ok(csv.includes(alex.id));assert.ok(!csv.includes(f.foreign.id))
   await signIn(h.owner);await page.goto(h.origin+'/app/settings',{waitUntil:'networkidle'})
   await card.getByRole('button',{name:'Revoke download link',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.match(await card.innerText(),/Link revoked/)
   assert.equal((await h.send(path,undefined,manager.cookie)).status,404)
   await card.getByText('Review and approve schedule',{exact:true}).click()
   const edit=card.locator('form[data-report-schedule]').first()
   await edit.getByLabel('Report name',{exact:true}).fill('Stale approval must not land')
   await edit.getByRole('checkbox').check()
   await h.cmd('report.schedule.pause',pin(schedule))
   const [stale]=await Promise.all([page.waitForNavigation(),edit.getByRole('button',{name:'Approve updated schedule',exact:true}).click()])
   assert.equal(stale.status(),409)
   assert.match(await page.getByRole('alert').innerText(),/Revision changed; reload before deciding/)
   const current=(await h.state()).reportschedules[0];assert.equal(current.label,'Approved service report');assert.equal(current.enabled,false)
   assert.deepEqual(errors,[])
  }finally{await context.close()}
 }finally{await h.close()}
}

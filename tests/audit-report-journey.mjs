import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
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
 const updated=await h.cmd('time.edit',{id:f.manual.id,revision:2,start:f.manual.start,end:'2026-10-10T15:00:00Z',breakMinutes:30,reason:'Second reviewed correction'})
 const latest=(await read()).rows.find(x=>x.category==='punch-edit');assert.equal(latest.sourceRevision,updated.revision);assert.equal(latest.facts.reason,'Second reviewed correction');assert.equal(latest.facts.minutes,390)
 const level=await h.cmd('access.level.save',{name:'Synthetic report reader',site:'Austin',permissions:['reports.view']})
 await h.cmd('access.grant',{staffId:f.morgan.id,levelId:level.id,site:'Austin'})
 await read(query,f.morgan.cookie,403)
 // Revoking the native manager is immediate too.
 await h.cmd('staff.save',{id:f.morgan.id,revision:before.staff.find(p=>p.id===f.morgan.id).revision,name:f.morgan.name,email:f.morgan.email,payrollId:f.morgan.payrollId,role:'manager',active:false,site:'Austin'})
 await read(query,f.morgan.cookie,403)
 return r
}
export async function auditBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.CLOUD_CHROMIUM?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{} )})
 const h=await harness({now:'2026-10-27T12:00:00Z'})
 try{
  await auditFixture(h)
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
   assert.equal(await page.locator('table tbody tr').count(),2)
   const account=page.locator('[data-tooltip="Account menu"]');assert.equal(await account.count(),1);await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor();await account.blur()
   await page.goto(h.origin+'/app/audit?'+query,{waitUntil:'networkidle'})
   assert.ok((await page.locator('table').innerText()).includes('Review closing change'))
   assert.ok((await page.locator('table').innerText()).includes('sick-leave'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});if(process.env.AUDIT_SCREENS){await mkdir(process.env.AUDIT_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.AUDIT_SCREENS,`audit-${width}.png`),fullPage:true})}}
   assert.deepEqual(errors,[])
  }finally{await context.close()}
 }finally{await h.close();await browser.close()}
}

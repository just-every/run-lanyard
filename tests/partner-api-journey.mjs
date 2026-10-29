import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {iconTooltips} from './browser-controls.mjs'

const now='2026-10-05T12:00:00Z',path='/api/lanyard/partner/v1',pin=r=>({id:r.id,revision:r.revision})
async function fixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('synthetic-lanyard-1'),foreign=await h.person('synthetic-lanyard-2'),manager=await h.person('synthetic-lanyard-3','manager')
 for(const p of [alex,foreign,manager])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'West':'East',hourlyRate:'23.47',position:'Service'})
 for(const p of [alex,foreign])await h.cmd('availability.save',{staffId:p.id,start:'2026-10-01T00:00:00Z',end:'2026-12-01T00:00:00Z'})
 const shift=(p=alex,site=p===foreign?'West':'East')=>({staffId:p.id,site,start:'2026-10-12T08:00:00Z',end:'2026-10-12T16:00:00Z',breakMinutes:30,label:'Service'})
 const create=async(site='East')=>h.cmd('partner.create',{label:'synthetic-lanyard-4',site,requestId:crypto.randomUUID()})
 const context=async(key,status=200)=>{const r=await h.send(path+'/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.equal(r.status,status,r.text);return r.value}
 const post=async(key,body,identity=crypto.randomUUID(),status=200,version='v1')=>{
  const response=await h.mf.dispatchFetch(h.origin+`/api/lanyard/partner/${version}/roster-drafts`,{method:'POST',headers:{authorization:`Bearer ${key.token}`,'content-type':'application/json','idempotency-key':identity,'x-test-now':String(Date.parse(now))},body:typeof body==='string'?body:JSON.stringify(body)})
  const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value
 }
 const body=async(key,shifts=[shift()],week='2026-10-12')=>({contextVersion:(await context(key)).contextVersion,week,shifts})
 return {alex,foreign,manager,shift,create,context,post,body}
}

export async function partnerApiJourney(){
 const h=await harness({now})
 try{
  const f=await fixture(h),{alex,foreign,manager,create,context,post,body,shift}=f,key=await create(),legacy=await h.cmd('agent.create',{label:'synthetic-lanyard-5'})
  const ctx=await context(key),serialized=JSON.stringify(ctx)
  assert.deepEqual(ctx.staff.map(p=>p.id).sort(),[alex.id,manager.id].sort());assert.equal(ctx.site,'East');assert.equal(ctx.apiVersion,'v1')
  for(const value of [alex.email,alex.payrollId,foreign.id,foreign.email,'2347','hourlyRate','rateBasis','payroll','contacts'])assert.ok(!serialized.includes(value),value)
  assert.equal((await h.send(path+'/context',undefined,h.owner)).status,401)
  await context(legacy,401)
  for(const cookie of [alex.cookie,manager.cookie])await h.cmd('partner.create',{label:'synthetic-lanyard-6',site:'East',requestId:crypto.randomUUID()},cookie,403)
  await h.cmd('partner.create',{label:'synthetic-lanyard-6',site:'West',scope:'payroll.prepare',requestId:crypto.randomUUID()},h.owner,400)
  const protectedBefore=await h.state(),claimsBefore=(await h.db.prepare('SELECT * FROM l_payroll_claims').all()).results
  const persisted=async()=>h.db.batch(['l_meta','l_staff','l_records','l_payroll_claims','l_events','l_commands','l_partner_keys'].map(table=>h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`))).then(results=>results.map(r=>r.results))
  const refused=async(fn)=>{const before=await persisted();await fn();assert.deepEqual(await persisted(),before,'refused partner request changes nothing')}
  await refused(()=>post(key,{contextVersion:ctx.contextVersion,week:'2026-10-12',shifts:[shift(foreign)]},crypto.randomUUID(),403))
  await refused(()=>post(key,{contextVersion:ctx.contextVersion,week:'2026-10-12',shifts:[shift(alex,'West')]},crypto.randomUUID(),403))
  await refused(()=>post(key,{contextVersion:ctx.contextVersion,week:'2026-10-12',shifts:[shift()]},crypto.randomUUID(),404,'v2'))
  for(const route of ['/api/lanyard/agent/context','/api/lanyard/agent/fairness/compare?site=East&week=2026-10-12','/api/lanyard/state'])assert.equal((await h.send(route,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
  for(const name of ['roster.prepare','time.prepare','payroll.prepare','roster.publish'])assert.equal((await h.send('/api/lanyard/agent/command',{name,input:{}},'',{authorization:`Bearer ${key.token}`})).status,401)
  const request=await body(key),identity=crypto.randomUUID(),results=await Promise.all([post(key,request,identity),post(key,request,identity)])
  assert.deepEqual(results[0],results[1]);const draft=results[0].result
  assert.equal(draft.status,'draft');assert.equal(draft.approvalRequired,'roster.publish');assert.deepEqual(draft.conflicts,[])
  for(const value of [alex.email,alex.payrollId,'rateBasis','2347','costCents','policyWarnings'])assert.ok(!JSON.stringify(draft).includes(value),value)
  const prepared=await h.state();assert.equal(prepared.rosters.length,1);assert.equal(prepared.shifts.filter(s=>s.status==='draft').length,1)
  for(const kind of ['timesheets','batches'])assert.deepEqual(prepared[kind],protectedBefore[kind])
  assert.deepEqual((await h.db.prepare('SELECT * FROM l_payroll_claims').all()).results,claimsBefore)
  assert.deepEqual((await h.state(alex.cookie)).shifts,[],'preparation never publishes')
  await h.restart();await refused(async()=>assert.deepEqual(await post(key,request,identity),results[0]))
  await refused(()=>post(key,JSON.stringify(request)+' ',identity,409))
  await refused(()=>post(key,{...request,shifts:[{...shift(),end:'2026-10-12T17:00:00Z'}]},identity,409))
  await refused(()=>post(key,request,crypto.randomUUID(),409))
  const published=await h.cmd('roster.publish',pin(draft));assert.equal(published.status,'published')
  assert.deepEqual((await h.state(alex.cookie)).shifts.map(s=>[s.start,s.end,s.breakMinutes]),[['2026-10-12T08:00:00.000Z','2026-10-12T16:00:00.000Z',30]])
  await h.db.prepare('UPDATE l_staff SET erased_at=? WHERE id=?').bind('2026-10-12T17:00:00Z',alex.id).run()
  await refused(()=>post(key,request,identity,403));assert.ok(!(await context(key)).staff.some(p=>p.id===alex.id),'erasure fences context and saved responses')
  await h.db.prepare('UPDATE l_staff SET erased_at=NULL WHERE id=?').bind(alex.id).run()
  const otherKey=await create();await refused(()=>post(otherKey,request,identity,409))
  const replace=await h.cmd('roster.prepare',{week:'2026-10-12',shifts:[shift(),shift(foreign)]})
  await h.cmd('roster.publish',pin(replace))
  await refused(async()=>post(key,await body(key),crypto.randomUUID(),403))
  const foreignDraft=await h.cmd('roster.prepare',{week:'2026-10-19',shifts:[{...shift(foreign),start:'2026-10-19T08:00:00Z',end:'2026-10-19T16:00:00Z'}]})
  await refused(async()=>post(key,await body(key,[{...shift(),start:'2026-10-19T08:00:00Z',end:'2026-10-19T16:00:00Z'}],'2026-10-19'),crypto.randomUUID(),403))
  assert.equal((await h.state()).rosters.find(r=>r.id===foreignDraft.id).revision,foreignDraft.revision)
  // Foreign unassigned coverage is protected even without a linked roster or assigned staff.
  const open=async(site,date)=>h.cmd('openshift.post',{site,position:'Service',start:date+'T08:00:00Z',end:date+'T16:00:00Z',breakMinutes:30,label:'synthetic-lanyard-8',approval:'manager'})
  const foreignOpen=await open('West','2026-11-02')
  await refused(async()=>post(key,await body(key,[{...shift(),start:'2026-11-02T08:00:00Z',end:'2026-11-02T16:00:00Z'}],'2026-11-02'),crypto.randomUUID(),403))
  assert.equal((await h.state()).openshifts.find(o=>o.id===foreignOpen.id).status,'open')
  const foreignTemplate=await h.cmd('template.save',{name:'synthetic-lanyard-9',week:'2026-11-02'})
  const openDraft=await h.cmd('template.apply',{id:foreignTemplate.id,week:'2026-11-09'})
  assert.equal(openDraft.shifts.length,0);assert.equal(openDraft.openShifts.length,1)
  await refused(async()=>post(key,await body(key,[{...shift(),start:'2026-11-09T08:00:00Z',end:'2026-11-09T16:00:00Z'}],'2026-11-09'),crypto.randomUUID(),403))
  const beforeRestart=await persisted();await h.restart()
  await refused(async()=>post(key,await body(key,[{...shift(),start:'2026-11-09T08:00:00Z',end:'2026-11-09T16:00:00Z'}],'2026-11-09'),crypto.randomUUID(),403))
  assert.deepEqual(await persisted(),beforeRestart,'foreign open coverage and its private draft survive restart unchanged')
  // The narrower grant still allows its own cafe to retain open coverage through human publication.
  await open('East','2026-11-16')
  const ownTemplate=await h.cmd('template.save',{name:'synthetic-lanyard-10',week:'2026-11-16'})
  const ownOpenDraft=await h.cmd('template.apply',{id:ownTemplate.id,week:'2026-11-23'})
  const ownRequest=await body(key,[{...shift(),start:'2026-11-23T08:00:00Z',end:'2026-11-23T16:00:00Z'}],'2026-11-23'),ownIdentity=crypto.randomUUID()
  const ownDraft=(await post(key,ownRequest,ownIdentity)).result
  assert.deepEqual(ownDraft.conflicts,[]);assert.equal(ownDraft.revision,ownOpenDraft.revision+1)
  const coverage=(await h.state()).openshifts.filter(o=>o.week==='2026-11-23'&&o.status==='draft')
  assert.equal(coverage.length,1);assert.equal(coverage[0].site,'East');assert.equal(coverage[0].minutes,450)
  assert.deepEqual((await h.state(alex.cookie)).openshifts.filter(o=>o.week==='2026-11-23'),[],'partner preparation cannot publish open coverage')
  const publication=await h.cmd('roster.publish',pin(ownDraft));assert.equal(publication.status,'published')
  const finalCoverage=(await h.state()).openshifts.filter(o=>o.week==='2026-11-23'&&o.status==='open')
  assert.equal(finalCoverage.length,1);assert.equal(finalCoverage[0].minutes,450)
  await h.restart();await refused(async()=>assert.equal((await post(key,ownRequest,ownIdentity)).result.id,ownDraft.id))
  for(const column of ['expires_at','scope','api_version','owner_version','site']){
   const original=await h.db.prepare(`SELECT ${column} AS value FROM l_partner_keys WHERE id=?`).bind(key.id).first(),values={expires_at:1,scope:'time.prepare',api_version:'v2',owner_version:-1,site:'West'}
   await h.db.prepare(`UPDATE l_partner_keys SET ${column}=? WHERE id=?`).bind(values[column],key.id).run()
   await refused(()=>post(key,request,identity,column==='site'?403:401))
   await h.db.prepare(`UPDATE l_partner_keys SET ${column}=? WHERE id=?`).bind(original.value,key.id).run()
  }
  const currentPerson=(await h.state()).staff.find(p=>p.id===alex.id)
  await h.cmd('staff.save',{...pin(currentPerson),name:currentPerson.name,email:currentPerson.email,payrollId:currentPerson.payrollId,role:'staff',active:false,site:'East'})
  await refused(()=>post(key,request,identity,403))
  await h.cmd('staff.save',{...pin({...currentPerson,revision:currentPerson.revision+1}),name:currentPerson.name,email:currentPerson.email,payrollId:currentPerson.payrollId,role:'staff',active:true,site:'East'})
  const rotateRequest=crypto.randomUUID(),rotated=await h.cmd('partner.rotate',{id:key.id,requestId:rotateRequest})
  assert.ok(rotated.token&&rotated.token!==key.token);assert.equal(rotated.site,key.site)
  assert.equal((await h.cmd('partner.rotate',{id:key.id,requestId:rotateRequest})).token,undefined,'refresh cannot recover a token')
  await context(key,401);await refused(()=>post(key,request,identity,401));await context(rotated)
  const rows=(await h.db.prepare('SELECT * FROM l_partner_keys').all()).results
  for(const row of rows)for(const token of [key.token,rotated.token])assert.ok(!JSON.stringify(row).includes(token),'clear credential never persisted')
  await h.cmd('partner.revoke',{id:rotated.id});await context(rotated,401)
  
  const ownerKey=await create(),ownerRequest=await body(ownerKey,[{...shift(),start:'2026-10-26T08:00:00Z',end:'2026-10-26T16:00:00Z'}],'2026-10-26'),ownerIdentity=crypto.randomUUID()
  await post(ownerKey,ownerRequest,ownerIdentity);
  await h.db.prepare('UPDATE oa_operators SET version=version+1 WHERE id=(SELECT owner_id FROM l_partner_keys WHERE id=?)').bind(ownerKey.id).run()
  await context(ownerKey,401);await refused(()=>post(ownerKey,ownerRequest,ownerIdentity,401))
 }finally{await h.close()}
}

export async function partnerBrowser(width=1440){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   await fixture(h)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const p=new URL(route.request().url()).pathname;if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage();page.setDefaultTimeout(15000)
   await page.goto(h.origin+'/app/settings',{waitUntil:'networkidle'})
   const card=page.locator('#partner-access')
   await card.getByLabel('Partner credential label').fill('synthetic-lanyard-7');await card.getByLabel('Cafe',{exact:true}).selectOption('East')
   await card.getByRole('button',{name:'Create partner credential',exact:true}).click();await page.waitForLoadState('networkidle')
   const token=await page.locator('.credential').innerText()
   const raw=await h.send(path+'/context',undefined,'',{authorization:`Bearer ${token}`});assert.equal(raw.status,200,raw.text);assert.equal(raw.value.site,'East')
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.credential').count(),0,'clear credential vanishes on reload')
   const row=card.locator('tbody tr').filter({hasText:'synthetic-lanyard-7'});await row.getByRole('button',{name:'Rotate credential',exact:true}).click();await page.waitForLoadState('networkidle')
   const rotated=await page.locator('.credential').innerText();assert.notEqual(rotated,token)
   assert.equal((await h.send(path+'/context',undefined,'',{authorization:`Bearer ${token}`})).status,401)
   assert.equal((await h.send(path+'/context',undefined,'',{authorization:`Bearer ${rotated}`})).status,200)
   await page.goto(h.origin+'/app/settings',{waitUntil:'networkidle'})
   await card.locator('tbody tr').filter({hasText:'Active'}).getByRole('button',{name:'Revoke credential',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal((await h.send(path+'/context',undefined,'',{authorization:`Bearer ${rotated}`})).status,401)
   assert.equal(await card.locator('tbody tr').filter({hasText:'Revoked'}).count(),2)
   await card.scrollIntoViewIfNeeded();await iconTooltips(page)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   assert.ok(await card.locator('label,button,p,td').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=13)))
   if(process.env.PARTNER_SCREENS){await mkdir(process.env.PARTNER_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.PARTNER_SCREENS,`partner-settings-${width}.png`),fullPage:false})}
  }finally{await context.close();await h.close()}
 }finally{await browser.close()}
}

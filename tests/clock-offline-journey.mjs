// CLOCK-002 through the real native session, page, encrypted browser storage and HTTP doors.
import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
export async function offlineJourney() {
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']})
 try {
  const alex=await h.person('Alex'),priya=await h.person('Priya','manager')
  for(const person of [alex,priya])await h.cmd('staff.save',{id:person.id,revision:person.revision,name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:true,site:'Ocean Beach'})
  await h.cmd('photo.save',{site:'Ocean Beach',native:true,breaks:true,retentionDays:30,consent:true})
  await h.cmd('roundrule.save',{site:'Ocean Beach',from:'2026-10-01',method:'nearest',increment:15,apply:'capture'})
  await h.cmd('roundrule.save',{site:'Ocean Beach',from:'2026-10-13',method:'nearest',increment:5,apply:'capture'})
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:390,height:1000},permissions:['camera']})
  context.setDefaultTimeout(20000)
  const [name,...value]=alex.cookie.split('=')
  await context.addCookies([{name,value:value.join('='),url:h.origin}])
  let disconnected=true
  await context.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname
   if(path==='/api/lanyard/command'&&disconnected)return route.abort('internetdisconnected')
   if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js')) {
    try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
   }
   await route.continue()
  })
  let page=await context.newPage()
  const open=async()=>{await page.goto(h.origin+'/app/time?week=2026-10-12',{waitUntil:'networkidle'});await page.locator('[data-clock-form] button[type=submit]').first().waitFor({state:'visible'})}
  await open()
  await context.setOffline(true)
  const capture=async(at,label)=>{await page.clock.setFixedTime(new Date(at));await page.getByLabel("I have read this site's photo notice").check();await page.getByLabel('I consent to a still photo for this punch').check();await page.getByRole('button',{name:label,exact:true}).click()}
  await capture('2026-10-12T14:07:00Z','Clock in')
  await page.getByRole('button',{name:'Start meal break',exact:true}).waitFor()
  await capture('2026-10-12T18:00:00Z','Start meal break')
  await page.getByRole('button',{name:'End meal break',exact:true}).waitFor()
  await page.close()
  await h.restart()
  await context.setOffline(false)
  page=await context.newPage();await open()
  await capture('2026-10-12T18:30:00Z','End meal break')
  await page.getByRole('button',{name:'Clock out',exact:true}).waitFor()
  await capture('2026-10-12T22:08:00Z','Clock out')
  await page.waitForFunction(()=>document.querySelectorAll('[data-clock-events] li').length===4)
  const encrypted=await page.evaluate(async()=>{
   const actor=document.querySelector('[data-clock]').dataset.actor
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(`lanyard.clock.outbox.${actor}`);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
   try {const tx=db.transaction('vault'),store=tx.objectStore('vault'),read=k=>new Promise((resolve,reject)=>{const r=store.get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
    const [key,sealed]=await Promise.all([read('key'),read('state')]);return {extractable:key.extractable,plain:new TextDecoder().decode(sealed.data),bytes:sealed.data.byteLength}
   }finally{db.close()}
  })
  assert.equal(encrypted.extractable,false);assert.ok(encrypted.bytes>0);assert.ok(!encrypted.plain.includes('capturedAt'));assert.ok(!encrypted.plain.includes('/9j/'))
  assert.equal((await h.state(alex.cookie)).clocks.length,0,'offline captures do not pretend server acceptance')
  // Look at the pending state in both widths with realistic originals retained.
  if(process.env.CLOCK_SCREENS)await mkdir(process.env.CLOCK_SCREENS,{recursive:true})
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   if(process.env.CLOCK_SCREENS)await page.screenshot({path:join(process.env.CLOCK_SCREENS,`pending-${width}.png`),fullPage:true})
   assert.ok(await page.locator('[data-clock]').isVisible())
  }
  disconnected=false
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:/Retry queued clock/}).click()])
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent==='0 pending · 0 unresolved')
  const saved=await h.state(alex.cookie),time=saved.timesheets[0]
  assert.equal(saved.clocks.length,1,JSON.stringify({clocks:saved.clocks,timesheets:saved.timesheets,issues:saved.clockissues}));assert.equal(time.minutes,465);assert.equal(time.breakMinutes,30)
  assert.equal(time.rounding.increment,15);assert.equal(time.start,'2026-10-12T14:07:00.000Z')
  assert.equal(time.end,'2026-10-12T22:08:00.000Z')
  assert.equal(saved.clocks[0].breaks.length,1)
  assert.equal(saved.photoreceipts.length,4);assert.ok(saved.photoreceipts.every(r=>r.photoId&&r.photoConsent&&!r.photoException),'all clock and timed-break stills survive page and Worker restart')
  assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_kiosk_photos').first()).n,4)
  assert.ok(saved.clocks[0].breaks[0].receivedAt>saved.clocks[0].breaks[0].start)
  await page.getByText('Clock history',{exact:true}).click()
  await page.getByText('Capture receipts',{exact:true}).click()
  const receiptTimes=await page.locator('.clock-list time').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('datetime')))
  for(const receipt of [saved.clocks[0].receivedAt,saved.clocks[0].closedReceivedAt,saved.clocks[0].breaks[0].receivedAt,saved.clocks[0].breaks[0].endReceivedAt])assert.ok(receiptTimes.includes(receipt))
  assert.ok(saved.clocks[0].receivedAt>saved.clocks[0].start)
  await page.reload({waitUntil:'networkidle'})
  assert.equal((await h.state(alex.cookie)).timesheets.length,1,'reopening cannot duplicate accepted work')
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   if(process.env.CLOCK_SCREENS)await page.screenshot({path:join(process.env.CLOCK_SCREENS,`synced-${width}.png`),fullPage:true})
  }
  // Clock skew is retained and reaches the manager as an explicitly unresolved report.
  disconnected=true
  await capture('2030-10-12T14:00:00Z','Clock in')
  await page.waitForFunction(()=>document.querySelectorAll('[data-clock-events] li').length===1)
  disconnected=false
  await page.getByRole('button',{name:/Retry queued clock/}).click()
  await page.waitForFunction(()=>document.querySelector('[data-clock-events]').textContent.includes('Reported for manager review'))
  assert.equal((await h.state(priya.cookie)).clockissues.length,1)
  assert.equal((await h.state(alex.cookie)).clocks.length,1)
  page.once('dialog',d=>d.accept())
  await page.getByRole('button',{name:'Discard local copy',exact:true}).click()
  await page.waitForFunction(()=>document.querySelectorAll('[data-clock-events] li').length===0)
  // Revocation prevents both applying time and reporting under the revoked authority.
  disconnected=true
  await capture('2026-10-13T14:00:00Z','Clock in')
  await page.waitForFunction(()=>document.querySelectorAll('[data-clock-events] li').length===1)
  await h.cmd('staff.save',{id:alex.id,revision:2,name:alex.name,email:alex.email,payrollId:'ALEX',role:'staff',active:false,site:'Ocean Beach'})
  disconnected=false
  // Access was revoked while the employee was offline: no employee retry precedes manager sign-in.
  await h.cmd('clock.in',{commandId:'revoked-direct',capturedAt:'2026-10-13T14:00:00Z'},alex.cookie,403)
  assert.equal((await h.state()).clocks.length,1)
  assert.equal((await h.state()).clockissues.length,1)
  // The next manager sign-in sees only a count until they submit the originals for review.
  const [managerCookieName,...managerCookieValue]=priya.cookie.split('=')
  await context.addCookies([{name:managerCookieName,value:managerCookieValue.join('='),url:h.origin}])
  await page.close();page=await context.newPage();await open()
  const recoveryNotice=page.locator('[data-clock-recovery]')
  await recoveryNotice.waitFor()
  const noticeText=await recoveryNotice.innerText()
  assert.equal(Number((await recoveryNotice.locator('[data-clock-recovery-count]').innerText()).match(/\d+/)?.[0]),1)
  assert.ok(!noticeText.includes('2026-10-13'));assert.ok(!noticeText.includes('Alex'))
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   if(process.env.CLOCK_SCREENS)await page.screenshot({path:join(process.env.CLOCK_SCREENS,`recovery-${width}.png`),fullPage:true})
  }
  await recoveryNotice.getByRole('button',{name:'Submit unsynced punches for review',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[data-clock-recovery]').textContent.includes('submitted for review'))
  assert.equal((await h.state()).clocks.length,1,'manager recovery never applies captured time')
  const reports=(await h.state(priya.cookie)).clockissues
  assert.equal(reports.length,2)
  assert.ok(reports.every(r=>!('photo' in r.capture.input)&&!('photoConsent' in r.capture.input)),'rejected and revoked capture reports contain punch facts, never image bytes or consent metadata')
  assert.ok(reports.some(r=>r.capture.input.capturedAt==='2026-10-13T14:00:00.000Z'&&r.status==='unresolved'))
  await h.cmd('staff.save',{id:alex.id,revision:3,name:alex.name,email:alex.email,payrollId:'ALEX',role:'staff',active:true,site:'Ocean Beach'})
  await context.addCookies([{name,value:value.join('='),url:h.origin}])
  await page.close();page=await context.newPage();await open()
  await page.waitForFunction(()=>document.querySelector('[data-clock-events]').textContent.includes('Unresolved'))
  assert.equal((await h.state()).clocks.length,1,'a manager-reviewed original never replays after reactivation')
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   if(process.env.CLOCK_SCREENS)await page.screenshot({path:join(process.env.CLOCK_SCREENS,`unresolved-${width}.png`),fullPage:true})
  }
  const managerContext=await browser.newContext(),[managerName,...managerValue]=priya.cookie.split('=')
  await managerContext.addCookies([{name:managerName,value:managerValue.join('='),url:h.origin}])
  await managerContext.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname
   if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
   await route.continue()
  })
  const managerPage=await managerContext.newPage();await managerPage.goto(h.origin+'/app/time?week=2026-10-12',{waitUntil:'networkidle'})
  for(const width of [1440,390]){
   await managerPage.setViewportSize({width,height:1000})
   if(process.env.CLOCK_SCREENS)await managerPage.screenshot({path:join(process.env.CLOCK_SCREENS,`manager-${width}.png`),fullPage:true})
   assert.ok(await managerPage.locator('#offline-review').isVisible())
  }
  await managerContext.close()
  // Signing out from another page still warns about this actor's durable originals.
  await page.goto(h.origin+'/app/schedule',{waitUntil:'networkidle'})
  await page.locator('details.me summary').click()
  page.once('dialog',async d=>{assert.match(d.message(),/saved clock event/);await d.dismiss()})
  await page.locator('[data-signout]').click()
  await page.waitForFunction(()=>!document.querySelector('[data-signout]').disabled)
  assert.equal((await h.state(alex.cookie)).clockissues.length,2)
  page.once('dialog',d=>d.accept())
  await page.locator('[data-signout]').click()
  await page.waitForURL('**/signin')
  const dbs=await page.evaluate(()=>indexedDB.databases())
  assert.ok(!dbs.some(d=>d.name===`lanyard.clock.outbox.${saved.actor.id}`))
  await context.close()
  console.log('CLOCK-002: offline clock/meal, page restart, ordered reconciliation and capture-date rounding passed')
 } finally {await browser.close();await h.close()}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await offlineJourney()

// MOBILE-001 and MOBILE-002: one phone workflow through current native-session doors.
export async function mobileJourney() {
 const initial='2026-10-28T16:00:00Z',h=await harness({now:initial})
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 let now=initial,context
 const pin=r=>({id:r.id,revision:r.revision})
 try {
  await h.cmd('settings.save',{timezone:'UTC'})
  const people=[]
  for(let n=1;n<=7;n++)people.push(await h.person(`synthetic-lanyard-${n}`,n===6?'manager':'staff'))
  const [alex,ben,cy,dee,eve,manager,foreign]=people
  for(const p of people)await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:'Counter'})
  for(const p of [alex,ben,foreign])await h.cmd('availability.save',{staffId:p.id,start:'2026-10-26T00:00:00Z',end:'2026-11-02T00:00:00Z'})
  const draft=await h.cmd('roster.prepare',{week:'2026-10-26',shifts:[alex,foreign].map(p=>({staffId:p.id,site:p===foreign?'Mission':'Ocean Beach',start:'2026-10-28T17:00:00Z',end:'2026-10-28T20:00:00Z',breakMinutes:0}))})
  assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft))
  await h.cmd('attendrule.save',{site:'Ocean Beach',graceMinutes:5,noShowMinutes:30})
  const sheets=[]
  for(const p of [alex,cy,dee,eve,foreign])sheets.push(await h.cmd('time.prepare',{staffId:p.id,start:'2026-10-26T14:00:00Z',end:'2026-10-26T16:00:00Z',breakMinutes:0,reason:'Recorded opening work'}))
  const [clean,edit,bulk,stale,foreignTime]=sheets
  await h.cmd('availability.policy',{requireApproval:true})
  const pickup=await h.cmd('openshift.post',{site:'Ocean Beach',position:'Counter',start:'2026-10-30T17:00:00Z',end:'2026-10-30T20:00:00Z',breakMinutes:0,approval:'manager'})
  const foreignLeave=await h.cmd('leave.request',{start:'2026-10-31T00:00:00Z',end:'2026-11-01T00:00:00Z',reason:'Foreign private request'},foreign.cookie)
  const foreignPattern=await h.cmd('pattern.save',{from:'2026-11-02',blocks:'Mon available 00:00-24:00'},foreign.cookie)
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  context=await browser.newContext({viewport:{width:390,height:1000}})
  let holdEdit,releaseEdit,dropEdit=false,editRequests=0
  await context.route('**/*',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname
   if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
   if(path==='/app/action'&&request.url().includes('name=time.edit')){
    editRequests++
    if(holdEdit)await holdEdit
    if(dropEdit){await route.fetch({headers:{...request.headers(),'x-test-now':String(Date.parse(now))}});return route.abort('internetdisconnected')}
   }
   await route.continue({headers:{...request.headers(),'x-test-now':String(Date.parse(now))}})
  })
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const sign=async p=>{await context.clearCookies();const [name,...value]=p.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
  const open=async path=>{await page.goto(h.origin+path,{waitUntil:'networkidle'});await page.clock.setFixedTime(new Date(now))}
  const saved=async()=>{await page.locator('.notice[role=status]').filter({hasText:'Saved.'}).waitFor();await page.waitForFunction(()=>document.querySelector('.notice[role=status]')===document.activeElement)}
  const screens=async label=>{
   if(!process.env.MOBILE_SCREENS)return
   await mkdir(process.env.MOBILE_SCREENS,{recursive:true})
   for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:join(process.env.MOBILE_SCREENS,`${label}-${width}.png`),fullPage:true})}
   await page.setViewportSize({width:390,height:1000})
  }
  await sign(alex);await open('/app/schedule?week=2026-10-26&day=wed')
  assert.ok((await page.locator('#team-view').innerText()).includes(alex.name));assert.ok(!(await page.locator('#team-view').innerText()).includes(foreign.name))
  await page.keyboard.press('Tab');assert.equal(await page.getByRole('link',{name:'Skip to content'}).evaluate(n=>n===document.activeElement),true)
  await page.keyboard.press('Enter');assert.equal(await page.locator('#main').evaluate(n=>n===document.activeElement),true)
  await page.getByText('Swap one of your shifts',{exact:true}).click()
  const propose=page.locator('form[action*="name=swap.propose"]')
  await propose.locator('[name=to]').selectOption(ben.id);await propose.getByLabel('Message (optional)').fill('Training cover')
  await context.setOffline(true);await propose.getByRole('button',{name:'Propose swap'}).click()
  await propose.getByRole('status').filter({hasText:'Offline. Not sent.'}).waitFor()
  assert.equal(await propose.getByLabel('Message (optional)').inputValue(),'Training cover')
  assert.equal((await h.state()).swaps.length,0)
  await screens('employee-unsent')
  await context.setOffline(false);await propose.getByRole('button',{name:'Propose swap'}).click();await saved()
  await sign(ben);await open('/app/schedule?week=2026-10-26&day=wed');await page.getByRole('button',{name:'Agree',exact:true}).click();await saved()
  await page.getByText('Set a weekly pattern',{exact:true}).click()
  const patternForm=page.locator('form[action*="name=pattern.save"]')
  await patternForm.getByLabel('Starts on',{exact:true}).fill('2026-11-02');await patternForm.getByLabel('Weekly blocks, one per line').fill('Mon available 09:00-17:00')
  await patternForm.getByRole('button',{name:'Save pattern'}).click();await saved()
  assert.equal((await h.state(ben.cookie)).patterns[0].status,'pending')
  await page.getByText('Request time off',{exact:true}).first().click()
  const leaveForm=page.locator('form[action*="name=leave.request"]')
  await leaveForm.getByLabel('Time off starts').fill('2026-10-31T00:00');await leaveForm.getByLabel('Time off ends').fill('2026-11-01T00:00');await leaveForm.getByLabel('Reason',{exact:true}).fill('Family day')
  await leaveForm.getByRole('button',{name:'Request time off',exact:true}).click();await saved()
  await page.locator('#open-shifts').getByRole('button',{name:'Request',exact:true}).click();await saved()
  assert.equal((await h.state(ben.cookie)).pickups[0].status,'requested')
  await sign(manager);await open('/app/schedule?week=2026-10-26&day=wed')
  await page.getByRole('button',{name:'Approve swap',exact:true}).click();await saved()
  assert.equal((await h.state()).swaps[0].status,'approved')
  const decide=async(command,id)=>{const form=page.locator(`form[action*="name=${command}"]`).filter({has:page.locator(`input[name=id][value="${id}"]`)});await form.getByRole('button',{name:'Approve',exact:true}).click();await saved()}
  const pending=await h.state(ben.cookie)
  await decide('leave.decide',pending.leave[0].id)
  await decide('pattern.decide',pending.patterns[0].id)
  await page.locator('form[action*="name=openshift.approve"]').getByRole('button',{name:`Approve ${ben.name}`,exact:true}).click();await saved()
  const decisions=await h.state(ben.cookie)
  assert.equal(decisions.leave[0].status,'approved');assert.equal(decisions.patterns[0].status,'approved');assert.equal(decisions.pickups[0].status,'approved')
  assert.ok(decisions.shifts.some(x=>x.openShiftId===pickup.id&&x.staffId===ben.id))
  assert.ok(!(await page.locator('#time-off').innerText()).includes('Foreign private request'))
  assert.ok(!(await page.locator('#availability').innerHTML()).includes(foreignPattern.id))
  const beforeForeign=await h.state()
  await h.cmd('leave.decide',{...pin(foreignLeave),decision:'approved'},manager.cookie,403)
  await h.cmd('pattern.decide',{...pin(foreignPattern),decision:'approved'},manager.cookie,403)
  assert.equal((await h.state()).version,beforeForeign.version)
  await sign(ben);await open('/app/schedule?week=2026-10-26&day=wed')
  const shift=page.locator('.wk-cell[data-day=wed] details.shift').first()
  await shift.locator('summary').click();await shift.getByText('Confirmed ✓',{exact:true}).waitFor()
  const current=(await h.state(ben.cookie)).shifts.find(x=>x.status==='published')
  assert.equal(current.staffId,ben.id);assert.ok(current.confirmedAt)
  now='2026-10-28T17:15:00Z'
  await sign(manager);await open('/app/time?week=2026-10-26')
  await page.locator('#attendance li').filter({hasText:ben.name}).filter({hasText:'Late'}).waitFor()
  assert.ok(!(await page.locator('#attendance').innerText()).includes(foreign.name))
  assert.ok(!(await page.locator('#approve').innerHTML()).includes(foreignTime.id))
  const foreignBefore=await h.state()
  for(const [name,input] of [['time.approve',pin(foreignTime)],['time.edit',{...pin(foreignTime),start:foreignTime.start,end:foreignTime.end,breakMinutes:0,reason:'Outside scope'}],['time.prepare',{staffId:foreign.id,start:'2026-10-27T14:00:00Z',end:'2026-10-27T16:00:00Z',breakMinutes:0,reason:'Outside scope'}]])await h.cmd(name,input,manager.cookie,403)
  assert.equal((await h.state()).version,foreignBefore.version)
  const beforeRefresh=await h.state()
  await context.setOffline(true);await page.getByRole('link',{name:'Refresh attendance',exact:true}).click()
  await page.locator('[data-attendance-status]').filter({hasText:'Attendance could not be updated.'}).waitFor()
  await page.locator('#attendance li').filter({hasText:ben.name}).filter({hasText:'Late'}).waitFor()
  await context.setOffline(false)
  await sign(ben)
  const employee=await context.newPage();await employee.goto(h.origin+'/app/time?week=2026-10-26',{waitUntil:'networkidle'});await employee.clock.setFixedTime(new Date(now))
  await employee.getByRole('button',{name:'Clock in',exact:true}).click()
  await employee.getByRole('button',{name:'Clock out',exact:true}).waitFor()
  await employee.waitForFunction(()=>document.querySelector('[data-clock-status]').textContent==='0 pending · 0 unresolved')
  await employee.close();await sign(manager)
  await page.getByRole('link',{name:'Refresh attendance',exact:true}).click()
  await page.locator('#attendance li').filter({hasText:ben.name}).filter({hasText:'Present'}).waitFor()
  assert.equal((await h.state()).clocks.length,beforeRefresh.clocks.length+1)
  assert.equal(await page.locator('[data-attendance-status]').evaluate(n=>n===document.activeElement),true)
  await screens('manager-attendance')
  const row=t=>page.locator('#approve tr').filter({has:page.locator(`input[name=id][value="${t.id}"]`)})
  await row(clean).getByRole('button',{name:'Approve',exact:true}).click();await saved()
  assert.equal((await h.state()).timesheets.find(t=>t.id===clean.id).status,'approved')
  await h.cmd('time.edit',{...pin(stale),start:stale.start,end:'2026-10-26T16:15:00Z',breakMinutes:0,reason:'New reviewed source'})
  const beforeStale=await h.state()
  await row(stale).getByRole('button',{name:'Approve',exact:true}).click()
  await row(stale).getByRole('status').filter({hasText:/changed/i}).waitFor()
  assert.equal((await h.state()).version,beforeStale.version,'stale mobile approval writes nothing')
  assert.equal(await row(stale).getByRole('status').evaluate(n=>n===document.activeElement),true)
  await row(stale).getByRole('link',{name:'Review current records'}).click();await page.waitForLoadState('networkidle')
  await row(edit).getByText('Edit',{exact:true}).click()
  let editForm=row(edit).locator('form[action*="name=time.edit"]')
  await editForm.getByLabel('Work ends').fill('2026-10-26T16:30');await editForm.getByLabel('Reason',{exact:true}).fill('Checked closing log')
  holdEdit=new Promise(resolve=>{releaseEdit=resolve})
  await editForm.getByRole('button',{name:'Save edit'}).click()
  await editForm.getByRole('status').filter({hasText:'Saving.'}).waitFor()
  assert.equal(await editForm.getAttribute('aria-busy'),'true');assert.equal(await editForm.getByRole('button',{name:'Save edit'}).isDisabled(),true)
  releaseEdit();holdEdit=null;await saved()
  let stored=(await h.state()).timesheets.find(t=>t.id===edit.id)
  assert.equal(stored.minutes,150);assert.equal(stored.captured.minutes,120);assert.equal(stored.edited.reason,'Checked closing log');assert.equal(editRequests,1)
  // A response lost after the server saved must never be called unsent or retried automatically.
  await row(edit).getByText('Edit',{exact:true}).click();editForm=row(edit).locator('form[action*="name=time.edit"]')
  await editForm.getByLabel('Reason',{exact:true}).fill('Checked retained edit')
  dropEdit=true;await editForm.getByRole('button',{name:'Save edit'}).click()
  await editForm.getByRole('status').filter({hasText:'Save not confirmed.'}).waitFor()
  assert.equal(await editForm.getByLabel('Reason',{exact:true}).inputValue(),'Checked retained edit')
  assert.equal(await editForm.getByRole('button',{name:'Save edit'}).isDisabled(),true)
  stored=(await h.state()).timesheets.find(t=>t.id===edit.id);assert.equal(stored.revision,3);assert.equal(editRequests,2)
  dropEdit=false;await screens('manager-unconfirmed-save')
  await editForm.getByRole('link',{name:'Review current records'}).click();await page.waitForLoadState('networkidle')
  await page.getByText('Filter and approve many',{exact:true}).click()
  await page.getByRole('button',{name:'Approve 3 shown',exact:true}).click();await saved()
  await page.getByRole('status').filter({hasText:'Approved 3 · skipped 0'}).waitFor()
  const end=await h.state()
  for(const sheet of [clean,edit,bulk,stale])assert.equal(end.timesheets.find(t=>t.id===sheet.id).status,'approved')
  assert.deepEqual(end.timesheets.find(t=>t.id===foreignTime.id),beforeStale.timesheets.find(t=>t.id===foreignTime.id))
  assert.equal((await h.send('/api/lanyard/attendance?site=Mission',undefined,manager.cookie)).value.rows.length,0)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  const account=page.locator('summary[aria-label=Account]');await account.focus();await page.getByRole('tooltip',{name:'Account menu'}).waitFor()
  await page.locator('h1').click();await screens('manager-approved')
  await sign(alex);await open('/app/time?week=2026-10-26')
  const earnings=page.locator('#earnings tr').filter({has:page.getByRole('rowheader',{name:'Regular (approved)',exact:true})})
  assert.equal(Number.parseFloat(await earnings.locator('td').first().innerText()),2)
  assert.ok(!(await page.locator('#main').innerHTML()).includes(foreignTime.id))
  await sign(ben);await open('/app/schedule?week=2026-10-26&day=2026-10-30')
  const friday=page.locator('.wk-cell[data-day=fri] details.shift').first()
  await friday.locator('summary').click();await friday.getByLabel('Note for your manager (optional)').fill('Need a replacement')
  await friday.getByRole('button',{name:'I can’t make this shift',exact:true}).click();await saved()
  await sign(alex);await open('/app/schedule?week=2026-10-26&day=2026-10-30')
  await page.getByRole('button',{name:'Accept',exact:true}).click();await saved()
  const offer=(await h.send('/api/lanyard/state',undefined,alex.cookie,{'x-test-now':String(Date.parse(now))})).value.offers.find(o=>o.status==='accepted')
  assert.ok(offer,JSON.stringify((await h.state(alex.cookie)).offers.map(o=>({id:o.id,status:o.status}))))
  await sign(manager);await open(`/app/schedule?week=2026-10-26&day=2026-10-30&cover=${offer.shiftId}`)
  await page.locator('form[action*="name=cover.approve"]').getByRole('button',{name:`Approve ${alex.name}`,exact:true}).click();await saved()
  assert.equal((await h.state(alex.cookie)).shifts.find(x=>x.id===offer.shiftId).staffId,alex.id)
  // A later home-cafe move does not move the cafe retained on worked time.
  await h.cmd('staff.save',{id:foreign.id,revision:2,name:foreign.name,email:foreign.email,payrollId:foreign.payrollId,role:foreign.role,active:true,site:'Ocean Beach',position:'Counter'})
  await open('/app/time?week=2026-10-26')
  assert.ok(!(await page.locator('#main').innerHTML()).includes(foreignTime.id))
  const retainedBefore=await h.state()
  await h.cmd('time.approve',pin(foreignTime),manager.cookie,403)
  assert.equal((await h.state()).version,retainedBefore.version)
  assert.deepEqual(errors,[])
 }finally{await context?.close();await browser.close();await h.close()}
}

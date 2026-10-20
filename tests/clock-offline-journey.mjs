// CLOCK-002 through the real native session, page, encrypted browser storage and HTTP doors.
import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
export async function offlineJourney() {
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {
  const alex=await h.person('Alex'),priya=await h.person('Priya','manager')
  await h.cmd('roundrule.save',{site:'',from:'2026-10-01',method:'nearest',increment:15,apply:'capture'})
  await h.cmd('roundrule.save',{site:'',from:'2026-10-13',method:'nearest',increment:5,apply:'capture'})
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:390,height:1000}})
  context.setDefaultTimeout(20000)
  const [name,...value]=alex.cookie.split('=')
  await context.addCookies([{name,value:value.join('='),url:h.origin}])
  let disconnected=true
  await context.route('**/*',async route=>{
   const path=new URL(route.request().url()).pathname
   if(path==='/api/lanyard/command'&&disconnected)return route.abort('internetdisconnected')
   if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path==='/lanyard.js'||path==='/clock-outbox.js'||path==='/clock-recovery.js') {
    try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
   }
   await route.continue()
  })
  let page=await context.newPage()
  const open=async()=>{await page.goto(h.origin+'/app/time?week=2026-10-12',{waitUntil:'networkidle'});await page.locator('[data-clock-form] button[type=submit]').first().waitFor({state:'visible'})}
  await open()
  await context.setOffline(true)
  const capture=async(at,label)=>{await page.clock.setFixedTime(new Date(at));await page.getByRole('button',{name:label,exact:true}).click()}
  await capture('2026-10-12T14:07:00Z','Clock in')
  await page.getByRole('button',{name:'Start meal break',exact:true}).waitFor()
  await capture('2026-10-12T18:00:00Z','Start meal break')
  await page.getByRole('button',{name:'End meal break',exact:true}).waitFor()
  await page.close()
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
  assert.equal(encrypted.extractable,false);assert.ok(encrypted.bytes>0);assert.ok(!encrypted.plain.includes('capturedAt'))
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
  assert.ok(saved.clocks[0].breaks[0].receivedAt>saved.clocks[0].breaks[0].start)
  await page.getByText('Clock history',{exact:true}).click()
  await page.getByText('Capture receipts',{exact:true}).click()
  assert.match(await page.locator('.clock-list').innerText(),/received/)
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
  await h.cmd('staff.save',{id:alex.id,revision:1,name:alex.name,email:alex.email,payrollId:'ALEX',role:'staff',active:false})
  disconnected=false
  await page.getByRole('button',{name:/Retry queued clock/}).click()
  await page.waitForFunction(()=>document.querySelector('[data-clock-events]').textContent.includes('Unresolved'))
  assert.equal((await h.state()).clocks.length,1)
  assert.equal((await h.state()).clockissues.length,1)
  // The next manager sign-in sees only a count until they submit the originals for review.
  const [managerCookieName,...managerCookieValue]=priya.cookie.split('=')
  await context.addCookies([{name:managerCookieName,value:managerCookieValue.join('='),url:h.origin}])
  await page.close();page=await context.newPage();await open()
  const recoveryNotice=page.locator('[data-clock-recovery]')
  await recoveryNotice.waitFor()
  const noticeText=await recoveryNotice.innerText()
  assert.match(noticeText,/unsynced punches from a revoked session/i)
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
  assert.ok(reports.some(r=>r.capture.input.capturedAt==='2026-10-13T14:00:00.000Z'&&r.status==='unresolved'))
  await h.cmd('staff.save',{id:alex.id,revision:2,name:alex.name,email:alex.email,payrollId:'ALEX',role:'staff',active:true})
  await context.addCookies([{name,value:value.join('='),url:h.origin}])
  await page.close();page=await context.newPage();await open()
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

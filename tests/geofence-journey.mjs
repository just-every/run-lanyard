import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
export async function geofenceFixture(h){
 const alex=await h.person('Alex'),ben=await h.person('Ben'),lead=await h.person('Lead','manager')
 for(const p of [alex,ben,lead])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'Ocean Beach',hourlyRate:'20.00'})
 const policy={site:'Ocean Beach',latitude:37.76,longitude:-122.5,radiusMeters:200,maxAccuracyMeters:50,retentionDays:30,enabled:true,consent:true}
 const rule=await h.cmd('geofence.save',policy)
 const device=await h.send('/api/lanyard/command',{name:'clockbrowser.enroll',input:{site:policy.site,label:'Location phone',type:'phone'}},h.owner)
 assert.equal(device.status,200,device.text)
 const cookie=alex.cookie+'; '+device.cookie
 const capture=async(name,at,location,status=200,using=cookie)=>h.cmd(name,{commandId:crypto.randomUUID(),capturedAt:at,...(name==='clock.out'?{breakMinutes:0}:{}),...(location!==undefined?{location}:{})},using,status)
 const coords=at=>({latitude:37.76,longitude:-122.5,accuracyMeters:5,observedAt:at,consent:true,noticeSeen:true})
 const inside=await capture('clock.in','2025-06-01T16:00:00Z',coords('2025-06-01T16:00:00Z'))
 const outside=await capture('clock.out','2025-06-01T17:00:00Z',{...coords('2025-06-01T17:00:00Z'),longitude:-122.51})
 return {alex,ben,lead,policy,rule,device,cookie,capture,coords,inside,outside}
}
export async function geofenceApi(h){
 const f=await geofenceFixture(h),{alex,ben,lead,rule,cookie,capture,coords,inside,outside,device}=f
 const state=await h.state(),receipts=state.georeceipts
 assert.deepEqual(receipts.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)).map(r=>r.status),['inside geofence','out-of-zone punch'])
 assert.ok(outside.timesheet.exceptions.includes('out-of-zone punch'))
 const t=state.timesheets.find(t=>t.id===outside.timesheet.id);assert.equal(t.locationReview.length,2)
 assert.deepEqual((await h.cmd('time.approveMany',{items:[pin(t)]})).approved,[])
 assert.match((await h.cmd('time.approveMany',{items:[pin(t)]})).skipped[0].reason,/out-of-zone punch/)
 const source=receipts.find(r=>r.id===outside.locationReceiptId)
 await h.cmd('location.review',{...pin(source),reason:'Employee disputes the boundary; captured evidence retained'})
 const reviewed=(await h.state()).georeceipts.find(r=>r.id===source.id),{reviews,revision,...unchanged}=reviewed,{revision:priorRevision,...original}=source
 assert.deepEqual(unchanged,original);assert.equal(reviews.length,1)
 const beforeCount=(await h.state()).georeceipts.length
 for(const who of [ben.cookie,lead.cookie]){assert.deepEqual((await h.state(who)).georeceipts,[]);assert.ok((await h.state(who)).timesheets.every(t=>!t.locationReview));await h.cmd('location.review',{...pin(reviewed),reason:'Unauthorized review'},who,403);await h.cmd('geofence.save',f.policy,who,403)}
 assert.equal((await h.state(alex.cookie)).georeceipts.length,2)
 const key=await h.cmd('agent.create',{label:'Location custody refusal'}),agent=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})
 assert.deepEqual(agent.value.georeceipts,[]);assert.deepEqual(agent.value.geofences,[]);assert.ok(agent.value.timesheets.every(t=>!t.locationReview));assert.ok(!JSON.stringify(agent.value).includes('latitude'))
 // Non-punch calls and unconsented or stale evidence cannot collect coordinates.
 await h.cmd('clock.breakStart',{commandId:crypto.randomUUID(),capturedAt:'2025-06-01T18:00:00Z',kind:'meal',location:coords('2025-06-01T18:00:00Z')},cookie,400)
 await capture('clock.in','2025-06-02T16:00:00Z',{...coords('2025-06-02T16:00:00Z'),consent:false},403)
 await capture('clock.in','2025-06-02T16:00:00Z',coords('2025-06-02T15:58:00Z'),409)
 assert.equal((await h.state()).georeceipts.length,beforeCount)
 await capture('clock.in','2025-06-02T16:00:00Z',{...coords('2025-06-02T16:00:00Z'),accuracyMeters:100})
 const denied=await capture('clock.out','2025-06-02T17:00:00Z',{noticeSeen:true,failure:'permission denied'})
 assert.ok(denied.timesheet.exceptions.includes('poor location accuracy'));assert.ok(denied.timesheet.exceptions.includes('location permission denied'))
 const failed=(await h.state()).georeceipts.find(r=>r.id===denied.locationReceiptId);assert.equal(failed.latitude,undefined)
 await capture('clock.in','2025-06-03T16:00:00Z',undefined)
 const missing=await capture('clock.out','2025-06-03T17:00:00Z',undefined);assert.ok(missing.timesheet.exceptions.includes('location unavailable'))
 await h.cmd('geofence.save',{...f.policy,revision:rule.revision,longitude:-122.51})
 assert.deepEqual((await h.state()).georeceipts.find(r=>r.id===inside.locationReceiptId).geofence,{latitude:37.76,longitude:-122.5,radiusMeters:200,maxAccuracyMeters:50})
 const held=await h.cmd('location.hold',{...pin(reviewed),hold:true,reason:'Employer dispute hold'})
 await h.cmd('location.erase',{...pin(held),reason:'Expired coordinates',consent:true},h.owner,409)
 const released=await h.cmd('location.hold',{...pin(held),hold:false,reason:'Review completed'})
 await h.cmd('location.erase',{...pin(released),reason:'Expired coordinates',consent:true})
 const erased=(await h.state()).georeceipts.find(r=>r.id===source.id);assert.equal(erased.latitude,undefined);assert.equal(erased.longitude,undefined);assert.equal(erased.distanceMeters,undefined);assert.equal(erased.status,source.status);assert.equal(erased.capturedAt,source.capturedAt);assert.ok(erased.erasedAt)
 const commandRows=(await h.db.prepare('SELECT result FROM l_commands').all()).results.filter(r=>JSON.parse(r.result).result?.locationReceiptId===source.id);assert.equal(commandRows.length,1);assert.ok(!commandRows[0].result.includes('latitude'))
 await h.restart();assert.ok((await h.state()).georeceipts.find(r=>r.id===source.id).erasedAt)
 // Enrollment revocation applies to new captures and to an identical prior retry.
 await h.cmd('clockbrowser.revoke',{id:device.value.id})
 await capture('clock.in','2025-06-04T16:00:00Z',coords('2025-06-04T16:00:00Z'),403)
 const originalIn=receipts.find(r=>r.id===inside.locationReceiptId)
 await h.cmd('clock.in',{commandId:originalIn.commandId,capturedAt:originalIn.capturedAt,location:coords(originalIn.capturedAt)},cookie,403)
 const rejected=await h.cmd('clock.report',{commandId:crypto.randomUUID(),capture:{name:'clock.in',input:{commandId:crypto.randomUUID(),capturedAt:'2025-06-04T16:00:00Z',location:coords('2025-06-04T16:00:00Z')}},error:'Device access revoked'},alex.cookie)
 assert.equal(rejected.capture.input.location,undefined)
 assert.ok(!JSON.stringify((await h.state(lead.cookie)).clockissues).includes('latitude'),'rejected-capture reports never expose coordinates to managers')
 assert.equal((await h.state()).georeceipts.length,6)
}
export async function geofenceBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
 try{const f=await geofenceFixture(h),page=await context.newPage()
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
 await page.goto(h.origin+'/app/time?week=2025-05-26',{waitUntil:'networkidle'})
 const review=page.locator('#approve .punch-locations');assert.match(await review.innerText(),/inside geofence/);assert.match(await review.innerText(),/out-of-zone punch/);assert.match(await review.innerText(),/accuracy 5 m/)
 await review.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
 if(process.env.C37_SCREENS){await mkdir(process.env.C37_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C37_SCREENS,`location-review-${width}.png`)})}
 const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
 await page.getByText('Filter and approve many',{exact:true}).click();const bulk=page.getByRole('button',{name:'Approve 1 shown',exact:true});await bulk.scrollIntoViewIfNeeded();await bulk.click();await page.waitForLoadState('networkidle');assert.match(await page.getByRole('status').filter({hasText:'Approved 0 · skipped 1'}).innerText(),/Approved 0 · skipped 1/);assert.match(await page.getByRole('status').filter({hasText:'Approved 0 · skipped 1'}).innerText(),/out-of-zone punch/)
 if(process.env.C37_SCREENS)await page.screenshot({path:join(process.env.C37_SCREENS,`location-bulk-skip-${width}.png`)})
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

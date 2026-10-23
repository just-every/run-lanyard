import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,local} from './workforce-journey.mjs'
export async function photoFixture(h){
 const alex=await h.person('Alex'),ben=await h.person('Ben'),lead=await h.person('Lead','manager')
 for(const p of [alex,ben,lead])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===ben?'Mission':'Ocean Beach',hourlyRate:'20.00'})
 const policy=await h.cmd('photo.save',{site:'Mission',native:true,breaks:true,retentionDays:30,consent:true})
 await h.cmd('photo.save',{site:'Ocean Beach',native:false,breaks:false,retentionDays:30,consent:true})
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,lead,policy}
}
export async function photoApi(h){
 const f=await photoFixture(h),{alex,ben,lead,policy}=f,photo=btoa('\xff\xd8\xffsynthetic-lanyard-8'),input={photo,photoConsent:true,photoNoticeSeen:true}
 // Kiosk enrollment already records employer consent and employee notice/consent.
 await h.cmd('kiosk.pin',{pin:'123456',language:'en',consent:true},alex.cookie)
 const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Photo tablet',photo:true,consent:true}},h.owner);assert.equal(enrolled.status,200)
 const signin=await h.send('/api/lanyard/kiosk/signin',{email:alex.email,pin:'123456'},enrolled.cookie);assert.equal(signin.status,200,signin.text)
 const cookies=enrolled.cookie+'; '+signin.cookie
 const kiosk=async(name,at)=>{const r=await h.send('/api/lanyard/kiosk/capture',{name,input:{commandId:crypto.randomUUID(),capturedAt:local('2025-06-01',at),...(name==='clock.out'?{breakMinutes:0}:{})},photo,photoConsent:true},cookies);assert.equal(r.status,200,r.text);return r.value.result}
 await kiosk('clock.in','09:00');const kt=await kiosk('clock.out','10:00')
 const before=(await h.state()).clocks.length
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-9',capturedAt:local('2025-06-02','09:00'),photo,photoConsent:true},ben.cookie,403);assert.equal((await h.state()).clocks.length,before,'missing notice cannot write a punch or photo')
 const start={commandId:'synthetic-lanyard-10',capturedAt:local('2025-06-02','09:00'),...input},native=await h.cmd('clock.in',start,ben.cookie),replay=await h.cmd('clock.in',start,ben.cookie);assert.deepEqual(replay,native)
 const done=await h.cmd('clock.out',{commandId:'synthetic-lanyard-11',capturedAt:local('2025-06-02','10:00'),breakMinutes:0,...input},ben.cookie)
 assert.equal((await h.state()).photonotices.filter(n=>n.staffId===ben.id).length,1)
 const reviewed=(await h.state()).timesheets.filter(t=>[kt.timesheet.id,done.timesheet.id].includes(t.id));assert.ok(reviewed.every(t=>t.photoReview.length===2&&t.photoReview.every(p=>p.photoId)))
 for(const t of reviewed)for(const p of t.photoReview){const path='/api/lanyard/kiosk-photos/'+p.photoId;assert.equal((await h.send(path,undefined,h.owner)).status,200);assert.equal((await h.send(path,undefined,t.staffId===ben.id?ben.cookie:alex.cookie)).status,200);assert.equal((await h.send(path,undefined,t.staffId===ben.id?alex.cookie:ben.cookie)).status,404);assert.equal((await h.send(path,undefined,lead.cookie)).status,404)}
 await h.cmd('time.approve',pin(kt.timesheet));await h.cmd('time.approve',pin(done.timesheet))
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-12',capturedAt:local('2025-06-03','09:00'),photoNoticeSeen:true,photoConsent:true,photoFailure:'camera denied'},ben.cookie)
 const denied=await h.cmd('clock.out',{commandId:'synthetic-lanyard-13',capturedAt:local('2025-06-03','10:00'),breakMinutes:0,photoNoticeSeen:true,photoConsent:false,photoFailure:'photo consent declined'},ben.cookie)
 assert.ok(denied.timesheet.exceptions.some(x=>x.includes('camera denied')))
 const bulk=await h.cmd('time.approveMany',{items:[pin(denied.timesheet)]});assert.equal(bulk.approved.length,0);assert.ok(bulk.skipped[0].reason.includes('camera denied'))
 const agent=await h.cmd('agent.create',{label:'Photo reader refusal'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`});assert.deepEqual(context.value.photoreceipts,[]);assert.deepEqual(context.value.kioskreceipts,[]);assert.deepEqual(context.value.photonotices,[]);assert.ok(context.value.timesheets.every(t=>!t.photoReview))
 const path='/api/lanyard/kiosk-photos/'+native.photoReceipt.photoId;assert.ok([401,403,404].includes((await h.send(path,undefined,'',{authorization:`Bearer ${agent.token}`})).status))
 await h.cmd('photo.hold',{staffId:ben.id,hold:true,reason:'Employer legal hold'})
 await h.cmd('photo.erase',{staffId:ben.id,mode:'retention',consent:true,reason:'Expired photo review'},h.owner,409)
 const person=(await h.state()).staff.find(p=>p.id===ben.id);await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:false,site:person.site,hourlyRate:'20.00'})
 await h.cmd('photo.hold',{staffId:ben.id,hold:false,reason:'Hold released after employer review'})
 const erased=await h.cmd('photo.erase',{staffId:ben.id,mode:'former',consent:true,reason:'Expired photos of former employee'});assert.equal(erased.erased,2);assert.equal((await h.send(path,undefined,h.owner)).status,404)
 assert.equal((await h.cmd('photo.erase',{staffId:alex.id,mode:'retention',consent:true,reason:'Expired kiosk photos'})).erased,2)
 const final=await h.state();assert.ok(final.timesheets.some(t=>t.id===done.timesheet.id&&t.status==='approved'&&t.minutes===60));assert.ok(final.timesheets.find(t=>t.id===denied.timesheet.id).exceptions.some(x=>x.includes('camera denied')));assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_kiosk_photos').first()).n,0)
 await h.cmd('photo.save',{...policy,revision:policy.revision},lead.cookie,403)
 await h.restart();assert.equal((await h.state()).photoreceipts.filter(p=>p.erasedAt).length,2)
}
export async function photoBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']})
 try{for(const width of [1440,390]){const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
 try{const f=await photoFixture(h),page=await context.newPage();await context.grantPermissions(['camera'],{origin:h.origin})
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.C35_SCREENS){await mkdir(process.env.C35_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C35_SCREENS,`${name}-${width}.png`)})}}
 await as(h.owner);await page.goto(h.origin+'/app/people',{waitUntil:'networkidle'});await page.locator('#photo-custody').getByText('Mission · Photos on · 30 days',{exact:true}).click();await page.locator('#photo-custody').scrollIntoViewIfNeeded();await shot('photo-policy')
 await as(f.ben.cookie);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});await page.getByLabel("I have read this site's photo notice").check();await page.getByLabel('I consent to a still photo for this punch').check();await shot('photo-notice')
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/lanyard/command')&&r.request().postDataJSON()?.name==='clock.in'),page.getByRole('button',{name:'Clock in',exact:true}).click()]);await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Clock out',exact:true}).waitFor({state:'visible'})
 // Real elapsed minute: the clock public door accepts payable whole minutes, never synthetic application time.
 await page.waitForTimeout(61000)
 await page.getByLabel("I have read this site's photo notice").check();await page.getByLabel('I consent to a still photo for this punch').check()
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/lanyard/command')&&r.request().postDataJSON()?.name==='clock.out'),page.getByRole('button',{name:'Clock out',exact:true}).click()]);await page.waitForLoadState('networkidle')
 const captures=(await h.state()).photoreceipts.filter(p=>p.staffId===f.ben.id);assert.equal(captures.length,2);assert.ok(captures.every(p=>p.photoId&&!p.photoException))
 await as(h.owner);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});const photos=page.locator('#approve .punch-photos img');assert.equal(await photos.count(),2);await photos.first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('#approve .punch-photos img')].every(i=>i.complete&&i.naturalWidth>0));await shot('photo-approval')
 const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('photo-tooltip')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

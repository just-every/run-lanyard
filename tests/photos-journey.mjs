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
 await h.cmd('photo.save',{site:'Ocean Beach',native:false,kiosk:true,breaks:false,retentionDays:30,consent:true})
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,lead,policy}
}
export async function photoApi(h){
 const f=await photoFixture(h),{alex,ben,lead,policy}=f,photo=btoa('\xff\xd8\xffsynthetic-lanyard-8'),input={photo,photoConsent:true,photoNoticeSeen:true}
 // Kiosk enrollment already records employer consent and employee notice/consent.
 await h.cmd('kiosk.pin',{pin:'123456',language:'en',consent:true},alex.cookie)
 const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Photo tablet',photo:false,consent:true}},h.owner);assert.equal(enrolled.status,200)
 const beforeSiteConsent=await h.send('/api/lanyard/kiosk/state',undefined,enrolled.cookie);assert.equal(beforeSiteConsent.status,401)
 const unconsented=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'No photo authorization',photo:false}},h.owner)
 const noPhotoLogin=await h.send('/api/lanyard/kiosk/signin',{email:alex.email,pin:'123456'},unconsented.cookie),noPhotoCookie=unconsented.cookie+'; '+noPhotoLogin.cookie
 assert.equal((await h.send('/api/lanyard/kiosk/state',undefined,noPhotoCookie)).value.photoEnrollmentNeeded,true)
 assert.equal((await h.send('/api/lanyard/kiosk/capture',{name:'clock.in',input:{commandId:'synthetic-lanyard-69',capturedAt:local('2025-06-01','09:00')},photo,photoConsent:true},noPhotoCookie)).status,403,'site policy cannot replace the required employer consent at enrollment')
 const signin=await h.send('/api/lanyard/kiosk/signin',{email:alex.email,pin:'123456'},enrolled.cookie);assert.equal(signin.status,200,signin.text)
 const cookies=enrolled.cookie+'; '+signin.cookie
 assert.equal((await h.send('/api/lanyard/kiosk/state',undefined,cookies)).value.photoRequired,true,'site policy overrides a no-photo enrollment')
 const refused=await h.send('/api/lanyard/kiosk/capture',{name:'clock.in',input:{commandId:'synthetic-lanyard-40',capturedAt:local('2025-06-01','09:00')}},cookies);assert.equal(refused.status,403,'new site policy cannot be bypassed with a stale no-photo client')
 const kiosk=async(name,at)=>{const r=await h.send('/api/lanyard/kiosk/capture',{name,input:{commandId:crypto.randomUUID(),capturedAt:local('2025-06-01',at),...(name==='clock.out'?{breakMinutes:0}:{})},photo,photoConsent:true},cookies);assert.equal(r.status,200,r.text);return r.value.result}
 await kiosk('clock.in','09:00')
 const optionalBreak={name:'clock.breakStart',input:{commandId:'synthetic-lanyard-67',capturedAt:local('2025-06-01','09:15'),kind:'meal'}}
 const noExtra=await h.send('/api/lanyard/kiosk/capture',{...optionalBreak,photo,photoConsent:true},cookies);assert.equal(noExtra.status,403,'site break-photos off refuses optional image collection')
 assert.equal((await h.send('/api/lanyard/kiosk/capture',optionalBreak,cookies)).status,200)
 assert.equal((await h.send('/api/lanyard/kiosk/capture',{name:'clock.breakEnd',input:{commandId:'synthetic-lanyard-68',capturedAt:local('2025-06-01','09:25')}},cookies)).status,200)
 const kt=await kiosk('clock.out','10:00')
 const before=(await h.state()).clocks.length
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-9',capturedAt:local('2025-06-02','09:00'),photo,photoConsent:true},ben.cookie,403);assert.equal((await h.state()).clocks.length,before,'missing notice cannot write a punch or photo')
 const start={commandId:'synthetic-lanyard-10',capturedAt:local('2025-06-02','09:00'),...input},native=await h.cmd('clock.in',start,ben.cookie),replay=await h.cmd('clock.in',start,ben.cookie);assert.deepEqual(replay,native)
 const done=await h.cmd('clock.out',{commandId:'synthetic-lanyard-11',capturedAt:local('2025-06-02','10:00'),breakMinutes:0,...input},ben.cookie)
 assert.equal((await h.state()).photonotices.filter(n=>n.staffId===ben.id).length,1)
 const reviewed=(await h.state()).timesheets.filter(t=>[kt.timesheet.id,done.timesheet.id].includes(t.id));assert.ok(reviewed.every(t=>t.photoReview.filter(p=>p.photoId).length===2&&t.photoReview.every(p=>!p.photoException)))
 for(const t of reviewed)for(const p of t.photoReview.filter(p=>p.photoId)){const path='/api/lanyard/kiosk-photos/'+p.photoId;assert.equal((await h.send(path,undefined,h.owner)).status,200);assert.equal((await h.send(path,undefined,t.staffId===ben.id?ben.cookie:alex.cookie)).status,200);assert.equal((await h.send(path,undefined,t.staffId===ben.id?alex.cookie:ben.cookie)).status,404);assert.equal((await h.send(path,undefined,lead.cookie)).status,404)}
 await h.cmd('time.approve',pin(kt.timesheet));await h.cmd('time.approve',pin(done.timesheet))
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-12',capturedAt:local('2025-06-03','09:00'),photoNoticeSeen:true,photoConsent:true,photoFailure:'camera denied'},ben.cookie)
 const denied=await h.cmd('clock.out',{commandId:'synthetic-lanyard-13',capturedAt:local('2025-06-03','10:00'),breakMinutes:0,photoNoticeSeen:true,photoConsent:false,photoFailure:'photo consent declined'},ben.cookie)
 assert.ok(denied.timesheet.exceptions.some(x=>x.includes('camera denied')))
 const bulk=await h.cmd('time.approveMany',{items:[pin(denied.timesheet)]});assert.equal(bulk.approved.length,0);assert.ok(bulk.skipped[0].reason.includes('camera denied'))
 const agent=await h.cmd('agent.create',{label:'Photo reader refusal'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`});assert.deepEqual(context.value.photoreceipts,[]);assert.deepEqual(context.value.kioskreceipts,[]);assert.deepEqual(context.value.photonotices,[]);assert.ok(context.value.timesheets.every(t=>!t.photoReview))
 const managers=await h.state(lead.cookie);assert.ok(managers.timesheets.every(t=>!t.photoReview));assert.deepEqual(managers.photoreceipts,[]);assert.deepEqual(managers.kioskreceipts,[])
 const path='/api/lanyard/kiosk-photos/'+native.photoReceipt.photoId;assert.ok([401,403,404].includes((await h.send(path,undefined,'',{authorization:`Bearer ${agent.token}`})).status))
 // Device requirements use an owner-classified credential, never a spoofable UA.
 await h.cmd('photo.save',{site:'Mission',phone:true,browser:false,kiosk:false,breaks:true,retentionDays:30,consent:true,revision:policy.revision})
 const enroll=async type=>{const r=await h.send('/api/lanyard/command',{name:'clockbrowser.enroll',input:{site:'Mission',label:'Reviewed '+type,type}},h.owner);assert.equal(r.status,200,r.text);return r}
 const browserDevice=await enroll('browser'),browserCookie=ben.cookie+'; '+browserDevice.cookie
 assert.ok(!(await h.send('/app/time',undefined,browserCookie)).text.includes('data-punch-photo'))
 await h.cmd('clock.in',{commandId:'synthetic-lanyard-64',capturedAt:local('2025-06-04','09:00'),...input},browserCookie,403)
 const browserIn=await h.cmd('clock.in',{commandId:'synthetic-lanyard-60',capturedAt:local('2025-06-04','09:00')},browserCookie)
 assert.ok(!browserIn.photoReceipt)
 await h.cmd('clock.out',{commandId:'synthetic-lanyard-61',capturedAt:local('2025-06-04','10:00'),breakMinutes:0},browserCookie)
 const phoneDevice=await enroll('phone'),phoneCookie=ben.cookie+'; '+phoneDevice.cookie
 assert.ok((await h.send('/app/time',undefined,phoneCookie)).text.includes('data-punch-photo'))
 const missing={commandId:'synthetic-lanyard-62',capturedAt:local('2025-06-05','09:00')},unchanged=(await h.state()).clocks.length
 await h.cmd('clock.in',missing,phoneCookie,403,{'user-agent':'synthetic-lanyard-browser','x-photo-device':'browser'})
 assert.equal((await h.state()).clocks.length,unchanged)
 await h.cmd('clockbrowser.enroll',{site:'Mission',label:'Unauthorized',type:'browser'},ben.cookie,403)
 await h.cmd('clockbrowser.revoke',{id:browserDevice.value.id})
 await h.cmd('clock.in',missing,browserCookie,403)
 assert.equal((await h.state()).clocks.length,unchanged,'revocation restores the conservative unknown-device requirement')
 // Unclassified devices must satisfy the enabled phone requirement.
 await h.cmd('clock.in',{...missing,photo,photoConsent:true,photoNoticeSeen:true},ben.cookie,200)
 await h.cmd('clock.out',{commandId:'synthetic-lanyard-63',capturedAt:local('2025-06-05','10:00'),breakMinutes:0,...input},ben.cookie)
 await crossSiteShift(h,ben)
 assert.ok(!(await h.send('/app/time',undefined,ben.cookie)).text.includes('data-punch-photo'),'clock-in renders the upcoming work-site policy rather than the home cafe policy')
 const at=Date.now();await h.cmd('clock.in',{commandId:'synthetic-lanyard-65',capturedAt:new Date(at-60000).toISOString()},ben.cookie)
 await h.cmd('clock.out',{commandId:'synthetic-lanyard-66',capturedAt:new Date(at).toISOString(),breakMinutes:0},ben.cookie)
 await h.cmd('photo.hold',{staffId:ben.id,hold:true,reason:'Employer legal hold'})
 await h.cmd('photo.erase',{staffId:ben.id,mode:'retention',consent:true,reason:'Expired photo review'},h.owner,409)
 const person=(await h.state()).staff.find(p=>p.id===ben.id);await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:false,site:person.site,hourlyRate:'20.00'})
 await h.cmd('photo.hold',{staffId:ben.id,hold:false,reason:'Hold released after employer review'})
 const erased=await h.cmd('photo.erase',{staffId:ben.id,mode:'former',consent:true,reason:'Expired photos of former employee'});assert.equal(erased.erased,4);assert.equal((await h.send(path,undefined,h.owner)).status,404)
 assert.equal((await h.cmd('photo.erase',{staffId:alex.id,mode:'retention',consent:true,reason:'Expired kiosk photos'})).erased,2)
 const final=await h.state();assert.ok(final.timesheets.some(t=>t.id===done.timesheet.id&&t.status==='approved'&&t.minutes===60));assert.ok(final.timesheets.find(t=>t.id===denied.timesheet.id).exceptions.some(x=>x.includes('camera denied')));assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_kiosk_photos').first()).n,0)
 await h.cmd('photo.save',{...policy,revision:policy.revision},lead.cookie,403)
 await h.restart();assert.equal((await h.state()).photoreceipts.filter(p=>p.erasedAt).length,4)
}
export async function photoBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic','--use-fake-device-for-media-stream']})
 try{for(const width of [1440,390]){const h=await harness({secure:true}),context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
 try{await context.addInitScript(()=>{window.photoStreams=[];const real=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async p=>{const stream=await real(p);window.photoStreams.push(stream);return stream}});const f=await photoFixture(h),page=await context.newPage();await context.grantPermissions(['camera'],{origin:h.origin})
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.C35_SCREENS){await mkdir(process.env.C35_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C35_SCREENS,`${name}-${width}.png`)})}}
 await as(h.owner);await page.goto(h.origin+'/app/people',{waitUntil:'networkidle'});await page.locator('#photo-custody').getByText('Mission · Photos on · 30 days',{exact:true}).click();const policyForm=page.locator('#photo-custody details[open] form').first();await policyForm.getByLabel('Phone photos').selectOption('true');await policyForm.getByLabel('Browser clock photos').selectOption('false');await policyForm.locator('[name=consent]').check();await Promise.all([page.waitForResponse(r=>r.url().includes('name=photo.save')),policyForm.getByRole('button',{name:'Save photo policy',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);const savedPolicy=(await h.state()).photopolicies.find(p=>p.site==='Mission');assert.deepEqual([savedPolicy.phone,savedPolicy.browser],[true,false]);await page.locator('#photo-custody').getByText('Mission · Photos on · 30 days',{exact:true}).click();await page.locator('#photo-custody').scrollIntoViewIfNeeded();await shot('photo-policy')
 const enrollment=page.locator('#clock-networks');await enrollment.getByText('Enrol this browser as a time clock',{exact:true}).click();const deviceForm=enrollment.locator('form').filter({has:page.getByRole('button',{name:'Enrol this browser',exact:true})});await deviceForm.getByLabel('Cafe').selectOption('Mission');await deviceForm.getByLabel('Label (e.g. Back office PC)',{exact:true}).fill('Reviewed employee phone');await deviceForm.getByLabel('Photo device type').selectOption('phone');await Promise.all([page.waitForResponse(r=>r.url().includes('name=clockbrowser.enroll')),deviceForm.getByRole('button',{name:'Enrol this browser',exact:true}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);await page.locator('#clock-networks').scrollIntoViewIfNeeded();await shot('photo-device-type')
 await as(f.ben.cookie);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});await page.getByLabel("I have read this site's photo notice").check();await page.getByLabel('I consent to a still photo for this punch').check();await shot('photo-notice')
 await Promise.all([page.waitForEvent('load'),page.waitForResponse(r=>r.url().endsWith('/api/lanyard/command')&&r.request().postDataJSON()?.name==='clock.in'),page.getByRole('button',{name:'Clock in',exact:true}).click()]);await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Clock out',exact:true}).waitFor({state:'visible'})
 // Real elapsed minute: the clock public door accepts payable whole minutes, never synthetic application time.
 await page.waitForTimeout(61000)
 await page.getByLabel("I have read this site's photo notice").check();await page.getByLabel('I consent to a still photo for this punch').check()
 await Promise.all([page.waitForEvent('load'),page.waitForResponse(r=>r.url().endsWith('/api/lanyard/command')&&r.request().postDataJSON()?.name==='clock.out'),page.getByRole('button',{name:'Clock out',exact:true}).click()]);await page.waitForLoadState('networkidle')
 const captures=(await h.state()).photoreceipts.filter(p=>p.staffId===f.ben.id);assert.equal(captures.length,2);assert.ok(captures.every(p=>p.photoId&&!p.photoException))
 await as(h.owner);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});const photos=page.locator('#approve .punch-photos img');assert.equal(await photos.count(),2);await photos.first().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('#approve .punch-photos img')].every(i=>i.complete&&i.naturalWidth>0));await shot('photo-approval')
 const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('photo-tooltip')
 assert.equal(await page.evaluate(()=>window.photoStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true)
 // A new employee has no later punch that would forbid this historical capture.
 const dana=await h.person('Dana');await h.cmd('staff.save',{...pin(dana),name:dana.name,email:dana.email,payrollId:dana.payrollId,role:'staff',active:true,site:'Mission',hourlyRate:'20.00'})
 // A browser-level camera denial keeps the real punch with a named exception.
 await context.clearPermissions();const permission=await context.newCDPSession(page),{targetInfo}=await permission.send('Target.getTargetInfo');await permission.send('Browser.setPermission',{permission:{name:'camera'},setting:'denied',origin:h.origin,browserContextId:targetInfo.browserContextId});await as(dana.cookie);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});assert.equal(await page.evaluate(async()=>(await navigator.permissions.query({name:'camera'})).state),'denied')
 for(const [name,at]of [['Clock in','2025-06-06T16:00:00Z'],['Clock out','2025-06-06T17:00:00Z']]){await page.clock.setFixedTime(new Date(at));await page.getByLabel("I have read this site's photo notice").check();await page.getByLabel('I consent to a still photo for this punch').check();try{await Promise.all([page.waitForEvent('load'),page.waitForResponse(r=>r.url().endsWith('/api/lanyard/command')&&r.request().postDataJSON()?.name===(name==='Clock in'?'clock.in':'clock.out')),page.getByRole('button',{name,exact:true}).click()]);await page.waitForLoadState('networkidle')}catch(error){throw new Error(name+': '+await page.locator('[data-clock-status]').innerText()+' '+await page.locator('[data-clock-events]').innerText(),{cause:error})}}
 const cameraDenied=(await h.state()).timesheets.find(t=>t.staffId===dana.id&&t.exceptions?.some(e=>e.includes('camera denied')));assert.ok(cameraDenied,'real browser permission denial becomes an explicit timesheet exception');assert.ok(cameraDenied.photoReview.every(p=>!p.photoId&&p.photoException==='camera denied'))
 const bulk=await h.cmd('time.approveMany',{items:[pin(cameraDenied)]});assert.equal(bulk.approved.length,0);assert.match(bulk.skipped[0].reason,/camera denied/)
 await as(h.owner);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});await page.locator('#approve').getByText('punch photo unavailable: camera denied',{exact:false}).first().scrollIntoViewIfNeeded();await shot('photo-camera-denied')
 await context.grantPermissions(['camera'],{origin:h.origin})
 // The kiosk uses the same real still path instead of an arbitrary file upload.
 await h.cmd('kiosk.pin',{pin:'123456',language:'en',consent:true},f.alex.cookie)
 const device=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Photo kiosk',photo:false,consent:true}},h.owner)
 await as(device.cookie);await page.goto(h.origin+'/app/kiosk',{waitUntil:'networkidle'});await page.locator('[name=email]').fill(f.alex.email);await page.locator('[name=pin]').fill('123456');await page.getByRole('button',{name:'Verify employee'}).click();await page.getByRole('heading',{name:'Your clock',exact:true}).waitFor()
 const kioskStart=Date.now()-120000
 for(const [name,offset]of [['Clock in',0],['Clock out',60000]]){await page.clock.setFixedTime(new Date(kioskStart+offset));await page.locator('[name=photoConsent]').check();await page.getByRole('button',{name,exact:true}).click();await page.waitForFunction(n=>document.querySelector('#kiosk-pending').textContent.startsWith('0 saved')&&document.querySelector('#kiosk-current').textContent===(n==='Clock in'?'Clocked in':'Clocked out'),name)}
 assert.equal(await page.evaluate(()=>window.photoStreams.length===2&&window.photoStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true)
 const owner=await h.signIn(h.auth.OWNER_EMAIL),state=await h.state(owner),receipts=state.kioskreceipts.filter(r=>r.staffId===f.alex.id);assert.equal(receipts.length,2);assert.ok(receipts.every(r=>r.photoId&&r.photoConsent));await shot('photo-kiosk-capture')
 await as(owner);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});const kioskImages=page.locator('#approve .punch-photos img');assert.equal(await kioskImages.count(),4);await kioskImages.last().scrollIntoViewIfNeeded();await page.waitForFunction(()=>[...document.querySelectorAll('#approve .punch-photos img')].every(i=>i.complete&&i.naturalWidth>0));await shot('photo-kiosk-review')
 await crossSiteShift(h,f.ben,owner);await as(f.ben.cookie);await page.goto(h.origin+'/app/time',{waitUntil:'networkidle'});assert.equal(await page.locator('[data-punch-photo]').count(),0);await page.locator('[data-clock]').scrollIntoViewIfNeeded();await shot('photo-cross-site-policy')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

async function crossSiteShift(h,person,owner=h.owner){
 const start=new Date(Date.now()-120000).toISOString(),end=new Date(Date.now()+3600000).toISOString()
 const on=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start)),utc=Date.parse(on+'T00:00:00Z'),week=new Date(utc-((new Date(utc).getUTCDay()+6)%7)*86400000).toISOString().slice(0,10)
 await h.cmd('availability.save',{staffId:person.id,start,end},owner)
 const roster=await h.cmd('roster.prepare',{week,shifts:[{staffId:person.id,start,end,site:'Ocean Beach',breakMinutes:0}]},owner)
 assert.deepEqual(roster.conflicts,[]);await h.cmd('roster.publish',pin(roster),owner)
}

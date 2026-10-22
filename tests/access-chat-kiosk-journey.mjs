import assert from 'node:assert/strict'
import {harness} from './harness.mjs'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
const pin=r=>({id:r.id,revision:r.revision})
// Compare retained business data and sessions, excluding derived read-time timestamps.
const retained=async h=>Promise.all(['l_meta','l_staff','l_records','l_events','l_commands','l_kiosk_sessions'].map(async table=>(await h.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results))
export async function crew(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),ben=await h.person('Ben'),lead=await h.person('Lead','manager'),foreign=await h.person('Foreign','manager')
 for(const p of [alex,ben,lead,foreign])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:p===foreign?'Mission':'Ocean Beach',position:'Counter',hourlyRate:'20.00'})
 const day=new Date(Date.now()+14*86400000).toISOString().slice(0,10),week=new Date(Date.parse(day+'T12:00Z')-((new Date(day+'T12:00Z').getUTCDay()+6)%7)*86400000).toISOString().slice(0,10)
 for(const p of [alex,ben])await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:new Date(Date.parse(week+'T00:00Z')+7*86400000).toISOString()})
 const shifts=[{staffId:alex.id,site:'Ocean Beach',start:week+'T09:00:00Z',end:week+'T12:00:00Z',breakMinutes:0}]
 return {alex,ben,lead,foreign,week,shifts}
}
export async function accessApi(h){
 const f=await crew(h),{alex,ben,lead,foreign,week,shifts}=f
 let level=await h.cmd('access.level.save',{name:'Shift lead',site:'Ocean Beach',permissions:['draft.view','draft.edit','swap.approve']})
 await h.cmd('access.grant',{levelId:level.id,staffId:lead.id,site:'Mission'},h.owner,403)
 const grant=await h.cmd('access.grant',{levelId:level.id,staffId:lead.id,site:'Ocean Beach'})
 const before=await h.state(),draft=await h.cmd('roster.prepare',{week,shifts},lead.cookie)
 assert.equal(draft.status,'draft');assert.equal('rateBasis' in draft.shifts[0],false)
 const noWrites=async(n,p,c=lead.cookie)=>{const s=await h.state();await h.cmd(n,p,c,403);const after=await h.state();assert.equal(after.version,s.version);assert.deepEqual(after.events,s.events)}
 await noWrites('roster.publish',pin(draft));await noWrites('time.approve',{id:'synthetic-lanyard-1',revision:1});await noWrites('agent.create',{label:'Attempt'});await noWrites('roster.prepare',{week,shifts:shifts.map(s=>({...s,site:'Mission'}))})
 await noWrites('access.level.save',{name:'Payroll',site:'Ocean Beach',permissions:['payroll.export']})
 await noWrites('access.level.save',{name:'Foreign empty level',site:'Mission',permissions:[]});await noWrites('access.level.save',{name:'Foreign empty level',site:'Ocean Beach',permissions:[]},foreign.cookie)
 const empty=await h.cmd('access.level.save',{name:'No administrative permissions',site:'Ocean Beach',permissions:[]});await noWrites('access.grant',{levelId:empty.id,staffId:foreign.id,site:'Ocean Beach'})
 const payroll=await h.cmd('access.level.save',{name:'Payroll owner',site:'Ocean Beach',permissions:['payroll.export']});await noWrites('access.grant',{levelId:payroll.id,staffId:alex.id,site:'Ocean Beach'})
 const state=await h.state(lead.cookie);assert.deepEqual(state.access.sites,['Ocean Beach']);assert.equal(state.actor.role,'staff');assert.deepEqual(state.batches,[]);assert.ok(!state.staff.some(x=>x.id===ben.id));assert.equal((await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${week}&size=60`,undefined,lead.cookie)).status,403)
 const contact=await h.send('/api/lanyard/contacts/'+alex.id,undefined,lead.cookie);assert.equal(contact.status,404);assert.ok((await h.state()).events.some(x=>x.action==='contact.refused'&&x.entityId===alex.id))
 await h.cmd('roster.publish',pin(draft));const shift=(await h.state()).shifts.find(x=>x.rosterId===draft.id)
 let swap=await h.cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:ben.id},alex.cookie);swap=await h.cmd('swap.respond',{...pin(swap),decision:'accepted'},ben.cookie)
 const prepared=await h.send('/api/lanyard/access',undefined,lead.cookie);assert.ok(prepared.value.swaps.some(x=>x.id===swap.id));assert.equal('rateBasis' in (prepared.value.drafts[0]?.shifts[0]??{}),false)
 // Editing the level is effective for the next request in this still-active native session.
 level=await h.cmd('access.level.save',{...pin(level),name:level.name,site:level.site,permissions:['draft.view','draft.edit']})
 await noWrites('swap.decide',{...pin(swap),decision:'approved'})
 assert.deepEqual(level.changes.at(-1).before,['draft.view','draft.edit','swap.approve']);assert.deepEqual(level.changes.at(-1).after,['draft.view','draft.edit'])
 level=await h.cmd('access.level.save',{...pin(level),name:level.name,site:level.site,permissions:['draft.view','draft.edit','swap.approve']})
 swap=await h.cmd('swap.decide',{...pin(swap),decision:'approved'},lead.cookie);assert.equal(swap.status,'approved')
 await h.cmd('access.revoke',pin(grant));await noWrites('roster.prepare',{week,shifts})
 // Restoration is distinct from revocation and is available only to the owner.
 await noWrites('access.restore',{staffId:lead.id})
 const restored=await h.cmd('access.restore',{staffId:lead.id})
 assert.equal(restored.staffId,lead.id);assert.deepEqual(restored.before['Ocean Beach'],[])
 assert.ok(restored.after['Ocean Beach'].includes('schedule.publish'))
 const retained=(await h.send('/api/lanyard/access',undefined,h.owner)).value.grants.find(g=>g.id===grant.id)
 assert.ok(retained.archivedAt);assert.equal(retained.revoked,true);assert.equal(retained.changes.at(-1).action,'access.restore')
 assert.deepEqual(retained.changes.at(-1).before,[]);assert.ok(retained.changes.at(-1).after.includes('schedule.publish'))
 assert.equal((await h.state(lead.cookie)).actor.role,'manager')
 assert.equal((await h.send(`/api/lanyard/intervals?site=Ocean%20Beach&date=${week}&size=60`,undefined,lead.cookie)).status,200)
 const nativeDraft=await h.cmd('roster.prepare',{week,shifts},lead.cookie)
 assert.equal((await h.cmd('roster.publish',pin(nativeDraft),lead.cookie)).status,'published')
 await h.restart();assert.equal((await h.state(lead.cookie)).actor.role,'manager')
 await noWrites('access.grant',{levelId:empty.id,staffId:lead.id,site:'Ocean Beach'},foreign.cookie)
 // An archive is history, not authority to reconvert a native manager.
 const restoredPeer=await h.person('RestoredPeer','manager')
 await h.cmd('staff.save',{...pin(restoredPeer),name:restoredPeer.name,email:restoredPeer.email,payrollId:restoredPeer.payrollId,role:'manager',active:true,site:'Ocean Beach'})
 const peerGrant=await h.cmd('access.grant',{levelId:empty.id,staffId:restoredPeer.id,site:'Ocean Beach'})
 await h.cmd('access.restore',{staffId:restoredPeer.id})
 await noWrites('access.grant',{levelId:empty.id,staffId:restoredPeer.id,site:'Ocean Beach'})
 assert.ok((await h.send('/api/lanyard/access',undefined,h.owner)).value.grants.find(g=>g.id===peerGrant.id).archivedAt)
 const nextGrant=await h.cmd('access.grant',{levelId:level.id,staffId:lead.id,site:'Ocean Beach'})
 assert.equal((await h.state(lead.cookie)).actor.role,'staff');await h.cmd('access.revoke',pin(nextGrant))
 await h.cmd('access.restore',{staffId:lead.id})
 assert.ok((await h.state()).events.some(e=>e.action==='access.restore'&&e.entityId===lead.id&&e.actorRole==='owner'))
 const key=await h.cmd('agent.create',{label:'Preparation only'}),ctx=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.deepEqual(ctx.value.accesslevels,[]);assert.deepEqual(ctx.value.accessgrants,[]);assert.equal(ctx.value.access,null)
 const staffGrant=await h.cmd('access.grant',{levelId:level.id,staffId:ben.id,site:'Ocean Beach'});const staffDraft=await h.cmd('roster.prepare',{week,shifts},ben.cookie);assert.equal(staffDraft.status,'draft');const staffId=(await h.state(ben.cookie)).actor.id;assert.ok((await h.state()).events.some(e=>e.action==='roster.prepare'&&e.actorId===staffId&&e.actorRole==='staff'));const ownPattern=await h.cmd('pattern.save',{from:week,blocks:'Mon available 09:00-17:00',preferredHours:20,maxHours:40},ben.cookie);assert.equal(ownPattern.staffId,ben.id);await noWrites('pattern.save',{staffId:alex.id,from:week,blocks:'Mon available 09:00-17:00'},ben.cookie)
 await h.cmd('closerule.save',{site:'Ocean Beach',graceMinutes:0,capHours:1});const start=new Date(Date.now()-5*3600000).toISOString(),open=await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:start},ben.cookie),end=new Date(Date.parse(start)+3600000).toISOString();const ownTime=await h.cmd('time.confirm',{...pin(open),end,breakMinutes:0},ben.cookie);assert.equal(ownTime.timesheet.staffId,ben.id);assert.equal(ownTime.timesheet.minutes,60)
 await h.cmd('access.revoke',pin(staffGrant))
 assert.ok((await h.state()).events.some(e=>e.action==='access.revoke'))
 return f
}
export async function chatApi(h){
 const f=await crew(h),{alex,ben,lead,foreign,week,shifts}=f
 const announcement=await h.cmd('chat.create',{kind:'announcement',site:'Ocean Beach',title:'Opening checklist'},lead.cookie)
 await h.cmd('chat.send',{threadId:announcement.id,text:'synthetic-lanyard-1: check the espresso station',attachment:{name:'handover.txt',type:'text/plain',data:btoa('synthetic-lanyard-2')}},lead.cookie)
 const read=async(c=alex.cookie,q='')=>h.send('/api/lanyard/chat'+q,undefined,c)
 let view=(await read()).value;assert.ok(view.threads.some(t=>t.id===announcement.id));const message=view.messages[0];assert.equal('data' in message.attachments[0],false)
 await h.cmd('chat.acknowledge',pin(message),alex.cookie);await h.cmd('chat.acknowledge',pin(message),alex.cookie);assert.equal((await read()).value.reads.filter(x=>x.messageId===message.id).length,1)
 assert.equal((await read(alex.cookie,'?q=espresso')).value.messages.length,1)
 await h.cmd('chat.send',{threadId:announcement.id,text:'Attempt'},alex.cookie,403)
 const attachment=`/api/lanyard/chat/messages/${message.id}/files/${message.attachments[0].id}`;assert.equal((await h.send(attachment,undefined,ben.cookie)).text,'synthetic-lanyard-2');assert.equal((await h.send(attachment,undefined,foreign.cookie)).status,404)
 const direct=await h.cmd('chat.create',{kind:'direct',site:'Ocean Beach',title:'Closing handover',members:[ben.id]},alex.cookie)
 await h.cmd('chat.send',{threadId:direct.id,text:'Please request the swap through Schedule.'},alex.cookie)
 assert.equal((await read(lead.cookie)).value.threads.some(t=>t.id===direct.id),false,'managers cannot read private operational DMs without membership')
 const noWrites=async(path,input,c,status)=>{const before=await retained(h);const r=await h.send(path,input,c);assert.equal(r.status,status,r.text);assert.deepEqual(await retained(h),before);return r}
 await noWrites('/api/lanyard/chat?threadId='+direct.id,undefined,h.owner,404)
 await noWrites('/api/lanyard/command',{name:'chat.send',input:{threadId:direct.id,text:'Owner attempt'}},h.owner,404)
 const group=await h.cmd('chat.create',{kind:'group',site:'Ocean Beach',title:'Counter group',members:[ben.id,lead.id]},alex.cookie);assert.ok((await read(ben.cookie)).value.threads.some(t=>t.id===group.id))
 const draft=await h.cmd('roster.prepare',{week,shifts});await h.cmd('roster.publish',pin(draft));const shift=(await h.state()).shifts.find(x=>x.rosterId===draft.id)
 const handover=await h.cmd('chat.create',{kind:'shift',site:'Ocean Beach',title:'Shift handover',shiftId:shift.id,shiftRevision:shift.revision},alex.cookie)
 await h.cmd('chat.send',{threadId:handover.id,text:'Swap requested in chat, not approved.'},alex.cookie)
 assert.equal((await h.state()).swaps.length,0);assert.equal((await h.state()).shifts.find(x=>x.id===shift.id).staffId,alex.id)
 let swap=await h.cmd('swap.propose',{shiftId:shift.id,revision:shift.revision,to:ben.id},alex.cookie);swap=await h.cmd('swap.respond',{...pin(swap),decision:'accepted'},ben.cookie);assert.equal((await h.state()).shifts.find(x=>x.id===shift.id).staffId,alex.id)
 await h.cmd('swap.decide',{...pin(swap),decision:'approved'},lead.cookie)
 assert.equal((await read()).value.threads.some(t=>t.id===handover.id),false);assert.ok((await read(ben.cookie)).value.threads.some(t=>t.id===handover.id));assert.equal(handover.shiftRevision,shift.revision)
 // Fully revoked managers have no announcement or manager-only shift authority.
 const level=await h.cmd('access.level.save',{name:'Restricted manager',site:'Ocean Beach',permissions:[]})
 const grant=await h.cmd('access.grant',{levelId:level.id,staffId:lead.id,site:'Ocean Beach'})
 await h.cmd('access.revoke',pin(grant))
 await noWrites('/api/lanyard/command',{name:'chat.send',input:{threadId:announcement.id,text:'Revoked attempt'}},lead.cookie,403)
 await noWrites('/api/lanyard/chat?threadId='+handover.id,undefined,lead.cookie,404)
 await noWrites('/api/lanyard/command',{name:'access.restore',input:{staffId:lead.id}},lead.cookie,403)
 await h.cmd('access.restore',{staffId:lead.id})
 await h.cmd('chat.send',{threadId:announcement.id,text:'Native manager restored'},lead.cookie)
 assert.ok((await read(lead.cookie,'?threadId='+handover.id)).value.threads.some(t=>t.id===handover.id))
 // A new published roster does not move the old row's chat to a new assignee.
 const replacement=await h.cmd('roster.prepare',{week,shifts:shifts.map(x=>({...x,staffId:alex.id}))})
 await h.cmd('roster.publish',pin(replacement))
 assert.equal((await h.state()).shifts.find(x=>x.id===shift.id).status,'superseded')
 assert.ok((await read(ben.cookie,'?threadId='+handover.id)).value.messages.some(m=>m.threadId===handover.id))
 await noWrites('/api/lanyard/chat?threadId='+handover.id,undefined,alex.cookie,404)
 const person=(await h.state()).staff.find(x=>x.id===ben.id)
 await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:true,site:'Mission'})
 assert.equal((await read(ben.cookie)).value.messages.some(m=>m.id===message.id),false);assert.equal((await h.send(attachment,undefined,ben.cookie)).status,404)
 await noWrites('/api/lanyard/command',{name:'chat.send',input:{threadId:direct.id,text:'Transferred attempt'}},ben.cookie,404)
 const away=(await h.state()).staff.find(x=>x.id===ben.id)
 await h.cmd('staff.save',{...pin(away),name:away.name,email:away.email,payrollId:away.payrollId,role:away.role,active:true,site:'Ocean Beach'})
 assert.ok((await read(ben.cookie,'?threadId='+direct.id)).value.messages.some(m=>m.text==='Please request the swap through Schedule.'))
 assert.equal((await h.send(attachment,undefined,ben.cookie)).text,'synthetic-lanyard-2')
 const changed=(await h.state()).staff.find(x=>x.id===ben.id);await h.cmd('staff.save',{...pin(changed),name:changed.name,email:changed.email,payrollId:changed.payrollId,role:changed.role,active:false,site:'Mission'})
 assert.equal((await read(ben.cookie)).status,403);assert.deepEqual((await h.state()).chatmessages,[])
 return f
}
export async function kioskApi(h){
 const f=await crew(h),{alex,ben,lead,foreign}=f
 await h.cmd('kiosk.enroll',{site:'Ocean Beach',label:'Attempt',photo:false},lead.cookie,403)
 await h.cmd('kiosk.pin',{pin:'123456',language:'es',consent:true},alex.cookie)
 await h.cmd('kiosk.pin',{pin:'234567',language:'en',consent:true},ben.cookie)
 const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Counter tablet',photo:true,consent:true}},h.owner);assert.equal(enrolled.status,200,enrolled.text);assert.equal('cookie' in enrolled.value,false)
 const device=enrolled.cookie,post=async(path,input,c=device,headers={})=>h.send('/api/lanyard/kiosk/'+path,input,c,headers)
 assert.equal((await post('signin',{email:alex.email,pin:'000000'})).status,401)
 const login=await post('signin',{email:alex.email,pin:'123456'});assert.equal(login.status,200,login.text);let cookie=device+'; '+login.cookie
 let own=await post('state',undefined,cookie);assert.equal(own.value.staffId,alex.id);assert.equal(own.value.language,'es');assert.equal(own.value.clocks.length,0)
 // JPEG fixture contains only an inert signature; this asserts byte custody, not camera hardware.
 await h.cmd('roundrule.save',{site:'Ocean Beach',from:'2020-01-01',method:'nearest',increment:15,apply:'capture'})
 const photo=btoa(String.fromCharCode(255,216,255,217)),start=new Date(Date.now()-4*3600000),at=n=>new Date(start.getTime()+n*60000).toISOString(),stamp={'x-test-now':String(Date.now())}
 const capture=(name,n,extra={})=>({name,input:{commandId:crypto.randomUUID(),capturedAt:at(n),...extra},photo,photoConsent:true})
 const inEvent=capture('clock.in',0)
 assert.equal((await post('capture',{...inEvent,photo:undefined},cookie,stamp)).status,403)
 let punch=await post('capture',inEvent,cookie,stamp);assert.equal(punch.status,200,punch.text);const receipt=punch.value.result.kioskReceipt;assert.equal(receipt.language,'es');assert.ok(receipt.photoId)
 const again=await post('capture',inEvent,cookie,stamp);assert.equal(again.status,200);assert.equal(again.value.result.id,punch.value.result.id)
 for(const [name,n,input] of [['clock.breakStart',30,{kind:'meal'}],['clock.breakEnd',60,{}],['clock.out',180,{breakMinutes:0}]]){const c=await post('capture',capture(name,n,input),cookie,stamp);assert.equal(c.status,200,c.text)}
 own=await post('state',undefined,cookie);assert.equal(own.value.receipts.length,4);assert.ok(own.value.receipts.every(x=>x.photoId&&x.staffId===alex.id))
 const time=(await h.state()).timesheets.find(t=>t.staffId===alex.id);assert.equal(time.rounding.increment,15);assert.ok(time.payable.start);assert.equal(time.start,at(0));assert.equal(time.end,at(180))
 const path='/api/lanyard/kiosk-photos/'+receipt.photoId;assert.equal((await h.send(path,undefined,h.owner)).status,200);const bytes=await h.mf.dispatchFetch(h.origin+path,{headers:{cookie:h.owner}});assert.deepEqual([...new Uint8Array(await bytes.arrayBuffer())],[255,216,255,217]);assert.equal((await h.send(path,undefined,ben.cookie)).status,404);assert.equal((await h.send('/api/lanyard/state',undefined,cookie)).status,401)
 await h.restart();assert.equal((await post('state',undefined,cookie)).value.staffId,alex.id)
 await post('signout',{},cookie);assert.equal((await post('state',undefined,cookie)).status,401)
 const second=await post('signin',{email:ben.email,pin:'234567'});cookie=device+'; '+second.cookie;assert.equal((await post('state',undefined,cookie)).value.language,'en');assert.equal((await post('state',undefined,cookie)).value.clocks.length,0)
 const bin=await post('capture',{...capture('clock.in',190),photo:undefined,photoConsent:false,photoFailure:'camera denied'},cookie);assert.equal(bin.status,200,bin.text);const bout=await post('capture',capture('clock.out',210,{breakMinutes:0}),cookie);assert.equal(bout.status,200,bout.text);assert.equal(bout.value.result.timesheet.staffId,ben.id);assert.equal(bout.value.result.kioskReceipt.language,'en');assert.ok(bout.value.result.timesheet.exceptions.includes('punch photo unavailable: camera denied'));const bulk=await h.cmd('time.approveMany',{items:[pin(bout.value.result.timesheet)]});assert.equal(bulk.approved.length,0);assert.ok(bulk.skipped[0].reason.includes('punch photo unavailable'))
 assert.equal((await post('capture',capture('roster.publish',190,{}),cookie)).status,403)
 assert.equal((await post('capture',capture('clock.transfer',190,{site:'Mission',job:'synthetic-lanyard-1'}),cookie)).status,403)
 await h.cmd('kiosk.revoke',{id:enrolled.value.id});assert.equal((await post('capture',capture('clock.in',200),cookie)).status,403);assert.equal((await post('state',undefined,cookie)).status,403)
 const locked=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Lock test',photo:false}},h.owner);for(let n=0;n<5;n++)assert.equal((await post('signin',{email:'unknown@venue.example',pin:'000000'},locked.cookie)).status,401)
 assert.equal((await post('signin',{email:alex.email,pin:'123456'},locked.cookie)).status,403)
 // Spread failures across devices so this asserts the per-person limiter, not device locking.
 const attempts=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Person limit one',photo:false}},h.owner)
 const spare=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Person limit two',photo:false}},h.owner)
 for(let n=0;n<4;n++)assert.equal((await post('signin',{email:alex.email,pin:'000000'},attempts.cookie)).status,401)
 assert.equal((await post('signin',{email:alex.email,pin:'000000'},spare.cookie)).status,401)
 const beforeSixth=await retained(h),sessionsBefore=(await h.db.prepare('SELECT * FROM l_kiosk_sessions ORDER BY token_hash').all()).results
 const sixth=await post('signin',{email:alex.email,pin:'123456'},spare.cookie)
 assert.equal(sixth.status,401,sixth.text);assert.equal(sixth.cookie,undefined)
 assert.deepEqual(await retained(h),beforeSixth);assert.deepEqual((await h.db.prepare('SELECT * FROM l_kiosk_sessions ORDER BY token_hash').all()).results,sessionsBefore)
 // Security counters may advance on refusal; no identity/session or workforce write is allowed.
 assert.ok((await h.state()).events.some(e=>e.action==='kiosk.revoke'))
 return f
}
export async function surfaceBrowser(){
 const h=await harness({secure:true}),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
 const f=await crew(h)
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 await h.cmd('chat.create',{kind:'site',site:'Ocean Beach',title:'Morning service'})
 const t=(await h.send('/api/lanyard/chat',undefined,f.alex.cookie)).value.threads[0];await h.cmd('chat.send',{threadId:t.id,text:'Grinder cleaned; milk delivery is on the way.'},f.alex.cookie)
 await h.cmd('access.level.save',{name:'Shift lead',site:'Ocean Beach',permissions:['draft.view','draft.edit','swap.approve']})
 await h.cmd('kiosk.pin',{pin:'123456',language:'es',consent:true},f.alex.cookie)
 const e=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Counter tablet',photo:true,consent:true}},h.owner)
 for(const width of [1440,390]){
  await h.cmd('chat.send',{threadId:t.id,text:`Grinder cleaned for width ${width}.`},f.alex.cookie)
  const ctx=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  await ctx.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
  const cookie=async c=>{await ctx.clearCookies();const [name,...v]=c.split('=');await ctx.addCookies([{name,value:v.join('='),url:h.origin,secure:name.startsWith('__Host-')}])}
  await cookie(h.owner);const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');if(process.env.C33_SCREENS){await mkdir(process.env.C33_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C33_SCREENS,`${name}-${width}.png`),fullPage:true})}}
  await page.goto(h.origin+'/app/access');await page.getByRole('heading',{name:'Access levels',exact:true}).waitFor()
  const create=page.locator('form[action*="name=access.level.save"]').filter({has:page.getByRole('button',{name:'Create level',exact:true})});await create.locator('[name=name]').fill('Browser lead '+width);await create.locator('[name=site]').fill('Ocean Beach');await create.locator('[name=permissions][value="draft.edit"]').check();await create.locator('[name=permissions][value="swap.approve"]').check();await create.getByRole('button',{name:'Create level'}).click()
  const level=(await h.send('/api/lanyard/access',undefined,h.owner)).value.levels.find(x=>x.name==='Browser lead '+width);assert.ok(level)
  const grant=page.locator('form[action*="name=access.grant"]');await grant.locator('[name=levelId]').selectOption(level.id);await grant.locator('[name=staffId]').selectOption(f.lead.id);await grant.locator('[name=site]').fill('Ocean Beach');await grant.getByRole('button',{name:'Assign level'}).click();await shot('access')
  await cookie(f.lead.cookie);await page.goto(h.origin+'/app/access');const draft=page.locator('form[action*="name=roster.prepare"]').filter({has:page.getByRole('button',{name:'Prepare draft',exact:true})});await draft.locator('[name=week]').fill(f.week);await draft.locator('[name=draftStaff]').selectOption(f.alex.id);await draft.locator('[name=draftStart]').fill(f.week+'T09:00');await draft.locator('[name=draftEnd]').fill(f.week+'T12:00');await draft.getByRole('button',{name:'Prepare draft'}).click();assert.ok((await h.state()).rosters.some(r=>r.week===f.week&&r.status==='draft'));const edit=page.locator('form[action*="name=roster.prepare"]').filter({has:page.getByRole('button',{name:'Save shift in draft',exact:true})}).first();await edit.locator('[name=draftEnd]').fill(f.week+'T13:00');await edit.getByRole('button',{name:'Save shift in draft'}).click();assert.ok((await h.state()).shifts.some(x=>x.status==='draft'&&x.end===f.week+'T13:00:00.000Z'));await shot('delegated-draft')
  await cookie(h.owner);await page.goto(h.origin+'/app/access')
  const restore=page.locator('form[action*="name=access.restore"]').filter({has:page.locator(`input[name=staffId][value="${f.lead.id}"]`)})
  await restore.getByRole('button',{name:'Restore native authority',exact:true}).click()
  assert.equal((await h.state(f.lead.cookie)).actor.role,'manager')
  assert.ok((await h.send('/api/lanyard/access',undefined,h.owner)).value.grants.filter(g=>g.staffId===f.lead.id).every(g=>g.archivedAt))
  assert.equal(await page.locator('form[action*="name=access.restore"] input[name=staffId]').count(),0)
  await shot('access-restored')
  await cookie(f.lead.cookie);await page.goto(h.origin+'/app/schedule?week='+f.week);await shot('native-manager-restored')
  await cookie(f.alex.cookie);await page.goto(h.origin+'/app/chat');await page.getByRole('heading',{name:'Morning service',exact:true}).waitFor();await page.getByRole('button',{name:'Acknowledge',exact:true}).first().click();assert.ok((await page.locator('main').innerText()).includes('Acknowledged'));await page.locator('input[name=q]').fill('Grinder');await page.getByRole('button',{name:'Search',exact:true}).click();assert.ok((await page.locator('main').innerText()).includes('Grinder cleaned'));await shot('chat')
  await cookie(await h.signIn(h.auth.OWNER_EMAIL));const [deviceName,...deviceValue]=e.cookie.split('=');await ctx.addCookies([{name:deviceName,value:deviceValue.join('='),url:h.origin,secure:true}]);await page.goto(h.origin+'/app/kiosk');await page.waitForFunction(()=>document.querySelector('#kiosk-status').textContent.includes('Verify your personal PIN'));assert.equal((await ctx.request.get(h.origin+'/api/lanyard/state')).status(),401,'opening the kiosk ends the enrollment/admin native session');await page.locator('#kiosk-signin [name=email]').fill(f.alex.email);await page.locator('#kiosk-signin [name=pin]').fill('123456');await page.getByRole('button',{name:'Verify employee'}).click();await page.getByRole('heading',{name:'Tu reloj'}).waitFor();await shot('kiosk');await page.locator('[name=photoFailure]').selectOption('camera denied');assert.equal(await page.locator('[name=photoFailure]').inputValue(),'camera denied');await shot('kiosk-unverified')
  await page.getByRole('button',{name:'Cerrar sesión para la siguiente persona'}).click();await page.getByRole('button',{name:'Verify employee'}).waitFor();assert.equal(await page.locator('#kiosk-person').isVisible(),false);assert.deepEqual(errors,[]);await cookie(h.owner);await page.goto(h.origin+'/app/schedule?week='+f.week);await shot('shared-navigation');await ctx.close()
 }
 }finally{await browser.close();await h.close()}
}

export async function kioskOffline(){
 const h=await harness({secure:true}),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const f=await crew(h),{alex}=f
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  await h.cmd('kiosk.pin',{pin:'123456',language:'en',consent:true},alex.cookie)
  const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Offline counter',photo:false}},h.owner)
  const context=await browser.newContext({viewport:{width:390,height:1000},ignoreHTTPSErrors:true}),[name,...value]=enrolled.cookie.split('=')
  await context.addCookies([{name,value:value.join('='),url:h.origin,secure:true}])
  let disconnected=true
  await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/lanyard/kiosk/capture'&&disconnected)return route.abort('internetdisconnected');if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
  let page=await context.newPage();await page.goto(h.origin+'/app/kiosk');await page.locator('[name=email]').fill(alex.email);await page.locator('[name=pin]').fill('123456');await page.getByRole('button',{name:'Verify employee'}).click();await page.getByRole('heading',{name:'Your clock',exact:true}).waitFor()
  const start=Date.now()-4*3600000,at=n=>new Date(start+n*60000),capture=async(n,label,count)=>{await page.clock.setFixedTime(at(n));await page.getByRole('button',{name:label,exact:true}).click();await page.waitForFunction(n=>document.querySelector('#kiosk-pending').textContent.startsWith(n+' saved'),count)}
  await context.setOffline(true);await capture(0,'Clock in',1);await capture(30,'Start meal',2)
  await page.close();await h.restart();await context.setOffline(false);page=await context.newPage();await page.goto(h.origin+'/app/kiosk');await page.getByRole('heading',{name:'Your clock',exact:true}).waitFor();await capture(60,'End break',3);await capture(180,'Clock out',4)
  const encrypted=await page.evaluate(async()=>{const names=await indexedDB.databases(),name=names.find(d=>d.name.includes('kiosk:')).name,db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{const tx=db.transaction('vault'),get=k=>new Promise((resolve,reject)=>{const r=tx.objectStore('vault').get(k);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const key=await get('key'),state=await get('state');return {extractable:key.extractable,plain:new TextDecoder().decode(state.data),bytes:state.data.byteLength}}finally{db.close()}})
  assert.equal(encrypted.extractable,false);assert.ok(encrypted.bytes>0);assert.equal(encrypted.plain.includes('capturedAt'),false);assert.equal((await h.state()).clocks.length,0)
  disconnected=false;await page.getByRole('button',{name:'Retry saved captures'}).click();await page.waitForFunction(()=>document.querySelector('#kiosk-pending').textContent.startsWith('0 saved'))
  let state=await h.state();assert.equal(state.timesheets.length,1);assert.equal(state.timesheets[0].minutes,150);assert.equal(state.clocks[0].breaks.length,1);assert.equal(state.kioskreceipts.length,4);assert.ok(state.kioskreceipts.every(r=>r.receivedAt>r.capturedAt))
  await page.reload();await page.getByRole('heading',{name:'Your clock',exact:true}).waitFor();assert.equal((await h.state()).timesheets.length,1)
  disconnected=true;await capture(200,'Clock in',1);await h.cmd('kiosk.revoke',{id:enrolled.value.id})
  // No employee retry precedes the owner's sign-in. The manager recovery UI reveals only a count.
  const [ownerName,...ownerValue]=h.owner.split('=');await context.addCookies([{name:ownerName,value:ownerValue.join('='),url:h.origin}]);await page.goto(h.origin+'/app/time');const recovery=page.locator('[data-clock-recovery]');await recovery.waitFor();const notice=await recovery.innerText();assert.ok(notice.includes('1 unsynced punch'));assert.equal(notice.includes('Alex'),false);assert.equal(notice.includes('capturedAt'),false)
  if(process.env.C33_SCREENS)for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await mkdir(process.env.C33_SCREENS,{recursive:true});await recovery.screenshot({path:join(process.env.C33_SCREENS,`kiosk-recovery-${width}.png`)})}
  await recovery.getByRole('button',{name:'Submit unsynced punches for review'}).click();await page.waitForFunction(()=>document.querySelector('[data-clock-recovery]').textContent.includes('No punches were automatically applied'))
  state=await h.state();assert.equal(state.clockissues.length,1);assert.equal(state.timesheets.length,1);assert.equal(state.clockissues[0].originalActorId,(await h.state(alex.cookie)).actor.id)
  const issue=state.clockissues[0];await h.cmd('clockissue.resolve',{...pin(issue),commandId:crypto.randomUUID(),reason:'Owner reviewed kiosk original; no additional work was performed.'});assert.equal((await h.state()).clockissues[0].status,'resolved');assert.equal((await h.state()).timesheets.length,1)
  await page.goto(h.origin+'/app/kiosk');assert.equal((await page.locator('body').innerText()).includes('Kiosk is unavailable'),true)
  await context.close()
 }finally{await browser.close();await h.close()}
}

export async function kioskSegmentApi(h){
 const {handoverFixture}=await import('./shiftwork-fixture.mjs'),f=await handoverFixture(h),{alex,start,end,counter,kitchen}=f
 await h.cmd('kiosk.pin',{pin:'123456',language:'en',consent:true},alex.cookie)
 const enrolled=await h.send('/api/lanyard/command',{name:'kiosk.enroll',input:{site:'Ocean Beach',label:'Kitchen tablet',photo:false}},h.owner)
 const signin=await h.send('/api/lanyard/kiosk/signin',{email:alex.email,pin:'123456'},enrolled.cookie);assert.equal(signin.status,200,signin.text)
 const cookie=enrolled.cookie+'; '+signin.cookie,post=async(name,at,extra={})=>{const r=await h.send('/api/lanyard/kiosk/capture',{name,input:{commandId:crypto.randomUUID(),capturedAt:at,...extra}},cookie);assert.equal(r.status,200,r.text);return r.value.result}
 const refused=await h.send('/api/lanyard/kiosk/capture',{name:'clock.in',input:{commandId:crypto.randomUUID(),capturedAt:start},photo:btoa(String.fromCharCode(255,216,255,217)),photoConsent:true},cookie);assert.equal(refused.status,403,'a device without employer photo approval cannot collect optional photos')
 await post('clock.in',start);await post('clock.transfer',new Date(Date.parse(start)+180*60000).toISOString(),{job:kitchen.id})
 const time=(await post('clock.out',end,{breakMinutes:30})).timesheet,approved=await h.cmd('time.approve',pin(time))
 assert.deepEqual(approved.workSegments.map(p=>[p.job,p.site,p.minutes,p.rateBasis.segments.map(x=>x.cents),p.rateBasis.costCents]),[[counter.id,'Ocean Beach',169,[2000],5633],[kitchen.id,'Ocean Beach',281,[2400],11240]])
 assert.equal(approved.workSegments.reduce((n,p)=>n+p.minutes,0),450)
 const batch=await h.cmd('payroll.prepare',{ids:[approved.id]}),exported=await h.cmd('payroll.export',pin(batch)),csv=(await h.send(`/api/lanyard/batches/${exported.id}.csv`,undefined,h.owner)).text
 assert.ok(csv.includes(counter.id));assert.ok(csv.includes(kitchen.id));assert.equal(csv.split('\r\n').filter(l=>l.startsWith('ALEX,')).length,2)
 await h.cmd('kiosk.pin',{pin:'345678',language:'es',consent:true},alex.cookie)
 assert.equal((await h.send('/api/lanyard/kiosk/state',undefined,cookie)).status,401,'a PIN change revokes an already active kiosk session')
 const again=await h.send('/api/lanyard/kiosk/signin',{email:alex.email,pin:'345678'},enrolled.cookie),changed=enrolled.cookie+'; '+again.cookie
 const person=(await h.state()).staff.find(x=>x.id===alex.id);await h.cmd('staff.save',{...pin(person),name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:false,site:person.site})
 assert.equal((await h.send('/api/lanyard/kiosk/state',undefined,changed)).status,401,'deactivation revokes an active kiosk employee session')
}

import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

async function fixture(h){
 await h.cmd('settings.save',{timezone:'UTC'})
 const owner=await h.cmd('staff.save',{name:'Listed owner',email:h.auth.OWNER_EMAIL,payrollId:'synthetic-lanyard-1',role:'staff',active:true,site:'East'})
 const member=await h.person('GroupMember'),manager=await h.person('GroupManager','manager')
 for(const p of [member,manager])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'East'})
 const thread=await h.cmd('chat.create',{kind:'group',site:'East',title:'Service group',members:[member.id,manager.id]})
 const message=await h.cmd('chat.send',{threadId:thread.id,text:'synthetic-lanyard-2 retained service history',attachment:{name:'service.txt',type:'text/plain',data:btoa('synthetic-lanyard-3')}})
 const file=`/api/lanyard/chat/messages/${message.id}/files/${message.attachments[0].id}`
 return {owner,member,manager,thread,message,file}
}
async function denied(h,f){
 assert.equal((await h.send('/api/lanyard/chat?threadId='+f.thread.id,undefined,f.member.cookie)).status,404)
 assert.ok(!(await h.send('/api/lanyard/chat?q=synthetic-lanyard-2',undefined,f.member.cookie)).value.messages.some(m=>m.id===f.message.id))
 assert.equal((await h.send(f.file,undefined,f.member.cookie)).status,404)
 await h.cmd('chat.send',{threadId:f.thread.id,text:'Removed member attempt'},f.member.cookie,404)
 await h.cmd('chat.acknowledge',pin(f.message),f.member.cookie,404)
}
export async function chatMembershipApi(){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const f=await fixture(h),input={...pin(f.thread),staffId:f.member.id,reason:'Reviewed operational group departure'}
  assert.equal((await h.send(f.file,undefined,f.member.cookie)).status,200)
  const refused=async(p,c,status)=>{
   const before=(await h.db.prepare('SELECT * FROM l_records ORDER BY id').all()).results
   const count=await h.db.prepare('SELECT COUNT(*) AS n FROM l_events').first()
   await h.cmd('chat.removeMember',p,c,status)
   assert.deepEqual((await h.db.prepare('SELECT * FROM l_records ORDER BY id').all()).results,before)
   assert.deepEqual(await h.db.prepare('SELECT COUNT(*) AS n FROM l_events').first(),count)
  }
  await refused(input,f.manager.cookie,403)
  await refused(input,f.member.cookie,403)
  await refused({...input,reason:''},h.owner,400)
  await refused({...input,staffId:f.owner.id},h.owner,400)
  await refused({...input,members:[f.member.id]},h.owner,400)
  const other=await h.cmd('chat.create',{kind:'group',site:'East',title:'No owner readership',members:[f.manager.id]},f.member.cookie)
  await refused({...input,...pin(other)},h.owner,404)
  const saved=await h.cmd('chat.removeMember',input)
  assert.deepEqual(saved.members,[f.manager.id,f.owner.id])
  assert.deepEqual(saved.membershipChanges[0].before,f.thread.members)
  assert.deepEqual(saved.membershipChanges[0].after,saved.members)
  assert.equal(saved.membershipChanges[0].reason,input.reason)
  assert.equal(saved.membershipChanges[0].at,'2026-10-26T12:00:00.000Z')
  await refused(input,h.owner,409)
  await denied(h,f)
  assert.equal((await h.send(f.file,undefined,h.owner)).text,'synthetic-lanyard-3','removal retains the attachment for existing authorized readers')
  const managerView=(await h.send('/api/lanyard/chat?threadId='+f.thread.id,undefined,f.manager.cookie)).value
  assert.ok(managerView.messages.some(m=>m.id===f.message.id))
  assert.equal('membershipChanges' in managerView.threads.find(t=>t.id===f.thread.id),false,'membership review reasons remain owner-private')
  assert.ok((await h.state()).events.some(e=>e.action==='chat.removeMember'&&e.entityId===f.thread.id&&e.actorRole==='owner'))
  await h.restart();await denied(h,f)
  // Returning to the cafe cannot undo an explicit removal.
  for(const site of ['West','East']){
   const p=(await h.state()).staff.find(p=>p.id===f.member.id)
   await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site})
  }
  await denied(h,f)
  // Voluntary departure removes only the acting member, never somebody else.
  const departure={...pin(saved),reason:'synthetic-lanyard voluntary departure'}
  const beforeLeave=(await h.db.prepare('SELECT * FROM l_records ORDER BY id').all()).results
  await h.cmd('chat.leave',{...departure,staffId:f.owner.id},f.manager.cookie,400)
  await h.cmd('chat.leave',{...departure,revision:f.thread.revision},f.manager.cookie,409)
  assert.deepEqual((await h.db.prepare('SELECT * FROM l_records ORDER BY id').all()).results,beforeLeave)
  const left=await h.cmd('chat.leave',departure,f.manager.cookie)
  assert.deepEqual(left.members,[f.owner.id])
  assert.equal(left.membershipChanges.at(-1).action,'left')
  assert.equal(left.membershipChanges.at(-1).staffId,f.manager.id)
  await denied(h,{...f,member:f.manager})
  await h.restart();await denied(h,{...f,member:f.manager})
  assert.equal((await h.send(f.file,undefined,h.owner)).status,200)
  const p=(await h.state()).staff.find(p=>p.id===f.owner.id)
  await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'West'})
  await refused({...pin(saved),staffId:f.manager.id,reason:'Transferred owner attempt'},h.owner,404)
 }finally{await h.close()}
}
export async function chatMembershipBrowser(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now:'2026-10-26T12:00:00Z'}),context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}})
  try{
   const f=await fixture(h),page=await context.newPage()
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await page.goto(h.origin+'/app/chat',{waitUntil:'networkidle'})
   assert.equal(new URL(page.url()).pathname,'/app/chat',await page.locator('body').innerText())
   assert.equal(await page.locator('form[action*="name=chat.removeMember"]').count(),1,await page.locator('main').innerText())
   const form=page.locator('form[action*="name=chat.removeMember"]')
   await form.locator('select[name=staffId]').selectOption(f.member.id)
   await form.getByLabel('Membership review reason',{exact:true}).fill('Reviewed operational group departure')
   const account=page.getByLabel('Account',{exact:true});await account.focus()
   await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
   const shot=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.CHAT_SCREENS){await mkdir(process.env.CHAT_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.CHAT_SCREENS,`${label}-${width}.png`),fullPage:true})}}
   await shot('chat-membership-review')
   await form.getByRole('button',{name:'Remove member',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await form.locator(`option[value="${f.member.id}"]`).count(),0)
   assert.ok((await page.locator('main').innerText()).includes('synthetic-lanyard-2 retained service history'))
   await denied(h,f);await shot('chat-membership-removed')
   const leave=page.locator('form[action*="name=chat.leave"]')
   await leave.getByLabel('Departure reason',{exact:true}).fill('synthetic-lanyard voluntary departure')
   await leave.getByRole('button',{name:'Leave group',exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('form[action*="name=chat.leave"]').count(),0)
   assert.ok(!(await page.locator('main').innerText()).includes('synthetic-lanyard-2 retained service history'))
   await denied(h,{...f,member:{...f.owner,cookie:h.owner}});await shot('chat-membership-left')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

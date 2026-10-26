import {iconTooltips} from './browser-controls.mjs'
// Native AI doors with fakes only at the paid provider edge. No test registrations here.
import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'

const week='2026-10-26',site='Harbor',timezone='America/New_York'
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XcAAAAASUVORK5CYII='
const photo={name:'synthetic-ai-schedule.png',type:'image/png',data:png}
const cell=(value,field,ambiguous=false)=>({value,confidence:ambiguous?0.42:0.97,ambiguous,source:{kind:field==='label'?'request':'image',reference:field==='label'?'staffing request':`row 2, ${field}`,excerpt:String(value??'unreadable')}})
const output=()=>({rows:[{employee:cell('Alex','employee',true),site:cell(site,'site'),startLocal:cell('2026-11-01T01:30','start',true),endLocal:cell('2026-11-01T03:30','end'),breakMinutes:cell(30,'meal'),label:cell('Counter','label'),notes:['The name is abbreviated and the start repeats during the DST transition.']}],warnings:['Confirm the employee and repeated local time.']})
function fakeProvider(requests){return async request=>{
 assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(request.method,'POST')
 const payload=await request.json();requests.push(payload);assert.equal(payload.store,false);assert.equal(payload.input[0].content[1].type,'input_image');assert.equal(payload.text.format.type,'json_schema')
 assert.ok(!JSON.stringify(payload).includes('hourlyRate'));assert.ok(!JSON.stringify(payload).includes('timesheets'))
 return Response.json({id:'synthetic-lanyard-101',status:'completed',model:payload.model,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output())}]}]})
}}
async function person(h,short,name,role='staff',cafe=site){const p=await h.person(short,role);await h.cmd('staff.save',{id:p.id,revision:p.revision,name,email:p.email,payrollId:p.payrollId,role,active:true,position:'Counter',hourlyRate:24,site:cafe});return {...p,name,site:cafe}}
async function setup(h){await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'});await h.cmd('settings.save',{timezone});return person(h,'Alex','Alex Rivera')}
const consent=()=>({week,site,request:'Use this schedule image. Set the position to Counter.',image:photo,consent:true})
const saved=async(h,id)=>(await h.state()).aischedules.find(x=>x.id===id)
const reviewedRow=(p,extra={})=>({sourceIndex:0,staffId:p.id,site,startLocal:'2026-11-01T01:30',endLocal:'2026-11-01T03:30',breakMinutes:30,label:'Counter',confirmed:true,...extra})
async function allow(h,p){await h.cmd('availability.save',{staffId:p.id,start:'2026-10-26T00:00:00Z',end:'2026-11-03T00:00:00Z'})}

export async function aiScheduleApi(){
 const requests=[],h=await harness({now:'2026-10-26T12:00:00Z',auth:{OPENAI_API_KEY:'synthetic-lanyard-101'},modelOutbound:fakeProvider(requests)})
 try{
  const p=await setup(h),before=await h.state(),time=await h.cmd('time.prepare',{staffId:p.id,start:'2026-10-19T12:00:00Z',end:'2026-10-19T20:00:00Z',breakMinutes:30,reason:'Manager verified missed time'})
  await h.cmd('time.approve',{id:time.id,revision:time.revision});const approved=structuredClone((await h.state()).timesheets)
  const source=await h.cmd('ai.consent',consent());assert.equal(requests.length,0,'consent is retained before any provider request');assert.equal(source.status,'consented');assert.equal(source.image,undefined)
  let record=await saved(h,source.id);assert.equal(record.consent.actor,before.actor.id);assert.ok((await h.state()).events.some(e=>e.action==='ai.consent'&&e.entityId===source.id));assert.equal(record.image.data,undefined,'snapshot does not carry image bytes')
  await h.cmd('ai.prepare',{id:source.id,revision:source.revision},h.owner,409)
  const extraction=await h.cmd('ai.extract',{id:source.id,revision:source.revision});assert.equal(requests.length,1);assert.equal((await h.state()).rosters.length,before.rosters.length)
  record=await saved(h,source.id);assert.equal(record.extraction.rows[0].employee.ambiguous,true);assert.ok(record.extraction.rows[0].employee.source.reference)
  await h.cmd('ai.prepare',{id:source.id,revision:extraction.revision},h.owner,409)
  let review=await h.cmd('ai.review',{id:source.id,revision:extraction.revision,reason:'Correct abbreviated name and check venue occurrence',rows:[reviewedRow(p)]})
  record=await saved(h,source.id);assert.equal(record.status,'extracted');assert.equal(record.issues.find(x=>x.field==='start').candidates.length,2)
  review=await h.cmd('ai.review',{id:source.id,revision:review.revision,reason:'Choose the later repeated occurrence after checking source',rows:[reviewedRow(p,{startChoice:'2026-11-01T06:30:00.000Z'})]})
  record=await saved(h,source.id);assert.equal(record.status,'reviewed');assert.ok(record.validation.conflicts.some(x=>x.reason==='Outside availability'));assert.equal(record.validation.added.length,1);assert.ok(record.validation.warnings.some(x=>x.kind==='missing forecast'))
  await h.cmd('ai.prepare',{id:source.id,revision:review.revision-1},h.owner,409)
  const prepared=await h.cmd('ai.prepare',{id:source.id,revision:review.revision});assert.equal(prepared.approvalRequired,'roster.publish');assert.equal((await h.state(p.cookie)).shifts.length,0)
  await h.cmd('roster.publish',prepared.approval,h.owner,409)
  await allow(h,p);await h.cmd('roster.publish',{...prepared.approval,revision:prepared.approval.revision+1},h.owner,409)
  await h.cmd('roster.publish',prepared.approval)
  const state=await h.state(),shift=state.shifts.find(x=>x.rosterId===prepared.rosterId&&x.status==='published');assert.equal(shift.start,'2026-11-01T06:30:00.000Z');assert.equal(shift.minutes,90);assert.deepEqual(state.timesheets,approved,'AI output never changes approved time');assert.equal((await h.state(p.cookie)).shifts[0].id,shift.id)
  // A reviewed source cannot overwrite a changed schedule.
  const second=await h.cmd('ai.consent',consent()),extracted=await h.cmd('ai.extract',{id:second.id,revision:second.revision})
  const checked=await h.cmd('ai.review',{id:second.id,revision:extracted.revision,reason:'Verified the same source',rows:[reviewedRow(p,{startChoice:'2026-11-01T06:30:00.000Z'})]})
  await h.cmd('roster.prepare',{week,shifts:[{staffId:p.id,start:'2026-10-27T12:00:00Z',end:'2026-10-27T20:00:00Z',breakMinutes:30,label:'Counter',site}]})
  await h.cmd('ai.prepare',{id:second.id,revision:checked.revision},h.owner,409)
 }finally{await h.close()}
}

export async function aiScheduleScopeApi(){
 const requests=[],h=await harness({now:'2026-10-26T12:00:00Z',auth:{OPENAI_API_KEY:'synthetic-lanyard-101'},modelOutbound:fakeProvider(requests)})
 try{
  const p=await setup(h),manager=await person(h,'Priya','Priya Shah','manager'),foreign=await person(h,'Dee','Dee Moreno','manager','Market'),agent=await h.cmd('agent.create',{label:'Draft assistant'}),source=await h.cmd('ai.consent',consent())
  const state=await h.state(),version=state.version
  for(const who of [p.cookie,manager.cookie,foreign.cookie]){
   assert.deepEqual((await h.state(who)).aischedules,[])
   assert.equal((await h.send(`/api/lanyard/ai-schedules/${source.id}/source`,undefined,who)).status,403)
   for(const [name,input] of [['ai.consent',consent()],['ai.extract',{id:source.id,revision:source.revision}],['ai.review',{id:source.id,revision:source.revision,rows:[],reason:'unauthorized'}],['ai.prepare',{id:source.id,revision:source.revision}],['ai.erase',{id:source.id,revision:source.revision,consent:true,reason:'unauthorized'}]])await h.cmd(name,input,who,403)
  }
  assert.equal((await h.send('/api/lanyard/command',{name:'ai.extract',input:{id:source.id,revision:source.revision}},'')).status,401)
  assert.equal((await h.send('/api/lanyard/command',{name:'ai.extract',input:{id:source.id,revision:source.revision}},h.owner,{origin:'https://foreign.example'})).status,403)
  const token=agent.token??agent.key;assert.ok(token)
  assert.equal((await h.send('/api/lanyard/agent/command',{name:'ai.extract',input:{id:source.id,revision:source.revision}},'',{authorization:`Bearer ${token}`})).status,403)
  const context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${token}`});assert.equal(context.status,200);assert.deepEqual(context.value.aischedules,[])
  assert.equal(requests.length,0);assert.equal((await h.state()).version,version,'denials have no business writes')
  const original=await h.mf.dispatchFetch(h.origin+`/api/lanyard/ai-schedules/${source.id}/source`,{headers:{cookie:h.owner}});assert.equal(original.status,200);assert.deepEqual(Buffer.from(await original.arrayBuffer()),Buffer.from(png,'base64'))
  const extraction=await h.cmd('ai.extract',{id:source.id,revision:source.revision});assert.equal(requests.length,1)
  const sent=JSON.parse(requests[0].input[0].content[0].text);assert.ok(sent.people.some(x=>x.id===p.id));assert.ok(sent.people.every(x=>x.site===site));assert.ok(!JSON.stringify(sent).includes(foreign.id))
  await h.cmd('ai.erase',{id:source.id,revision:extraction.revision,reason:'No longer needed',consent:true})
  const erased=await saved(h,source.id);assert.equal(erased.status,'erased');for(const field of ['request','image','extraction','reviewRows','validation','reviewedShifts'])assert.equal(erased[field],undefined)
  assert.equal((await h.send(`/api/lanyard/ai-schedules/${source.id}/source`,undefined,h.owner)).status,404)
  await h.cmd('ai.extract',{id:source.id,revision:erased.revision},h.owner,409);assert.equal(requests.length,1)
  await h.restart();assert.equal((await saved(h,source.id)).status,'erased')
  const receipts=await h.db.prepare('SELECT result FROM l_commands').all();assert.ok(receipts.results.every(x=>!x.result.includes(png)&&!x.result.includes(consent().request)),'command receipts retain no erased source')
  assert.ok((await h.state()).events.some(e=>e.action==='ai.erase'&&e.entityId===source.id))
 }finally{await h.close()}
}

async function browserContext(browser,h,width){
 const context=await browser.newContext({viewport:{width,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}});context.setDefaultTimeout(20000)
 const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 return context
}
async function shot(page,name){await iconTooltips(page);if(process.env.AI_SCREENS){await mkdir(process.env.AI_SCREENS,{recursive:true});await page.locator('#ai-schedule').scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.AI_SCREENS,name+'.png'),fullPage:true})}}
async function action(page,button,name){const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name='+name)),page.waitForEvent('load'),button.click()]);assert.equal(response.status(),200);const html=await response.text();assert.equal(html.match(/<div class="notice error"[^>]*>(.*?)<\/div>/s)?.[1]??null,null);await page.waitForLoadState('networkidle')}

export async function aiScheduleBrowser(){
 const requests=[],h=await harness({now:'2026-10-26T12:00:00Z',auth:{OPENAI_API_KEY:'synthetic-lanyard-101'},modelOutbound:fakeProvider(requests)}),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const p=await setup(h);await allow(h,p)
  for(const width of [1440,390]){
   const context=await browserContext(browser,h,width),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await page.goto(h.origin+`/app/schedule?week=${week}&site=${site}&view=draft`,{waitUntil:'networkidle'})
   const card=page.locator('#ai-schedule');if(!(await card.getAttribute('open')))await card.locator(':scope > summary').click()
   const upload=card.locator('[data-ai-upload]');if(!(await upload.isVisible()))await card.getByText('Start a new extraction',{exact:true}).click()
   await upload.getByLabel('Cafe',{exact:true}).selectOption(site);await upload.getByLabel('Staffing request',{exact:true}).fill(consent().request)
   await upload.getByLabel('Schedule image',{exact:true}).setInputFiles({name:photo.name,mimeType:photo.type,buffer:Buffer.from(png,'base64')});await upload.locator('[name=consent]').check();const prior=requests.length
   await action(page,upload.getByRole('button',{name:'Save consent and source'}),'ai.consent');assert.equal(requests.length,prior)
   const source=(await h.state()).aischedules.findLast(x=>x.status==='consented'),entry=()=>page.locator(`[data-ai-source="${source.id}"]`)
   await shot(page,`consent-${width}`);await action(page,entry().getByRole('button',{name:'Extract with OpenAI'}),'ai.extract');assert.equal(requests.length,prior+1)
   assert.ok(await entry().getByText('Source row 1',{exact:false}).isVisible());await entry().getByText('Confidence and source references',{exact:true}).click();await shot(page,`extracted-${width}`)
   const review=()=>entry().locator('[data-ai-review]'),row=()=>review().locator('[data-ai-row="0"]')
   assert.equal(await row().locator('[data-ai-field=staffId]').inputValue(),'','ambiguous employee is never auto-selected')
   await row().locator('[data-ai-field=staffId]').selectOption(p.id);await row().locator('[data-ai-field=confirmed]').check();await review().getByLabel('Review and correction note',{exact:true}).fill('Checked abbreviated name; inspect the repeated local start')
   await action(page,review().getByRole('button',{name:'Validate corrected proposal'}),'ai.review');assert.ok(await row().getByLabel('Exact start occurrence',{exact:true}).isVisible())
   await row().getByLabel('Exact start occurrence',{exact:true}).selectOption('2026-11-01T06:30:00.000Z');await row().locator('[data-ai-field=confirmed]').check()
   await action(page,review().getByRole('button',{name:'Validate corrected proposal'}),'ai.review');assert.ok(await entry().locator('[data-ai-validation]').isVisible());await shot(page,`review-${width}`)
   await action(page,entry().getByRole('button',{name:'Prepare reviewed draft'}),'ai.prepare');assert.equal((await h.state()).rosters.find(x=>x.status==='draft').status,'draft')
   await page.goto(h.origin+`/app/schedule?week=${week}&site=${site}&view=draft`,{waitUntil:'networkidle'});assert.ok(await page.locator('[data-saved-review]').isVisible())
   await action(page,page.getByRole('button',{name:'Publish this revision',exact:true}),'roster.publish');assert.ok((await h.state(p.cookie)).shifts.some(x=>x.start==='2026-11-01T06:30:00.000Z'))
   await shot(page,`published-${width}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');assert.deepEqual(errors,[]);await context.close()
  }
 }finally{await browser.close();await h.close()}
}

/** Explicit held-key proof only, never part of the ordinary suite. One real provider request. */
export async function aiLive(){
 assert.ok(process.env.OPENAI_API_KEY,'A held OPENAI_API_KEY is required')
 let calls=0,usage
 const modelOutbound=async request=>{assert.equal(++calls,1,'live journey permits one extraction request');const response=await fetch(request.url,{method:request.method,headers:request.headers,body:await request.arrayBuffer()});if(response.ok){const body=await response.clone().json();usage=body.usage}return response}
 const h=await harness({now:'2026-10-26T12:00:00Z',auth:{OPENAI_API_KEY:process.env.OPENAI_API_KEY,...(process.env.OPENAI_MODEL?{OPENAI_MODEL:process.env.OPENAI_MODEL}:{})},modelOutbound}),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const p=await setup(h);await allow(h,p)
  const fixture=await browser.newPage({viewport:{width:1050,height:480}})
  await fixture.setContent('<!doctype html><html><body style="font:24px Arial;padding:32px;background:#fff;color:#111"><h1>Harbor cafe</h1><h2>Week starting Monday 26 October 2026</h2><p>Synthetic schedule fixture. Venue: America/New_York.</p><table style="border-collapse:collapse" border="1" cellpadding="20"><tr><th>Employee</th><th>Date</th><th>Local start</th><th>Local end</th><th>Unpaid meal</th><th>Position</th></tr><tr><td>Alex Rivera</td><td>26 Oct 2026</td><td>08:00 AM</td><td>04:00 PM</td><td>30 minutes</td><td>Counter</td></tr></table></body></html>')
  const bytes=await fixture.screenshot({type:'png',fullPage:true});await fixture.close()
  const source=await h.cmd('ai.consent',{week,site,request:'Read the attached schedule. Move Alex Rivera’s Monday start to 09:00 AM. Keep the end time, 30-minute unpaid meal and Counter position. This is synthetic material authorized for this test.',image:{name:'synthetic-harbor-schedule.png',type:'image/png',data:bytes.toString('base64')},consent:true})
  assert.equal(calls,0);const extracted=await h.cmd('ai.extract',{id:source.id,revision:source.revision}),record=await saved(h,source.id)
  assert.equal(calls,1);assert.ok(record.providerId);assert.equal(record.extraction.rows.length,1);const row=record.extraction.rows[0]
  assert.match(row.employee.value,/Alex/i);assert.equal(row.startLocal.value,'2026-10-26T09:00');assert.ok(Object.values(row).some(v=>v?.source?.kind==='image'));assert.ok(Object.values(row).some(v=>v?.source?.kind==='request'))
  const corrected={sourceIndex:0,staffId:p.id,site,startLocal:'2026-10-26T09:00',endLocal:'2026-10-26T16:00',breakMinutes:30,label:'Counter',confirmed:true}
  const reviewed=await h.cmd('ai.review',{id:source.id,revision:extracted.revision,rows:[corrected],reason:'Checked source image, employee identity and changed local start; confirmed each field'})
  assert.equal((await saved(h,source.id)).status,'reviewed')
  for(const width of [1440,390]){const context=await browserContext(browser,h,width),page=await context.newPage();await page.goto(h.origin+`/app/schedule?week=${week}&site=${site}&view=draft`,{waitUntil:'networkidle'});await shot(page,`live-review-${width}`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close()}
  const prepared=await h.cmd('ai.prepare',{id:source.id,revision:reviewed.revision});await h.cmd('roster.publish',prepared.approval)
  const own=(await h.state(p.cookie)).shifts;assert.equal(own.length,1);assert.equal(own[0].start,'2026-10-26T13:00:00.000Z')
  console.log(JSON.stringify({proof:'AI-001 synthetic held-provider extraction and native review',model:record.model,providerId:record.providerId,calls,inputTokens:usage?.input_tokens,outputTokens:usage?.output_tokens,rosterPublished:true,buyerPhoto:false}))
 }finally{await browser.close();await h.close()}
}

import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
export async function templateFixture(h){
 const alex=await h.person('Alex'),cy=await h.person('Cy'),manager=await h.person('Morgan','manager')
 for(const p of [alex,cy])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,hourlyRate:'20.00'})
 const enter=async(p,day,minutes=480,extra={})=>{const start=`2026-10-${day}T15:00:00Z`,end=new Date(Date.parse(start)+minutes*60000).toISOString();return h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:p.id,start,end,breakMinutes:0,reason:'Reviewed source time',...extra})))}
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 const times=[await enter(alex,12),await enter(alex,13),await enter(cy,12)]
 const spec={approved:true,name:'Mapped employee earnings',delimiter:',',header:true,columns:[{field:'employee',header:'Worker'},{field:'workflow',header:'Treatment'},{field:'code',header:'Earning'},{field:'hours',header:'Quantity'}],groupBy:[],dateFormat:'iso',decimals:4,employees:{[alex.id]:{id:'=synthetic-lanyard-1',workflow:'W-2'},[cy.id]:{id:'synthetic-lanyard-2',workflow:'1099'}},codes:{regular:'REG'},jobs:{},locations:{}}
 return {alex,cy,manager,times,spec,enter}
}
export async function templatesApi(h){
 const f=await templateFixture(h),{alex,cy,manager,times,spec,enter}=f
 await h.cmd('payroll.template.save',spec,alex.cookie,403)
 await h.cmd('payroll.template.save',spec,manager.cookie,403)
 const unapproved=await h.cmd('payroll.template.save',{...spec,approved:undefined})
 const refusal=await h.cmd('payroll.prepare',{templateId:unapproved.id},h.owner,409);assert.match(JSON.stringify(refusal),/not owner-approved/)
 let t=await h.cmd('payroll.template.save',{...spec,codes:{}})
 await h.cmd('payroll.prepare',{templateId:t.id},h.owner,409)
 assert.equal((await h.state()).batches.length,0,'mapping refusal creates no batch or claim')
 t=await h.cmd('payroll.template.save',{...spec,...pin(t)})
 const unknown=await h.cmd('payroll.template.save',{...spec,employees:{...spec.employees,[cy.id]:{id:'synthetic-lanyard-2',workflow:'unclassified'}}})
 const unclassified=await h.cmd('payroll.prepare',{templateId:unknown.id},h.owner,409);assert.match(JSON.stringify(unclassified),/unclassified/);assert.equal((await h.state()).paytemplates.find(x=>x.id===unknown.id).employees[cy.id].workflow,'unclassified')
 const classified=await h.cmd('payroll.template.save',{...spec,...pin(unknown)});assert.ok((await h.cmd('payroll.prepare',{templateId:classified.id})).csvPreview.includes('1099'))
 const draft=await h.cmd('payroll.prepare',{templateId:t.id}),competing=await h.cmd('payroll.prepare',{templateId:t.id})
 assert.equal(draft.csvPreview,"Worker,Treatment,Earning,Quantity\r\n'=synthetic-lanyard-1,W-2,REG,16.0000\r\nsynthetic-lanyard-2,1099,REG,8.0000\r\n")
 assert.equal(draft.lines.reduce((n,l)=>n+l.minutes,0),1440)
 await h.cmd('payroll.export',pin(draft),manager.cookie,403)
 assert.deepEqual((await h.state(manager.cookie)).paytemplates,[])
 assert.ok(!(await h.state(manager.cookie)).batches.some(b=>b.id===draft.id))
 assert.deepEqual((await h.state(alex.cookie)).paytemplates,[])
 const key=await h.cmd('agent.create',{label:'synthetic-lanyard-3'}),agent=await h.send('/api/lanyard/agent/command',{name:'payroll.prepare',input:{templateId:t.id}},'',{authorization:`Bearer ${key.token}`})
 assert.equal(agent.status,403)
 const agentState=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`})
 assert.deepEqual(agentState.value.paytemplates,[]);assert.ok(!JSON.stringify(agentState.value).includes('=synthetic-lanyard-1'))
 // Exact retained template and source revision must still hold at approval.
 t=await h.cmd('payroll.template.save',{...spec,...pin(t),codes:{regular:'BASE'}})
 await h.cmd('payroll.export',pin(draft),h.owner,409)
 assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_payroll_claims').first()).n,0)
 const current=await h.cmd('payroll.prepare',{templateId:t.id}),sent=await h.cmd('payroll.export',pin(current)),path=`/api/lanyard/batches/${sent.id}.csv`
 assert.equal(sent.csv,current.csvPreview)
 assert.equal((await h.send(path,undefined,h.owner)).text,(await h.send(path,undefined,h.owner)).text)
 for(const cookie of [alex.cookie,manager.cookie])assert.equal((await h.send(path,undefined,cookie)).status,403)
 await h.cmd('payroll.acknowledge',{...pin(sent),reference:'synthetic-lanyard-4'},manager.cookie,403)
 await h.cmd('payroll.export',pin(competing),h.owner,409)
 // No duplicate upload claim, and a late correction groups only its signed delta.
 const corrected=await enter(alex,12,420,{corrects:times[0].id,reason:'Reviewed negative correction'})
 const delta=await h.cmd('payroll.prepare',{ids:[corrected.id],templateId:t.id})
 assert.match(delta.csvPreview,/-1\.0000/);assert.equal(delta.lines.reduce((n,l)=>n+l.minutes,0),-60)
 await h.cmd('payroll.export',pin(delta))
 assert.equal((await h.send(path,undefined,h.owner)).text,sent.csv)
 // Captured UTC boundaries survive date grouping and payable-hour formatting.
 await enter(alex,14,450)
 const dated={...spec,name:'Dated output',delimiter:'\t',groupBy:['date'],dateFormat:'us',decimals:2,columns:[{field:'employee',header:'Worker'},{field:'date',header:'Day'},{field:'start',header:'Captured start'},{field:'end',header:'Captured end'},{field:'minutes',header:'Minutes'},{field:'hours',header:'Hours'}]}
 const daily=await h.cmd('payroll.template.save',dated),datedBatch=await h.cmd('payroll.prepare',{templateId:daily.id})
 assert.match(datedBatch.csvPreview,/10\/14\/2026\t2026-10-14T15:00:00.000Z\t2026-10-14T22:30:00.000Z\t450\t7.50/)
 await h.restart();assert.equal((await h.state()).paytemplates.find(r=>r.id===daily.id).delimiter,'\t')
 assert.equal((await h.send(path,undefined,h.owner)).text,sent.csv)
 // Native premium sources cannot silently receive contractor employee treatment.
 const rule=await h.cmd('breakrule.save',{site:'',mealAfterMinutes:300,mealMinutes:30,restEveryMinutes:240,restMinutes:10,waiveUpTo:360,premium:true})
 assert.ok(rule.id)
 const prem=await enter(cy,15,480)
 const contractor=await h.cmd('payroll.template.save',{...spec,codes:{regular:'REG','meal premium':'MEAL','rest premium':'REST'}})
 const denied=await h.cmd('payroll.prepare',{ids:[prem.id],templateId:contractor.id},h.owner,409);assert.match(JSON.stringify(denied),/Contractor workflow supports regular worked time only/)
 for(const journey of [contractorOvertime,legacyClassification]){const edge=await harness();try{await journey(edge)}finally{await edge.close()}}
}

export async function templatesBrowser(){
 if(process.env.PAY_SCREENS)await mkdir(process.env.PAY_SCREENS,{recursive:true})
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390])for(const format of ['csv','xlsx']){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await templateFixture(h)
   await h.cmd('policy.save',{site:'',from:'2026-10-01',preset:'CA',reviewReason:'Employer reviewed overtime core'})
   await f.enter(f.alex,14,780)
   await h.cmd('payroll.input.save',{staffId:f.alex.id,date:'2026-10-12',kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-9',reason:'Approved paid non-work input'})
   await h.cmd('payroll.input.save',{staffId:f.alex.id,date:'2026-10-12',kind:'tips',minutes:0,amountCents:3000,reference:'synthetic-lanyard-10',reason:'Approved tip allocation'})
   const spec={...f.spec,classification:'policy',format,codes:{regular:'REG',overtime:'OT','double time':'DT',PTO:'VAC',tips:'TIP'}},template=await h.cmd('payroll.template.save',spec)
   const unapproved=await h.cmd('payroll.template.save',{...spec,name:'Pending owner approval',approved:false})
   const unknown=await h.cmd('payroll.template.save',{...spec,name:'Legacy classification review',employees:{...spec.employees,[f.cy.id]:{id:'synthetic-lanyard-2',workflow:'unclassified'}}})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   const page=await context.newPage();await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   for(const [id,reason] of [[unapproved.id,'not owner-approved'],[unknown.id,'unclassified']]){await page.getByLabel('Export template',{exact:true}).selectOption(id);await page.getByRole('button',{name:'Prepare batch',exact:true}).click();await page.waitForLoadState('networkidle');assert.ok((await page.locator('.notice.error').innerText()).includes(reason));if(process.env.PAY_SCREENS)await page.screenshot({path:join(process.env.PAY_SCREENS,`refused-${id===unapproved.id?'approval':'classification'}-${format}-${width}.png`),fullPage:true})}
   await page.getByLabel('Export template',{exact:true}).selectOption(template.id);await page.getByRole('button',{name:'Prepare batch',exact:true}).click();await page.waitForLoadState('networkidle')
   const draft=(await h.state()).batches.find(b=>b.exportTemplate?.id===template.id);assert.ok(draft)
   const card=page.locator('.batch').filter({hasText:draft.id.slice(0,8)})
   assert.equal(await card.locator('pre.csv').innerText(),draft.csvPreview.replaceAll('\r\n','\n'))
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await card.locator('input[type=checkbox]').check();await card.getByRole('button',{name:`Export reviewed ${format.toUpperCase()}`,exact:true}).click();await page.waitForLoadState('networkidle')
   assert.equal(await page.locator('.notice.error').count(),0)
   const sent=(await h.state()).batches.find(b=>b.id===draft.id);assert.equal(sent.csv,draft.csvPreview);assert.equal(sent.status,'exported')
   assert.ok((await card.innerText()).includes('W-2'));assert.ok((await card.innerText()).includes('1099'))
   const account=page.locator('.me > summary');await account.focus();assert.equal(await page.locator('#control-tooltip').innerText(),'Account menu');assert.equal(await page.locator('#control-tooltip').isVisible(),true);await account.blur();await account.hover();await page.waitForTimeout(350);assert.equal(await page.locator('#control-tooltip').isVisible(),true)
   const icons=page.locator('button, a.button');for(let i=0;i<await icons.count();i++){const control=icons.nth(i);if(!(await control.textContent()).trim())assert.ok(await control.getAttribute('data-tip')||await control.getAttribute('data-tooltip'),'icon control has a tooltip: '+await control.evaluate(e=>e.outerHTML))}
   if(process.env.PAY_SCREENS){await mkdir(process.env.PAY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.PAY_SCREENS,`mapped-payroll-${format}-${width}.png`),fullPage:true})}
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

export async function classificationApi(h){
 const alex=await h.person('Alex'),cy=await h.person('Cy')
 for(const p of [alex,cy])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,hourlyRate:'20.00'})
 await h.cmd('policy.save',{site:'',from:'2026-10-01',preset:'CA',reviewReason:'Employer reviewed maintained overtime core'})
 const enter=async(p,minutes,extra={})=>{const start='2026-10-12T15:00:00Z';return h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:p.id,start,end:new Date(Date.parse(start)+minutes*60000).toISOString(),breakMinutes:0,reason:'Employer approved captured time',...extra})))}
 const a=await enter(alex,780),b=await enter(cy,780)
 let period=await h.cmd('period.save',{start:'2026-10-12',end:'2026-10-18'})
 for(const cookie of [alex.cookie,cy.cookie,h.owner])period=await h.cmd('period.signoff',pin(period),cookie)
 period=await h.cmd('period.lock',pin(period))
 const spec={approved:true,name:'Policy-classified earnings',classification:'policy',delimiter:',',header:true,columns:[{field:'employee',header:'Worker'},{field:'workflow',header:'Treatment'},{field:'code',header:'Earning'},{field:'minutes',header:'Minutes'},{field:'amount',header:'USD'}],groupBy:[],dateFormat:'iso',decimals:4,employees:{[alex.id]:{id:'synthetic-lanyard-1',workflow:'W-2'},[cy.id]:{id:'synthetic-lanyard-2',workflow:'1099'}},codes:{regular:'REG',overtime:'OT','double time':'DT',PTO:'VAC',tips:'TIP'},jobs:{},locations:{}}
 let template=await h.cmd('payroll.template.save',{...spec,codes:{regular:'REG',overtime:'OT'}})
 await h.cmd('payroll.prepare',{templateId:template.id},h.owner,409)
 template=await h.cmd('payroll.template.save',{...spec,...pin(template)})
 await h.cmd('payroll.input.save',{staffId:alex.id,date:'2026-10-12',kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-7',reason:'Employer approved paid leave input'})
 await h.cmd('payroll.input.save',{staffId:alex.id,date:'2026-10-12',kind:'tips',minutes:0,amountCents:3000,reference:'synthetic-lanyard-8',reason:'Employer approved tip allocation'})
 const batch=await h.cmd('payroll.prepare',{templateId:template.id}),lines=batch.classificationLines
 assert.deepEqual([...new Set(lines.map(l=>l.earningCode))].sort(),['PTO','double time','overtime','regular','tips'])
 assert.deepEqual(lines.filter(l=>l.classifiedWorked&&l.staffId===alex.id).map(l=>[l.earningCode,l.minutes,l.costCents]),[['regular',480,16000],['overtime',240,12000],['double time',60,4000]])
 assert.deepEqual(lines.filter(l=>l.classifiedWorked&&l.staffId===cy.id).map(l=>[l.earningCode,l.minutes,l.costCents]),[['regular',780,26000]],'contractor workflow does not inherit employee overtime or tax calculations')
 assert.ok(lines.filter(l=>l.classifiedWorked).every(l=>l.policyRefs[0].preset==='CA'&&l.rateCents===2000&&l.date==='2026-10-12'))
 const sent=await h.cmd('payroll.export',pin(batch));assert.equal(sent.csv,batch.csvPreview)
 assert.ok(sent.csv.split('\r\n').includes('synthetic-lanyard-2,1099,REG,780,260.00'))
 period=await h.cmd('period.close',{...pin(period),reference:'synthetic-lanyard-11 owner-recorded provider reference'})
 const closed=structuredClone(period),beforeChange=(await h.state()).batches.find(x=>x.id===sent.id)
 template=await h.cmd('payroll.template.save',{...spec,...pin(template),name:'Later reviewed template',codes:{...spec.codes,regular:'BASE'}})
 assert.deepEqual((await h.state()).batches.find(x=>x.id===sent.id),beforeChange)
 assert.deepEqual((await h.state()).periods.find(x=>x.id===closed.id),closed)
 assert.equal(beforeChange.exportTemplate.revision,template.revision-1)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv)
 assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_payroll_claims').first()).n,2)
 const corrected=await enter(alex,720,{corrects:a.id,reason:'Employer approved late one-hour correction'})
 await h.cmd('payroll.prepare',{ids:[corrected.id]},h.owner,409)
 const delta=await h.cmd('payroll.prepare',{ids:[corrected.id],templateId:template.id})
 assert.deepEqual(delta.classificationLines.map(l=>[l.earningCode,l.minutes,l.costCents]),[['double time',-60,-4000]])
 assert.match(delta.csvPreview,/DT,-60,-40.00/)
 await h.cmd('payroll.export',pin(delta))
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv)
 // A later source rate edit cannot change the retained source amounts.
 const person=(await h.state()).staff.find(p=>p.id===alex.id)
 await h.cmd('staff.save',{...pin(person),name:alex.name,email:alex.email,payrollId:alex.payrollId,role:alex.role,active:true,hourlyRate:'35.00'})
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv)
 const final=(await h.state()).batches.filter(b=>b.status==='exported').flatMap(b=>b.classificationLines??[]).filter(l=>l.classifiedWorked&&l.staffId===alex.id)
 assert.equal(final.reduce((n,l)=>n+l.minutes,0),720);assert.equal(final.reduce((n,l)=>n+l.costCents,0),28000)
}

export async function earningInputsApi(h){
 const {tipFixture}=await import('./tipcredit-journey.mjs'),f=await tipFixture(h),{riley,morgan,server,prep,first,second}=f
 await h.cmd('tipcredit.save',{site:'Austin',state:'TX',minimumWage:'7.25',from:'2020-01-01',tippedJobs:[server.id]})
 const spec={approved:true,name:'Approved non-work inputs',classification:'policy',delimiter:';',header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Code'},{field:'minutes',header:'Minutes'},{field:'amount',header:'USD'}],groupBy:[],dateFormat:'iso',decimals:4,employees:{[riley.id]:{id:'synthetic-lanyard-1',workflow:'W-2'}},codes:{regular:'REG',overtime:'OT','double time':'DT',PTO:'VAC',tips:'TIP','tip make-up':'MAKEUP'},jobs:{[server.id]:'SERVE',[prep.id]:'PREP'},locations:{Austin:'AUSTIN'}}
 const input={staffId:riley.id,date:first,kind:'PTO',minutes:120,amountCents:2000,reference:'synthetic-lanyard-5',reason:'Employer approved PTO from its external bank'}
 await h.cmd('payroll.input.save',input,morgan.cookie,403)
 let pto=await h.cmd('payroll.input.save',input)
 await h.cmd('payroll.input.save',input,h.owner,409)
 const tips=await h.cmd('payroll.input.save',{...input,kind:'tips',minutes:0,amountCents:3000,reference:'synthetic-lanyard-6',reason:'Employer reviewed approved tip allocation'})
 let template=await h.cmd('payroll.template.save',{...spec,codes:{...spec.codes,'tip make-up':''}},h.owner,400)
 template=await h.cmd('payroll.template.save',{...spec,codes:{regular:'REG',PTO:'VAC',tips:'TIP'}})
 await h.cmd('payroll.prepare',{templateId:template.id},h.owner,409)
 template=await h.cmd('payroll.template.save',{...spec,...pin(template)})
 const {days,local}=await import('./workforce-journey.mjs'),day=days(first,2)
 const pending=await h.cmd('time.prepare',{staffId:riley.id,job:prep.id,site:'Austin',start:local(day,'09:00'),end:local(day,'10:00'),breakMinutes:0,reason:'Late source awaiting approval'})
 await h.cmd('payroll.prepare',{templateId:template.id},h.owner,409)
 f.approved.push(await h.cmd('time.approve',pin(pending)))
 const batch=await h.cmd('payroll.prepare',{templateId:template.id})
 assert.deepEqual(batch.lines.filter(l=>l.payInputId).map(l=>[l.payCode,l.minutes,l.costCents]).sort((a,b)=>a[0].localeCompare(b[0])),[['PTO',120,2000],['tips',0,3000]])
 assert.deepEqual(batch.lines.filter(l=>l.makeupKey).map(l=>[l.week,l.costCents]),[[first,6192]])
 assert.ok(batch.csvPreview.includes(';MAKEUP;0;61.92'));assert.ok(batch.csvPreview.includes(';VAC;120;20.00'));assert.ok(batch.csvPreview.includes(';TIP;0;30.00'))
 assert.ok(batch.classificationLines.filter(l=>l.classifiedWorked).every(l=>[server.id,prep.id].includes(l.job)&&l.rateCents===213))
 const sent=await h.cmd('payroll.export',pin(batch))
 await h.cmd('payroll.prepare',{templateId:template.id},h.owner,409)
 pto=await h.cmd('payroll.input.save',{...input,...pin(pto),minutes:60,amountCents:1000,reason:'Employer corrected one paid hour'})
 const delta=await h.cmd('payroll.prepare',{templateId:template.id})
 assert.deepEqual(delta.lines.filter(l=>l.payInputId).map(l=>[l.payCode,l.minutes,l.costCents]),[['PTO',-60,-1000]])
 const competing=await h.cmd('payroll.prepare',{templateId:template.id});await h.cmd('payroll.export',pin(delta));await h.cmd('payroll.export',pin(competing),h.owner,409)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv)
 assert.deepEqual((await h.state(riley.cookie)).payinputs,[]);assert.deepEqual((await h.state(morgan.cookie)).payinputs,[])
 assert.equal((await h.state()).sickuses.length,0,'employer PTO inputs do not fabricate leave-bank activity')
 assert.equal((await h.state()).timesheets.length,f.approved.length,'non-work inputs never fabricate worked time')
 assert.ok((await h.state()).events.some(e=>e.action==='payroll.input.save'&&e.entityId===tips.id))
}

export async function classifiedSegmentsApi(h,transfer=false){
 const {handoverFixture,captureWork}=await import('./shiftwork-fixture.mjs'),f=await handoverFixture(h,!transfer)
 let time
 if(transfer){await h.cmd('clock.in',{commandId:crypto.randomUUID(),capturedAt:f.start},f.alex.cookie);await h.cmd('clock.transfer',{commandId:crypto.randomUUID(),capturedAt:new Date(Date.parse(f.start)+240*60000).toISOString(),job:f.kitchen.id},f.alex.cookie);time=(await h.cmd('clock.out',{commandId:crypto.randomUUID(),capturedAt:f.end,breakMinutes:0},f.alex.cookie)).timesheet}else time=(await captureWork(h,f)).time
 const approved=await h.cmd('time.approve',pin(time),f.manager.cookie)
 const spec={approved:true,name:'Classified area sources',classification:'policy',delimiter:',',header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Code'},{field:'job',header:'Job'},{field:'location',header:'Cafe'},{field:'minutes',header:'Minutes'},{field:'amount',header:'USD'}],groupBy:['job','location'],dateFormat:'iso',decimals:4,employees:{[f.alex.id]:{id:'synthetic-lanyard-1',workflow:'W-2'}},codes:{regular:'REG'},jobs:{[f.counter.id]:'COUNT',[f.kitchen.id]:'COOK'},locations:{'Ocean Beach':'OB'}}
 let template=await h.cmd('payroll.template.save',{...spec,jobs:{[f.counter.id]:'COUNT'}})
 await h.cmd('payroll.prepare',{ids:[approved.id],templateId:template.id},h.owner,409)
 template=await h.cmd('payroll.template.save',{...spec,...pin(template)})
 const batch=await h.cmd('payroll.prepare',{ids:[approved.id],templateId:template.id})
 assert.deepEqual(batch.classificationLines.map(l=>[l.job,l.minutes,l.rateCents]),[[f.counter.id,240,2000],[f.kitchen.id,240,2400]])
 assert.equal(batch.classificationLines.reduce((n,l)=>n+l.minutes,0),approved.minutes)
 assert.ok(batch.classificationLines.every(l=>l.rateReference.profileId===f.profile.id&&l.sourceStart===approved.start&&l.sourceEnd===approved.end))
 const sent=await h.cmd('payroll.export',pin(batch))
 const correction=await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:f.alex.id,start:approved.start,end:approved.end,breakMinutes:transfer?29:59,corrects:approved.id,reason:'Reviewed signed job and area correction'})))
 const delta=await h.cmd('payroll.prepare',{ids:[correction.id],templateId:template.id})
 assert.deepEqual(delta.classificationLines.map(l=>[l.job,l.minutes]),[[f.counter.id,-14],[f.kitchen.id,-15]])
 assert.equal(delta.classificationLines.reduce((n,l)=>n+l.minutes,0),-29)
 await h.cmd('payroll.export',pin(delta))
 assert.equal((await h.db.prepare('SELECT count(*) AS n FROM l_payroll_claims WHERE root_id=?').bind(approved.rootId).first()).n,2)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv)
}

export async function workbookApi(h){
 const {unzipSync,strFromU8}=await import('fflate'),{createHash}=await import('node:crypto'),f=await templateFixture(h)
 const spec={...f.spec,format:'xlsx'},template=await h.cmd('payroll.template.save',spec),batch=await h.cmd('payroll.prepare',{templateId:template.id}),sent=await h.cmd('payroll.export',pin(batch))
 const path=`/api/lanyard/batches/${sent.id}.xlsx`,read=async()=>{const response=await h.mf.dispatchFetch(h.origin+path,{headers:{cookie:h.owner}});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/spreadsheetml.sheet/);return Buffer.from(await response.arrayBuffer())}
 const first=await read(),second=await read();assert.deepEqual(first,second);assert.equal(createHash('sha256').update(first).digest('hex'),sent.sha256)
 const book=unzipSync(first),sheet=strFromU8(book['xl/worksheets/sheet1.xml'])
 assert.ok(sheet.includes('<t xml:space="preserve">Worker</t>'));assert.ok(sheet.includes('<t xml:space="preserve">=synthetic-lanyard-1</t>'))
 assert.ok(sheet.includes('<v>16.0000</v>'));assert.ok(sheet.includes('<v>8.0000</v>'));assert.ok(!sheet.includes('<f>'),'provider IDs are text cells, never formulas')
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).status,409)
 assert.equal((await h.send(path,undefined,f.alex.cookie)).status,403)
 const t=f.times[0],correction=await f.enter(f.alex,12,465,{corrects:t.id,reason:'Reviewed workbook correction'}),delta=await h.cmd('payroll.prepare',{ids:[correction.id],templateId:template.id}),done=await h.cmd('payroll.export',pin(delta))
 const response=await h.mf.dispatchFetch(h.origin+`/api/lanyard/batches/${done.id}.xlsx`,{headers:{cookie:h.owner}}),adjusted=strFromU8(unzipSync(new Uint8Array(await response.arrayBuffer()))['xl/worksheets/sheet1.xml'])
 assert.ok(adjusted.includes('<v>-0.2500</v>'));assert.deepEqual(await read(),first)
}

export async function delimitedApi(h,format){
 const f=await templateFixture(h),{createHash}=await import('node:crypto')
 await f.enter(f.alex,12,480,{corrects:f.times[0].id,breakMinutes:30,reason:'Agreed payable break minutes'})
 const spec={...f.spec,format,delimiter:'~',header:true,groupBy:['date'],dateFormat:'us',timeFormat:'utc-minute',decimals:2,columns:[{field:'date',header:'Pay date'},{field:'employee',header:'Worker ID'},{field:'start',header:'Original start'},{field:'end',header:'Original end'},{field:'minutes',header:'Paid minutes'},{field:'hours',header:'Paid hours'}]}
 const template=await h.cmd('payroll.template.save',spec),batch=await h.cmd('payroll.prepare',{templateId:template.id}),sent=await h.cmd('payroll.export',pin(batch)),extension=format==='tsv'?'tsv':'txt',delimiter=format==='tsv'?'\t':'~'
 assert.ok(batch.csvPreview.startsWith(['Pay date','Worker ID','Original start','Original end','Paid minutes','Paid hours'].join(delimiter)+'\r\n'))
 assert.ok(batch.csvPreview.includes(['10/12/2026',"'=synthetic-lanyard-1",'2026-10-12 15:00','2026-10-12 23:00','450','7.50'].join(delimiter)))
 const path=`/api/lanyard/batches/${sent.id}.${extension}`,a=await h.send(path,undefined,h.owner),b=await h.send(path,undefined,h.owner)
 assert.equal(a.status,200);assert.equal(a.text,b.text);assert.equal(a.text,batch.csvPreview);assert.equal(createHash('sha256').update(a.text).digest('hex'),sent.sha256)
 assert.match(a.headers.get('content-type'),format==='tsv'?/tab-separated-values/:/text\/plain/)
}

async function contractorOvertime(h){
 const {payFixture}=await import('./payschedules-journey.mjs'),f=await payFixture(h)
 await f.enter(f.alex,16,5)
 await f.signLock(f.first,f.alex);await f.signLock(f.second,f.alex)
 const spec={approved:true,name:'Owner-reviewed contractor source',classification:'source',header:true,columns:[{field:'employee',header:'Employee'},{field:'code',header:'Earning'},{field:'minutes',header:'Minutes'}],groupBy:[],employees:{[f.alex.id]:{id:'synthetic-lanyard-20',workflow:'1099'}},codes:{regular:'REG','weekly overtime premium':'OT'},jobs:{},locations:{}}
 const contractor=await h.cmd('payroll.template.save',spec),before=(await h.state()).batches
 const denied=await h.cmd('payroll.prepare',{templateId:contractor.id},h.owner,409)
 assert.match(JSON.stringify(denied),/Contractor workflow supports regular worked time only/)
 assert.deepEqual((await h.state()).batches,before)
 const employee=await h.cmd('payroll.template.save',{...spec,employees:{[f.alex.id]:{id:'synthetic-lanyard-20',workflow:'W-2'}}})
 const approved=await h.cmd('payroll.prepare',{templateId:employee.id});assert.ok(approved.lines.some(l=>l.payCode==='weekly overtime premium'&&l.minutes===300))
}

async function legacyClassification(h){
 const f=await templateFixture(h),original=await h.cmd('payroll.export',pin(await h.cmd('payroll.prepare',{})))
 const correction=await f.enter(f.alex,12,420,{corrects:f.times[0].id,reason:'Owner-reviewed legacy hours correction'})
 const spec={...f.spec,classification:'policy',employees:{...f.spec.employees,[f.alex.id]:{id:'synthetic-lanyard-40',workflow:'unclassified'}}}
 let t=await h.cmd('payroll.template.save',spec)
 const unknown=await h.cmd('payroll.prepare',{ids:[correction.id],templateId:t.id},h.owner,409);assert.match(JSON.stringify(unknown),/unclassified/)
 assert.equal((await h.state()).paytemplates.find(x=>x.id===t.id).employees[f.alex.id].workflow,'unclassified')
 t=await h.cmd('payroll.template.save',{...spec,...pin(t),employees:f.spec.employees})
 const conversion=await h.cmd('payroll.prepare',{ids:[correction.id],templateId:t.id},h.owner,409);assert.match(JSON.stringify(conversion),/Previously exported hours need reconciliation/)
 assert.equal((await h.send(`/api/lanyard/batches/${original.id}.csv`,undefined,h.owner)).text,original.csv)
}

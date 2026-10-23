import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {pin,local} from './workforce-journey.mjs'
export async function differentialFixture(h){
 const alex=await h.person('Alex'),ben=await h.person('Ben'),morgan=await h.person('Morgan','manager')
 for(const p of [alex,ben,morgan])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site:'Ocean Beach',position:'Service',hourlyRate:'20.00'})
 const counter=await h.cmd('job.save',{name:'Counter',skills:[],certifications:[]}),kitchen=await h.cmd('job.save',{name:'Kitchen',skills:[],certifications:[]})
 const profile=await h.cmd('workforce.save',{staffId:alex.id,jobs:[counter.id,kitchen.id],skills:[],certifications:[],sites:['Ocean Beach'],preferences:[],minHours:0,maxHours:40,classification:'hourly',rates:[{job:counter.id,from:'2020-01-01',cents:2000},{job:kitchen.id,from:'2020-01-01',cents:2400}]})
 const base={from:'2025-01-01',site:'Ocean Beach',role:'Service',tag:'Closing',days:[0,1,2,3,4,5,6],order:0,mode:'added',value:150,code:'NIGHT'}
 const night=await h.cmd('differential.save',{...base,name:'Night',startMinute:1320,endMinute:1440})
 const early=await h.cmd('differential.save',{...base,name:'Early night',startMinute:0,endMinute:360})
 const weekend=await h.cmd('differential.save',{...base,name:'Saturday',startMinute:0,endMinute:1440,days:[6],mode:'multiplier',value:1.25,order:1,code:'WKND'})
 const shift={staffId:alex.id,start:local('2025-10-11','21:00'),end:local('2025-10-12','02:00'),breakMinutes:0,job:counter.id,site:'Ocean Beach',label:'Closing'}
 await h.cmd('availability.save',{staffId:alex.id,start:shift.start,end:shift.end})
 const draft=await h.cmd('roster.prepare',{week:'2025-10-06',shifts:[shift]});assert.deepEqual(draft.conflicts,[]);await h.cmd('roster.publish',pin(draft))
 const published=(await h.state()).shifts.find(x=>x.status==='published')
 await h.cmd('shiftwork.save',{shiftId:published.id,shiftRevision:published.revision,notes:'Close both stations',tasks:[],segments:[{until:120,job:counter.id,area:'Counter'},{until:300,job:kitchen.id,area:'Kitchen'}]})
 const enter=async extra=>{const t=await h.cmd('time.prepare',{staffId:alex.id,start:shift.start,end:shift.end,breakMinutes:0,reason:'Reviewed paper time',...extra});return h.cmd('time.approve',pin(t),morgan.cookie)}
 const approved=await enter({})
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {alex,ben,morgan,counter,kitchen,profile,base,night,early,weekend,shift,approved,enter}
}
export async function differentialApi(h){
 const f=await differentialFixture(h),{alex,ben,profile,approved,night,base,shift,enter}=f
 const parts=approved.differentialBasis
 assert.deepEqual(parts.map(p=>[p.date,p.area,p.minutes,p.rateCents,p.additions.map(a=>[a.code,a.costCents])]),[
  ['2025-10-11','Counter',60,2000,[['WKND',500]]],['2025-10-11','Counter',60,2000,[['NIGHT',150],['WKND',538]]],['2025-10-11','Kitchen',60,2400,[['NIGHT',150],['WKND',638]]],['2025-10-12','Kitchen',120,2400,[['NIGHT',300]]]])
 assert.equal(parts.reduce((n,p)=>n+p.minutes,0),approved.minutes)
 await h.cmd('differential.save',{...base,name:'Foreign rule',site:'Mission',startMinute:0,endMinute:1440,value:99999})
 await h.cmd('differential.save',{...base,name:'Foreign position',role:'Supervisor',startMinute:0,endMinute:1440,value:99999})
 await h.cmd('differential.save',{...base,name:'Foreign tag',tag:'Opening',startMinute:0,endMinute:1440,value:99999})
 const fractional=await h.cmd('differential.save',{...base,name:'Future fractional multiplier',from:'2027-01-01',mode:'multiplier',value:1.15,startMinute:0,endMinute:60});assert.equal(fractional.value,1.15)
 await h.cmd('differential.save',{...base,name:'Future night',from:'2025-10-13',startMinute:1320,endMinute:1440,value:300})
 await h.cmd('differential.save',{...base,...pin(night),name:'Night',startMinute:1320,endMinute:1440,from:'2025-10-13',value:400})
 assert.deepEqual((await h.state()).timesheets.find(t=>t.id===approved.id).differentialBasis,parts,'effective updates preserve approved history')
 const batch=await h.cmd('payroll.prepare',{ids:[approved.id]}),competing=await h.cmd('payroll.prepare',{ids:[approved.id]})
 assert.equal(batch.lines.filter(l=>l.differentialLine).reduce((n,l)=>n+l.costCents,0),2276)
 assert.equal(batch.lines.filter(l=>!l.payCode).reduce((n,l)=>n+l.minutes,0),300)
 const sent=await h.cmd('payroll.export',pin(batch));await h.cmd('payroll.export',pin(competing),h.owner,409)
 assert.match(sent.csv,/differential_cents,differential_rule_id,differential_rule_revision/);assert.match(sent.csv,/,NIGHT,/);assert.match(sent.csv,/,WKND,/)
 // Rate edits after approval do not reprice the source's correction.
 const {id,revision,by,at,versions,...input}=profile
 await h.cmd('workforce.save',{...input,id,revision,rates:profile.rates.map(r=>({...r,cents:5000}))})
 const corrected=await enter({corrects:approved.id,end:local('2025-10-12','01:00')})
 const delta=await h.cmd('payroll.prepare',{ids:[corrected.id]})
 assert.deepEqual(delta.lines.filter(l=>l.differentialLine).map(l=>[l.area,l.payCode,l.minutes,l.costCents]),[['Kitchen','NIGHT',-60,-150]])
 assert.deepEqual(corrected.differentialBasis.map(p=>p.rateCents),[2000,2000,2400,2400])
 await h.cmd('payroll.export',pin(delta));await h.cmd('payroll.prepare',{ids:[corrected.id]},h.owner,409)
 assert.equal((await h.send(`/api/lanyard/batches/${sent.id}.csv`,undefined,h.owner)).text,sent.csv)
 const claims=await h.db.prepare('SELECT * FROM l_payroll_claims WHERE root_id=?').bind(approved.rootId).all()
 assert.equal(claims.results.length,2);assert.equal(claims.results.reduce((n,c)=>n+c.minutes,0),240)
 const own=await h.send('/app/time?week=2025-10-06',undefined,alex.cookie);assert.match(own.text,/Shift differential \(approved\)/);assert.ok(own.text.includes('$21.26'));assert.ok(own.text.includes('$109.26'),'own total uses retained area base rates as well as differentials')
 assert.deepEqual((await h.state(ben.cookie)).differentials,[]);assert.ok(!(await h.state(ben.cookie)).timesheets.some(t=>t.staffId===alex.id))
 const agent=await h.cmd('agent.create',{label:'Differential test'}),context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${agent.token}`})
 assert.deepEqual(context.value.differentials,[]);assert.ok(context.value.timesheets.every(t=>!t.differentialRules&&t.differentialBasis.length===0))
 await h.cmd('differential.save',{},alex.cookie,403);await h.cmd('differential.save',{},f.morgan.cookie,403)
 await h.cmd('earnings.save',{estimates:false,statementUrl:'',payDays:''})
 assert.ok(!(await h.send('/app/time?week=2025-10-06',undefined,alex.cookie)).text.includes('$21.26'))
}
export async function differentialBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
 try{const f=await differentialFixture(h),page=await context.newPage()
 await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
 const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
 const shot=async name=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.C35_SCREENS){await mkdir(process.env.C35_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.C35_SCREENS,`${name}-${width}.png`)})}}
 await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
 const card=page.locator('#differentials');await card.getByText('Add a differential',{exact:true}).click()
 const form=card.locator('form').last();for(const [label,value] of [['Differential name','Next week'],['Effective from','2025-10-13'],['Mapped payroll code','NEXT']])await form.getByLabel(label,{exact:true}).fill(value)
 await Promise.all([page.waitForResponse(r=>r.url().includes('name=differential.save')),form.getByRole('button',{name:'Save differential'}).click()]);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0);assert.ok((await page.locator('#differentials').innerText()).includes('Next week'));await page.locator('#differentials').scrollIntoViewIfNeeded();await shot('differential-settings')
 const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'});await shot('differential-tooltip-focus');await account.blur();await account.hover();assert.equal(await page.getByRole('tooltip').isVisible(),false);await page.getByRole('tooltip').waitFor({state:'visible'})
 const batch=await h.cmd('payroll.prepare',{});await h.cmd('payroll.export',pin(batch));await page.reload({waitUntil:'networkidle'});await page.locator('.batch').first().scrollIntoViewIfNeeded();assert.ok((await page.locator('.batch').first().innerText()).includes('additional differential pay'));await shot('differential-export')
 await as(f.alex.cookie);await page.goto(h.origin+'/app/time?week=2025-10-06',{waitUntil:'networkidle'});assert.ok((await page.locator('#earnings').innerText()).includes('$22.76'));assert.ok((await page.locator('#earnings').innerText()).includes('$134.76'));await page.locator('#earnings').scrollIntoViewIfNeeded();await shot('differential-earnings')
 const previous=page.getByRole('link',{name:'Previous week',exact:true});await previous.focus();await page.getByRole('tooltip',{name:'Previous week',exact:true}).waitFor({state:'visible'});await shot('differential-week-tooltip')
 }finally{await context.close();await h.close()}}}finally{await browser.close()}
}

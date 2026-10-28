import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {iconTooltips} from './browser-controls.mjs'
import {harness} from './harness.mjs'
import {fixture} from './cost-journey.mjs'
import {pin} from './workforce-journey.mjs'

export async function reportsApi(){
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try {
  const f=await fixture(h),{alex,ben,foreign,manager,week}=f
  const read=async(params={},cookie=h.owner,status=200,csv=false)=>{
   const q=new URLSearchParams({from:week,through:'2026-10-18',...params}),r=await h.send('/api/lanyard/reports'+(csv?'.csv':'')+'?'+q,undefined,cookie)
   assert.equal(r.status,status,r.text);return csv?r:r.value
  }
  const west=await h.person('WestStaff')
  await h.cmd('staff.save',{...pin(west),name:west.name,email:west.email,payrollId:west.payrollId,role:'staff',active:true,site:'West',hourlyRate:'99.00'})
  const t=await h.cmd('time.prepare',{staffId:west.id,site:'West',start:week+'T08:00:00Z',end:week+'T10:00:00Z',breakMinutes:0,reason:'Approved west service'})
  await h.cmd('time.approve',pin(t))
  const batch=await h.cmd('payroll.prepare',{ids:[f.times[0].id]})
  await h.cmd('payroll.export',pin(batch))
  const issue=await h.cmd('clock.report',{commandId:'synthetic-lanyard-1',capture:{name:'clock.in',input:{commandId:'synthetic-lanyard-2',capturedAt:'2026-10-17T08:00:00Z'}},error:'Capture awaits reconciliation'},ben.cookie)
  await h.cmd('payroll.input.save',{staffId:alex.id,date:week,kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-3',reason:'Approved paid time'})
  await h.cmd('payroll.input.save',{staffId:alex.id,date:week,kind:'tips',minutes:0,amountCents:750,reference:'synthetic-lanyard-4',reason:'Reviewed allocation'})
  await h.cmd('sales.save',{site:'East',date:week,metric:'sales',value:'1000.00'})
  await h.cmd('attendrule.save',{site:'East',graceMinutes:5,noShowMinutes:30})
  const sourceRecords=async()=>JSON.stringify((await h.db.prepare('SELECT kind,id,revision,data FROM l_records ORDER BY kind,id').all()).results)
  const beforeReads=await sourceRecords()
  const all=await read(),worked=all.rows.filter(r=>r.kind==='worked')
  assert.deepEqual(worked.map(r=>r.site).sort(),['East','East','East','East','East','West'])
  assert.equal(all.totals.find(r=>r.kind==='worked').minutes,2640)
  assert.equal(all.totals.find(r=>r.kind==='worked').overtimeMinutes,120)
  assert.equal(worked.find(r=>r.site==='West').amountCents,19800)
  assert.deepEqual(all.rows.filter(r=>r.kind==='PTO').map(r=>[r.minutes,r.amountCents]),[[120,4000]])
  assert.deepEqual(all.rows.filter(r=>r.kind==='tips').map(r=>r.amountCents),[750])
  const payroll=all.rows.filter(r=>r.kind==='payroll')
  assert.deepEqual(payroll.map(r=>[r.sourceId,r.minutes,r.incomplete]),[[batch.id,480,true]])
  assert.equal(JSON.parse(payroll[0].detail).timeId,f.times[0].id)
  const missing=all.rows.find(r=>r.sourceId===issue.id)
  assert.deepEqual([missing.status,missing.incomplete,missing.minutes],['unresolved offline punch',true,null])
  assert.ok(all.rows.some(r=>r.kind==='attendance'&&r.staffId===ben.id&&r.status==='no-show'&&r.incomplete))
  assert.equal(all.rows.find(r=>r.kind==='labor'&&r.site==='East'&&r.date===week).incomplete,false)
  assert.equal(all.rows.find(r=>r.kind==='labor'&&r.site==='East'&&r.date==='2026-10-13').incomplete,true)
  const scoped=await read({},manager.cookie)
  assert.ok(scoped.rows.length>0);assert.deepEqual([...new Set(scoped.rows.map(r=>r.site))],['East'])
  assert.equal(scoped.rows.some(r=>r.kind==='PTO'||r.kind==='payroll'),false)
  assert.equal(scoped.rows.some(r=>r.staffId===west.id||r.amountCents===19800),false)
  await read({site:'West'},manager.cookie,404);await read({person:west.id},manager.cookie,404)
  await read({},alex.cookie,403);await read({},'',401);await read({from:'2026-01-01'},h.owner,400)
  const east=await read({site:'East',kind:'worked',job:f.bar.id,person:alex.id,from:'2026-10-13',through:'2026-10-13'})
  assert.deepEqual(east.rows.map(r=>[r.date,r.minutes,r.revision]),[['2026-10-13',600,f.times[1].revision]])
  const csv=await read({site:'West',kind:'worked'},h.owner,200,true)
  assert.match(csv.headers.get('content-type'),/text\/csv/);assert.match(csv.text,/19800/);assert.ok(!csv.text.includes(alex.id))
  const managerCsv=await read({},manager.cookie,200,true);assert.ok(!managerCsv.text.includes(west.id));assert.ok(!managerCsv.text.includes('19800'))
  const downloadEvents=(await h.db.prepare("SELECT actor_id,actor_role FROM l_events WHERE action='reports.download' ORDER BY rowid").all()).results
  assert.deepEqual(downloadEvents.map(e=>e.actor_role),['owner','manager'])
  assert.equal(await sourceRecords(),beforeReads,'JSON and CSV reads leave every source record unchanged')
  assert.ok(!scoped.choices.people.some(p=>p.id===west.id))
  const agent=await h.cmd('agent.create',{label:'Reporting refuses preparation authority'})
  for(const path of ['/app/reports','/api/lanyard/reports','/api/lanyard/reports.csv']){
   const query=new URLSearchParams({site:'East',from:week,through:'2026-10-18'})
   assert.equal((await h.send(path+'?'+query,undefined,'',{authorization:`Bearer ${agent.token}`})).status,401)
   assert.equal((await h.send(path+'?'+query,undefined,alex.cookie)).status,403)
   const foreignQuery=new URLSearchParams(query);foreignQuery.set('site','West')
   assert.equal((await h.send(path+'?'+foreignQuery,undefined,manager.cookie)).status,404)
  }
  const correction=await h.cmd('time.prepare',{...f.shift(1,9),corrects:f.times[1].id,reason:'Correct a duplicate hour'})
  assert.equal((await read({site:'East',kind:'worked'})).totals.find(r=>r.kind==='worked').minutes,2520,'pending correction does not change approved totals')
  await h.cmd('time.approve',pin(correction))
  let current=await read({site:'East',kind:'worked'})
  assert.equal(current.totals.find(r=>r.kind==='worked').minutes,2460)
  assert.equal(current.rows.some(r=>r.sourceId===f.times[1].id),false)
  assert.ok(current.rows.some(r=>r.sourceId===correction.id&&r.revision===correction.revision+1))
  await h.cmd('clock.in',{commandId:'synthetic-lanyard-5',capturedAt:'2026-10-17T08:12:00Z'},ben.cookie)
  await h.cmd('clock.breakStart',{commandId:'synthetic-lanyard-6',capturedAt:'2026-10-17T08:30:00Z',kind:'meal'},ben.cookie)
  await h.cmd('clock.breakEnd',{commandId:'synthetic-lanyard-7',capturedAt:'2026-10-17T09:00:00Z'},ben.cookie)
  const tipQuestion=await h.cmd('question.save',{site:'East',position:'',when:'out',kind:'tips',text:'Declared cash tips',required:false})
  const captured=await h.cmd('clock.out',{commandId:'synthetic-lanyard-8',capturedAt:'2026-10-17T10:12:00Z',breakMinutes:0,answers:{[tipQuestion.id]:'7.50'}},ben.cookie)
  const breaks=await read({kind:'breaks',person:ben.id})
  assert.ok(breaks.rows.some(r=>r.minutes===30&&r.detail==='meal'&&r.status==='closed'))
  assert.equal(breaks.totals.find(r=>r.kind==='breaks').minutes,30,'timed breaks are not counted again in the exception summary')
  const attendance=await read({kind:'attendance',person:ben.id})
  assert.ok(attendance.rows.some(r=>r.status==='done'&&JSON.parse(r.detail).lateMinutes===12))
  await h.cmd('forecast.save',{week,site:'=synthetic-lanyard-9',days:Array(7).fill(1000),budgetPercent:10})
  const safe=await read({kind:'labor',site:'=synthetic-lanyard-9'},h.owner,200,true)
  assert.match(safe.text,/"'=synthetic-lanyard-9"/)
  const overnight=await h.cmd('roster.prepare',{week:'2026-10-19',shifts:[{staffId:ben.id,site:'East',start:'2026-10-19T23:00:00Z',end:'2026-10-20T01:00:00Z',breakMinutes:0}]})
  await h.cmd('roster.publish',pin(overnight))
  const night=await read({from:'2026-10-19',through:'2026-10-20',kind:'attendance',person:ben.id})
  assert.deepEqual(night.rows.map(r=>[r.date,r.status,r.incomplete]),[['2026-10-19','no-show',true]])
  await h.cmd('time.approve',pin(captured.timesheet))
  const tipReport=await read({kind:'tips',site:'East'})
  assert.deepEqual(tipReport.rows.map(r=>[r.status,r.amountCents]).sort(),[['declared',750],['employer approved',750]])
  const tipTotal=tipReport.totals.find(r=>r.kind==='tips')
  assert.deepEqual([tipTotal.knownAmountCents,tipTotal.declaredAmountCents],[750,750],'declarations are not added to approved allocations')
  current=await read({site:'East',kind:'worked'})
  await h.restart();assert.deepEqual((await read({site:'East',kind:'worked'})).rows,current.rows)
  const person=(await h.state()).staff.find(p=>p.id===manager.id)
  await h.cmd('staff.save',{...pin(person),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'manager',active:false,site:'East'})
  await read({},manager.cookie,403)
  const beforeRefusal=await sourceRecords(),auditCount=(await h.db.prepare("SELECT count(*) n FROM l_events WHERE action='reports.download'").first()).n
  for(const path of ['/app/reports','/api/lanyard/reports.csv'])assert.equal((await h.send(path+'?'+new URLSearchParams({site:'East',from:week,through:'2026-10-18'}),undefined,manager.cookie)).status,403)
  assert.equal(await sourceRecords(),beforeRefusal)
  assert.equal((await h.db.prepare("SELECT count(*) n FROM l_events WHERE action='reports.download'").first()).n,auditCount)
 }finally{await h.close()}
}

export async function reportsBrowser(){
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 const h=await harness({now:'2026-10-26T12:00:00Z'})
 try{
  const f=await fixture(h),{alex,ben,manager,week}=f
  const issue=await h.cmd('clock.report',{commandId:'synthetic-lanyard-31',capture:{name:'clock.in',input:{commandId:'synthetic-lanyard-32',capturedAt:'2026-10-17T08:00:00Z'}},error:'Awaiting manager reconciliation'},ben.cookie)
  await h.cmd('payroll.input.save',{staffId:alex.id,date:week,kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-33',reason:'Approved paid time'})
  await h.cmd('payroll.input.save',{staffId:alex.id,date:week,kind:'tips',minutes:0,amountCents:750,reference:'synthetic-lanyard-34',reason:'Approved tip input, not a pool'})
  await h.cmd('sales.save',{site:'East',date:week,metric:'sales',value:'1000.00'})
  const batch=await h.cmd('payroll.prepare',{ids:[f.times[0].id]});await h.cmd('payroll.export',pin(batch))
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'x-test-now':String(Date.parse('2026-10-26T12:00:00Z'))}})
  try{
   await context.route('**/*',async route=>{
    const p=new URL(route.request().url()).pathname
    if(p.startsWith('/fonts/')||p.startsWith('/brand/')||/\.(css|js)$/.test(p))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',p.slice(1))),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':p.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   const signIn=async cookie=>{const [name,...value]=cookie.split('=');await context.clearCookies();await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   await signIn(h.owner)
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
   const query=new URLSearchParams({site:'East',from:week,through:'2026-10-18',kind:'all',person:'',job:''})
   const open=async()=>{const response=await page.goto(h.origin+'/app/reports?'+query,{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(new URL(page.url()).pathname,'/app/reports')}
   const sourceRecords=async()=>JSON.stringify((await h.db.prepare('SELECT kind,id,revision,data FROM l_records ORDER BY kind,id').all()).results)
   const compare=async()=>{
    const params=new URL(page.url()).searchParams,api=await h.send('/api/lanyard/reports?'+params,undefined,h.owner)
    assert.equal(api.status,200,api.text)
    assert.deepEqual(await page.locator('.report-sources tbody tr').evaluateAll(rows=>rows.map(row=>[row.dataset.kind,row.dataset.source])),api.value.rows.map(row=>[row.kind,row.sourceId]))
    for(const total of api.value.totals.filter(t=>api.value.kind==='all'||t.kind===api.value.kind)){
     const row=page.locator(`[data-total-kind="${total.kind}"]`)
     assert.equal(await row.locator('[data-label="Records"]').innerText(),String(total.rows))
     assert.equal(await row.locator('[data-label="Known minutes"]').innerText(),api.value.rows.some(row=>row.kind===total.kind&&row.minutes!==null)?total.minutes+' min':'Unknown')
    }
    const link=await page.getByRole('link',{name:'Download matching CSV'}).getAttribute('href')
    for(const [key,value] of Object.entries({site:api.value.site,from:api.value.from,through:api.value.through,kind:api.value.kind,job:api.value.job??'',person:api.value.person??''}))assert.equal(new URL(link,h.origin).searchParams.get(key),value)
    const before=await sourceRecords(),csv=await h.send(link,undefined,h.owner)
    assert.equal(csv.status,200,csv.text)
    const quoted=v=>'"'+String(v==null?'':v).replaceAll('"','""')+'"'
    const columns=['kind','date','site','job','staffId','sourceId','revision','status','minutes','overtimeMinutes','amountCents','incomplete','detail']
    assert.equal(csv.text,[columns.map(quoted).join(','),...api.value.rows.map(row=>columns.map(key=>quoted(row[key])).join(','))].join('\r\n')+'\r\n')
    assert.equal(await sourceRecords(),before,'screen and CSV reporting never mutate sources')
    return api.value
   }
   const proof=async label=>{
    await iconTooltips(page)
    for(const width of [1440,390]){
     await page.setViewportSize({width,height:1000})
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
     if(process.env.REPORT_SCREENS){
      await mkdir(process.env.REPORT_SCREENS,{recursive:true});await page.evaluate(()=>scrollTo(0,0))
      await page.screenshot({path:join(process.env.REPORT_SCREENS,`${label}-${width}.png`)})
      const sources=page.locator('.report-sources')
      if(await sources.count()){await sources.locator('tbody tr').first().scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.REPORT_SCREENS,`${label}-records-${width}.png`)})}
     }
    }
    await page.setViewportSize({width:1440,height:1000})
   }
   const beforeOpen=await sourceRecords()
   await open();assert.equal(await sourceRecords(),beforeOpen)
   let report=await compare()
   assert.match(await page.locator('[data-total-kind="worked"]').innerText(),/2520 min/)
   assert.match(await page.locator('[data-total-kind="worked"]').innerText(),/120 min/)
   assert.match(await page.locator(`[data-source="${issue.id}"]`).innerText(),/Incomplete/)
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/\$7\.50/)
   assert.match(await page.locator('[data-total-kind="tips"]').innerText(),/Declared separately: Unknown/)
   assert.equal(await page.locator('[data-total-kind="attendance"] [data-label="Known minutes"]').innerText(),'Unknown')
   assert.match(await page.locator('[data-total-kind="payroll"]').innerText(),/Incomplete/)
   assert.match(await page.locator('main').innerText(),/Rows from different report kinds are not additive/)
   assert.match(await page.locator('main').innerText(),/Sales: Unknown/)
   assert.match(await page.locator('main').innerText(),/Budget: \$100\.00 · Sales: \$1,000\.00/)
   for(const row of report.rows)assert.match(await page.locator(`[data-source="${row.sourceId}"][data-kind="${row.kind}"]`).first().innerText(),new RegExp('Revision '+(row.revision||'Unknown')))
   await proof('operational-sources')
   await page.getByLabel('Report kind',{exact:true}).selectOption('worked')
   await page.getByLabel('Job',{exact:true}).selectOption(f.bar.id)
   await page.getByLabel('Person',{exact:true}).selectOption(alex.id)
   await page.getByLabel('From',{exact:true}).fill('2026-10-13')
   await page.getByLabel('Through (inclusive)',{exact:true}).fill('2026-10-13')
   await page.getByRole('button',{name:'Show report',exact:true}).click();await page.waitForLoadState('networkidle')
   report=await compare();assert.deepEqual(report.rows.map(row=>[row.date,row.minutes]),[['2026-10-13',600]])
   assert.match(await page.locator('.report-sources').innerText(),/Alex/);assert.match(await page.locator('.report-sources').innerText(),/Barista/)
   await proof('filtered-worked-time')
   const downloaded=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download matching CSV'}).click()])
   assert.equal(downloaded[0].suggestedFilename(),'lanyard-operational.csv')
   const downloadedCsv=await readFile(await downloaded[0].path(),'utf8')
   assert.equal(downloadedCsv,(await h.send('/api/lanyard/reports.csv?'+new URL(page.url()).searchParams,undefined,h.owner)).text)
   assert.ok((await h.db.prepare("SELECT count(*) n FROM l_events WHERE action='reports.download' AND actor_id=?").bind((await h.state()).actor.id).first()).n>0)
   const correction=await h.cmd('time.prepare',{...f.shift(1,9),corrects:f.times[1].id,reason:'Confirmed one duplicate hour'})
   await page.reload({waitUntil:'networkidle'});report=await compare();assert.equal(report.rows[0].minutes,600)
   await h.cmd('time.approve',pin(correction));await page.reload({waitUntil:'networkidle'});report=await compare()
   assert.deepEqual(report.rows.map(row=>[row.sourceId,row.minutes,row.revision]),[[correction.id,540,correction.revision+1]])
   await h.restart();await page.reload({waitUntil:'networkidle'});await compare()
   query.set('from','2026-11-01');query.set('through','2026-11-01');query.set('kind','worked')
   await open();assert.match(await page.locator('main').innerText(),/unknown coverage, not proof of zero activity/)
   assert.match(await page.locator('[data-total-kind="worked"]').innerText(),/Unknown/)
   await proof('unknown-coverage')
   await signIn(manager.cookie)
   query.set('from',week);query.set('through','2026-10-18');query.set('kind','all')
   await open()
   assert.deepEqual(await page.getByLabel('Cafe',{exact:true}).locator('option').allTextContents(),['East'])
   assert.ok(!(await page.locator('main').innerText()).includes('Taylor'))
   assert.equal(await page.locator('[data-kind="PTO"],[data-kind="payroll"]').count(),0)
   assert.equal((await page.goto(h.origin+'/app/reports?'+new URLSearchParams({...Object.fromEntries(query),site:'West'}))).status(),404)
   assert.ok(!(await page.locator('body').innerText()).includes(f.foreign.id))
   await open()
   const managerRecord=(await h.state()).staff.find(p=>p.id===manager.id)
   await h.cmd('staff.save',{...pin(managerRecord),name:manager.name,email:manager.email,payrollId:manager.payrollId,role:'manager',active:false,site:'East'})
   assert.equal((await page.reload({waitUntil:'networkidle'})).status(),403)
   assert.ok(!(await page.locator('body').innerText()).includes(alex.id))
   assert.deepEqual(errors,[])
  }finally{await context.close()}
 }finally{await h.close();await browser.close()}
}

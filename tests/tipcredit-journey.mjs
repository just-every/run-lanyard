import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {days,monday,local,pin} from './workforce-journey.mjs'
const id=()=>crypto.randomUUID(),after=(iso,minutes)=>new Date(Date.parse(iso)+minutes*60000).toISOString()
// The app's own date label, such as "Mon Oct 5".
const label=d=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00Z')).replace(',','')
const BARRED=[['CA','California'],['WA','Washington'],['OR','Oregon'],['NV','Nevada'],['MN','Minnesota'],['AK','Alaska'],['MT','Montana']]

// TIPS-002: Riley serves at the Austin cafe for a $2.13 tipped cash wage. Two weeks ago they declared
// $10 of cash tips on each of two 8-hour Server shifts; last week $60 and $50, with the last hour of
// Monday's shift changed to Prep (side work that produces no tips) through the phone clock (CLOCK-008).
export async function tipFixture(h) {
 const riley=await h.person('Riley'),morgan=await h.person('Morgan','manager'),taylor=await h.person('Taylor','manager')
 for(const [p,site] of [[riley,'Austin'],[morgan,'Austin'],[taylor,'Mission']])await h.cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,role:p.role,active:true,site,position:'Server',hourlyRate:'2.13'})
 const server=await h.cmd('job.save',{name:'Server',skills:[],certifications:[]}),prep=await h.cmd('job.save',{name:'Prep',skills:[],certifications:[]})
 await h.cmd('workforce.save',{staffId:riley.id,jobs:[server.id,prep.id],skills:[],certifications:[],sites:['Austin'],preferences:[],minHours:0,maxHours:40,classification:'hourly employee',employmentType:'part-time',startDate:'2024-01-01',rates:[{job:'',from:'2020-01-01',cents:213}]})
 const tips=await h.cmd('question.save',{site:'Austin',position:'',when:'out',kind:'tips',text:'Cash tips received',required:false})
 const second=days(monday(new Date().toISOString().slice(0,10)),-7),first=days(second,-7)
 await h.cmd('availability.save',{staffId:riley.id,start:local(days(first,-1),'00:00'),end:local(days(second,7),'00:00')})
 for(const week of [first,second]){const draft=await h.cmd('roster.prepare',{week,shifts:[0,1].map(d=>({staffId:riley.id,job:server.id,site:'Austin',start:local(days(week,d),'09:00'),end:local(days(week,d),'17:00'),breakMinutes:0,label:'Lunch service'}))});await h.cmd('roster.publish',pin(draft))}
 const shifts=(await h.state()).shifts.filter(x=>x.staffId===riley.id&&x.status==='published').sort((a,b)=>a.start.localeCompare(b.start))
 const punch=async(shift,declared,sideWork)=>{
  await h.cmd('clock.in',{commandId:id(),capturedAt:shift.start},riley.cookie)
  if(sideWork)await h.cmd('clock.transfer',{commandId:id(),capturedAt:after(shift.end,-60),job:prep.id},riley.cookie)
  const {timesheet}=await h.cmd('clock.out',{commandId:id(),capturedAt:shift.end,breakMinutes:0,answers:{[tips.id]:declared}},riley.cookie)
  return h.cmd('time.approve',pin(timesheet),morgan.cookie)
 }
 const approved=[await punch(shifts[0],'10.00'),await punch(shifts[1],'10.00'),await punch(shifts[2],'60.00',true),await punch(shifts[3],'50.00')]
 await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
 return {riley,morgan,taylor,server,prep,first,second,approved}
}

export async function tipCreditApi(h) {
 const f=await tipFixture(h),{riley,morgan,taylor,server,prep,first,second,approved}=f
 const setup={site:'Austin',state:'TX',minimumWage:'7.25',from:'2020-01-01',tippedJobs:[server.id]}
 // States that bar a tip credit refuse the setup and write nothing; only the owner sets one up, at or above the federal minimum wage.
 for(const [state,name] of BARRED)assert.equal((await h.cmd('tipcredit.save',{...setup,site:'Golden Gate',state,minimumWage:'16.90'},h.owner,409)).error,`${name} bars a tip credit: pay tipped employees there at least the full minimum wage in cash`)
 await h.cmd('tipcredit.save',setup,morgan.cookie,403)
 assert.match((await h.cmd('tipcredit.save',{...setup,minimumWage:'7.00'},h.owner,400)).error,/at least the federal \$7\.25/)
 assert.deepEqual((await h.state()).tipcredits,[])
 const saved=await h.cmd('tipcredit.save',setup)
 assert.deepEqual(saved.versions.map(v=>[v.from,v.state,v.minimumWageCents,v.tippedJobs]),[['2020-01-01','TX',725,[server.id]]])
 const read=async(week,cookie=h.owner,status=200)=>{const r=await h.send(`/api/lanyard/tipcredit?week=${week}`,undefined,cookie);assert.equal(r.status,status,r.text);return r.value}
 // Low tips: 16 tipped hours at $7.25 is $116.00 due; $34.08 cash wage plus $20.00 declared tips leaves a $61.92 make-up pay input.
 let [low]=(await read(first)).rows
 assert.deepEqual([low.staffId,low.tippedMinutes,low.requiredCents,low.cashWageCents,low.tipsCents,low.makeUpCents,low.nonTippedMinutes],[riley.id,960,11600,3408,2000,6192,0])
 assert.deepEqual(low.sources.map(x=>x.timesheetId),approved.slice(0,2).map(t=>t.id));assert.deepEqual(low.tipSources.map(x=>x.cents),[1000,1000])
 assert.deepEqual(low.sites,[{site:'Austin',state:'TX',stateName:'Texas',from:'2020-01-01',minimumWageCents:725}])
 // Normal tips: 15 tipped hours ($108.75 due) are covered by $31.95 cash wage and $110.00 tips; the hour of Prep side work is reported as non-tipped duty time.
 let [normal]=(await read(second)).rows
 assert.deepEqual([normal.tippedMinutes,normal.requiredCents,normal.cashWageCents,normal.tipsCents,normal.makeUpCents],[900,10875,3195,11000,0])
 assert.deepEqual(normal.nonTipped,[{job:prep.id,jobName:'Prep',site:'Austin',minutes:60}]);assert.equal(normal.nonTippedMinutes,60)
 assert.deepEqual(approved[2].workSegments.map(p=>[p.job,p.minutes]),[[server.id,420],[prep.id,60]])
 // A new minimum wage from last week checks that week only; the earlier week keeps its $7.25.
 const raised=await h.cmd('tipcredit.save',{...setup,...pin(saved),minimumWage:'8.00',from:second})
 assert.deepEqual(raised.versions.map(v=>[v.from,v.minimumWageCents]),[['2020-01-01',725],[second,800]])
 ;[low]=(await read(first)).rows;[normal]=(await read(second)).rows
 assert.deepEqual([low.requiredCents,low.makeUpCents,normal.requiredCents,normal.makeUpCents],[11600,6192,12000,0])
 await h.cmd('tipcredit.save',{...setup,minimumWage:'8.00'},h.owner,409)
 // Readers: the owner and the manager of Riley's cafe; another cafe's manager reads no row, staff are refused.
 assert.equal((await read(first,morgan.cookie)).rows[0].makeUpCents,6192)
 assert.deepEqual((await read(first,taylor.cookie)).rows,[])
 await read(first,riley.cookie,403)
 const mine=await h.state(riley.cookie);assert.deepEqual([mine.tipcredits,mine.tipChecks],[[],[]])
 assert.deepEqual((await h.state(morgan.cookie)).tipChecks.map(r=>[r.week,r.makeUpCents]),[[second,0],[first,6192]])
 assert.equal((await h.send(`/api/lanyard/tipcredit?week=${days(first,1)}`,undefined,h.owner)).status,400)
 // The make-up pay inputs download as a file for the payroll provider, and the download is recorded.
 const file=await h.send(`/api/lanyard/tipcredit.csv?week=${first}`,undefined,h.owner)
 assert.equal(file.status,200);assert.match(file.headers.get('content-disposition'),new RegExp(`lanyard-tip-credit-${first}\\.csv`))
 assert.deepEqual(file.text.split('\r\n'),['week_start,payroll_id,name,tipped_minutes,minimum_wage_due_usd,cash_wage_usd,declared_tips_usd,make_up_pay_input_usd,non_tipped_minutes',`${first},RILEY,Riley,960,116.00,34.08,20.00,61.92,0`,''])
 assert.ok((await h.state()).events.some(e=>e.action==='tipcredit.download'&&e.entityId===first))
}

export async function tipCreditBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try {
   const f=await tipFixture(h),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const card=page.locator('#tip-credit')
   const shot=async key=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key} fits ${width}px`)
    if(process.env.TIPS_SCREENS){await mkdir(process.env.TIPS_SCREENS,{recursive:true});await card.scrollIntoViewIfNeeded();await page.screenshot({path:join(process.env.TIPS_SCREENS,`${key}-${width}.png`)});await card.screenshot({path:join(process.env.TIPS_SCREENS,`${key}-section-${width}.png`)})}
   }
   const setUp=async(site,state,wage)=>{
    const details=card.locator('details',{hasText:'Set up a tip credit'});if(!await details.evaluate(d=>d.open))await details.locator('summary').click()
    const form=details.locator('form');await form.locator('[name=site]').fill(site);await form.locator('[name=state]').selectOption(state);await form.locator('[name=minimumWage]').fill(wage);await form.locator('[name=from]').fill(f.first)
    await form.getByLabel('Server',{exact:true}).check()
    const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name=tipcredit.save')),form.getByRole('button',{name:'Save tip credit',exact:true}).click()]);assert.equal(r.status(),200);await page.waitForLoadState('networkidle')
   }
   await as(h.owner);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   assert.ok((await card.innerText()).includes('No cafe has a tip-credit setup, so no workweek is checked.'))
   // A California cafe cannot take a tip credit; the refusal is shown and nothing is saved.
   await setUp('Golden Gate','CA','16.90')
   assert.equal(await page.locator('.notice.error').innerText(),'California bars a tip credit: pay tipped employees there at least the full minimum wage in cash');assert.deepEqual((await h.state()).tipcredits,[])
   await shot('tip-credit-refused')
   await setUp('Austin','TX','7.25')
   assert.equal(await page.locator('.notice.error').count(),0,await page.locator('.notice.error').allTextContents())
   const text=await card.innerText()
   for(const part of [`Texas · minimum wage $7.25/hr from ${label(f.first)}`,'tipped jobs: Server'])assert.ok(text.includes(part),`${part} in ${text}`)
   // Each recent workweek: the low-tip week shows its $61.92 make-up pay input, the next none, with the hour of Prep listed as non-tipped duty time.
   const weekRow=async week=>{const table=card.locator('h3',{hasText:new RegExp(`^Week of ${label(week)}$`)}).locator('xpath=following-sibling::table[1]');return (await table.locator('tbody tr').innerText()).replace(/\s+/g,' ')}
   const low=await weekRow(f.first),normal=await weekRow(f.second)
   for(const part of ['Riley','16.0','$116.00','$34.08','$20.00','$61.92'])assert.ok(low.includes(part),`${part} in ${low}`)
   for(const part of ['15.0','$108.75','$31.95','$110.00','None','Prep at Austin: 1.0 hrs'])assert.ok(normal.includes(part),`${part} in ${normal}`)
   await shot('tip-credit-checks')
   const [download]=await Promise.all([page.waitForEvent('download'),card.getByRole('link',{name:'Download make-up pay inputs'}).last().click()])
   assert.equal(download.suggestedFilename(),`lanyard-tip-credit-${f.first}.csv`)
   // The cafe's manager reads the same checks without the owner's setup form.
   await as(f.morgan.cookie);await page.goto(h.origin+'/app/payroll',{waitUntil:'networkidle'})
   assert.ok((await card.innerText()).includes('$61.92'));assert.equal(await card.locator('form').count(),0)
   await shot('tip-credit-manager')
   assert.deepEqual(errors,[])
  } finally {await context.close();await h.close()}
 }} finally {await browser.close()}
}

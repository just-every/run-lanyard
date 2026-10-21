import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
const plus=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
export async function learnFixture(h) {
 const today=new Date().toISOString().slice(0,10),stamp=(date,time='12:00')=>({'x-test-now':String(Date.parse(date+'T'+time+':00Z'))})
 const cmd=(n,p,c=h.owner,status=200,when=stamp(today))=>h.cmd(n,p,c,status,when)
 const get=(path,c=h.owner)=>h.send(path,undefined,c,stamp(today))
 await cmd('settings.save',{timezone:'UTC'})
 const alex=await h.person('Alex'),priya=await h.person('Priya','manager'),omar=await h.person('Omar','manager')
 for(const [p,site] of [[alex,'Ocean Beach'],[priya,'Ocean Beach'],[omar,'Elsewhere']])await cmd('staff.save',{...pin(p),name:p.name,email:p.email,payrollId:p.payrollId,active:true,role:p.role,site})
 // Seven completed service days. Each was forecast from two prior same-weekday days at $100 and then sold $130; one day has no entered sales.
 const window=Array.from({length:7},(_,i)=>plus(today,-1-i)),rows=['date,hour,site,sales']
 for(const d of window){rows.push(`${plus(d,-7)},10,Ocean Beach,100`,`${plus(d,-14)},10,Ocean Beach,100`);if(d!==window[3])rows.push(`${d},10,Ocean Beach,130`)}
 const csv=rows.join('\n'),pre=await cmd('sales.preview',{csv,site:''});await cmd('sales.import',{csv,site:'',fingerprint:pre.fingerprint})
 for(const d of [...window].reverse()){
  const when=stamp(plus(d,-1)),f=(await h.send(`/api/lanyard/demand?site=Ocean%20Beach&date=${d}`,undefined,h.owner,when)).value
  assert.equal(f.live.status,'complete',d);await cmd('demand.save',{site:'Ocean Beach',date:d,digest:f.live.digest},h.owner,200,when)
 }
 // An unresolved no-show on one comparable day stays an unobserved cause.
 await cmd('availability.save',{staffId:alex.id,start:`${plus(window[1],-1)}T00:00:00Z`,end:`${today}T00:00:00Z`})
 const monday=plus(window[1],-((new Date(window[1]+'T12:00:00Z').getUTCDay()+6)%7))
 const draft=await cmd('roster.prepare',{week:monday,shifts:[{staffId:alex.id,start:`${window[1]}T09:00:00Z`,end:`${window[1]}T12:00:00Z`,breakMinutes:0}]},h.owner,200,stamp(monday));await cmd('roster.publish',pin(draft),h.owner,200,stamp(monday))
 await cmd('attendrule.save',{site:'Ocean Beach',graceMinutes:5,noShowMinutes:15},h.owner,200,stamp(monday))
 const read=async(c=h.owner,site='Ocean Beach')=>(await get(`/api/lanyard/learning/proposals?site=${encodeURIComponent(site)}&weeks=2`,c))
 return {today,stamp,cmd,get,read,alex,priya,omar,window,pin}
}
export async function learnApi(h) {
 const {today,stamp,cmd,get,read,alex,priya,omar,window}=await learnFixture(h)
 let e=(await read()).value
 assert.deepEqual([e.status,e.comparableDays],['proposal',6])
 assert.equal(e.excluded['no sales entered for the forecast hours'],1,'a day without entered sales stays unknown')
 assert.deepEqual([e.evaluation.trainDates.length,e.evaluation.holdoutDates.length,e.evaluation.biasPercent,e.evaluation.currentMeanAbsoluteErrorCents,e.evaluation.candidateMeanAbsoluteErrorCents],[4,2,30,3000,0])
 assert.deepEqual([e.proposal.field,e.proposal.from,e.proposal.to],['growthPercent',0,30])
 assert.ok(e.days.every(d=>d.errorCents===3000&&d.biasPercent===30))
 assert.ok(e.days.find(d=>d.date===window[1]).sources.some(x=>/unresolved no-show/.test(x)));assert.ok(e.days.find(d=>d.date===window[0]).sources.includes('unattributed'))
 assert.equal(e.providerHistory.status,'unknown')
 // Reads write nothing; only a reviewed digest creates a proposal, and only for the owner or that cafe's managers.
 const before=await h.state()
 await get(`/api/lanyard/learning/proposals?site=Ocean%20Beach&weeks=2`);assert.deepEqual((await h.state()).learnproposals,[])
 assert.equal((await read(alex.cookie)).status,403);assert.equal((await read(omar.cookie)).status,404)
 const key=await h.cmd('agent.create',{label:'Preparation only'});assert.equal((await h.send('/api/lanyard/learning/proposals?site=Ocean%20Beach',undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
 await cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:'0'.repeat(64)},priya.cookie,409);await cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:e.digest},alex.cookie,403)
 let p1=await cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:e.digest},priya.cookie)
 assert.deepEqual([p1.status,p1.version,p1.change.to],['proposed',1,30]);assert.equal((await h.state()).demandrules.length,0,'a proposal changes no assumption')
 await cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:e.digest},priya.cookie,409)
 // The assumptions change under it: approval is refused, a reasoned decline closes it.
 const rule=await cmd('demandrule.save',{site:'Ocean Beach',roles:'Barista|100|1'},priya.cookie)
 await cmd('learn.decide',{...pin(p1),decision:'approved',reason:'Looks right'},priya.cookie,409)
 await cmd('learn.decide',{...pin(p1),decision:'declined',reason:''},priya.cookie,400)
 p1=await cmd('learn.decide',{...pin(p1),decision:'declined',reason:'Assumptions were edited'},priya.cookie);assert.equal(p1.status,'declined')
 // A fresh proposal is approved, applies once, and a revert restores the assumption without touching history.
 e=(await read()).value;assert.equal(e.ruleRevision,rule.revision)
 let p2=await cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:e.digest},priya.cookie);assert.equal(p2.version,2)
 await cmd('learn.decide',{...pin(p2),decision:'approved',reason:'Sales run higher'},alex.cookie,403)
 p2=await cmd('learn.decide',{...pin(p2),decision:'approved',reason:'Sales run higher on every comparable day'},priya.cookie)
 let state=await h.state();assert.deepEqual([p2.status,state.demandrules[0].growthPercent,state.demandrules[0].roles.length],['approved',30,1])
 const next=plus(today,2),forecast=async()=>(await h.send(`/api/lanyard/demand?site=Ocean%20Beach&date=${next}`,undefined,h.owner,stamp(today))).value.live
 const hourly=await forecast();assert.ok(hourly.hours.every(x=>x.baseCents===null||x.baseCents>=0))
 const history={versions:state.demandforecasts,sales:state.sales}
 p2=await cmd('learn.revert',{...pin(p2),reason:'Back to the measured baseline'},priya.cookie)
 state=await h.state();assert.deepEqual([p2.status,state.demandrules[0].growthPercent],['reverted',0])
 assert.deepEqual({versions:state.demandforecasts,sales:state.sales},history,'reverting never alters saved forecasts or entered sales')
 await cmd('learn.revert',{...pin(p2),reason:'again'},priya.cookie,409)
 // A third proposal is declined with a reason; nothing it described was applied.
 e=(await read()).value;let p3=await cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:e.digest},priya.cookie)
 p3=await cmd('learn.decide',{...pin(p3),decision:'declined',reason:'Waiting for the holiday week'},priya.cookie)
 state=await h.state();assert.deepEqual([p3.status,state.demandrules[0].growthPercent,state.learnproposals.map(x=>x.status).sort()],['declined',0,['declined','declined','reverted']])
 // No schedule or published roster is written by learning.
 assert.deepEqual([state.rosters,state.shifts],[before.rosters,before.shifts])
 return {window}
}
export async function learnBrowser() {
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const f=await learnFixture(h),e=(await f.read()).value
  await f.cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:e.digest})
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1100},extraHTTPHeaders:f.stamp(f.today)})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage(),errors=[];page.on('pageerror',x=>errors.push(x.message))
   const shot=async key=>{if(process.env.LEARN_SCREENS){await mkdir(process.env.LEARN_SCREENS,{recursive:true});await page.locator('#learning').screenshot({path:join(process.env.LEARN_SCREENS,`${key}-${width}.png`)})}}
   await page.goto(h.origin+`/app/demand?site=Ocean%20Beach&date=${f.today}`,{waitUntil:'networkidle'})
   const text=await page.locator('#learning').innerText({timeout:5000}).catch(async()=>{throw Error('no learning card: '+(await page.locator('body').innerText()).slice(0,500))})
   for(const expected of ['Learning from forecast errors','6 comparable days','unresolved no-show','Fitted on 4 earlier days, held out 2 latest days','Growth would move from 0% to 30%'])assert.ok(text.includes(expected),expected)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('proposed')
   const decide=page.locator('form[action*="name=learn.decide"]')
   await decide.locator('[name=reason]').fill('Sales run higher on every comparable day')
   await Promise.all([page.waitForNavigation(),decide.getByRole('button',{name:'Decide'}).click()])
   assert.equal((await h.state()).demandrules[0].growthPercent,30)
   await page.locator('#learning summary',{hasText:'Proposals and decisions'}).click()
   assert.ok((await page.locator('#learning').innerText()).includes('approved'));await shot('approved')
   const revert=page.locator('form[action*="name=learn.revert"]');await revert.locator('[name=reason]').fill('Back to baseline')
   await Promise.all([page.waitForNavigation(),revert.getByRole('button',{name:/Revert/}).click()])
   assert.equal((await h.state()).demandrules[0].growthPercent,0);assert.deepEqual(errors,[])
   // Each width starts from an open proposal again.
   const next=(await f.read()).value;await f.cmd('learn.propose',{site:'Ocean Beach',weeks:2,digest:next.digest}).catch(()=>{})
   await context.close()
  }
 }finally{await browser.close();await h.close()}
}

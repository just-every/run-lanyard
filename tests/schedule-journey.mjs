// SCHEDULE-001 through native sessions, real pages, gestures and public HTTP commands.
import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
export async function scheduleJourney(){
 const h=await harness(),browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{
  const people=[]
  for(const [name,position,site,rate] of [['Alex','Counter','Harbor',20],['Ben','Kitchen','Harbor',24],['Casey','Counter','Market',22],['Dee','Kitchen','Market',26]]){
   const p=await h.person(name);people.push(p)
   await h.cmd('staff.save',{id:p.id,revision:1,name:p.name,email:p.email,payrollId:name.toUpperCase(),role:'staff',active:true,position,site,hourlyRate:rate})
  }
  const priya=await h.person('Priya','manager')
  await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
  const now=new Date(),base=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+14));base.setUTCDate(base.getUTCDate()-((base.getUTCDay()+6)%7))
  const date=(week,n)=>new Date(Date.parse(week+'T12:00Z')+n*86400000).toISOString().slice(0,10)
  for(const [round,width] of [1440,390].entries()){
   const week=new Date(base.getTime()+round*7*86400000).toISOString().slice(0,10)
   for(const p of people)await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:date(week,7)+'T23:00:00Z'})
   for(const site of ['Harbor','Market'])await h.cmd('forecast.save',{week,site,days:[100,100,100,100,100,100,100],budgetPercent:10})
   const context=await browser.newContext({viewport:{width,height:1000}});context.setDefaultTimeout(20000)
   const [name,...value]=priya.cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname
    if(path.startsWith('/fonts/')||path.startsWith('/brand/')||path.endsWith('.css')||path.endsWith('.js'))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}
    await route.continue()
   })
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('SCHEDULE-001 page error:',e.message)})
   const open=()=>page.goto(h.origin+`/app/schedule?week=${week}&site=all&view=draft`,{waitUntil:'networkidle'})
   await open();const form=()=>page.locator('[data-roster-form]'),rows=()=>form().locator('.shift-input')
   const submit=async(button,command)=>{const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name='+command)),page.waitForEvent('load'),button.click()]);assert.equal(response.status(),200);const html=await response.text();assert.equal(html.match(/<div class="notice error"[^>]*>(.*?)<\/div>/s)?.[1]??null,null,JSON.stringify({width,command,input:Object.fromEntries(new URLSearchParams(response.request().postData()))}));await page.waitForLoadState('networkidle');return new URLSearchParams(response.request().postData())}
   const validSpans=async(stage)=>{const values=await rows().evaluateAll(rs=>rs.map(r=>Object.fromEntries(['staffId','start','end'].map(k=>[k,r.querySelector(`[data-shift="${k}"]`).value]))).filter(r=>r.staffId));for(const value of values)assert.ok(value.end>value.start&&value.start.slice(0,10)===value.end.slice(0,10),JSON.stringify({stage,width,value,values}))}
   const fill=async(row,who,day)=>{await row.locator('[data-shift=staffId]').selectOption(people[who].id);await row.locator('[data-shift=start]').fill(date(week,day)+'T08:00');await row.locator('[data-shift=end]').fill(date(week,day)+'T16:00');await row.locator('[data-shift=breakMinutes]').fill('30');await row.locator('[data-shift=label]').fill(who%2?'Kitchen':'Counter');await row.locator('[data-shift=site]').fill(who<2?'Harbor':'Market')}
   for(let i=0;i<8;i++){if(i){await form().locator('[data-add-shift]').click();assert.equal(await rows().count(),i+1,JSON.stringify(await page.evaluate(()=>({url:location.pathname,handler:!!document.querySelector('[data-add-shift]')?.onclick,status:document.querySelector('[data-editor-status]')?.textContent,board:document.querySelector('[data-editor-board]')?.textContent}))))}await fill(rows().nth(i),i%4,Math.floor(i/4))}
   await page.waitForFunction(()=>document.querySelectorAll('[data-editor-board] .editor-shift').length===8)
   await submit(form().getByRole('button',{name:'Prepare draft',exact:true}),'roster.prepare')
   let state=await h.state(),draft=state.rosters.find(r=>r.week===week&&r.status==='draft');assert.ok(draft);const privateDraftIds=state.shifts.filter(x=>x.rosterId===draft.id&&x.status==='draft').map(x=>x.id)
   assert.equal((await h.state(people[0].cookie)).shifts.filter(x=>x.rosterId===draft.id).length,0,'draft never reaches employees')
   await open();assert.ok(await page.locator('[data-saved-review]').isVisible());const initialReview=(await h.state()).scheduleReviews.find(r=>r.week===week),warnings=initialReview.warnings.filter(w=>w.kind==='budget');assert.ok(warnings.length);for(const warning of warnings)assert.ok((await page.locator('[data-saved-review]').innerText()).includes(warning.message))
   // A real drag changes one day while preserving the span. Keyboard duration resizing is also available on mobile.
   const movedIndex=await rows().evaluateAll((rs,{id,week})=>rs.findIndex(r=>r.querySelector('[data-shift=staffId]').value===id&&r.querySelector('[data-shift=start]').value.slice(0,10)===week),{id:people[0].id,week});const movedRow=rows().nth(movedIndex),before=await movedRow.locator('[data-shift=start]').inputValue()
   await form().locator('[data-editor-view]').selectOption('week')
   if(width===1440){
    const source=page.locator(`.editor-shift[data-row="${movedIndex}"]`),target=page.locator(`.editor-day[data-date="${date(week,2)}"]`)
    await source.scrollIntoViewIfNeeded();const from=await source.boundingBox(),to=await target.boundingBox();assert.ok(from&&to)
    await page.mouse.move(from.x+12,from.y+12);await page.mouse.down();await page.mouse.move(from.x+35,from.y+24,{steps:5})
    await page.locator('.editor-shift[data-dragging]').waitFor()
    const dropY=Math.max(to.y+8,Math.min(from.y+12,to.y+to.height-8));await page.mouse.move(to.x+to.width/2,dropY,{steps:10});await page.mouse.move(to.x+to.width/2+2,dropY+1,{steps:2})
    if(process.env.SCHEDULE_SCREENS){await mkdir(process.env.SCHEDULE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,'dragging-1440.png')})}
    await page.mouse.up()
   }
   else{const end=await movedRow.locator('[data-shift=end]').inputValue();await movedRow.locator('[data-shift=start]').fill(date(week,2)+before.slice(10));await movedRow.locator('[data-shift=end]').fill(date(week,2)+end.slice(10));await movedRow.locator('[data-shift=end]').press('Tab')}
   assert.equal((await movedRow.locator('[data-shift=start]').inputValue()).slice(0,10),date(week,2),await form().locator('[data-editor-status]').innerText());assert.notEqual(await movedRow.locator('[data-shift=start]').inputValue(),before);await validSpans('move')
   const slider=page.locator('.editor-shift input[type=range]').first(),rowIndex=Number(await slider.locator('..').locator('..').getAttribute('data-row')),oldEnd=await rows().nth(rowIndex).locator('[data-shift=end]').inputValue()
   await slider.focus();await slider.press('ArrowRight');await slider.press('Tab')
   assert.notEqual(await rows().nth(rowIndex).locator('[data-shift=end]').inputValue(),oldEnd);await validSpans('resize')
   const detail=form().locator('details').filter({has:page.locator('[data-bulk-apply]')});await detail.locator('summary').click()
   const copyIndices=await rows().evaluateAll((rs,{ids,week})=>ids.map(id=>rs.findIndex(r=>r.querySelector('[data-shift=staffId]').value===id&&r.querySelector('[data-shift=start]').value.slice(0,10)===week)),{ids:[people[1].id,people[2].id],week});for(const i of copyIndices)await rows().nth(i).locator('[data-select-shift]').check()
   await form().locator('[data-copy-shifts]').click();await validSpans('copy');assert.equal(await rows().count(),11,'eight originals, two copies and the blank row')
   for(const i of copyIndices)await rows().nth(i).locator('[data-select-shift]').uncheck()
   for(const i of [9,10])await rows().nth(i).locator('[data-select-shift]').check()
   await form().locator('[data-bulk=days]').fill('3');await form().locator('[data-bulk=breakMinutes]').fill('20');await form().locator('[data-bulk=label]').fill('Closing');await form().locator('[data-bulk=site]').fill('Harbor')
   await form().locator('[data-bulk-apply]').click();await validSpans('bulk move');assert.equal(await rows().nth(9).locator('[data-shift=breakMinutes]').inputValue(),'20')
   await form().locator('[data-undo-shift]').click();await validSpans('undo');assert.equal(await rows().nth(9).locator('[data-shift=breakMinutes]').inputValue(),'30')
   await form().locator('[data-bulk-apply]').click();await validSpans('reapply bulk move')
   // Bulk assignment can use another person; this one does not overlap their current work.
   for(const i of [9,10])await rows().nth(i).locator('[data-select-shift]').uncheck()
   await rows().nth(9).locator('[data-select-shift]').check();await form().locator('[data-bulk=staffId]').selectOption(people[0].id);await form().locator('[data-bulk=days]').fill('0');await form().locator('[data-bulk-apply]').click()
   assert.equal(await rows().nth(9).locator('[data-shift=staffId]').inputValue(),people[0].id);await validSpans('bulk assign')
   await form().locator('[data-editor-view]').selectOption(date(week,3));assert.equal(await page.locator('.editor-day').count(),1)
   await form().locator('[data-editor-view]').selectOption('week')
   const submitted=await submit(form().getByRole('button',{name:'Prepare draft',exact:true}),'roster.prepare');assert.equal(JSON.parse(submitted.get('shifts')).length,10)
   state=await h.state();draft=state.rosters.find(r=>r.week===week&&r.status==='draft');assert.equal(state.shifts.filter(x=>x.rosterId===draft.id&&x.status==='draft').length,10)
   await h.cmd('roster.publish',{id:draft.id,revision:draft.revision-1},priya.cookie,409)
   const review=state.scheduleReviews.find(r=>r.week===week);assert.equal(review.conflicts.length,0,JSON.stringify(review.conflicts));assert.equal(review.added.length,10)
   assert.ok((await page.locator('[data-saved-review]').innerText()).includes('Closing'))
   if(process.env.SCHEDULE_SCREENS){await mkdir(process.env.SCHEDULE_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`draft-${width}.png`),fullPage:true});await page.locator('[data-saved-review]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`review-viewport-${width}.png`)});await page.locator('#plan').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`editor-viewport-${width}.png`)})}
   await submit(page.getByRole('button',{name:'Publish this revision',exact:true}),'roster.publish')
   state=await h.state();assert.equal(state.rosters.find(r=>r.id===draft.id).status,'published');assert.ok(state.shifts.filter(x=>privateDraftIds.includes(x.id)).every(x=>x.status==='replaced-draft'));assert.ok(state.shiftChanges.filter(x=>x.week===week).every(x=>!privateDraftIds.includes(x.lineage)),'private drafts never appear as publication history');assert.equal(state.shifts.filter(x=>x.rosterId===draft.id&&x.status==='published').length,10)
   const published=state.shifts.filter(x=>x.rosterId===draft.id&&x.status==='published').map(x=>({staffId:x.staffId,start:x.start,end:x.end,breakMinutes:x.breakMinutes,label:x.label,site:x.site}))
   // A later review shows removed/added shifts, and undo cannot modify the published records.
   await open();await rows().first().locator('[data-shift=label]').fill('Opening revised');await rows().first().locator('[data-shift=label]').press('Tab');await form().locator('[data-undo-shift]').click()
   assert.equal((await h.state()).rosters.find(r=>r.id===draft.id).status,'published')
   const altered=published.map((x,i)=>i===0?{...x,end:new Date(Date.parse(x.end)+30*60000).toISOString()}:x)
   const change=await h.cmd('roster.prepare',{week,shifts:altered},priya.cookie);await open()
   const delta=(await h.state()).scheduleReviews.find(r=>r.week===week);assert.equal(delta.added.length,1);assert.equal(delta.removed.length,1);assert.equal(delta.unchanged.length,9)
   if(process.env.SCHEDULE_SCREENS){await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`change-${width}.png`),fullPage:true});await page.locator('[data-saved-review]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`change-viewport-${width}.png`)})}
   await submit(page.getByRole('button',{name:'Publish this revision',exact:true}),'roster.publish')
   assert.equal((await h.state()).rosters.find(r=>r.id===draft.id).status,'superseded')
   const [staffName,...staffValue]=people[0].cookie.split('=');await context.addCookies([{name:staffName,value:staffValue.join('='),url:h.origin}]);await open()
   assert.equal(await page.locator('[data-roster-form]').count(),0);assert.equal(await page.locator('[data-saved-review]').count(),0)
   assert.ok(await page.locator('#changes').isVisible())
   const personal=await h.state(people[0].cookie);assert.ok(personal.shifts.length);assert.ok(personal.shifts.every(x=>x.staffId===people[0].id));assert.ok(personal.shifts.every(x=>x.status==='published'));assert.ok(personal.shiftChanges.filter(x=>x.week===week).every(x=>!privateDraftIds.includes(x.lineage)),'employee changes exclude replaced private drafts')
   if(process.env.SCHEDULE_SCREENS){await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`employee-${width}.png`),fullPage:true});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:join(process.env.SCHEDULE_SCREENS,`employee-viewport-${width}.png`)})}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no viewport overflow')
   assert.deepEqual(errors,[]);await context.close()
  }
  console.log('SCHEDULE-001: service-week visual/keyboard/mobile editing, exact review, publication and private employee change views passed')
 }finally{await browser.close();await h.close()}
}
if(process.argv[1]===new URL(import.meta.url).pathname)await scheduleJourney()

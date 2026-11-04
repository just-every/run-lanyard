// Native browser leg of the declared specialist journey, using the same
// installation and records as its MCP client. No production handlers are faked.
import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'

export async function specialistBrowser(h) {
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[]
 const [name,...value]=h.owner.split('=')
 await context.addCookies([{name,value:value.join('='),url:h.origin}])
 await context.route('**/*',async route=>{
  const path=new URL(route.request().url()).pathname
  if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try {
   return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})
  }catch{}
  await route.continue()
 })
 page.on('pageerror',error=>errors.push(error.message))
 const open=async path=>{
  const response=await page.goto(h.origin+path,{waitUntil:'networkidle'})
  assert.equal(response.status(),200)
  assert.equal(new URL(page.url()).pathname,path.split('?')[0],'the native person reaches the requested screen')
 }
 const submit=async(form,label)=>{
  const [response]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name=')),form.getByRole('button',{name:label,exact:true}).click()])
  assert.equal(response.status(),200)
  await page.waitForLoadState('networkidle')
  assert.deepEqual(await page.locator('.notice.error').allTextContents(),[])
 }
 let nativeTime
 return {
  async review({worker,week,draft,time}) {
   await open('/app/schedule?week='+week+'&view=draft')
   const editor=page.locator('[data-roster-form]'),shift=editor.locator('.shift-input').first()
   assert.equal(await shift.locator('[data-shift=staffId]').inputValue(),worker.id)
   assert.equal(await shift.locator('[data-shift=start]').inputValue(),week+'T10:00')
   assert.equal(await shift.locator('[data-shift=end]').inputValue(),week+'T12:00')
   assert.equal(await shift.locator('[data-shift=breakMinutes]').inputValue(),'0')
   // The person's edit uses the UI's own preparation action. A later MCP
   // retry must leave this newer native revision and its label intact.
   await shift.locator('[data-shift=label]').fill('Human reviewed preparation')
   await submit(editor,'Prepare draft')
   const after=await h.state(),roster=after.rosters.find(row=>row.id===draft.id)
   assert.equal(roster.status,'draft')
   assert.ok(roster.revision>draft.revision)
   const shifts=after.shifts.filter(row=>row.rosterId===draft.id)
   assert.deepEqual(shifts.filter(row=>row.status==='draft').map(row=>({staffId:row.staffId,start:row.start,end:row.end,breakMinutes:row.breakMinutes,label:row.label})),[{staffId:worker.id,start:week+'T10:00:00.000Z',end:week+'T12:00:00.000Z',breakMinutes:0,label:'Human reviewed preparation'}])
   assert.equal(shifts.filter(row=>row.status==='replaced-draft').length,1,'the previous agent draft is retained as history')
   await open('/app/time?week='+week)
   const pending=page.locator('#time-'+time.id+'-approval')
   assert.ok((await pending.innerText()).includes(worker.name))
   assert.equal(await pending.locator('[name=revision]').first().inputValue(),String(time.revision))
   await submit(pending.locator('form[action*="name=time.approve&"]'),'Approve')
   const approved=await h.state(),decision=approved.timesheets.find(row=>row.id===time.id)
   assert.equal(decision.status,'approved')
   assert.equal(decision.approvedBy,approved.actor.id,'the signed-in person supplies the native decision')
   // Prepare and approve a distinct, equally long native entry, then compare
   // the two resulting payroll drafts without exporting either one.
   const manual=page.locator('form[action*="name=time.prepare&"]').filter({hasNot:page.locator('[name=corrects]')})
   await manual.locator('[name=staffId]').selectOption(worker.id)
   await manual.locator('[name=start]').fill(week+'T13:00')
   await manual.locator('[name=end]').fill(week+'T15:00')
   await manual.locator('[name=breakMinutes]').fill('0')
   await manual.locator('[name=reason]').fill('Employer supplied native parity facts')
   await submit(manual,'Prepare timesheet')
   nativeTime=(await h.state()).timesheets.find(row=>row.staffId===worker.id&&row.start===week+'T13:00:00.000Z')
   assert.ok(nativeTime)
   assert.equal(nativeTime.minutes,120)
   await submit(page.locator('#time-'+nativeTime.id+'-approval form[action*="name=time.approve&"]'),'Approve')
  },
  async comparePayroll(batch) {
   await open('/app/payroll')
   const native=(await h.state()).batches.find(row=>row.id===batch.id)
   const card=page.locator('.batch').filter({has:page.locator('[name=id][value="'+batch.id+'"]')})
   assert.equal(await card.count(),1,'the exact MCP draft is available to the native reviewer')
   assert.equal(await card.locator('.card-head [class*=status]').count()>0,true)
   assert.equal(await card.locator('.ledger tbody tr').count(),1)
   assert.equal((await card.locator('.ledger tbody .hrs').innerText()).trim(),'2.0')
   assert.equal(batch.csvPreview,undefined,'the agent receives no payroll file bytes')
   assert.equal(await card.locator('.csv').innerText(),native.csvPreview.replaceAll('\r\n','\n'))
   assert.equal(await card.getByRole('link',{name:/Download exported/}).count(),0)
  },
  async preparePayroll(agentBatch) {
   const form=page.locator('[data-payroll-form]')
   for(const box of await form.locator('[data-payroll-id]').all())await box.setChecked((await box.getAttribute('data-payroll-id')).split(',').includes(nativeTime.id))
   await submit(form,'Prepare batch')
   const state=await h.state(),nativeBatch=state.batches.find(row=>row.id!==agentBatch.id&&row.lines.some(line=>line.timeId===nativeTime.id||line.id===nativeTime.id))
   assert.ok(nativeBatch,'the UI prepares a separate draft from the selected native source')
   assert.deepEqual(nativeBatch.lines.map(line=>({staffId:line.staffId,minutes:line.minutes})),agentBatch.lines.map(line=>({staffId:line.staffId,minutes:line.minutes})))
   assert.equal(nativeBatch.status,'draft')
   assert.deepEqual(errors,[])
  },
  async capture(week) {
   if(process.env.AGENT_SCREENS)await mkdir(process.env.AGENT_SCREENS,{recursive:true})
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000})
    for(const [screen,path,selector] of [
     ['schedule','/app/schedule?week='+week+'&view=draft','#plan'],
     ['time','/app/time?week='+week,'.time-list'],
     ['payroll','/app/payroll','.batch'],
    ]){
     await open(path)
     await page.locator(selector).first().scrollIntoViewIfNeeded()
     assert.equal(await page.locator(selector).first().isVisible(),true,'the native '+screen+' review remains visible at '+width)
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'the native '+screen+' page fits the viewport')
     if(process.env.AGENT_SCREENS)await page.screenshot({path:join(process.env.AGENT_SCREENS,screen+'-'+width+'.png')})
    }
   }
   assert.deepEqual(errors,[])
  },
  async close(){await context.close();await browser.close()},
 }
}

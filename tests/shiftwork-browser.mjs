import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {handoverFixture,captureWork} from './shiftwork-fixture.mjs'
export async function handoverBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try {for(const width of [1440,390]) {
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try {
   const f=await handoverFixture(h,false),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const open=async path=>{await page.goto(h.origin+path,{waitUntil:'networkidle'})}
   const shot=async(key,selector)=>{
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${key} fits ${width}px`)
    if(process.env.HANDOVER_SCREENS){await mkdir(process.env.HANDOVER_SCREENS,{recursive:true});await page.locator(selector).evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:join(process.env.HANDOVER_SCREENS,`${key}-${width}.png`)});await page.locator(selector).screenshot({path:join(process.env.HANDOVER_SCREENS,`${key}-section-${width}.png`)})}
   }
   const submit=async(form,name)=>{const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('/app/action?name=')),form.getByRole('button',{name,exact:true}).click()]);assert.equal(r.status(),200);await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0,await page.locator('.notice.error').allTextContents())}
   const schedule=`/app/schedule?week=${f.week}&site=Ocean%20Beach`
   await as(f.manager.cookie);await open(schedule);await page.locator('#handover summary').filter({hasText:'Edit handover'}).click()
   let editor=page.locator('[data-handover-editor]')
   await editor.locator('[name=notes]').fill(f.input.notes);await editor.locator('[name=taskLines]').fill(f.input.tasks.join('\n'))
   for(const [i,p] of f.input.segments.entries()){const row=editor.locator('[data-area-row]').nth(i);await row.locator('[name=segmentJob]').selectOption(p.job);await row.locator('[name=segmentArea]').fill(p.area);await row.locator('[name=segmentUntil]').fill(String(p.until))}
   await editor.locator('[data-add-area]').click();assert.equal(await editor.locator('[data-area-row]').count(),3);await editor.locator('[data-area-row]').last().locator('[data-remove-area]').click();assert.equal(await editor.locator('[data-area-row]').count(),2)
   await shot('manager-edit','#handover');await submit(editor,'Save handover')
   assert.equal((await h.state()).shiftwork[0].segments.length,2);await shot('manager-saved','#handover')
   await as(f.alex.cookie);await open(schedule)
   const handover=page.locator('#handover'),respond=handover.locator('form[action*="shiftwork.respond"]')
   assert.ok((await handover.innerText()).includes(f.input.notes));assert.ok((await handover.innerText()).includes('Kitchen close'))
   await respond.locator('[name=completed]').first().check();await respond.locator('[name=blocker]').fill('Kitchen lock needs maintenance')
   await respond.locator('[name=attachment]').setInputFiles({name:'lock.txt',mimeType:'text/plain',buffer:Buffer.from('Lock inspected on closing shift')})
   await submit(respond,'Send handover');assert.ok((await handover.innerText()).includes('Completed: Sanitize counter'));assert.ok((await handover.innerText()).includes('Kitchen lock needs maintenance'))
   await shot('employee-response','#handover')
   const [download]=await Promise.all([page.waitForEvent('download'),handover.getByRole('link',{name:'lock.txt',exact:true}).click()]);assert.equal(download.suggestedFilename(),'lock.txt')
   const work=await captureWork(h,f)
   await as(f.manager.cookie);await open(schedule);assert.ok((await handover.innerText()).includes('Kitchen lock needs maintenance'));await shot('manager-handover','#handover')
   await open(`/app/time?week=${f.week}&site=Ocean%20Beach`)
   await submit(page.locator('#approve form[action*="name=time.approve&"]'),'Approve')
   assert.ok((await page.locator('.time-list').innerText()).includes('Counter / Front counter: 4.0 hrs'))
   assert.ok((await page.locator('.time-list').innerText()).includes('Kitchen / Kitchen close: 4.0 hrs'))
   assert.ok((await page.locator('.time-list').innerText()).includes('Total 8.0 hrs; enclosing time 8.0 hrs'))
   await shot('time-reconciled','.time-list')
   await open('/app/payroll');await submit(page.locator('form[data-payroll-form]'),'Prepare batch')
   assert.equal((await h.state()).batches[0].lines.reduce((n,l)=>n+l.minutes,0),480)
   const batch=page.locator('.batch');assert.ok((await batch.innerText()).includes('Front counter'));assert.ok((await batch.innerText()).includes('Kitchen close'));await shot('payroll-preview','.batch')
   const exportForm=page.locator('form[action*="name=payroll.export"]');await exportForm.locator('[type=checkbox]').check();await submit(exportForm,'Export reviewed CSV')
   assert.equal((await h.state()).batches[0].status,'exported');await shot('payroll-exported','.batch')
   assert.deepEqual(errors,[])
  } finally {await context.close();await h.close()}
 }} finally {await browser.close()}
}

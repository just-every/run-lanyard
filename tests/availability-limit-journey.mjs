import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
import {days,monday,local,pin} from './workforce-journey.mjs'

export async function availabilityLimitBrowser() {
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness(),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const alex=await h.person('Alex'),priya=await h.person('Priya','manager'),week=days(monday(new Date().toISOString().slice(0,10)),28)
   const blocks='Mon available 06:00-22:00\nTue available 06:00-22:00'
   await h.cmd('pattern.save',{staffId:alex.id,from:days(week,-7),blocks,maxHours:15},priya.cookie)
   const draft=await h.cmd('roster.prepare',{week,shifts:[0,1].map(d=>({staffId:alex.id,start:local(days(week,d),'07:00'),end:local(days(week,d),'15:00'),breakMinutes:30}))},priya.cookie)
   await h.cmd('roster.publish',pin(draft),priya.cookie);await h.cmd('availability.policy',{requireApproval:true},priya.cookie)
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const as=async cookie=>{const [name,...value]=cookie.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])}
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
   const shot=async key=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.AVAILABILITY_SCREENS){await mkdir(process.env.AVAILABILITY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.AVAILABILITY_SCREENS,`${key}-${width}.png`),fullPage:true})}}
   const url=h.origin+'/app/schedule?week='+week
   const submit=async(button,name)=>{const [r]=await Promise.all([page.waitForResponse(r=>r.url().includes('name='+name)),button.click()]);assert.equal(r.status(),200);assert.ok(!(await r.text()).includes('class="notice error"'));await page.waitForLoadState('networkidle')}
   await as(alex.cookie);await page.goto(url,{waitUntil:'networkidle'})
   const form=page.locator('form[action*="pattern.save"]');await page.locator('summary').filter({hasText:/^Set a weekly pattern$/}).click()
   await form.getByLabel('Starts on',{exact:true}).fill(week);await form.getByLabel('Ends on (optional)').fill(days(week,6));await form.getByLabel('Most hours a week').fill('14');await form.getByLabel('Weekly blocks, one per line').fill(blocks)
   await submit(form.getByRole('button',{name:'Save pattern',exact:true}),'pattern.save')
   const collision=page.locator('[role=status]').filter({hasText:'This pattern collides with published shifts:'})
   assert.equal(await collision.locator('li').count(),1,'the weekly-limit collision is visible to the employee');await collision.scrollIntoViewIfNeeded();await shot('saved-maximum-collision')
   const pending=(await h.state(alex.cookie)).patterns.find(r=>r.status==='pending');assert.ok(pending)
   await as(priya.cookie);await page.goto(url,{waitUntil:'networkidle'})
   const approval=page.locator('form[action*="pattern.decide"]').filter({has:page.locator(`input[name=id][value="${pending.id}"]`)}).filter({has:page.locator('input[name=decision][value=approved]')})
   await submit(approval.getByRole('button',{name:'Approve',exact:true}),'pattern.decide')
   assert.equal(await collision.locator('li').count(),1,'the same collision is visible on manager approval');await collision.scrollIntoViewIfNeeded();await shot('approved-maximum-collision')
   assert.equal((await h.state()).patterns.find(r=>r.id===pending.id).status,'approved');assert.deepEqual(errors,[])
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

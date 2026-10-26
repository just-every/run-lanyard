import {iconTooltips} from './browser-controls.mjs'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
const pin=r=>({id:r.id,revision:r.revision})
export async function iifFixture(h){
 const alex=await h.person('Alex')
 await h.cmd('staff.save',{...pin(alex),name:alex.name,email:alex.email,payrollId:alex.payrollId,role:'staff',active:true,hourlyRate:'20.00'})
 const times=[]
 for(let day=12;day<=16;day++){const start=`2026-10-${day}T15:00:00Z`;times.push(await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:alex.id,start,end:`2026-10-${day}T23:00:00Z`,breakMinutes:0,reason:'Reviewed captured time'}))))}
 times.push(await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:alex.id,start:'2026-10-17T15:00:00Z',end:'2026-10-17T17:00:00Z',breakMinutes:0,reason:'Reviewed overtime'}))))
 await h.cmd('payroll.input.save',{staffId:alex.id,date:'2026-10-18',kind:'PTO',minutes:120,amountCents:4000,reference:'synthetic-lanyard-1',reason:'Employer approved leave'})
 const spec={preset:'quickbooks-desktop',approved:true,name:'QuickBooks Desktop · export only',employees:{[alex.id]:{id:'Alex Baker',workflow:'W-2'}},codes:{regular:'Regular Pay',overtime:'Overtime Pay',PTO:'Vacation Pay'},jobs:{'':'Bakery:Operations'},locations:{},iif:{companyName:'Synthetic Bakery',companyCreateTime:'1208544781',version:'8',release:'0',serviceItems:{'':'Counter service'}}}
 return {alex,times,spec}
}
export function parseIif(file){
 const lines=file.trimEnd().split('\r\n').map(l=>l.split('\t')),head=lines.find(l=>l[0]==='!TIMEACT')
 assert.ok(head);return lines.filter(l=>l[0]==='TIMEACT').map(l=>Object.fromEntries(head.slice(1).map((k,i)=>[k,l[i+1]])))
}
export async function iifApi(h){
 const f=await iifFixture(h)
 let t=await h.cmd('payroll.template.save',{...f.spec,codes:{regular:'Regular Pay',PTO:'Vacation Pay'}})
 const before=(await h.state()).batches,denied=await h.cmd('payroll.prepare',{templateId:t.id},h.owner,409)
 assert.match(JSON.stringify(denied),/Unmapped payroll item: overtime/);assert.deepEqual((await h.state()).batches,before)
 t=await h.cmd('payroll.template.save',{...f.spec,...pin(t)})
 const b=await h.cmd('payroll.prepare',{templateId:t.id}),activities=parseIif(b.csvPreview)
 const minutes=s=>{const [hours,mins]=s.split(':').map(Number);return hours*60+mins}
 assert.deepEqual(Object.fromEntries(['Regular Pay','Overtime Pay','Vacation Pay'].map(code=>[code,activities.filter(r=>r.PITEM===code).reduce((n,r)=>n+minutes(r.DURATION),0)])),{'Regular Pay':2400,'Overtime Pay':120,'Vacation Pay':120})
 assert.ok(activities.every(r=>r.EMP==='Alex Baker'&&r.JOB==='Bakery:Operations'&&r.ITEM==='Counter service'&&r.XFERTOPAYROLL==='Y'))
 const competing=await h.cmd('payroll.prepare',{templateId:t.id}),sent=await h.cmd('payroll.export',pin(b)),path=`/api/lanyard/batches/${sent.id}.iif`
 const file=await h.send(path,undefined,h.owner);assert.equal(file.status,200);assert.equal(file.text,b.csvPreview);assert.deepEqual(parseIif(file.text),activities)
 assert.equal((await h.send(path,undefined,f.alex.cookie)).status,403)
 await h.cmd('payroll.export',pin(competing),h.owner,409)
 const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(file.text).digest('hex'),sent.sha256)
 await h.restart();assert.equal((await h.send(path,undefined,h.owner)).text,file.text)
 const corrected=await h.cmd('time.approve',pin(await h.cmd('time.prepare',{staffId:f.alex.id,start:f.times[0].start,end:f.times[0].end,breakMinutes:60,corrects:f.times[0].id,reason:'Reviewed reduction after import'})))
 const negative=await h.cmd('payroll.prepare',{templateId:t.id,ids:[corrected.id]},h.owner,409);assert.match(JSON.stringify(negative),/negative time corrections/)
 assert.equal((await h.send(path,undefined,h.owner)).text,file.text)
 await h.cmd('payroll.template.save',{...f.spec,iif:{...f.spec.iif,companyName:'Invalid\tname'}},h.owner,400)
}
export async function iifBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({now:'2026-10-26T12:00:00Z'}),context=await browser.newContext({viewport:{width,height:1000}})
  try{
   const f=await iifFixture(h);await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await (await import('node:fs/promises')).readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   await context.addCookies([{name:h.owner.split('=')[0],value:h.owner.split('=')[1],url:h.origin}]);const page=await context.newPage()
   await page.goto(h.origin+'/app/settings');await page.getByText('Configure IIF time export',{exact:true}).click()
   for(const [label,value] of Object.entries({'QuickBooks company name':'Synthetic Bakery','Company creation time':'1208544781','Timer version':'8','Timer release':'0','Alex':'Alex Baker','Regular pay':'Regular Pay','Overtime pay':'Overtime Pay','Paid time off':'Vacation Pay'}))await page.getByLabel(label,{exact:true}).fill(value)
   await page.getByText('Customers and service items',{exact:true}).click();await page.getByLabel('Customer and job',{exact:true}).fill('Bakery:Operations');await page.getByLabel('Service item',{exact:true}).fill('Counter service')
   await page.locator('input[name=approved]').check();await page.getByRole('button',{name:'Approve preset',exact:true}).click();await page.waitForLoadState('networkidle');assert.equal(await page.locator('.notice.error').count(),0)
   await iconTooltips(page)
   if(process.env.PAY_SCREENS){await mkdir(process.env.PAY_SCREENS,{recursive:true});await page.getByText('Configure IIF time export',{exact:true}).click();await page.screenshot({path:join(process.env.PAY_SCREENS,`iif-settings-${width}.png`),fullPage:true})}
   const t=(await h.state()).paytemplates.find(t=>t.preset==='quickbooks-desktop')
   await page.goto(h.origin+'/app/payroll');await page.getByLabel('Export template',{exact:true}).selectOption(t.id);await page.getByRole('button',{name:'Prepare batch',exact:true}).click();await page.waitForLoadState('networkidle')
   const b=(await h.state()).batches.find(b=>b.exportTemplate?.id===t.id),card=page.locator('.batch').filter({hasText:b.id.slice(0,8)})
   assert.ok((await card.locator('pre.csv').innerText()).includes('!TIMEACT'));await card.locator('input[type=checkbox]').check();await card.getByRole('button',{name:'Export reviewed IIF',exact:true}).click();await page.waitForLoadState('networkidle')
   const download=await page.getByRole('link',{name:'Download exported IIF',exact:true}).getAttribute('href');assert.equal((await h.send(download,undefined,h.owner)).text,b.csvPreview)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   await iconTooltips(page)
   if(process.env.PAY_SCREENS)await page.screenshot({path:join(process.env.PAY_SCREENS,`iif-exported-${width}.png`),fullPage:true})
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

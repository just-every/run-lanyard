import assert from 'node:assert/strict'
import {readFile,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'
import {harness} from './harness.mjs'
export async function privacyBrowser(){
 const browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 try{for(const width of [1440,390]){
  const h=await harness({secure:true}),context=await browser.newContext({viewport:{width,height:1000},ignoreHTTPSErrors:true})
  try{
   const person=await h.person('PrivacyBrowser'),date=new Date(Date.now()-30*86400000).toISOString().slice(0,10),consent={consent:true,reason:'synthetic-lanyard-80 reviewed employee request'}
   const note=await h.cmd('note.save',{staffId:person.id,date,category:'other',visibility:'employee',text:'synthetic-lanyard-81 original note',attachment:{name:'record.txt',type:'text/plain',data:btoa('synthetic-lanyard-82')}})
   await h.mf.dispatchFetch(h.origin+'/setup',{method:'POST',headers:{origin:h.origin,cookie:h.owner,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes',redirect:'manual'})
   const [name,...value]=h.owner.split('=');await context.addCookies([{name,value:value.join('='),url:h.origin}])
   await context.route('**/*',async route=>{const path=new URL(route.request().url()).pathname;if(path.startsWith('/fonts/')||path.startsWith('/brand/')||/\.(css|js)$/.test(path))try{return await route.fulfill({body:await readFile(join(process.cwd(),'public',path.slice(1))),contentType:path.endsWith('.css')?'text/css':path.endsWith('.js')?'application/javascript':path.endsWith('.svg')?'image/svg+xml':'font/woff2'})}catch{}await route.continue()})
   const page=await context.newPage();await page.goto(h.origin+'/app/people',{waitUntil:'networkidle'})
   const journal=page.locator('#journal');await journal.scrollIntoViewIfNeeded();assert.ok((await journal.innerText()).includes(note.text));assert.equal(await journal.getByText('Edit',{exact:true}).count(),1)
   const shot=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(process.env.PRIVACY_SCREENS){await mkdir(process.env.PRIVACY_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.PRIVACY_SCREENS,`privacy-${label}-${width}.png`)})}}
   await shot('before')
   const account=page.locator('summary[aria-label="Account"]');await account.focus();await page.getByRole('tooltip',{name:'Account menu',exact:true}).waitFor({state:'visible'})
   await h.cmd('staff.save',{id:person.id,revision:person.revision,name:person.name,email:person.email,payrollId:person.payrollId,role:person.role,active:false})
   for(const type of ['notes','attachments'])await h.cmd('privacy.retention',{type,days:1,...consent})
   await h.cmd('privacy.erase',{staffId:person.id,type:'notes',...consent})
   await page.reload({waitUntil:'networkidle'});await journal.scrollIntoViewIfNeeded()
   assert.ok(!(await journal.innerText()).includes(note.text));assert.ok((await journal.innerText()).includes('Erased note'));assert.equal(await journal.getByText('Edit',{exact:true}).count(),0);assert.equal(await journal.getByRole('link',{name:'record.txt'}).count(),0)
   await shot('after')
  }finally{await context.close();await h.close()}
 }}finally{await browser.close()}
}

// Explicit held-key journey through the public deployment and sign-in doors.
// Run only through the fleet heavy slot; it is never part of push Verify.
import assert from 'node:assert/strict'
import {access,mkdir,readFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from '@playwright/test'
import {command} from './installation-process.mjs'
import {cloud,mint,verifiedSender,signInLink} from './hosted-installation-provider.mjs'

export async function hostedInstallation(){
 const root=process.cwd(),environment=process.env.HOSTED_ENVIRONMENT
 assert.match(environment??'',/^proof-[a-z0-9]+(?:-[a-z0-9]+)*$/,'Use a unique disposable proof environment')
 for(const name of ['CF_MINTER','MAIL_API_KEY','MAIL_FROM','MAILBOX_RECEIPT_URL','HOSTED_QA_INBOX'])assert.ok(process.env[name],`${name} is required`)
 const recipient=process.env.HOSTED_QA_INBOX,parts=recipient.split('@')
 assert.equal(parts.length,2,'Configure one fleet QA recipient')
 assert.match(parts[0],/^qa-[a-z0-9+-]+$/i,'Configure a fleet QA inbox')
 assert.equal(parts[1].toLowerCase(),'runeditrun.com','Only the fleet QA domain is permitted')
 await access(chromium.executablePath())
 await verifiedSender(process.env.MAIL_FROM)
 const token=await mint(),cli=resolve('node_modules/@runeditrun/rer/global/rer.mjs')
 const env={...process.env,CLOUDFLARE_API_TOKEN:token.value,MAIL_PROVIDER:'sendgrid',OWNER_EMAIL:recipient,CI:'true',WRANGLER_SEND_METRICS:'false'}
 delete env.CF_MINTER;delete env.MAILBOX_RECEIPT_URL
 const rer=args=>command(root,process.execPath,[cli,...args],env)
 const statePath=join(root,'.rer/deploy',environment+'.json')
 let browser,deploymentAttempted=false
 try{
  deploymentAttempted=true
  console.log('hosted installation: deploying disposable environment')
  await rer(['deploy','--environment',environment,'--owner-name','Fleet QA','--non-interactive','--no-queue'])
  const state=JSON.parse(await readFile(statePath,'utf8')),origin=state.receipt.origin
  assert.ok(origin.startsWith(`https://lanyard-${environment}.`)&&origin.endsWith('.workers.dev'))
  assert.equal((await fetch(origin+'/health')).status,200,'Hosted health succeeds')
  assert.equal((await fetch(origin+'/api/lanyard/state')).status,401,'Hosted data requires a native session')
  for(const path of ['/__dev/key','/auth/dev/enter','/auth/dev/outbox'])assert.equal((await fetch(origin+path)).status,404,'Local development identity is absent')
  browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext(),page=await context.newPage()
  page.setDefaultTimeout(30000)
  await page.goto(origin+'/signin',{waitUntil:'networkidle'})
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
   if(process.env.INSTALLATION_SCREENS){await mkdir(process.env.INSTALLATION_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.INSTALLATION_SCREENS,`hosted-signin-${width}.png`)})}
  }
  const since=new Date().toISOString()
  await page.getByLabel('Email',{exact:true}).fill(recipient)
  await page.getByRole('button',{name:'Email a sign-in link',exact:true}).click()
  await page.goto(await signInLink(origin,since),{waitUntil:'networkidle'})
  const confirm=page.getByRole('button',{name:/continue|sign in|confirm/i}).first()
  if(await confirm.count()){await confirm.click();await page.waitForLoadState('networkidle')}
  if(new URL(page.url()).pathname==='/setup'){
   await page.getByRole('checkbox').check()
   await page.getByRole('button',{name:'Finish setup',exact:true}).click()
  }
  await page.waitForURL(/\/app(?:\/|\?|$)/)
  const save=async(name,input)=>{
   const response=await page.request.post(origin+'/api/lanyard/command',{headers:{origin},data:{name,input}})
   assert.equal(response.status(),200,`Hosted ${name} succeeds`)
   return (await response.json()).result
  }
  const person=await save('staff.save',{name:'Rosa Martinez',email:'synthetic-lanyard-2@example.test',payrollId:'ROSA',active:true,role:'staff',hourlyRate:'22.00'})
  const week='2026-11-09'
  await save('availability.save',{staffId:person.id,start:'2026-11-08T00:00:00Z',end:'2026-11-16T00:00:00Z'})
  await save('roster.prepare',{week,shifts:[{staffId:person.id,start:week+'T14:00:00Z',end:week+'T22:00:00Z',breakMinutes:30,label:'Counter opening'}]})
  await page.goto(origin+'/app/schedule?week='+week+'&view=draft',{waitUntil:'networkidle'})
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   await page.getByRole('rowheader').filter({hasText:'Rosa Martinez'}).waitFor({state:'visible'})
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Hosted schedule fits its viewport')
   for(const name of ['Previous week','Next week','Account']){
    const control=page.getByLabel(name,{exact:true})
    await control.focus()
    await page.getByRole('tooltip').waitFor({state:'visible'})
    assert.ok((await page.getByRole('tooltip').innerText()).trim(),'Icon controls explain themselves on focus')
    await control.evaluate(element=>element.blur())
    await page.mouse.move(0,0)
    await control.hover()
    await page.getByRole('tooltip').waitFor({state:'visible'})
   }
   if(process.env.INSTALLATION_SCREENS){
    await mkdir(process.env.INSTALLATION_SCREENS,{recursive:true})
    await page.screenshot({path:join(process.env.INSTALLATION_SCREENS,`hosted-${width}.png`)})
    await page.getByRole('rowheader').filter({hasText:'Rosa Martinez'}).scrollIntoViewIfNeeded()
    await page.screenshot({path:join(process.env.INSTALLATION_SCREENS,`hosted-roster-${width}.png`)})
   }
  }
  assert.equal((await page.request.get(origin+'/api/lanyard/state')).status(),200)
  console.log('hosted installation: public deploy, health, private native sign-in and saved roster passed at 1440 and 390')
 }finally{
  try{await browser?.close()}finally{try{
   if(deploymentAttempted){
    const state=await readFile(statePath,'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;return null})
    if(state){await rer(['deploy','--environment',environment,'--remove','--yes','--no-queue']);console.log('hosted installation: owned Worker, database and bucket removed with provider readback')}
   }
  }finally{
   await cloud('DELETE','/tokens/'+token.id,process.env.CF_MINTER)
   console.log('hosted installation: temporary token revoked')
  }}
 }
}
try{await hostedInstallation()}catch(error){
 let message=String(error?.message??error).replace(/https?:\/\/[^\s"'<>]+/g,'[private URL]')
 for(const key of ['CF_MINTER','MAIL_API_KEY','MAILBOX_RECEIPT_URL'])if(process.env[key])message=message.replaceAll(process.env[key],'[private value]')
 console.error('hosted installation failed: '+message)
 process.exitCode=1
}

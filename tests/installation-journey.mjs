// Run explicitly through the heavy slot, outside push Verify. Uses real fresh
// clones, the declared CLI and a real browser; no copied state or dependencies.
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {chromium} from '@playwright/test'
import {command,serve} from './installation-process.mjs'

const root=process.cwd(),temporary=await mkdtemp(join(tmpdir(),'lanyard-installation-'))
const source=join(temporary,'source'),destination=join(temporary,'destination'),home=join(temporary,'home')
const env={...process.env,HOME:home,CI:'true',WRANGLER_SEND_METRICS:'false',RER_INSTALL_NO_NEXT:'1',RER_INSTALL_NO_PATH:'1'}
delete env.XDG_DATA_HOME;delete env.RER_LOCAL_OPERATION;delete env.RER_LOCAL_STATE_PATH
const cli=join(home,'.local/share/rer/current/global/rer.mjs')
const rer=(cwd,args,expected)=>command(cwd,process.execPath,[cli,...args],env,expected)
let server,browser
try{
 await mkdir(home)
 for(const clone of [source,destination])await command(root,'git',['clone','--filter=blob:none','--no-local',root,clone],process.env)
 console.log('installation: two empty clones created from committed HEAD')
 await command(root,process.execPath,[resolve('node_modules/@runeditrun/rer/global/rer.mjs'),'cli','install'],env)
 const {version}=JSON.parse(await readFile('node_modules/@runeditrun/rer/package.json','utf8'))
 await rer(source,['update','--version',version])
 for(const verb of ['install','setup','dev','preview','build','check','verify','deploy','export','import','doctor','describe','reset'])await rer(source,[verb,'--help'])
 await rer(source,['check','--profile','first-party'])
 await rer(source,['install','--no-queue'])
 await rer(source,['setup','--owner-email','synthetic-lanyard-1@example.test','--owner-name','Installation owner','--no-queue'])
 await rer(source,['doctor']);await rer(source,['describe'])
 server=await serve(source,cli,env)
 // Browser always runs under the real HOME, never the installer's scratch HOME.
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const context=await browser.newContext(),page=await context.newPage()
 await page.goto(server.open,{waitUntil:'networkidle'})
 await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup',exact:true}).click()
 await page.waitForURL(/\/app(?:\/|\?|$)/)
 const save=async(name,input)=>{const response=await page.request.post(server.origin+'/api/lanyard/command',{data:{name,input}});assert.equal(response.status(),200);return (await response.json()).result}
 const rosa=await save('staff.save',{name:'Rosa Martinez',email:'synthetic-lanyard-2@example.test',payrollId:'ROSA',active:true,role:'staff',hourlyRate:'22.00'})
 const week=new Date();week.setUTCDate(week.getUTCDate()+14-(week.getUTCDay()+6)%7);const monday=week.toISOString().slice(0,10)
 await save('roster.prepare',{week:monday,shifts:[{staffId:rosa.id,start:monday+'T14:00:00Z',end:monday+'T22:00:00Z',breakMinutes:30,label:'Counter opening'}]})
 await page.goto(server.origin+'/app/schedule?week='+monday+'&view=draft',{waitUntil:'networkidle'})
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000})
  assert.ok((await page.locator('body').innerText()).includes('Rosa'))
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  if(process.env.INSTALLATION_SCREENS){await mkdir(process.env.INSTALLATION_SCREENS,{recursive:true});await page.screenshot({path:join(process.env.INSTALLATION_SCREENS,`installed-${width}.png`)})}
 }
 const before=await (await page.request.get(server.origin+'/api/lanyard/state')).json()
 await context.close();await browser.close();browser=null;await server.stop();server=null
 await rer(source,['build','--no-queue'])
 const archive=join(temporary,'installation.rer')
 await rer(source,['export','--output',archive,'--no-queue'])
 await rer(destination,['install','--no-queue'])
 await rer(destination,['import','--input',archive,'--yes','--no-queue'])
 await rer(destination,['setup','--owner-email','synthetic-lanyard-1@example.test','--owner-name','Installation owner','--no-queue'])
 const restored=join(temporary,'restored.rer');await rer(destination,['export','--output',restored,'--no-queue'])
 const parts=text=>text.split('\n').filter(Boolean).map(JSON.parse).filter(r=>r.kind==='part')
 assert.deepEqual(parts(await readFile(restored,'utf8')),parts(await readFile(archive,'utf8')))
 await rer(source,['reset','--non-interactive'],4)
 const retained=join(temporary,'retained.rer');await rer(source,['export','--output',retained,'--no-queue'])
 assert.deepEqual(parts(await readFile(retained,'utf8')),parts(await readFile(archive,'utf8')))
 await rer(source,['reset','--yes'])
 server=await serve(destination,cli,env,'preview')
 assert.equal((await fetch(server.origin+'/health')).status,200)
 assert.equal((await fetch(server.origin+'/api/lanyard/state')).status,401,'restore does not restore a session')
 await server.stop();server=await serve(destination,cli,env)
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 const back=await browser.newContext(),restoredPage=await back.newPage()
 await restoredPage.goto(server.open,{waitUntil:'networkidle'})
 if(new URL(restoredPage.url()).pathname==='/setup'){
  await restoredPage.getByRole('checkbox').check();await restoredPage.getByRole('button',{name:'Finish setup',exact:true}).click()
 }
 await restoredPage.goto(server.origin+'/app/schedule?week='+monday+'&view=draft',{waitUntil:'networkidle'})
 for(const width of [1440,390]){
  await restoredPage.setViewportSize({width,height:1000})
  assert.ok((await restoredPage.locator('body').innerText()).includes('Rosa'))
  assert.equal(await restoredPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  if(process.env.INSTALLATION_SCREENS)await restoredPage.screenshot({path:join(process.env.INSTALLATION_SCREENS,`restored-${width}.png`)})
 }
 const response=await restoredPage.request.get(server.origin+'/api/lanyard/state');assert.equal(response.status(),200)
 const after=await response.json()
 for(const key of ['staff','rosters','shifts'])assert.deepEqual(after[key],before[key],`${key} survives archive and another installation's reset`)
 await back.close()
 console.log('installation: pinned CLI install and update, help, check, setup and sign-in, build, backup, empty-clone restore, fresh sign-in, preview, reset confirmation and isolation passed')
}finally{
 await browser?.close();await server?.stop();await rm(temporary,{recursive:true,force:true})
}

import assert from 'node:assert/strict'
import {cp,mkdir,mkdtemp,rm,symlink} from 'node:fs/promises'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {harness} from './harness.mjs'
import {pin} from './workforce-journey.mjs'

const exec=promisify(execFile)
async function checkout(root){
 await mkdir(root)
 for(const name of ['package.json','pnpm-lock.yaml','OPERATIONS.json','RUN-LOCALLY.md','ACCEPTANCE.md','SEED-COMMAND-CONTRACT.md','OPERATIONS.md','.node-version','wrangler.jsonc','deploy.json','rer-setup.json','scripts','src','migrations'])await cp(name,join(root,name),{recursive:true})
 await symlink(resolve('node_modules'),join(root,'node_modules'),'dir')
}
export async function reportsDeliveryArchive(){
 const temporary=await mkdtemp(join(tmpdir(),'lanyard-report-archive-')),source=join(temporary,'source'),restored=join(temporary,'restored'),file=join(temporary,'report.rer')
 const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};delete env.RER_LOCAL_OPERATION;delete env.RER_LOCAL_STATE_PATH
 const cli=async(cwd,args)=>{await exec(process.execPath,[resolve('node_modules/@runeditrun/rer/global/rer.mjs'),...args,'--no-queue'],{cwd,env,maxBuffer:2e6,timeout:180000})}
 let h
 try{
  await checkout(source);await checkout(restored)
  await exec(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'],{cwd:source,env,maxBuffer:2e6,timeout:180000})
  h=await harness({root:source,now:'2026-10-26T12:00:00Z',auth:{MAIL_PROVIDER:'sendgrid'}})
  await h.cmd('settings.save',{timezone:'UTC'})
  const person=await h.person('ReportArchive')
  const prepared=await h.cmd('time.prepare',{staffId:person.id,start:'2026-10-25T08:00:00Z',end:'2026-10-25T10:00:00Z',breakMinutes:0,reason:'Approved archive service'})
  const approved=await h.cmd('time.approve',pin(prepared))
  const input={label:'Archive report approval',recipient:'owner',site:'',kind:'worked',periodDays:1,cadenceDays:7,nextDue:'2026-10-26T12:00:00Z',consent:true}
  const schedule=await h.cmd('report.schedule.save',input)
  const tick=async at=>{const result=await (await h.mf.getWorker()).scheduled({scheduledTime:new Date(at),cron:'*/15 * * * *'});assert.equal(result.outcome,'ok')}
  const link=()=>{const message=h.mailbox.findLast(m=>m.subject==='Your scheduled Lanyard report'),url=new URL(message.text.match(/https?:\/\/\S+/)[0]);return url.pathname+url.search}
  await tick(input.nextDue)
  const path=link(),original=await h.state()
  assert.equal((await h.send(path,undefined,h.owner)).status,200)
  assert.equal((await h.db.prepare('SELECT count(*) n FROM l_report_approvals').first()).n,1)
  const auth=h.auth,previousOwner=h.owner
  await h.close();h=null
  console.log('Report archive: exporting approved schedule and retained source')
  await cli(source,['export','--output',file])
  console.log('Report archive: restoring through the public CLI')
  await cli(restored,['import','--input',file,'--yes'])
  h=await harness({root:restored,now:'2026-10-26T12:00:00Z',auth,owner:previousOwner})
  assert.equal((await h.send(path,undefined,previousOwner)).status,401,'Native sessions never travel')
  const owner=await h.signIn(auth.OWNER_EMAIL),back=await h.state(owner)
  assert.deepEqual(back.reportschedules,original.reportschedules)
  assert.deepEqual(back.reportdeliveries,original.reportdeliveries)
  assert.deepEqual(back.timesheets,original.timesheets)
  assert.equal((await h.db.prepare('SELECT count(*) n FROM l_report_approvals').first()).n,0,'Same installation secrets cannot restore delivery authority')
  assert.equal((await h.send(path,undefined,owner)).status,403,'A still-unexpired restored link cannot grant access')
  const before=h.mailbox.length
  await tick('2026-11-02T12:00:00Z')
  assert.equal(h.mailbox.length,before)
  const receipt=(await h.state(owner)).reportdeliveries.find(r=>r.status==='blocked')
  assert.match(receipt.reason,/recipient authority requires owner review/)
  const current=(await h.state(owner)).reportschedules[0]
  await h.cmd('report.schedule.save',{...input,...pin(current)},owner)
  await tick(input.nextDue)
  const fresh=await h.send(link(),undefined,owner)
  assert.equal(fresh.status,200,fresh.text);assert.ok(fresh.text.includes(approved.id))
  assert.equal((await h.send(path,undefined,owner)).status,404,'Fresh approval never revives an earlier link')
  assert.equal((await h.state(owner)).reportschedules.find(r=>r.id===schedule.id).enabled,true)
 }finally{if(h)await h.close();await rm(temporary,{recursive:true,force:true})}
}

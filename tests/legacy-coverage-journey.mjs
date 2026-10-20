// COVER-003 upgrade journey. Supply a real pre-pin checkout with --legacy-root;
// it creates a native pending offer there, then uses public CLI archive doors to
// move it into this checkout. No historical timestamps or consent are invented.
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {cp,mkdir,mkdtemp,rm,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {harness} from './harness.mjs'
const exec=promisify(execFile),root=process.cwd(),legacy=resolve(process.argv[process.argv.indexOf('--legacy-root')+1]??'')
assert.ok(process.argv.includes('--legacy-root'),'Pass --legacy-root pointing at a pre-pin production checkout')
const temporary=await mkdtemp(join(tmpdir(),'lanyard-cover-upgrade-')),source=join(temporary,'source'),destination=join(temporary,'destination'),archive=join(temporary,'legacy.rer')
const checkout=async(from,to)=>{
 await mkdir(to)
 for(const name of ['package.json','pnpm-lock.yaml','OPERATIONS.json','RUN-LOCALLY.md','ACCEPTANCE.md','SEED-COMMAND-CONTRACT.md','OPERATIONS.md','.node-version','wrangler.jsonc','deploy.json','rer-setup.json','scripts','src','migrations'])await cp(join(from,name),join(to,name),{recursive:true})
 await symlink(join(from,'node_modules'),join(to,'node_modules'),'dir')
}
const run=async(cwd,args)=>{
 const env={...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'};delete env.RER_LOCAL_OPERATION;delete env.RER_LOCAL_STATE_PATH
 return exec(process.execPath,[join(cwd,'node_modules/@runeditrun/rer/global/rer.mjs'),...args],{cwd,env,maxBuffer:2e6})
}
let h
try{
 await checkout(legacy,source);await checkout(root,destination)
 await exec(process.execPath,[join(source,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','foundation','--local'],{cwd:source,env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},maxBuffer:2e6})
 process.chdir(legacy)
 const old=await import(pathToFileURL(join(legacy,'tests/harness.mjs')).href)
 h=await old.harness({root:source})
 const ana=await h.person('Ana'),ben=await h.person('Ben')
 const date=new Date();date.setUTCDate(date.getUTCDate()+7+(8-date.getUTCDay())%7)
 const week=date.toISOString().slice(0,10),start=week+'T18:00:00Z',end=week+'T21:00:00Z'
 for(const p of [ana,ben])await h.cmd('availability.save',{staffId:p.id,start:week+'T00:00:00Z',end:week+'T23:59:00Z'})
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:ana.id,start,end,breakMinutes:0}]})
 await h.cmd('roster.publish',{id:draft.id,revision:draft.revision})
 const shift=(await h.state()).shifts.find(x=>x.status==='published')
 const called=await h.cmd('shift.callout',{id:shift.id,revision:shift.revision,note:'Legacy acceptance kept for review'},ana.cookie)
 const yes=await h.cmd('cover.respond',{id:called.offers[0].id,revision:called.offers[0].revision,decision:'accepted'},ben.cookie)
 assert.equal(yes.shiftRevision,undefined,'the source is genuinely pre-pin production code')
 await h.close();h=null;process.chdir(root)
 await run(source,['export','--output',archive,'--no-queue'])
 await run(destination,['import','--input',archive,'--yes','--no-queue'])
 h=await harness({root:destination,owner:'excluded-source-session'})
 const owner=await h.signIn(h.auth.OWNER_EMAIL),employee=await h.signIn(ben.email)
 const before=await h.state(owner),restored=before.offers.find(o=>o.id===yes.id),current=before.shifts.find(x=>x.id===called.shift.id)
 assert.equal(restored.status,'accepted');assert.equal(restored.legacy,true)
 for(const [name,input,cookie] of [['cover.respond',{id:restored.id,revision:restored.revision,decision:'accepted'},employee],['cover.approve',{id:restored.id,revision:restored.revision},owner]]){
  const refusal=await h.cmd(name,input,cookie,409);assert.match(refusal.error,/fresh offer/)
 }
 const refreshed=await h.cmd('cover.reopen',{id:current.id,revision:current.revision},owner)
 assert.equal(refreshed.shift.staffId,ana.id)
 const prior=(await h.state(owner)).offers.find(o=>o.id===yes.id)
 assert.equal(prior.status,'closed');assert.equal(prior.respondedAt,yes.respondedAt)
 const fresh=refreshed.offers.find(o=>o.staffId===ben.id)
 const accepted=await h.cmd('cover.respond',{id:fresh.id,revision:fresh.revision,decision:'accepted'},employee)
 const assigned=await h.cmd('cover.approve',{id:accepted.id,revision:accepted.revision},owner)
 assert.equal(assigned.staffId,ben.id)
 console.log('COVER-003 legacy archive upgrade journey passed')
}finally{
 await h?.close();process.chdir(root);await rm(temporary,{recursive:true,force:true})
}

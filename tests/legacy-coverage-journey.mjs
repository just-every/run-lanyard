// COVER-003 upgrade journey. Supply a real pre-pin checkout with --legacy-root;
// it creates a native pending offer there, then uses public CLI archive doors to
// move it into this checkout. No historical timestamps or consent are invented.
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {cp,mkdir,mkdtemp,readFile,rm,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
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
 const metadata=join(temporary,'native-offer.json')
 await exec(process.execPath,[join(root,'tests/legacy-coverage-source.mjs'),source,metadata],{cwd:legacy,env:process.env,maxBuffer:2e6})
 const {ana,ben,called,yes}=JSON.parse(await readFile(metadata,'utf8'))
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

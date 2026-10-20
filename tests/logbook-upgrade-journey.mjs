// LOG-001 upgrade journey. Supply a real pre-content-revision checkout with --legacy-root;
// it creates a native read receipts there, then uses public CLI archive doors to
// move it into this checkout. No historical timestamps or consent are invented.
import assert from 'node:assert/strict'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {cp,mkdir,mkdtemp,readFile,rm,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {harness} from './harness.mjs'
const exec=promisify(execFile),root=process.cwd(),legacy=resolve(process.argv[process.argv.indexOf('--legacy-root')+1]??'')
assert.ok(process.argv.includes('--legacy-root'),'Pass --legacy-root pointing at a pre-content-revision production checkout')
const temporary=await mkdtemp(join(tmpdir(),'lanyard-log-upgrade-')),source=join(temporary,'source'),destination=join(temporary,'destination'),archive=join(temporary,'legacy.rer')
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
 await exec(process.execPath,[join(root,'tests/logbook-upgrade-source.mjs'),source,metadata],{cwd:legacy,env:process.env,maxBuffer:2e6})
 const data=JSON.parse(await readFile(metadata,'utf8'))
 await run(source,['export','--output',archive,'--no-queue'])
 await run(destination,['import','--input',archive,'--yes','--no-queue'])
 h=await harness({root:destination,owner:'excluded-source-session'})
 const omar=await h.signIn(data.omar),priya=await h.signIn(data.priya)
 const entry=(await h.state(omar)).logbook.find(r=>r.id===data.id)
 await h.cmd('log.read',{id:entry.id,revision:entry.revision},omar,409)
 assert.deepEqual(entry.reads.map(r=>r.revision),[1,2])
 assert.deepEqual(entry.reads.map(r=>r.recordRevision),data.rawReadRevisions)
 assert.equal((await h.send(`/api/lanyard/logbook/${entry.id}/files/${data.fileId}`,undefined,omar)).text,'legacy floor inspection')
 const correction=await h.cmd('log.save',{id:entry.id,revision:entry.revision,date:'2026-10-12',category:'incident',text:'New-code correction'},priya)
 assert.equal(correction.contentRevision,3)
 const acknowledged=await h.cmd('log.read',{id:correction.id,revision:correction.revision},omar)
 assert.equal(acknowledged.reads.at(-1).revision,3)
 await h.cmd('log.read',{id:acknowledged.id,revision:acknowledged.revision},omar,409)
 console.log('LOG-001 legacy archive receipt journey passed')
}finally{
 await h?.close();process.chdir(root);await rm(temporary,{recursive:true,force:true})
}

// CI partitions the public-door journeys to retain the 15-minute job bound.
// A normal local rer verify still runs every command.
import {spawn} from 'node:child_process'
const shards={
 app:['build','typecheck','test:site','test:runtime'],
 core:['test:lanyard:core'],
 planning:['test:lanyard:planning'],
 rules:['test:lanyard:rules'],
 archive:['test:archive'],
}
const selected=process.env.SEED_VERIFY_SHARD
if(selected&&!Object.hasOwn(shards,selected))throw new Error(`Unknown verification shard: ${selected}`)
for(const name of selected?shards[selected]:Object.values(shards).flat()){
 // Keep streamed output and the exact failure exit; surface only command/test
 // names in Actions annotations when log downloads are unavailable.
 const annotation=value=>String(value).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A')
 const result=await new Promise((resolve,reject)=>{
  const child=spawn('pnpm',['run',name],{stdio:['inherit','pipe','inherit'],env:process.env})
  let pending=''
  const line=value=>{const failed=value.match(/^not ok \d+ - (.+)$/);if(process.env.GITHUB_ACTIONS==='true'&&failed)console.log('::error::'+annotation('Failed test: '+failed[1]))}
  child.stdout.on('data',chunk=>{process.stdout.write(chunk);pending+=chunk;const lines=pending.split('\n');pending=lines.pop();for(const value of lines)line(value)})
  child.on('error',reject)
  child.on('close',code=>{if(pending)line(pending);resolve(code)})
 })
 if(result!==0){
  if(process.env.GITHUB_ACTIONS==='true')console.log('::error::'+annotation('Verification command failed: '+name))
  process.exit(result??1)
 }
}

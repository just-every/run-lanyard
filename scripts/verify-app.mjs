// The seed's CI runs its public-door archive journey beside the application
// checks. A normal local rer verify still runs every command.
import {spawnSync} from 'node:child_process'
const shards={
 app:['build','typecheck','test:lanyard','test:site','test:runtime'],
 archive:['test:archive'],
}
const selected=process.env.SEED_VERIFY_SHARD
if(selected&&!Object.hasOwn(shards,selected))throw new Error(`Unknown verification shard: ${selected}`)
for(const name of selected?shards[selected]:Object.values(shards).flat()){
 const result=spawnSync('pnpm',['run',name],{stdio:'inherit',env:process.env})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status??1)
}

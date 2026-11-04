// Keep package commands available for a full local verify. Push Verify routes
// the same registrations through these complementary groups, with no retries.
import {spawnSync} from 'node:child_process'
const archive=['--test','--test-concurrency=1']
const partner='^LINK-001:'
const shards={
 core:[['scripts/test-lanyard.mjs','core-operations']],
 'core-finance':[
  ['scripts/test-lanyard.mjs','core-finance'],
  [...archive,`--test-name-pattern=${partner}`,'tests/archive.test.mjs'],
 ],
 planning:[['scripts/test-lanyard.mjs','planning-remaining']],
 rules:[['scripts/test-lanyard.mjs','rules-remaining']],
 archive:[[...archive,`--test-skip-pattern=${partner}`,'tests/archive.test.mjs']],
}
const shard=process.argv[2]
if(!Object.hasOwn(shards,shard))throw new Error(`Unknown verification shard: ${shard}`)
for(const args of shards[shard]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status??1)
}

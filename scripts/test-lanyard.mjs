// Keep the original full product command available; CI partitions only its
// registrations, using complementary filters on the same public-door file.
import {spawnSync} from 'node:child_process'
const rules='POLICY-|PAYRULE-|PAY-009|MINOR-001|LEAVE-003|CLOCK-001|CLOCK-005|ACCESS-003|CHAT-001|CLOCK-002'
const planning='SCHEDULE-|COVER-|AVAIL-|FAIR-|TRADEOFF-|DEMAND-|LEARN-|ACA-'
const shard=process.argv[2]
const filters={
 core:[`--test-skip-pattern=${rules}|${planning}`],
 planning:[`--test-name-pattern=${planning}`,`--test-skip-pattern=${rules}`],
 rules:[`--test-name-pattern=${rules}`],
}
if(!Object.hasOwn(filters,shard))throw new Error(`Unknown product test shard: ${shard}`)
function run(args){
 const result=spawnSync(process.execPath,['--test','--test-concurrency=1',...args],{stdio:'inherit',env:process.env})
 if(result.error)throw result.error
 if(result.status!==0)process.exit(result.status??1)
}
run([...filters[shard],'tests/lanyard.test.mjs'])
// These separate files belong to core and must not inherit title filters.
if(shard==='core')run(['tests/logbook.test.mjs','tests/coverage.test.mjs'])

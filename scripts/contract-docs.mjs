// Refresh contract metadata without rewriting the existing acceptance journeys.
import {readFileSync,writeFileSync} from 'node:fs'
import {parseContract} from '../src/base/seed-contract.mjs'
const source=readFileSync('CONTRACT.md','utf8'),contract=parseContract(source)
const selected=process.argv.slice(3)
for(const id of selected)if(!contract.clauses.some(c=>c.id===id))throw Error('Unknown clause '+id)
const rows=new Map(source.split('\n').filter(line=>/^\| `/.test(line)).map(line=>{const cells=line.slice(1,-1).split(/(?<!\\)\|/).map(v=>v.trim());return [cells[0].replaceAll('`',''),cells]}))
const acceptance=readFileSync('ACCEPTANCE.md','utf8').replace(/^- \*\*([A-Z][A-Z0-9-]+) — .*$/gm,(line,id)=>{
 if(selected.length&&!selected.includes(id))return line
 const clause=contract.clauses.find(c=>c.id===id),row=rows.get(id)
 if(!clause||!row)throw Error('Missing contract clause '+id)
 const journey=line.split(' **Existing evidence:**')[0].split(' **Remaining gap:**')[0].replace(/\*\*Status: (done|partial|missing)\.\*\*/,`**Status: ${clause.status}.**`)
 const evidence=row[4]?` **Existing evidence:** ${row[4]}${row[4].endsWith('.')?'':'.'}`:''
 return journey+evidence+(row[5]?` **Remaining gap:** ${row[5]}`:'')
})
const claims='# Product claims\n\nGenerated from [CONTRACT.md](../CONTRACT.md). Each status carries the evidence and remaining gaps in that source. Acceptance journeys remain in [ACCEPTANCE.md](../ACCEPTANCE.md).\n\n| Clause | Title | Status |\n| --- | --- | --- |\n'+contract.clauses.map(c=>`| ${c.id} | ${c.title} | ${c.status} |`).join('\n')+'\n'
if(!['write','check'].includes(process.argv[2]))throw Error('Use write or check, optionally followed by clause identifiers')
for(const [path,value] of [['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(process.argv[2]==='write')writeFileSync(path,value)
 else if(readFileSync(path,'utf8')!==value)throw Error(path+' is stale; run the contract document generator')
}
console.log('Contract documents '+process.argv[2]+' passed; '+contract.counts.total+' clauses')

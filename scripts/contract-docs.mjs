// Refresh contract metadata without rewriting the existing acceptance journeys.
import {readFileSync,writeFileSync} from 'node:fs'
import {parseContract} from '../src/base/seed-contract.mjs'
const source=readFileSync('CONTRACT.md','utf8')
// Writing derives totals before asking the strict parser to validate them.
// Check mode still validates the original source, including every summary row.
const input=process.argv[2]==='write'?source.replace(/^\| (Published|Target and push further|All) \|.*$/gm,''):source
const contract=parseContract(input)
// Summary rows and the acceptance footer are views of the same Status source.
// A status flip must not leave the old totals looking like an independent claim.
const count=predicate=>contract.clauses.filter(predicate).reduce((totals,clause)=>{totals[clause.status]++;totals.total++;return totals},{done:0,partial:0,missing:0,total:0})
const summary={Published:count(c=>c.kind==='published'),'Target and push further':count(c=>c.kind!=='published'),All:contract.counts}
const contractView=source.replace(/^\| (Published|Target and push further|All) \|.*$/gm,(_,label)=>{const n=summary[label];return `| ${label} | ${n.done} | ${n.partial} | ${n.missing} | ${n.total} |`})
parseContract(contractView)
const selected=process.argv.slice(3)
for(const id of selected)if(!contract.clauses.some(c=>c.id===id))throw Error('Unknown clause '+id)
const rows=new Map(source.split('\n').filter(line=>/^\| `/.test(line)).map(line=>{const cells=line.slice(1,-1).split(/(?<!\\)\|/).map(v=>v.trim());return [cells[0].replaceAll('`',''),cells]}))
let acceptance=readFileSync('ACCEPTANCE.md','utf8').replace(/^- \*\*([A-Z][A-Z0-9-]+) — .*$/gm,(line,id)=>{
 if(selected.length&&!selected.includes(id))return line
 const clause=contract.clauses.find(c=>c.id===id),row=rows.get(id)
 if(!clause||!row)throw Error('Missing contract clause '+id)
 const journey=line.split(' **Existing evidence:**')[0].split(' **Remaining gap:**')[0].replace(/\*\*Status: (done|partial|missing)\.\*\*/,`**Status: ${clause.status}.**`)
 const evidence=row[4]?` **Existing evidence:** ${row[4]}${row[4].endsWith('.')?'':'.'}`:''
 return journey+evidence+(row[5]?` **Remaining gap:** ${row[5]}`:'')
}).replace(/^Status totals: \d+ done, \d+ partial, \d+ missing; \d+ clauses\./m,`Status totals: ${contract.counts.done} done, ${contract.counts.partial} partial, ${contract.counts.missing} missing; ${contract.counts.total} clauses.`)
// New shared clauses carry their canonical acceptance text into this view;
// existing specialist journeys retain their exact wording.
const missing=contract.clauses.filter(c=>!new RegExp('^- \\*\\*'+c.id+' — ','m').test(acceptance))
if(missing.length){
 const additions=missing.map(c=>{
  const row=rows.get(c.id),journey=c.text.split('**Acceptance.**')[1]?.trim()??c.text
  return `- **${c.id} — ${c.title}.** **Status: ${c.status}.** ${journey}`+(row[4]?` **Existing evidence:** ${row[4]}`:'')+(row[5]?` **Remaining gap:** ${row[5]}`:'')
 }).join('\n\n')+'\n\n'
 acceptance=acceptance.replace(/^Status totals:/m,additions+'Status totals:')
}
const claims='# Product claims\n\nGenerated from [CONTRACT.md](../CONTRACT.md). Each status carries the evidence and remaining gaps in that source. Acceptance journeys remain in [ACCEPTANCE.md](../ACCEPTANCE.md).\n\n| Clause | Title | Status |\n| --- | --- | --- |\n'+contract.clauses.map(c=>`| ${c.id} | ${c.title} | ${c.status} |`).join('\n')+'\n'
if(!['write','check'].includes(process.argv[2]))throw Error('Use write or check, optionally followed by clause identifiers')
for(const [path,value] of [['CONTRACT.md',contractView],['ACCEPTANCE.md',acceptance],['docs/CLAIMS.md',claims]]){
 if(process.argv[2]==='write')writeFileSync(path,value)
 else if(readFileSync(path,'utf8')!==value)throw Error(path+' is stale; run the contract document generator')
}
console.log('Contract documents '+process.argv[2]+' passed; '+contract.counts.total+' clauses')

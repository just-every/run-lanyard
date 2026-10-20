// SCHEDULE-004: one claim for enclosing time, job/area deltas for the payroll file.
import {type Context,type Row} from './model'
const key=(l:any)=>JSON.stringify([l.job??'',l.area??'',l.site??''])
export function regularLines(c:Context,t:Row,base:Record<string,any>) {
 const previous=c.s.batches.filter(b=>['exported','acknowledged'].includes(b.status)).flatMap(b=>b.lines).filter((l:any)=>l.rootId===t.rootId&&!l.payCode)
 if(!t.workSegments?.length&&!previous.some((l:any)=>l.area!==undefined))return [{...base,minutes:t.exportMinutes}]
 const desired=t.workSegments?.length?t.workSegments:[{job:t.job??'',area:'',site:t.site??'',minutes:t.minutes,rateBasis:t.rateBasis,start:t.start,end:t.end}]
 const groups=new Map<string,any>()
 for(const l of desired){const k=key(l),old=groups.get(k);groups.set(k,{...base,job:l.job,area:l.area,site:l.site,start:old?.start??l.start,end:l.end,rateBasis:old?{...l.rateBasis,segments:[...old.rateBasis.segments,...l.rateBasis.segments],costCents:old.rateBasis.costCents===null||l.rateBasis.costCents===null?null:old.rateBasis.costCents+l.rateBasis.costCents}:l.rateBasis,minutes:(old?.minutes??0)+l.minutes})}
 for(const l of previous){const k=key(l),old=groups.get(k);groups.set(k,{...base,job:l.job??'',area:l.area??'',site:l.site??'',...old,minutes:(old?.minutes??0)-l.minutes})}
 const result=[...groups.values()].filter(l=>l.minutes!==0)
 return result.length?result:[{...base,job:desired[0].job,area:desired[0].area,site:desired[0].site,minutes:0}]
}

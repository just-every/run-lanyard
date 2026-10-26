import {type State,type Context,type Row,need,object,keys,integer,text,canonical,sha,work} from './model'
import {wall} from './settings'
import {draftWeek} from './roster'
import {scheduleReview} from './schedule-review'

/** All real offsets around this date, including half-hour changes; never choose a DST occurrence. */
export function aiLocalCandidates(value:unknown,tz:string):string[] {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return []
 const target=Date.parse(value+':00Z');if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==value)return []
 const offsets=new Set<number>()
 for(let h=-36;h<=36;h+=6){const at=target+h*3600000,w=wall(at,tz);offsets.add(Date.parse(`${w.date}T${w.time}:00Z`)-at)}
 return [...offsets].map(offset=>new Date(target-offset).toISOString()).filter(at=>{const w=wall(at,tz);return `${w.date}T${w.time}`===value}).sort()
}
export const aiWeekRoster=(s:State,week:string)=>s.rosters.find(r=>r.week===week&&r.status==='draft')??s.rosters.find(r=>r.week===week&&r.status==='published')
export const aiWeekShifts=(s:State,week:string)=>{const r=aiWeekRoster(s,week);return r?s.shifts.filter(x=>x.rosterId===r.id&&x.status===r.status):[]}
export const aiShiftInput=(r:Record<string,any>)=>({staffId:r.staffId,start:r.start,end:r.end,breakMinutes:r.breakMinutes,label:r.label??'',site:r.site??'',job:r.job??''})
export async function aiWeekDigest(s:State,week:string){return sha(canonical({timezone:s.timezone,rosters:s.rosters.filter(r=>r.week===week).map(r=>({id:r.id,revision:r.revision,status:r.status})),shifts:aiWeekShifts(s,week),open:s.openshifts.filter(r=>r.week===week)}))}
export type AiIssue={index:number;field:string;message:string;candidates?:string[]}

export function aiReview(c:Context,r:Row,input:unknown) {
 need(Array.isArray(input)&&input.length===r.extraction.rows.length,'Review every extracted row, including excluded rows')
 const seen=new Set<number>(),issues:AiIssue[]=[],shifts:Record<string,any>[]=[],reviewRows:Record<string,any>[]=[]
 for(const raw of input){const p=object(raw);keys(p,['sourceIndex','staffId','site','startLocal','endLocal','startChoice','endChoice','breakMinutes','label','confirmed','omit'])
  const i=integer(p.sourceIndex,'source row',0,r.extraction.rows.length-1);need(!seen.has(i),'Review each source row once');seen.add(i)
  const reviewed={sourceIndex:i,staffId:String(p.staffId??''),site:String(p.site??''),startLocal:String(p.startLocal??''),endLocal:String(p.endLocal??''),startChoice:String(p.startChoice??''),endChoice:String(p.endChoice??''),breakMinutes:p.breakMinutes,label:String(p.label??''),confirmed:p.confirmed===true,omit:p.omit===true}
  reviewRows.push(reviewed);const issue=(field:string,message:string,candidates?:string[])=>issues.push({index:i,field,message,...(candidates?{candidates}:{})})
  if(!reviewed.confirmed)issue('confirmed','Confirm this row against its sources, including any exclusion.')
  if(reviewed.omit)continue
  const person=c.s.staff.find(p=>p.id===reviewed.staffId&&p.active&&!p.erased_at&&p.site===r.site)
  if(!person)issue('staffId','Choose an active employee at the selected cafe; ambiguous names require a correction.')
  if(reviewed.site!==r.site)issue('site','The cafe must match the consented source scope.')
  const at=(field:'start'|'end')=>{const local=reviewed[`${field}Local`],choice=reviewed[`${field}Choice`],candidates=aiLocalCandidates(local,r.timezone)
   if(!candidates.length){issue(field,'Use a valid local time. This time is missing or does not exist at the venue.');return ''}
   if(candidates.length>1&&!candidates.includes(choice)){issue(field,'This local time repeats. Choose the exact UTC occurrence after checking the source.',candidates);return ''}
   if(choice&&!candidates.includes(choice)){issue(field,'The selected occurrence does not match this local time.',candidates);return ''}
   return candidates.length===1?candidates[0]:choice
  }
  const start=at('start'),end=at('end');let w:ReturnType<typeof work>|undefined
  try{w=work({start,end,breakMinutes:reviewed.breakMinutes})}catch(error){if(start&&end)issue('duration',(error as Error).message)}
  if(reviewed.label.length>120)issue('label','Position must be at most 120 characters.')
  if(person&&w&&reviewed.site===r.site)shifts.push({staffId:person.id,...w,label:reviewed.label,site:r.site})
 }
 reviewRows.sort((a,b)=>a.sourceIndex-b.sourceIndex)
 if(!shifts.length)issues.push({index:-1,field:'rows',message:'Keep at least one valid shift.'})
 let validation:ReturnType<typeof scheduleReview>|null=null
 if(!issues.length){const state=structuredClone(c.s),preview={...c,s:state,sql:[],entity:''};try{draftWeek(preview,r.week,[...aiWeekShifts(c.s,r.week).filter(x=>(x.site||c.s.staff.find(p=>p.id===x.staffId)?.site||'')!==r.site).map(aiShiftInput),...shifts.map(aiShiftInput)]);validation=scheduleReview(state,r.week,c.a)}catch(error){issues.push({index:-1,field:'schedule',message:(error as Error).message})}}
 return {reviewRows,reviewedShifts:shifts.map(aiShiftInput),issues,validation}
}

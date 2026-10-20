// SCHEDULE-004: schedule-relative job/area plans, reconciled to payable work.
import {type State,type Row,need,integer,text,keys} from './model'
import {lineageOf} from './history'
import {qualification,rateBasis} from './workforce'

export function segmentInput(s:State,x:Row,value:unknown) {
 need(Array.isArray(value)&&value.length<=20,'Provide at most 20 work segments')
 let last=0
 const segments=value.map((v:any)=>{
  keys(v,['until','job','area']);const until=integer(Number(v.until),'segment end minute',1,2880),job=text(v.job,'segment job',80),area=text(v.area,'work area',80)
  need(until>last,'Segment end minutes must increase')
  const start=new Date(Date.parse(x.start)+last*60000).toISOString(),end=new Date(Date.parse(x.start)+until*60000).toISOString()
  const issue=qualification(s,x.staffId,{...x,start,end,job});need(!issue,issue??'Unqualified segment',409)
  const r={from:last,until,job,area};last=until;return r
 })
 need(!segments.length||last===(Date.parse(x.end)-Date.parse(x.start))/60000,'Segments must cover the entire enclosing shift')
 return segments
}
/** Pin instructions when work is submitted. Later edits never reclassify that time. */
export function segmentPlan(s:State,staffId:string,x:Record<string,any>,shiftId?:string) {
 const source=shiftId?s.shifts.find(v=>v.id===shiftId):s.shifts.find(v=>v.staffId===staffId&&v.status==='published'&&v.start<x.end&&x.start<v.end)
 const w=source?s.shiftwork.find(v=>v.lineage===lineageOf(source)):undefined
 return source&&w?.segments?.length?{workId:w.id,workRevision:w.revision,shiftId:source.id,shiftStart:source.start,shiftEnd:source.end,site:w.site,segments:w.segments}:null
}
/** Early/late work extends the first/last area. Unpaid/rounded minutes are allocated
 * proportionally to elapsed area time; largest fractional remainder, earlier area first. */
export function reconcileSegments(s:State,staffId:string,x:Record<string,any>,plan:any) {
 if(!plan)return []
 const start=Date.parse(x.start),end=Date.parse(x.end),origin=Date.parse(plan.shiftStart)
 const pieces=plan.segments.map((p:any,i:number)=>{
  const a=Math.max(start,i===0?start:Math.round(origin+p.from*60000)),b=Math.min(end,i===plan.segments.length-1?end:Math.round(origin+p.until*60000))
  return {...p,start:new Date(a).toISOString(),end:new Date(Math.max(a,b)).toISOString(),weight:Math.max(0,b-a)}
 }).filter((p:any)=>p.weight>0)
 const total=pieces.reduce((n:number,p:any)=>n+p.weight,0)
 need(total===end-start,'Work segments do not reconcile to the enclosing time',409)
 for(const p of pieces)p.minutes=Math.floor(x.minutes*p.weight/total)
 let left=x.minutes-pieces.reduce((n:number,p:any)=>n+p.minutes,0)
 for(const p of [...pieces].sort((a,b)=>(x.minutes*b.weight/total-b.minutes)-(x.minutes*a.weight/total-a.minutes)||a.from-b.from))if(left-->0)p.minutes++
 // CLOCK-008 transfer segments carry their own cafe; SCHEDULE-004 areas share the plan's.
 return pieces.map(({weight,from,until,...p}:any)=>({...p,site:p.site||plan.site,rateBasis:rateBasis(s,staffId,{...p,site:p.site||plan.site})}))
}
export function segmentBasis(staffId:string,segments:any[]) {
 return {staffId,job:'',site:segments[0]?.site??'',workSegments:segments,segments:segments.flatMap(p=>p.rateBasis.segments.map((v:any)=>({...v,job:p.job,area:p.area}))),costCents:segments.some(p=>p.rateBasis.costCents===null)?null:segments.reduce((n,p)=>n+p.rateBasis.costCents,0)}
}

/** Every new assignment inheriting a handover plan rechecks each job and site. */
export function checkSegmentAssignments(s:State,before:State) {
 for(const x of s.shifts.filter(x=>x.status==='published')){const prior=before.shifts.find(v=>v.id===x.id);if(prior?.status==='published'&&prior.staffId===x.staffId&&prior.start===x.start&&prior.end===x.end)continue
  const w=s.shiftwork.find(v=>v.lineage===lineageOf(x));if(!w?.segments?.length)continue
  segmentInput(s,x,w.segments.map(({until,job,area}:any)=>({until,job,area})))
  x.rateBasis=segmentBasis(x.staffId,reconcileSegments(s,x.staffId,x,segmentPlan(s,x.staffId,x,x.id)))
 }
}

import {type State,type Row,canonical,sha} from './model'
import {workweek} from './payschedules'
import {policyClassification} from './policy'
import {priced} from './workforce'
import {dayAfter} from './aca'

/** A release approval binds the proposed catalog and the open source facts.
 * Nothing is changed by preview; applying the reviewed version is explicit. */
export async function releasePreview(s:State,candidate:Record<string,any>,old?:Row){
 const proposed={...candidate,id:old?.id??'proposed-policy',revision:(old?.revision??0)+1} as Row
 const next={...s,policies:[...s.policies.filter(r=>r.id!==old?.id),proposed]}
 const affected=new Map<string,{staffId:string;week:string}>()
 for(const t of s.timesheets){
  if(t.status==='superseded'||t.status==='rejected')continue
  for(const area of t.workSegments?.length?t.workSegments:[t]){
   const basis=area.rateBasis??priced(s,t.staffId,{...t,...area}),site=basis.site??t.site??s.staff.find(p=>p.id===t.staffId)?.site??''
   if(site!==candidate.site)continue
   for(const part of basis.segments){
    if(part.date<candidate.from)continue
    const week=workweek(s,t.staffId,part.date);affected.set(t.staffId+'|'+week,{staffId:t.staffId,week})
   }
  }
 }
 // A changed cafe can supply daily context for another cafe's next workweek.
 // Include those dependent weeks in the visible before and after review.
 const affectedStaff=new Set([...affected.values()].map(x=>x.staffId))
 for(const t of s.timesheets.filter(t=>affectedStaff.has(t.staffId)&&!['superseded','rejected'].includes(t.status)))for(const area of t.workSegments?.length?t.workSegments:[t])for(const part of (area.rateBasis??priced(s,t.staffId,{...t,...area})).segments){
  if(part.date<dayAfter(candidate.from,-1))continue
  const week=workweek(s,t.staffId,part.date);affected.set(t.staffId+'|'+week,{staffId:t.staffId,week})
 }
 const periods=s.periods.filter(p=>p.end>=candidate.from).map(p=>({id:p.id,revision:p.revision,start:p.start,end:p.end,status:p.status})).sort((a,b)=>a.id.localeCompare(b.id))
 const calculations=[...affected.values()].sort((a,b)=>a.staffId.localeCompare(b.staffId)||a.week.localeCompare(b.week)).map(({staffId,week})=>({staffId,week,before:policyClassification(s,staffId,week),after:policyClassification(next,staffId,week)}))
 const {at,by,reviewReason,reviewDigest,...proposal}=candidate
 // Pending work, open captures and retained rates can invalidate an otherwise
 // identical numeric total; approval must be of the current facts as well.
 const facts={timezone:s.timezone,staff:s.staff,timesheets:s.timesheets,clocks:s.clocks,policies:s.policies,periods:s.periods,workforce:s.workforce,jobs:s.jobs,paygroups:s.paygroups,rateSnapshots:s.rateSnapshots}
 const digest=await sha(canonical({proposal,facts,calculations}))
 return {digest,site:candidate.site,from:candidate.from,preset:candidate.preset,presetVersion:candidate.presetVersion,breakVersion:candidate.breakVersion,periods,calculations,label:'Reviewed recalculation estimate; applying never submits payroll or changes closed files'}
}

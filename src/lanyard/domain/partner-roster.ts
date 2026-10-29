import {type Actor,type State,need,keys} from './model'

export type PartnerRequest = {commandId:string;digest:string;contextVersion:number}

/** A week replacement must never remove a foreign row implicitly. */
export function partnerRoster(s:State,a:Actor,p:Record<string,any>,request:PartnerRequest) {
 const site=a.partner!.site
 keys(p,['week','shifts'])
 need(s.version===request.contextVersion,'Context changed; refresh before preparing a draft',409)
 need(Array.isArray(p.shifts),'Provide shifts')
 need(p.shifts.every((x:any)=>x&&typeof x==='object'&&!Array.isArray(x)&&s.staff.some(person=>person.id===x.staffId&&person.active&&!person.erased_at&&person.site===site)&&(x.site===undefined||x.site===site)),'Partner drafts are limited to their named cafe',403)
 const rosters=s.rosters.filter(r=>r.week===p.week&&['draft','published'].includes(r.status)).map(r=>r.id)
 const replaced=[...s.shifts.filter(x=>rosters.includes(x.rosterId)&&['draft','published'].includes(x.status)),...s.openshifts.filter(x=>(x.week===p.week||rosters.includes(x.rosterId))&&['draft','open'].includes(x.status))]
 need(replaced.every(x=>x.site===site),'This week includes another cafe; a partner cannot replace it',403)
}

/** Exclude wage bases, cost warnings, contact details and human-only review context. */
export function partnerDraft(result:any) {
 const {id,revision,week,status,approvalRequired,approval,conflicts}=result
 return {id,revision,week,status,approvalRequired,approval,conflicts,shifts:result.shifts.map(({id,revision,staffId,start,end,breakMinutes,label,site,job}:any)=>({id,revision,staffId,start,end,breakMinutes,label,site,job}))}
}

/** Erasure and current staff eligibility also fence a previously saved response. */
export function partnerReplay(s:State,a:Actor,response:any) {
 need(Array.isArray(response?.result?.shifts)&&response.result.shifts.every((x:any)=>s.staff.some(person=>person.id===x.staffId&&person.active&&!person.erased_at&&person.site===a.partner!.site)),'Draft staff no longer eligible; saved response withheld',403)
}

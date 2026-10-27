// The staff team view (ROSTER-004): who else works a person's cafe on the published
// schedule, by name, position and start/end only. Each cafe shows its whole team by
// default; a manager may narrow a cafe to the viewer's own position and hide people.
import {type Context,type State,keys,text,integer,need,manager,put} from './model'

export type TeamShift={name:string;position:string|null;start:string;end:string}
const SCOPES=['site','position']

/** The retained cafe, including payroll's source time, else the person's home cafe. */
export const siteOf=(s:State,x:Record<string,any>)=>x.site||(x.timeId?s.timesheets.find(t=>t.id===x.timeId)?.site:undefined)||x.rateBasis?.site||s.staff.find(p=>p.id===x.staffId)?.site||''

/** The cafe's saved choice, or the default whole-site view with nobody hidden. */
export function visibility(s:State,site:string) {
 return s.teamviews.find(v=>v.site===site)??{site,scope:'site',hidden:[] as string[]}
}

/** Published shifts at the viewer's home cafe in its permitted scope; a person hidden at any cafe never appears. */
export function teamFor(s:State,staffId:string):{scope:string;shifts:TeamShift[]} {
 const me=s.staff.find(p=>p.id===staffId);if(!me)return {scope:'site',shifts:[]}
 const site=me.site??'',rule=visibility(s,site),hidden=new Set(s.teamviews.flatMap(v=>v.hidden))
 const shifts=s.shifts.flatMap(x=>{
  const p=s.staff.find(v=>v.id===x.staffId)
  if(x.status!=='published'||!p||!p.active||p.erased_at||hidden.has(p.id)||siteOf(s,x)!==site)return []
  if(rule.scope==='position'&&(p.position??'')!==(me.position??''))return []
  return [{name:p.name,position:p.position,start:x.start,end:x.end}]
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name))
 return {scope:rule.scope,shifts}
}

export function team(c:Context,name:string,p:Record<string,any>) {
 if(name!=='team.visibility')return undefined
 manager(c.a);keys(p,['site','scope','hidden','revision'])
 const site=text(p.site,'site',80,true),old=c.s.teamviews.find(v=>v.site===site)
 if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Team view changed; reload before saving',409)
 need(SCOPES.includes(p.scope),'Choose whole cafe or own position only')
 const list=p.hidden===undefined?[]:p.hidden
 need(Array.isArray(list)&&list.length<=500,'Invalid hidden people')
 const hidden=[...new Set(list.map((id:unknown)=>text(id,'staffId')))] as string[]
 need(hidden.every(id=>c.s.staff.some(v=>v.id===id&&!v.erased_at)),'Hidden people must be staff',404)
 return put(c,'teamviews',{site,scope:p.scope,hidden,savedBy:c.a.id,savedAt:c.now},old)
}

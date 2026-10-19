// COVER-004: how open shifts and call-out replacements are offered. All eligible people at once,
// or timed tiers ranked by a priority rule; the tiers, their opening times and each answer are the
// offer log. A per-cafe access-to-hours rule (San Jose, Seattle, San Francisco, New York City) flags
// a person added at that cafe while its open hours are still owed to existing part-time staff.
import {type Context,type Row,type State,keys,text,integer,need,put,staff} from './model'
import {patternFit} from './patterns'

export const RULES=['parttime','preferred','fewest','seniority','custom']
export const TYPES=['full-time','part-time']
type Ranked={staffId:string;before:number}
export type Tier={staffIds:string[];opensAt:string}

export const employmentOf=(s:State,staffId:string)=>s.employment.find(r=>r.staffId===staffId)
/**
 * People ranked by a rule, ties by fewest published minutes that week, then name.
 * parttime: part-time first, then employment type not set, then full-time.
 * preferred: an AVAIL-001 pattern marking the whole shift preferred first.
 * seniority: earliest start date first; no start date last. custom: the manager's list order; unlisted last.
 */
export function rank(s:State,list:Ranked[],shift:Row,rule:string,ranking:string[]=[]) {
 const name=(id:string)=>s.staff.find(p=>p.id===id)?.name??''
 const key=(f:Ranked):number|string=>{const e=employmentOf(s,f.staffId)
  if(rule==='parttime')return e?.type==='part-time'?0:e?.type==='full-time'?2:1
  if(rule==='preferred')return patternFit(s,f.staffId,shift)?.preferred?0:1
  if(rule==='seniority')return e?.startDate||'9999-12-31'
  if(rule==='custom'){const i=ranking.indexOf(f.staffId);return i<0?ranking.length:i}
  return 0}
 return [...list].sort((a,b)=>{const x=key(a),y=key(b);return x<y?-1:x>y?1:a.before-b.before||name(a.staffId).localeCompare(name(b.staffId))||a.staffId.localeCompare(b.staffId)})
}
/** An offer order from input: all at once (one tier at `at`), or tiers of `size` people opening every `minutes`. */
export function order(c:Context,p:Record<string,any>) {
 const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''?Number(v):v
 const mode=p.order??'all';need(['all','tiers'].includes(mode),'Choose all at once or timed tiers')
 if(mode==='all')return {order:'all'}
 need(RULES.includes(p.rule),'Choose a priority rule')
 const ranking=p.rule==='custom'?(Array.isArray(p.ranking)?p.ranking:[p.ranking]).filter((v:unknown)=>v!==undefined&&v!=='').map((id:unknown)=>staff(c,id).id):[]
 need(p.rule!=='custom'||ranking.length>0,'List people in order for a custom ranking')
 return {order:'tiers',rule:p.rule,size:integer(num(p.size),'people per tier',1,50),minutes:integer(num(p.minutes),'minutes per tier',1,1440),ranking}
}
/** The offer log's tiers for the ranked people: tier k opens `k × minutes` after `at`; everyone else eligible after the last. */
export function tiers(s:State,o:Record<string,any>,list:Ranked[],shift:Row,at:string):{tiers:Tier[];everyoneAt:string} {
 if(o.order!=='tiers')return {tiers:[{staffIds:list.map(f=>f.staffId),opensAt:at}],everyoneAt:at}
 const ids=rank(s,list,shift,o.rule,o.ranking).map(f=>f.staffId),out:Tier[]=[],step=o.minutes*60000
 for(let i=0;i*o.size<ids.length;i++)out.push({staffIds:ids.slice(i*o.size,(i+1)*o.size),opensAt:new Date(Date.parse(at)+i*step).toISOString()})
 return {tiers:out,everyoneAt:new Date(Date.parse(at)+Math.max(out.length,1)*step).toISOString()}
}
/** When the offer reaches a person: their tier's opening, else the everyone-eligible point (rows without a log: at once). */
export function opensFor(o:Row,staffId:string):string {
 if(!o.tiers)return ''
 return o.tiers.find((t:Tier)=>t.staffIds.includes(staffId))?.opensAt??o.everyoneAt
}
const ruleAt=(s:State,site:string)=>s.offerrules.find(r=>r.site===site)
/** The cafe's call-out replacement order (all at once when none is saved). */
export const replacementOrder=(s:State,site:string)=>{const r=ruleAt(s,site);return r?.order==='tiers'?r:{order:'all'}}
/**
 * Access to hours for an open shift at a cafe with the rule on: existing staff at its cafe (and position)
 * who are part-time or have no employment type and whom no tier of its offer log reached while it was open. "Existing" is
 * anyone not added after the shift was posted; people added after it are the hires it flags.
 */
export function accessToHours(s:State,o:Row,now:string) {
 if(!ruleAt(s,o.site)?.accessToHours||!['open','filled'].includes(o.status))return null
 const added=(id:string)=>employmentOf(s,id)?.addedAt,until=o.status==='filled'&&o.filledAt<now?o.filledAt:now
 const here=s.staff.filter(p=>p.active&&!p.erased_at&&(p.site??'')===o.site&&(!o.position||p.position===o.position))
 // Offered = in a tier that opened while the shift was open; anyone outside the log was never offered it.
 const offered=(id:string)=>Boolean(o.tiers?.some((t:Tier)=>t.staffIds.includes(id)&&t.opensAt<=until))
 const existing=here.filter(p=>!(added(p.id)&&added(p.id)>o.postedAt)),hires=here.filter(p=>added(p.id)&&added(p.id)>o.postedAt).map(p=>p.id)
 const owed=existing.filter(p=>employmentOf(s,p.id)?.type!=='full-time'&&!offered(p.id)).map(p=>({staffId:p.id,typeSet:Boolean(employmentOf(s,p.id)?.type)}))
 return {owed,hires,flagged:hires.length>0&&owed.length>0}
}
export function offerRules(c:Context,name:string,p:Record<string,any>) {
 if(name!=='offerrule.save')return undefined
 // The replacement order: the owner, or a manager at their home cafe; the access-to-hours rule: the owner only.
 need(c.a.role==='owner'||c.a.role==='manager','Manager approval required',403);keys(p,['site','revision','order','rule','size','minutes','ranking','accessToHours'])
 const site=text(p.site,'site',80,true),old=c.s.offerrules.find(r=>r.site===site)
 if(c.a.role==='manager')need((c.s.staff.find(v=>v.id===c.a.staffId)?.site??'')===site,'Only a manager of this cafe can do this',403)
 if(old)need(integer(typeof p.revision==='string'?Number(p.revision):p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Offer rule changed; reload before saving',409)
 const flag=p.accessToHours===undefined?Boolean(old?.accessToHours):p.accessToHours===true||p.accessToHours==='on'
 if(flag!==Boolean(old?.accessToHours))need(c.a.role==='owner','Only the owner sets access to hours',403)
 return put(c,'offerrules',{site,...order(c,p),accessToHours:flag,savedBy:c.a.id,savedAt:c.now},old)
}
/** The employment record staff.save keeps: type, start date and when the person was added to Lanyard. */
export function employment(c:Context,staffId:string,isNew:boolean,p:Record<string,any>) {
 const old=employmentOf(c.s,staffId)
 if(!isNew&&p.employmentType===undefined&&p.startDate===undefined)return
 const type=p.employmentType===undefined?old?.type??null:p.employmentType===''?null:p.employmentType
 need(type===null||TYPES.includes(type),'Choose full-time, part-time or not set')
 const startDate=p.startDate===undefined?old?.startDate??null:p.startDate===''?null:p.startDate
 need(startDate===null||/^\d{4}-\d{2}-\d{2}$/.test(startDate)&&!Number.isNaN(Date.parse(startDate+'T00:00:00Z')),'Invalid start date: use YYYY-MM-DD')
 const entity=c.entity;put(c,'employment',{staffId,type,startDate,addedAt:old?.addedAt??(isNew?c.now:null)},old);c.entity=entity
}

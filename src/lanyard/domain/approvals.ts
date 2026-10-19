// TIME-008 bulk approval: a manager filters waiting timesheets, reviews the list and
// approves it in one action. Each item is pinned to the revision the manager saw and
// goes through the single approval; anything changed, flagged, foreign or their own is skipped.
import {type Context,type Row,type State,keys,text,need,manager,integer} from './model'
import {localDate} from './settings'
import {approve} from './time'

export const STATES=['clean','exception','edited','unconfirmed'] as const
export type Filter={site:string;position:string;from:string;to:string;state:string}

/**
 * A waiting timesheet's review states. exception: capture recorded an exception (no capture
 * path records one yet). edited: it corrects earlier approved time. unconfirmed: a manager or
 * agent entered it, not the person's own clock or request, and the person has not confirmed it (TIME-003). clean: none of these.
 */
export function statesOf(r:Record<string,any>):string[] {
 const states=[...(r.exceptions?.length?['exception']:[]),...(r.corrects?['edited']:[]),...(r.clockId||r.requested||r.employeeConfirmed?[]:['unconfirmed'])]
 return states.length?states:['clean']
}
/** Site is the person's home cafe, position their People position, from/to inclusive venue dates of the start. */
export function matches(s:State,r:Record<string,any>,f:Filter) {
 const p=s.staff.find(v=>v.id===r.staffId),day=localDate(r.start,s.timezone)
 return (!f.site||(p?.site??'')===f.site)&&(!f.position||(p?.position??'')===f.position)&&(!f.from||day>=f.from)&&(!f.to||day<=f.to)&&(!f.state||statesOf(r).includes(f.state))
}
const date=(v:unknown,label:string)=>{const d=text(v,label,10,true);need(!d||/^\d{4}-\d{2}-\d{2}$/.test(d)&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d,`Invalid ${label}: use YYYY-MM-DD`);return d}
export function filterOf(p:Record<string,any>):Filter {
 const f={site:text(p.site,'site',80,true),position:text(p.position,'position',80,true),from:date(p.from,'from'),to:date(p.to,'to'),state:text(p.state,'state',20,true)}
 need(!f.state||(STATES as readonly string[]).includes(f.state),'Invalid state');need(!f.from||!f.to||f.from<=f.to,'The period ends before it starts')
 return f
}

export function approvals(c:Context,name:string,p:Record<string,any>) {
 if(name!=='time.approveMany')return undefined
 manager(c.a);keys(p,['site','position','from','to','state','items'])
 const f=filterOf(p);need(Array.isArray(p.items)&&p.items.length>0&&p.items.length<=500,'Pin 1–500 timesheets')
 const approved:{id:string;staffId:string;revision:number}[]=[],skipped:{id:string;staffId?:string;reason:string}[]=[],seen=new Set<string>()
 for(const item of p.items) {
  need(item&&typeof item==='object'&&!Array.isArray(item),'Invalid item');keys(item,['id','revision'])
  const id=text(item.id,'id'),revision=integer(item.revision,'revision',1,Number.MAX_SAFE_INTEGER);need(!seen.has(id),'Each timesheet once');seen.add(id)
  const r=c.s.timesheets.find(t=>t.id===id),skip=(reason:string)=>skipped.push({id,staffId:r?.staffId,reason})
  if(!r){skip('Not found');continue}
  // An exception is named even when it arrived after the manager pinned the revision (BREAK-001).
  if(r.exceptions?.length){skip(`Exception: ${r.exceptions.join(', ')}`);continue}
  if(r.revision!==revision){skip('Changed since you reviewed it');continue}
  if(r.staffId===c.a.staffId){skip('Your own time');continue}
  if(!matches(c.s,r,f)){skip('Outside the filter');continue}
  try { const done=approve(c,r as Row);approved.push({id,staffId:r.staffId,revision});recordDecision(c,done.id) }
  catch(e){ if(!(e as any)?.status)throw e;skip((e as Error).message) }
 }
 c.entity=crypto.randomUUID()
 return {id:c.entity,filter:f,approved,skipped}
}
/** The same activity a single approval leaves: actor, role, timesheet and time, one per approved revision. */
function recordDecision(c:Context,id:string) {
 c.sql.push(c.db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),c.a.id,c.a.role,'time.approve',id,c.now))
}

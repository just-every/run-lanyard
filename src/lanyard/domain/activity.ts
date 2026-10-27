// AUDIT-001 readers: owners read all activity; a manager reads activity about people whose
// home cafe is theirs and about that cafe's settings; everyone reads the events they performed;
// staff also read decisions on their own personal records; agents read none. An event carries
// actor, role, action, subject id and time only, never employee-private fields.
import {type Actor,type State,type Row,kinds} from './model'
import {privateEntity} from './feedback'
import {privateNote} from './journal'

export type Event={id:string;actorId:string;actorRole:string;action:string;entityId:string;at:string}
type Subject={people:Set<string>;sites:Set<string>;person:string|null}

/** The people and cafes an event's subject record is about, and the one person whose own record it is (a staff record or a record with a staffId); empty for installation settings and records no longer present. */
function subject(s:State,index:Map<string,[string,Row]>,id:string):Subject {
 const people=new Set<string>(),sites=new Set<string>(),add=(v:unknown)=>{if(typeof v==='string'&&v)people.add(v)}
 let person:string|null=s.staff.some(p=>p.id===id)?id:null
 if(person)people.add(person)
 const found=index.get(id)
 if(found) {
  const [k,r]=found
  add(r.staffId);add(r.callout?.staffId);add(r.fromId);add(r.toId);if(typeof r.staffId==='string')person=r.staffId
  for(const list of [r.lines,r.slots,r.rows])if(Array.isArray(list))for(const x of list)add(x.staffId)
  const roster=k==='rosters'?r.id:k==='postings'?r.rosterId:null
  if(roster)for(const x of s.shifts)if(x.rosterId===roster)add(x.staffId)
  if(k!=='shifts'&&typeof r.site==='string')sites.add(r.site)
  if(typeof r.filter?.site==='string'&&r.filter.site)sites.add(r.filter.site)
 }
 return {people,sites,person}
}

/** The newest 100 events this reader may read. */
export function readable(s:State,a:Actor,events:Event[]):Event[] {
 if(a.role==='owner')return events.filter(e=>e.actorId===a.id||!privateEntity(s,e.entityId)).slice(0,100)
 if(a.role==='agent')return []
 const index=new Map<string,[string,Row]>(kinds.flatMap(k=>s[k].map(r=>[r.id,[k,r]] as [string,[string,Row]])))
 const home=s.staff.find(p=>p.id===a.staffId)?.site??'',siteOf=(id:string)=>s.staff.find(p=>p.id===id)?.site??''
 return events.filter(e=>{
  if(['chat.removeMember','chat.leave'].includes(e.action))return false
  if(e.actorId===a.id)return true
  // FEEDBACK-001: events on anonymous feedback name its author, so only their performer reads them.
  if(privateEntity(s,e.entityId))return false
  const {people,sites,person}=subject(s,index,e.entityId)
  // A cafe setting with no cafe named covers every cafe, so every manager reads it.
  if(a.role==='manager')return [...people].some(id=>siteOf(id)===home)||(!people.size&&(sites.has(home)||sites.has('')))
  // JOURNAL-001: a private note's events stay with its writers, not its employee.
  return person===a.staffId&&!privateNote(s,e.entityId)
 }).slice(0,100)
}

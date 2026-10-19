import {type Actor,type Context,type State,kinds,object,text,need,sha,canonical,get,manager} from './model'
import {actor,live,load,saved,commit} from './storage'
import {people} from './people'
import {roster} from './roster'
import {time} from './time'
import {payroll} from './payroll'
import {settings} from './settings'
import {cover} from './cover'
import {forecast} from './forecast'
import {team,teamFor} from './team'
import {approvals} from './approvals'
import {clockRules} from './clockrules'
import {leaveRules,allowedDates} from './leaverules'
import {localDate} from './settings'
import {postings} from './postings'
import {mealRules} from './mealrules'
import {templates} from './templates'
import {patterns} from './patterns'
import {postingPdf} from '../print'
import {type Event,readable} from './activity'
import {earnings,earnSettings} from './earnings'
import {rounding} from './rounding'
import {feedback,feedbackFor} from './feedback'
import {journal,notesFor,noteFile} from './journal'
import {swaps,swapOptions} from './swaps'
import {closeRules,provisional} from './closerules'
import {clockNets} from './clocknets'
import {openShifts,openFor} from './openshifts'
import {review} from './review'
export {actor}
export type {Actor} from './model'
const commands=['settings.save','staff.save','staff.erase','availability.save','leave.request','leave.decide','roster.prepare','roster.publish','shift.confirm','clock.in','clock.out','time.prepare','time.approve','payroll.prepare','payroll.export','payroll.acknowledge','forecast.save','shift.callout','cover.respond','cover.approve','team.visibility','time.approveMany','clockrule.save','leaverule.save','schedule.post','mealrule.save','template.save','template.apply','roster.copy','recurrence.save','recurrence.apply','availability.policy','pattern.save','pattern.decide','earnings.save','roundrule.save','feedback.submit','feedback.reply','feedback.settings','note.save','swap.propose','swap.respond','swap.withdraw','swap.decide','closerule.save','time.confirm','clocknet.save','openshift.post','openshift.request','openshift.approve','time.edit','time.return','time.resubmit']
function fresh(a:Actor,s:State) {
 if(a.role==='owner'||a.role==='agent')return a
 const person=s.staff.find(v=>v.id===a.staffId&&v.email.toLowerCase()===a.email.toLowerCase()&&v.active&&!v.erased_at)
 need(person,'Staff access revoked',403);return {...a,role:person.role}
}
export async function command(db:D1Database,identity:Actor,name:string,input:unknown,secret?:string,net?:Context['net']):Promise<object> {
 need(commands.includes(name),'Unknown command',404);const a=await live(db,identity),p=object(input)
 if(a.role==='agent')need(['roster.prepare','time.prepare','payroll.prepare'].includes(name),'Agents may prepare drafts only; a human manager must approve',403)
 const commandId=name.startsWith('clock.')?text(p.commandId,'commandId',120):crypto.randomUUID(),digest=await sha(canonical({name,input:p}))
 const previous=await saved(db,commandId,a,digest);if(previous)return previous
 const before=await load(db),s=structuredClone(before),c:Context={a:fresh(a,s),s,db,now:new Date().toISOString(),sql:[],entity:'',secret,net}
 let result:any=settings(c,name,p)
 if(result===undefined)result=await people(c,name,p)
 if(result===undefined)result=roster(c,name,p)
 if(result===undefined)result=time(c,name,p)
 if(result===undefined)result=await payroll(c,name,p)
 if(result===undefined)result=cover(c,name,p)
 if(result===undefined)result=forecast(c,name,p)
 if(result===undefined)result=team(c,name,p)
 if(result===undefined)result=approvals(c,name,p)
 if(result===undefined)result=clockRules(c,name,p)
 if(result===undefined)result=leaveRules(c,name,p)
 if(result===undefined)result=postings(c,name,p)
 if(result===undefined)result=mealRules(c,name,p)
 if(result===undefined)result=templates(c,name,p)
 if(result===undefined)result=patterns(c,name,p)
 if(result===undefined)result=earnings(c,name,p)
 if(result===undefined)result=rounding(c,name,p)
 if(result===undefined)result=await feedback(c,name,p)
 if(result===undefined)result=await journal(c,name,p)
 if(result===undefined)result=swaps(c,name,p)
 if(result===undefined)result=closeRules(c,name,p)
 if(result===undefined)result=clockNets(c,name,p)
 if(result===undefined)result=openShifts(c,name,p)
 need(result!==undefined,'Unknown command',404)
 if(a.role==='agent'&&name==='payroll.prepare') {
  const {csvPreview,csv,lines,...safe}=result as Record<string,any>
  result={...safe,lines:lines.map(({payrollId,...line}:any)=>line)}
 }
 return commit(c,before,name,commandId,digest,result)
}
export async function snapshot(db:D1Database,identity:Actor,secret?:string):Promise<object> {
 const a0=await live(db,identity),events=a0.role==='agent'?null:db.prepare('SELECT id,actor_id AS actorId,actor_role AS actorRole,action,entity_id AS entityId,at FROM l_events ORDER BY at DESC,id DESC').all<Event>()
 const s=await load(db),a=fresh(a0,s),manages=['owner','manager'].includes(a.role),agent=a.role==='agent'
 const staff=s.staff.filter(p=>manages||agent||p.id===a.staffId).map(p=>agent?{id:p.id,name:p.name,active:!!p.active,position:p.position,site:p.site}:{id:p.id,name:p.name,email:p.email,payrollId:p.payroll_id,role:p.role,active:!!p.active,revision:p.version,erasedAt:p.erased_at,position:p.position,site:p.site,...(manages||(p.id===a.staffId&&earnSettings(s.earnings).estimates)?{hourlyRateCents:p.rate_cents}:{})})
 const result:Record<string,any>={actor:{id:a.id,email:agent?undefined:a.email,name:agent?undefined:identity.name,role:a.role,staffId:a.staffId},version:s.version,settings:{timezone:s.timezone},staff}
 for(const k of kinds)result[k]=s[k]
 if(!manages&&!agent) {
  for(const k of ['availability','leave','clocks','timesheets','patterns'] as const)result[k]=s[k].filter(r=>r.staffId===a.staffId)
  // Staff see their own published shifts, the ones they called out of and the ones offered to them, never others' hours.
  result.offers=s.offers.filter(o=>o.staffId===a.staffId);const offered=new Set(result.offers.map((o:any)=>o.shiftId))
  result.shifts=s.shifts.filter(r=>r.status==='published'&&(r.staffId===a.staffId||r.callout?.staffId===a.staffId||offered.has(r.id))).map(({callout,...r})=>callout?{...r,callout:{staffId:callout.staffId===a.staffId?callout.staffId:undefined,note:callout.staffId===a.staffId?callout.note:undefined,at:callout.at,covered:Boolean(callout.coveredBy)}}:r)
  const ids=new Set(result.shifts.map((r:any)=>r.rosterId));result.rosters=s.rosters.filter(r=>ids.has(r.id));result.batches=[];result.forecasts=[];result.postings=[];result.templates=[];result.recurrences=[]
  // ROSTER-004: coworkers' published shifts at their cafe, as name, position and start/end only; who is hidden stays private.
  result.team=teamFor(s,a.staffId!);result.teamviews=[]
  // LEAVE-002: the dates they may not request (blackouts, limits already full), never who is off.
  result.leaveDates=allowedDates(s.staff,s.leave,s.leaverules,s.timezone,a.staffId!,localDate(new Date().toISOString(),s.timezone));result.leaverules=[]
 }
 if(agent) {
  result.clocks=[];result.teamviews=[];result.leave=s.leave.filter(r=>r.status==='approved').map(r=>({id:r.id,staffId:r.staffId,start:r.start,end:r.end,status:r.status,revision:r.revision}))
  result.timesheets=s.timesheets.map(({reason,submittedBy,approvedBy,network,...r})=>r)
  result.batches=s.batches.map(({csv,csvPreview,lines,reference,...r})=>({...r,lines:lines.map(({payrollId,...l}:any)=>l)}))
 }
 // COVER-001: managers read every swap; a person reads the swaps they are in, with both names, and their own swap choices.
 const named=(w:any)=>({...w,fromName:s.staff.find(p=>p.id===w.fromId)?.name??'Former staff',toName:s.staff.find(p=>p.id===w.toId)?.name??'Former staff'})
 result.swaps=agent?[]:s.swaps.filter(w=>manages||w.fromId===a.staffId||w.toId===a.staffId).map(named)
 result.swapOptions=a.staffId&&!agent?swapOptions(s,a.staffId,new Date().toISOString()):[]
 // COVER-002: managers read every open shift and request; a person reads the open shifts they may request (with their own rate when visible) and their requests.
 if(!manages){result.openshifts=agent?[]:openFor(s,a.staffId!,earnSettings(s.earnings).estimates);result.pickups=agent?[]:s.pickups.filter(x=>x.staffId===a.staffId)}
 // TIME-009: managers see each waiting timesheet's approval review.
 if(manages)result.timesheets=result.timesheets.map((t:any)=>t.status==='submitted'?{...t,review:review(s,t)}:t)
 // TIME-007: each open punch past its point shows its provisional end; the person sees it as their reminder.
 {const now=new Date().toISOString();result.clocks=result.clocks.map((k:any)=>{const mark=provisional(s,k,now);return mark?{...k,provisional:mark}:k})}
 // FEEDBACK-001: each reader's own slice; an anonymous author is never named.
 result.feedback=await feedbackFor(s,a,secret);if(agent)result.feedbackopts=[]
 // JOURNAL-001: notes by cafe and role; an employee reads only notes made visible to them.
 result.notes=notesFor(s,a)
 // AUDIT-001: each role reads only its own slice of the activity list.
 result.events=events?readable(s,a,(await events).results):[]
 return result
}
export async function batchCsv(db:D1Database,identity:Actor,id:string):Promise<string> {
 const a=await live(db,identity);manager(a);const s=await load(db);manager(fresh(a,s));const b=get(s,'batches',id);need(['exported','acknowledged'].includes(b.status),'Batch has not been exported',409);need(typeof b.csv==='string'&&await sha(b.csv)===b.sha256,'Stored payroll file integrity check failed',409)
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'payroll.download',b.id,new Date().toISOString()).run()
 return b.csv
}
/** SCHEDULE-005: the PDF of one posting, rebuilt from the rows it recorded, for owners and managers. */
export async function schedulePdf(db:D1Database,identity:Actor,id:string):Promise<{bytes:Uint8Array<ArrayBuffer>;name:string}> {
 const a=await live(db,identity);manager(a);const s=await load(db);manager(fresh(a,s));const p=get(s,'postings',id)
 return {bytes:postingPdf(p,p.filter.staffId?s.staff.find(v=>v.id===p.filter.staffId)?.name??null:null),name:`lanyard-schedule-${p.week}-r${p.rosterRevision}-${p.id.slice(0,8)}.pdf`}
}
/** JOURNAL-001: a note's attachment, for a reader who may read the note. */
export async function noteAttachment(db:D1Database,identity:Actor,noteId:string,fileId:string) {
 const a=await live(db,identity),s=await load(db);return noteFile(db,s,fresh(a,s),noteId,fileId)
}

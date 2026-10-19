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
export {actor}
export type {Actor} from './model'
const commands=['settings.save','staff.save','staff.erase','availability.save','leave.request','leave.decide','roster.prepare','roster.publish','shift.confirm','clock.in','clock.out','time.prepare','time.approve','payroll.prepare','payroll.export','payroll.acknowledge','forecast.save','shift.callout','cover.respond','cover.approve','team.visibility','time.approveMany']
function fresh(a:Actor,s:State) {
 if(a.role==='owner'||a.role==='agent')return a
 const person=s.staff.find(v=>v.id===a.staffId&&v.email.toLowerCase()===a.email.toLowerCase()&&v.active&&!v.erased_at)
 need(person,'Staff access revoked',403);return {...a,role:person.role}
}
export async function command(db:D1Database,identity:Actor,name:string,input:unknown):Promise<object> {
 need(commands.includes(name),'Unknown command',404);const a=await live(db,identity),p=object(input)
 if(a.role==='agent')need(['roster.prepare','time.prepare','payroll.prepare'].includes(name),'Agents may prepare drafts only; a human manager must approve',403)
 const commandId=name.startsWith('clock.')?text(p.commandId,'commandId',120):crypto.randomUUID(),digest=await sha(canonical({name,input:p}))
 const previous=await saved(db,commandId,a,digest);if(previous)return previous
 const before=await load(db),s=structuredClone(before),c:Context={a:fresh(a,s),s,db,now:new Date().toISOString(),sql:[],entity:''}
 let result:any=settings(c,name,p)
 if(result===undefined)result=await people(c,name,p)
 if(result===undefined)result=roster(c,name,p)
 if(result===undefined)result=time(c,name,p)
 if(result===undefined)result=await payroll(c,name,p)
 if(result===undefined)result=cover(c,name,p)
 if(result===undefined)result=forecast(c,name,p)
 if(result===undefined)result=team(c,name,p)
 if(result===undefined)result=approvals(c,name,p)
 need(result!==undefined,'Unknown command',404)
 if(a.role==='agent'&&name==='payroll.prepare') {
  const {csvPreview,csv,lines,...safe}=result as Record<string,any>
  result={...safe,lines:lines.map(({payrollId,...line}:any)=>line)}
 }
 return commit(c,before,name,commandId,digest,result)
}
export async function snapshot(db:D1Database,identity:Actor):Promise<object> {
 // The activity list is read beside the records whenever the signed-in role can see it.
 const a0=await live(db,identity),events=['owner','manager'].includes(a0.role)?db.prepare('SELECT id,actor_id AS actorId,actor_role AS actorRole,action,entity_id AS entityId,at FROM l_events ORDER BY at DESC,id DESC LIMIT 100').all():null
 const s=await load(db),a=fresh(a0,s),manages=['owner','manager'].includes(a.role),agent=a.role==='agent'
 const staff=s.staff.filter(p=>manages||agent||p.id===a.staffId).map(p=>agent?{id:p.id,name:p.name,active:!!p.active,position:p.position,site:p.site}:{id:p.id,name:p.name,email:p.email,payrollId:p.payroll_id,role:p.role,active:!!p.active,revision:p.version,erasedAt:p.erased_at,position:p.position,site:p.site,...(manages?{hourlyRateCents:p.rate_cents}:{})})
 const result:Record<string,any>={actor:{id:a.id,email:agent?undefined:a.email,name:agent?undefined:identity.name,role:a.role,staffId:a.staffId},version:s.version,settings:{timezone:s.timezone},staff}
 for(const k of kinds)result[k]=s[k]
 if(!manages&&!agent) {
  for(const k of ['availability','leave','clocks','timesheets'] as const)result[k]=s[k].filter(r=>r.staffId===a.staffId)
  // Staff see their own published shifts, the ones they called out of and the ones offered to them, never others' hours.
  result.offers=s.offers.filter(o=>o.staffId===a.staffId);const offered=new Set(result.offers.map((o:any)=>o.shiftId))
  result.shifts=s.shifts.filter(r=>r.status==='published'&&(r.staffId===a.staffId||r.callout?.staffId===a.staffId||offered.has(r.id))).map(({callout,...r})=>callout?{...r,callout:{staffId:callout.staffId===a.staffId?callout.staffId:undefined,note:callout.staffId===a.staffId?callout.note:undefined,at:callout.at,covered:Boolean(callout.coveredBy)}}:r)
  const ids=new Set(result.shifts.map((r:any)=>r.rosterId));result.rosters=s.rosters.filter(r=>ids.has(r.id));result.batches=[];result.forecasts=[]
  // ROSTER-004: coworkers' published shifts at their cafe, as name, position and start/end only; who is hidden stays private.
  result.team=teamFor(s,a.staffId!);result.teamviews=[]
 }
 if(agent) {
  result.clocks=[];result.teamviews=[];result.leave=s.leave.filter(r=>r.status==='approved').map(r=>({id:r.id,staffId:r.staffId,start:r.start,end:r.end,status:r.status,revision:r.revision}))
  result.timesheets=s.timesheets.map(({reason,submittedBy,approvedBy,...r})=>r)
  result.batches=s.batches.map(({csv,csvPreview,lines,reference,...r})=>({...r,lines:lines.map(({payrollId,...l}:any)=>l)}))
 }
 result.events=manages?(await (events??db.prepare('SELECT id,actor_id AS actorId,actor_role AS actorRole,action,entity_id AS entityId,at FROM l_events ORDER BY at DESC,id DESC LIMIT 100').all())).results:[]
 return result
}
export async function batchCsv(db:D1Database,identity:Actor,id:string):Promise<string> {
 const a=await live(db,identity);manager(a);const s=await load(db);manager(fresh(a,s));const b=get(s,'batches',id);need(['exported','acknowledged'].includes(b.status),'Batch has not been exported',409);need(typeof b.csv==='string'&&await sha(b.csv)===b.sha256,'Stored payroll file integrity check failed',409)
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'payroll.download',b.id,new Date().toISOString()).run()
 return b.csv
}

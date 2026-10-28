import {type Bindings,operatorAuth} from '../auth.server'
import {type Actor,keys,need,sha} from './domain/model'
import {load} from './domain/storage'
import {eligibleLocation} from './domain/organization'

const privateHeaders={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow'}
const eligibility=`SELECT p.id FROM l_staff p JOIN oa_operators o ON o.email=p.email COLLATE NOCASE
 WHERE p.id=? AND o.id=? AND o.version=? AND o.status='active' AND p.active=1 AND p.erased_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM l_erasure_journal e WHERE e.staff_id=p.id)`
async function employee(env:Bindings,a:Actor) {
 need(a.role!=='agent'&&a.staffId,'An active employee manages only their own calendar',403)
 need(await env.DB.prepare(eligibility).bind(a.staffId,a.id,a.ownerVersion).first(),'An active employee manages only their own calendar',403)
 return a.staffId
}
export async function calendarStatus(env:Bindings,a:Actor) {
 const id=await employee(env,a),row=await env.DB.prepare('SELECT revision,revoked_at,operator_id,operator_version FROM l_calendar_feeds WHERE staff_id=?').bind(id).first<any>()
 return {revision:row?.revision??0,active:Boolean(row&&!row.revoked_at&&row.operator_id===a.id&&row.operator_version===a.ownerVersion)}
}
/** The clear capability appears once, only in the explicit issuance response. */
export async function calendarCommand(env:Bindings,a:Actor,name:string,input:Record<string,unknown>) {
 const id=await employee(env,a);keys(input,['revision','consent'])
 need(['calendar.issue','calendar.rotate','calendar.revoke'].includes(name),'Unknown calendar command',404)
 const old=await calendarStatus(env,a)
 need(input.revision===old.revision,'Calendar changed; reload before retrying',409)
 need(name==='calendar.issue'?!old.active:old.active,'Reload the current calendar state',409)
 if(name!=='calendar.revoke')need(input.consent==='yes','Confirm that anyone with the private link can read your published assignments')
 const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),at=new Date().toISOString(),revision=old.revision+1
 const guard=env.DB.prepare(`INSERT INTO l_guard(id,ok) VALUES(?,CASE WHEN EXISTS(${eligibility}) AND
  coalesce((SELECT revision FROM l_calendar_feeds WHERE staff_id=?),0)=? THEN 1 ELSE 0 END)`).bind(crypto.randomUUID(),id,a.id,a.ownerVersion,id,old.revision)
 const save=name==='calendar.revoke'?env.DB.prepare('UPDATE l_calendar_feeds SET revoked_at=?,revision=? WHERE staff_id=?').bind(at,revision,id):
  env.DB.prepare(`INSERT INTO l_calendar_feeds(staff_id,operator_id,operator_version,token_hash,revision,revoked_at) VALUES(?,?,?,?,?,NULL)
   ON CONFLICT(staff_id) DO UPDATE SET operator_id=excluded.operator_id,operator_version=excluded.operator_version,token_hash=excluded.token_hash,revision=excluded.revision,revoked_at=NULL`).bind(id,a.id,a.ownerVersion,await sha(token),revision)
 try {await env.DB.batch([guard,save,env.DB.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,name,id,at),env.DB.prepare('DELETE FROM l_guard')])}
 catch(error){if(/constraint|CHECK|UNIQUE/i.test(String(error)))need(false,'Calendar changed; reload before retrying',409);throw error}
 return {revision,active:name!=='calendar.revoke',...(name==='calendar.revoke'?{}:{url:env.AUTH_ORIGIN+'/api/lanyard/calendar/'+token+'.ics'})}
}
const escapeText=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,')
const stamp=(value:string)=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')
/** Fold on UTF-8 octets, preserving code points and CRLF as required by iCalendar. */
function fold(line:string) {
 const out:string[]=[];let chunk='',bytes=0
 for(const char of line){const length=new TextEncoder().encode(char).length;if(bytes+length>75){out.push(chunk);chunk=' ';bytes=1}chunk+=char;bytes+=length}
 out.push(chunk);return out.join('\r\n')
}
export async function calendarFeed(request:Request,env:Bindings,token:string) {
 const denied=()=>new Response('Calendar unavailable',{status:404,headers:privateHeaders})
 if(!/^[a-f0-9]{64}$/.test(token))return denied()
 const row=await env.DB.prepare(`SELECT f.staff_id FROM l_calendar_feeds f JOIN l_staff p ON p.id=f.staff_id
  JOIN oa_operators o ON o.id=f.operator_id AND o.email=p.email COLLATE NOCASE
  WHERE f.token_hash=? AND f.revoked_at IS NULL AND p.active=1 AND p.erased_at IS NULL
  AND o.status='active' AND o.version=f.operator_version AND NOT EXISTS(SELECT 1 FROM l_erasure_journal e WHERE e.staff_id=p.id)`).bind(await sha(token)).first<{staff_id:string}>()
 if(!row)return denied()
 // Calendar clients use the secret link without cookies. A signed-in colleague cannot
 // use their ordinary application session to read somebody else's subscription.
 const session=await operatorAuth(env).getSession(request)
 if(session){const me=await env.DB.prepare('SELECT id FROM l_staff WHERE email=? COLLATE NOCASE AND active=1 AND erased_at IS NULL').bind(session.operator.email).first<{id:string}>();if(me?.id!==row.staff_id)return denied()}
 const s=await load(env.DB),events=(await env.DB.prepare('SELECT lineage,sequence,data,updated_at FROM l_calendar_events WHERE staff_id=? ORDER BY lineage').bind(row.staff_id).all<any>()).results
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Lanyard//Personal assignments//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:My Lanyard shifts','X-WR-TIMEZONE:'+escapeText(s.timezone)]
 for(const event of events){const data=JSON.parse(event.data);if(!eligibleLocation(s,row.staff_id,data.site))continue
  lines.push('BEGIN:VEVENT','UID:lanyard-'+await sha(row.staff_id+':'+event.lineage),'SEQUENCE:'+event.sequence,'DTSTAMP:'+stamp(event.updated_at),'LAST-MODIFIED:'+stamp(event.updated_at),'DTSTART:'+stamp(data.start),'DTEND:'+stamp(data.end),'SUMMARY:Published shift','LOCATION:'+escapeText(data.site),'STATUS:'+data.status,'TRANSP:OPAQUE','END:VEVENT')
 }
 lines.push('END:VCALENDAR')
 return new Response(lines.map(fold).join('\r\n')+'\r\n',{headers:{...privateHeaders,'content-type':'text/calendar; charset=utf-8','content-disposition':'inline; filename="lanyard-shifts.ics"'}})
}

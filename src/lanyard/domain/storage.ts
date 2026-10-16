// Adapted from saved siblings glove-storage.ts: a false CHECK guard rolls back
// the complete D1 batch, including source claims, audit and idempotent outcome.
import {type Actor,type State,type Context,type Staff,kinds,need,fail,sha} from './model'
export async function actor(db:D1Database,session:{userId:string;email:string;isOwner:boolean}):Promise<Actor> {
 const email=session.email.trim().toLowerCase();need(session.userId&&email,'Sign in required',403)
 const [erased,found]=await Promise.all([db.prepare('SELECT 1 FROM l_erasure_journal WHERE identity_hash=?').bind(await sha(email)).first(),db.prepare('SELECT * FROM l_staff WHERE email=? COLLATE NOCASE AND active=1 AND erased_at IS NULL').bind(email).first<Staff>()])
 const person=erased?null:found
 need(session.isOwner||person,'Staff access has been revoked or is not granted',403)
 return {id:session.userId,email,role:session.isOwner?'owner':person!.role,staffId:person?.id,isOwner:session.isOwner}
}
export async function live(db:D1Database,a:Actor):Promise<Actor> {
 if(a.role==='agent') { need(a.isOwner===true&&a.id,'Agent must be bound to an owner by the authenticated wrapper',403);return {...a,staffId:undefined} }
 return actor(db,{userId:a.id,email:a.email,isOwner:a.isOwner===true||a.role==='owner'})
}
export async function load(db:D1Database):Promise<State> {
 const r=await db.batch<any>([db.prepare('SELECT version,timezone FROM l_meta WHERE id=1'),db.prepare('SELECT * FROM l_staff ORDER BY name,id'),db.prepare('SELECT kind,data FROM l_records ORDER BY id'),db.prepare('SELECT * FROM l_payroll_claims')])
 const s={version:r[0].results[0].version,timezone:r[0].results[0].timezone,staff:r[1].results,claims:r[3].results} as State
 for(const k of kinds)s[k]=[]
 for(const row of r[2].results)if((kinds as readonly string[]).includes(row.kind))s[row.kind as typeof kinds[number]].push(JSON.parse(row.data))
 return s
}
export async function saved(db:D1Database,id:string,a:Actor,digest:string) {
 const old=await db.prepare('SELECT actor_id,digest,result FROM l_commands WHERE id=?').bind(id).first<any>()
 if(!old)return null
 need(old.actor_id===a.id&&old.digest===digest,'Command identity already used by another actor or body',409);return JSON.parse(old.result)
}
export async function commit(c:Context,before:State,name:string,commandId:string,digest:string,result:unknown) {
 const q:D1PreparedStatement[]=[], guard=(sql:string,...values:any[])=>q.push(c.db.prepare(`INSERT INTO l_guard(id,ok) VALUES(?,CASE WHEN (${sql}) THEN 1 ELSE 0 END)`).bind(crypto.randomUUID(),...values))
 guard('EXISTS(SELECT 1 FROM l_meta WHERE id=1 AND version=? AND timezone=?)',before.version,before.timezone)
 // Fence imports and live grants too: imports may not advance l_meta.
 guard('(SELECT COUNT(*) FROM l_staff)=?',before.staff.length)
 for(const s of before.staff)guard('EXISTS(SELECT 1 FROM l_staff WHERE id=? AND version=? AND active=? AND role=? AND email=? AND name=? AND payroll_id IS ? AND erased_at IS ?)',s.id,s.version,s.active,s.role,s.email,s.name,s.payroll_id,s.erased_at)
 if(c.a.role==='staff'||c.a.role==='manager')guard('EXISTS(SELECT 1 FROM l_staff WHERE id=? AND email=? COLLATE NOCASE AND active=1 AND erased_at IS NULL AND role=?)',c.a.staffId,c.a.email,c.a.role)
 if(c.a.role==='owner'||c.a.role==='agent')guard("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND role='owner' AND status='active')",c.a.id)
 else guard("EXISTS(SELECT 1 FROM oa_operators WHERE id=? AND status='active')",c.a.id)
 for(const k of kinds) { const old=new Map(before[k].map(r=>[r.id,JSON.stringify(r)]));for(const r of c.s[k])if(old.get(r.id)!==JSON.stringify(r))q.push(c.db.prepare('INSERT INTO l_records(kind,id,revision,data) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,data=excluded.data').bind(k,r.id,r.revision,JSON.stringify(r))) }
 q.push(...c.sql)
 q.push(c.db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),c.a.id,c.a.role,name,c.entity,c.now))
 q.push(c.db.prepare('UPDATE l_meta SET version=version+1,timezone=? WHERE id=1').bind(c.s.timezone))
 const response={ok:true,result,version:before.version+1}
 q.push(c.db.prepare('INSERT INTO l_commands(id,actor_id,digest,result,created_at) VALUES(?,?,?,?,?)').bind(commandId,c.a.id,digest,JSON.stringify(response),c.now))
 q.push(c.db.prepare('DELETE FROM l_guard'))
 try { await c.db.batch(q) } catch(e) { const replay=await saved(c.db,commandId,c.a,digest);if(replay)return replay;const message=e instanceof Error?e.message:String(e);if(/constraint|CHECK|UNIQUE/i.test(message))fail('State changed or identity conflicts; reload before retrying',409);throw e }
 return response
}

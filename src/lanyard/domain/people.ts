// @ts-ignore The pinned Base portability runtime is an ES module without declarations.
import {createPortability} from '@runeditrun/rer/modules/portability'
// @ts-ignore The archive policy is shared with Base's JavaScript CLI.
import archivePolicy from '../archive-policy.mjs'
import {freezeRates} from './workforce'
import {requestFlags,overrideOf} from './leaverules'
import {employment,employmentOf} from './offerorder'
import {type Context,keys,text,integer,need,manager,self,staff,window,get,exact,put,sha,overlap} from './model'
/** An hourly rate in dollars ("19.00", 19 or empty) stored as whole cents. */
export function cents(value:unknown):number|null {
 if(value===undefined||value===null||value==='')return null
 const raw=typeof value==='number'?String(value):typeof value==='string'?value.trim().replace(/^\$/,''):''
 need(/^\d{1,4}(?:\.\d{1,2})?$/.test(raw),'Invalid hourly rate: use dollars, such as 19.00')
 return Math.round(Number(raw)*100)
}
// Willow leave: pending requests and a manager's explicit decision are distinct.
export async function people(c:Context,name:string,p:Record<string,any>) {
 if(name==='staff.save') {
  need(c.a.role==='owner','Owner required',403);keys(p,['id','revision','name','email','payrollId','role','active','position','hourlyRate','site','employmentType','startDate'])
  const old=p.id?c.s.staff.find(s=>s.id===text(p.id,'id')):undefined;need(!p.id||old,'Staff not found',404)
  if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.version,'Staff changed; reload',409)
  need(!old?.erased_at,'Erased staff cannot be restored',409)
  const email=text(p.email,'email',254).toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Invalid email')
  need(!await c.db.prepare('SELECT 1 FROM l_erasure_journal WHERE identity_hash=?').bind(await sha(email)).first(),'Identity was erased; restore fence prevents reimport',409)
  need(typeof p.active==='boolean','Explicit active flag required');need(['staff','manager'].includes(p.role),'Invalid role')
  if(old&&old.rate_cents!==cents(p.hourlyRate))freezeRates(c,old.id)
  const r={id:old?.id??crypto.randomUUID(),name:text(p.name,'name',160),email,payroll_id:text(p.payrollId,'payrollId',100,true)||null,role:p.role,active:p.active?1:0,version:(old?.version??0)+1,erased_at:null,position:text(p.position,'position',80,true)||null,rate_cents:cents(p.hourlyRate),site:text(p.site,'site',80,true)||null}
  need(!c.s.staff.some(v=>v.id!==r.id&&(v.email.toLowerCase()===email||(r.payroll_id!==null&&v.payroll_id===r.payroll_id))),'Email or payroll ID is already used',409)
  c.sql.push(c.db.prepare('INSERT INTO l_staff(id,name,email,payroll_id,role,active,version,position,rate_cents,site) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,payroll_id=excluded.payroll_id,role=excluded.role,active=excluded.active,version=excluded.version,position=excluded.position,rate_cents=excluded.rate_cents,site=excluded.site').bind(r.id,r.name,r.email,r.payroll_id,r.role,r.active,r.version,r.position,r.rate_cents,r.site));employment(c,r.id,!old,p);c.entity=r.id
  const e=employmentOf(c.s,r.id)
  return {id:r.id,name:r.name,email:r.email,payrollId:r.payroll_id,role:r.role,active:!!r.active,revision:r.version,position:r.position,hourlyRateCents:r.rate_cents,site:r.site,employmentType:e?.type??null,startDate:e?.startDate??null}
 }
 if(name==='staff.erase') {
  need(c.a.role==='owner','Owner required',403);keys(p,['id','revision']);const old=c.s.staff.find(s=>s.id===text(p.id,'id'));need(old,'Staff not found',404);need(!old.erased_at,'Staff already erased',409);need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.version,'Staff changed; reload',409)
  // COVER-004's employment record (type, start date) is not history: it never blocks erasure and is erased with the person.
  const unusedSql=`NOT EXISTS(SELECT 1 FROM l_records r,json_tree(r.data) j WHERE r.kind<>'employment' AND j.key='staffId' AND j.value=?)
   AND NOT EXISTS(SELECT 1 FROM oa_operators WHERE email=? COLLATE NOCASE)
   AND NOT EXISTS(SELECT 1 FROM ik_provenance WHERE destination='lanyard:staff' AND target_kind='staff' AND target_id=?)
   AND NOT EXISTS(SELECT 1 FROM ik_d1_history WHERE destination='lanyard:staff' AND target_kind='staff' AND target_id=?)
   AND NOT EXISTS(SELECT 1 FROM l_import_staff_revisions WHERE staff_id=?)`
  const values=[old.id,old.email,old.id,old.id,old.id]
  const unused=await c.db.prepare(`SELECT CASE WHEN (${unusedSql}) THEN 1 ELSE 0 END AS ok`).bind(...values).first<{ok:number}>()
  need(unused?.ok===1,'Only unused, uninvited, non-imported staff can be erased; deactivate staff with employment history',409)
  c.sql.push(c.db.prepare(`INSERT INTO l_guard(id,ok) VALUES(?,CASE WHEN (${unusedSql}) THEN 1 ELSE 0 END)`).bind(crypto.randomUUID(),...values))
  const portability=await createPortability({db:c.db,buckets:{FILES:c.files!},policy:archivePolicy})
  c.sql.push(...await portability.redactionStatements(),...await portability.invalidateTransfersStatements())
  c.sql.push(c.db.prepare('INSERT INTO l_erasure_journal(staff_id,identity_hash,erased_at,actor_id) VALUES(?,?,?,?)').bind(old.id,await sha(old.email.toLowerCase()),c.now,c.a.id),c.db.prepare("DELETE FROM l_records WHERE kind='employment' AND json_extract(data,'$.staffId')=?").bind(old.id),c.db.prepare("UPDATE l_staff SET name='Erased staff',email=?,payroll_id=NULL,role='staff',active=0,version=version+1,erased_at=?,position=NULL,rate_cents=NULL,site=NULL WHERE id=?").bind(`erased-${old.id}@invalid.local`,c.now,old.id))
  // Keep identities and digests so old commands cannot replay erased PII.
  c.sql.push(c.db.prepare("UPDATE l_commands SET result=? WHERE instr(result,?)>0 OR instr(result,?)>0").bind(JSON.stringify({ok:true,result:{erased:true}}),old.id,old.email));c.entity=old.id
  c.s.employment=c.s.employment.filter(r=>r.staffId!==old.id)
  return {id:old.id,erased:true}
 }
 if(name==='availability.save') {
  keys(p,['id','revision','staffId','start','end']);need(c.a.role!=='agent','Staff or manager required',403)
  const staffId=p.staffId?staff(c,p.staffId).id:self(c.a);if(staffId!==c.a.staffId)manager(c.a)
  const old=p.id?get(c.s,'availability',p.id):undefined;if(old){exact(old,p);need(old.staffId===staffId,'Cannot move availability between staff')}
  const w=window(p);return put(c,'availability',{staffId,...w},old)
 }
 if(name==='leave.request') {
  keys(p,['start','end','reason']);const staffId=self(c.a),w=window(p)
  need(!c.s.leave.some(r=>r.staffId===staffId&&['pending','approved'].includes(r.status)&&overlap(r,w)),'Leave overlaps an existing request',409)
  const flags=requestFlags(c,{staffId,...w})
  return put(c,'leave',{staffId,...w,reason:text(p.reason,'reason',500,true),status:'pending',requestedBy:c.a.id,requestedAt:c.now,...(flags.length?{flags}:{})})
 }
 if(name==='leave.decide') {
  manager(c.a);keys(p,['id','revision','decision','override']);const r=get(c.s,'leave',p.id);exact(r,p);need(r.status==='pending','Request already decided',409);need(['approved','rejected'].includes(p.decision),'Invalid decision');need(r.staffId!==c.a.staffId&&r.requestedBy!==c.a.id,'You cannot decide your own leave',403)
  if(p.decision==='approved')need(!c.s.shifts.some(s=>s.staffId===r.staffId&&s.status==='published'&&overlap(s,r)),'Approved leave would conflict with a published shift',409)
  return put(c,'leave',{...r,status:p.decision,decidedBy:c.a.id,decidedAt:c.now,...(p.decision==='approved'?overrideOf(c,r,p):{})},r)
 }
 return undefined
}

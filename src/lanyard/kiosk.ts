import {operatorAuth,type Bindings} from '../auth.server'
import {type Actor,command} from './domain'
import {load,actor} from './domain/storage'
import {need,keys,text,keyed,sha} from './domain/model'
import {restricted} from './domain/access'
import {networkOf} from './clockbrowsers'
import {startOf} from './domain/transfers'
import {kioskPage} from './ui/kiosk'
const DEVICE='__Host-lanyard-kiosk',SESSION='__Host-lanyard-kiosk-person'
const cookie=(name:string,token:string,age:number)=>`${name}=${token}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`
const token=(r:Request,name:string)=>r.headers.get('cookie')?.split(/;\s*/).find(v=>v.startsWith(name+'='))?.slice(name.length+1)??''
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')
const audit=(env:Bindings,a:Actor,name:string,id:string)=>env.DB.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,name,id,new Date().toISOString())
export async function kioskAdmin(env:Bindings,a:Actor,name:string,p:Record<string,any>){
 need(a.role==='owner','Owner required for kiosk administration',403)
 if(name==='kiosk.enroll'){
  keys(p,['site','label','photo','consent']);const site=text(p.site,'cafe',80),label=text(p.label,'label',80),s=await load(env.DB)
  need(s.staff.some(p=>p.site===site),'Choose an existing cafe');need(typeof p.photo==='boolean'||['true','false'].includes(p.photo),'Choose photo policy')
  const photo=p.photo===true||p.photo==='true',photoConsent=p.consent===true||p.consent==='on';need(!photo||photoConsent,'Explicit approval of private photo custody required')
  const id=crypto.randomUUID(),value=random();await env.DB.batch([env.DB.prepare('INSERT INTO l_kiosk_devices(id,site,label,token_hash,photo,created_at,photo_consent) VALUES(?,?,?,?,?,?,?)').bind(id,site,label,await sha(value),photo?1:0,new Date().toISOString(),photoConsent?1:0),audit(env,a,name,id)])
  return {id,cookie:cookie(DEVICE,value,31536000)}
 }
 if(name==='kiosk.revoke'){
  keys(p,['id']);const id=text(p.id,'device');const updated=await env.DB.prepare('UPDATE l_kiosk_devices SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(new Date().toISOString(),id).run();need(updated.meta.changes===1,'Device not found',404);await audit(env,a,name,id).run();return {id}
 }
 need(false,'Unknown kiosk administration command',404)
}
export async function kioskPin(env:Bindings,a:Actor,p:Record<string,any>){
 keys(p,['pin','language','consent']);need(a.staffId&&a.role!=='agent','Linked employee required',403);need(typeof p.pin==='string'&&/^\d{6}$/.test(p.pin),'Use a six-digit PIN');need(['en','es'].includes(p.language),'Choose English or Spanish');need(p.consent===true||p.consent==='on','Confirm your personal kiosk PIN')
 await command(env.DB,a,'clocklanguage.save',{language:p.language},env.SESSION_SECRET)
 await env.DB.batch([env.DB.prepare('INSERT INTO l_kiosk_pins(staff_id,digest,version) VALUES(?,?,1) ON CONFLICT(staff_id) DO UPDATE SET digest=excluded.digest,version=version+1').bind(a.staffId,await keyed(env.SESSION_SECRET,`kiosk-pin:${a.staffId}:${p.pin}`)),audit(env,a,'kiosk.pin',a.staffId)])
 return {saved:true}
}
async function device(request:Request,env:Bindings){const d=await env.DB.prepare('SELECT * FROM l_kiosk_devices WHERE token_hash=? AND revoked_at IS NULL AND locked=0').bind(await sha(token(request,DEVICE))).first<any>();need(d,'Kiosk is unavailable; ask the owner to enroll this device',403);return d}
async function session(request:Request,env:Bindings,d:any){
 const hash=await sha(token(request,SESSION)),v=await env.DB.prepare(`SELECT k.*,p.version AS current_pin,s.email,s.version AS current_staff,s.active,s.erased_at,s.site,o.status AS operator_status FROM l_kiosk_sessions k JOIN l_kiosk_pins p ON p.staff_id=k.staff_id JOIN l_staff s ON s.id=k.staff_id JOIN oa_operators o ON o.id=k.operator_id WHERE k.token_hash=? AND k.device_id=? AND k.revoked_at IS NULL AND k.expires_at>?`).bind(hash,d.id,Date.now()).first<any>()
 need(v&&v.current_pin===v.pin_version&&v.current_staff===v.staff_version&&v.active&&!v.erased_at&&v.operator_status==='active'&&v.site===d.site,'Kiosk employee session expired or revoked',401)
 const a=await actor(env.DB,{userId:v.operator_id,email:v.email,isOwner:false});return {a:{...a,role:'staff' as const},hash}
}
/** Recovery identifies expired authority without exposing employee facts or usable credentials. */
export async function revokedKioskSessions(env:Bindings,a:Actor,site:string){
 if(!['owner','manager'].includes(a.role))return []
 const rows=await env.DB.prepare(`SELECT k.token_hash,d.site FROM l_kiosk_sessions k JOIN l_kiosk_devices d ON d.id=k.device_id JOIN l_staff s ON s.id=k.staff_id JOIN l_kiosk_pins p ON p.staff_id=s.id JOIN oa_operators o ON o.id=k.operator_id WHERE k.revoked_at IS NOT NULL OR k.expires_at<=? OR d.revoked_at IS NOT NULL OR d.locked=1 OR s.active=0 OR s.erased_at IS NOT NULL OR s.version<>k.staff_version OR p.version<>k.pin_version OR s.site<>d.site OR o.status<>'active'`).bind(Date.now()).all<{token_hash:string;site:string}>()
 return Promise.all(rows.results.filter(r=>a.role==='owner'||r.site===site).map(r=>sha(r.token_hash)))
}
export async function kioskResponse(request:Request,env:Bindings):Promise<Response|null>{
 const path=new URL(request.url).pathname;if(path!=='/app/kiosk'&&!path.startsWith('/api/lanyard/kiosk/'))return null
 const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
 const json=(v:any,status=200)=>Response.json(v,{status,headers})
 try{
  need(['GET','POST'].includes(request.method),'Method not allowed',405)
  if(request.method==='POST')need(request.headers.get('origin')===env.AUTH_ORIGIN&&request.headers.get('sec-fetch-site')!=='cross-site','Cross-site request refused',403)
  const d=await device(request,env)
  if(path==='/app/kiosk')return kioskPage(d)
  const raw=request.method==='POST'?await request.text():'';need(raw.length<160000,'Request is too large',413);let p:any={};if(raw){try{p=JSON.parse(raw)}catch{need(false,'Invalid JSON')}}
  if(path==='/api/lanyard/kiosk/enter'&&request.method==='POST'){keys(p,[]);const ended=await operatorAuth(env).signOut(request),response=json({entered:true});response.headers.append('set-cookie',ended.cookie);return response}
  if(path==='/api/lanyard/kiosk/signin'&&request.method==='POST'){
   keys(p,['email','pin']);const email=typeof p.email==='string'?p.email.trim().toLowerCase():''
   const v=await env.DB.prepare(`SELECT s.*,p.digest,p.version AS pin_version,o.id AS operator_id FROM l_staff s JOIN l_kiosk_pins p ON p.staff_id=s.id JOIN oa_operators o ON o.email=s.email COLLATE NOCASE AND o.status='active' WHERE s.email=? COLLATE NOCASE AND s.active=1 AND s.erased_at IS NULL AND s.site=?`).bind(email,d.site).first<any>()
   const now=Date.now(),window=Math.floor(now/900000),digest=await keyed(env.SESSION_SECRET,`kiosk-pin:${v?.id??'unknown'}:${String(p.pin)}`)
   const attempt=v?await env.DB.prepare('SELECT count FROM l_kiosk_attempts WHERE staff_id=? AND window=?').bind(v.id,window).first<any>():null
   // A blocked person is refused before verification; retain the limiter and device state unchanged.
   if((attempt?.count??0)>=5)return json({error:'Unable to verify employee. Repeated failures lock this kiosk.'},401)
   if(!v||typeof p.pin!=='string'||!/^\d{6}$/.test(p.pin)||digest!==v.digest){
    const q=[env.DB.prepare('UPDATE l_kiosk_devices SET failures=failures+1,locked=CASE WHEN failures>=4 THEN 1 ELSE locked END WHERE id=?').bind(d.id)]
    if(v)q.push(env.DB.prepare('INSERT INTO l_kiosk_attempts(staff_id,window,count) VALUES(?,?,1) ON CONFLICT(staff_id) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window').bind(v.id,window))
    await env.DB.batch(q);return json({error:'Unable to verify employee. Repeated failures lock this kiosk.'},401)
   }
   const value=random(),hash=await sha(value)
   await env.DB.batch([env.DB.prepare('UPDATE l_kiosk_sessions SET revoked_at=? WHERE device_id=? AND revoked_at IS NULL').bind(new Date().toISOString(),d.id),env.DB.prepare('INSERT INTO l_kiosk_sessions(token_hash,device_id,staff_id,staff_version,pin_version,operator_id,expires_at) VALUES(?,?,?,?,?,?,?)').bind(hash,d.id,v.id,v.version,v.pin_version,v.operator_id,now+5*60000),env.DB.prepare('UPDATE l_kiosk_devices SET failures=0 WHERE id=?').bind(d.id),audit(env,{id:v.operator_id,email:v.email,role:'staff'},'kiosk.signin',d.id)])
   const response=json({verified:true});response.headers.append('set-cookie',cookie(SESSION,value,300));response.headers.append('set-cookie',(await operatorAuth(env).signOut(request)).cookie);return response
  }
  const current=await session(request,env,d)
  if(path==='/api/lanyard/kiosk/signout'&&request.method==='POST'){
   await env.DB.prepare('UPDATE l_kiosk_sessions SET revoked_at=? WHERE token_hash=?').bind(new Date().toISOString(),current.hash).run();const response=json({signedOut:true});response.headers.set('set-cookie',cookie(SESSION,'',0));return response
  }
  const s=await load(env.DB),policy=s.photopolicies.find(p=>p.site===d.site),photoRequired=Boolean(d.photo||policy?.kiosk),photoBreaks=Boolean(d.photo||policy?.kiosk&&policy.breaks),language=s.clocklanguages.find(x=>x.staffId===current.a.staffId)?.language??'en'
  if(path==='/api/lanyard/kiosk/state'&&request.method==='GET'){
   const open=s.clocks.find(k=>k.staffId===current.a.staffId&&k.status==='open')
   return json({actorId:current.a.id,staffId:current.a.staffId,deviceId:d.id,sessionId:await sha(current.hash),open:open?{start:open.start,status:open.status,breaks:open.breaks??[],transfers:open.transfers??[],...startOf(s,open)}:null,language,photoRequired,photoEnrollmentNeeded:photoRequired&&!d.photo_consent,photoBreaks,photoTransfers:Boolean(d.photo),site:d.site,jobs:s.jobs.filter(j=>!s.workforce.find(w=>w.staffId===current.a.staffId)?.jobs.length||s.workforce.find(w=>w.staffId===current.a.staffId)?.jobs.includes(j.id)).map(j=>({id:j.id,name:j.name})),clocks:s.clocks.filter(k=>k.staffId===current.a.staffId),receipts:s.kioskreceipts.filter(k=>k.staffId===current.a.staffId)})
  }
  if(path==='/api/lanyard/kiosk/capture'&&request.method==='POST'){
   keys(p,['name','input','photo','photoConsent','photoFailure']);need(['clock.in','clock.out','clock.breakStart','clock.breakEnd','clock.transfer'].includes(p.name),'Kiosk may capture time only',403)
   need(!p.input?.site||p.input.site===d.site,'Device is not approved for this cafe',403)
   const result=await command(env.DB,current.a,p.name,p.input,env.SESSION_SECRET,{...await networkOf(request,env),browsers:[{id:d.id,site:d.site}]},env.FILES,{deviceId:d.id,sessionHash:current.hash,site:d.site,language,photoRequired:p.name.startsWith('clock.break')?photoBreaks:p.name==='clock.transfer'?Boolean(d.photo):photoRequired,photo:p.photo,photoFailure:p.photoFailure,photoConsent:p.photoConsent===true})
   return json(result)
  }
  return json({error:'Not found'},404)
 }catch(e){const status=Number((e as any)?.status)||500;return json({error:status<500?(e as Error).message:'Kiosk unavailable'},status)}
}

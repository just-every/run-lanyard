import {type Actor,type State,type Context,type Row,need,keys,text,instant,put,get,exact} from './model'
import {date} from './aca'
import {localDate} from './settings'
import {siteOf} from './team'

export const auditClasses=['schedule','breaks','rounding','tip-credit','punch-edit','minor-exception']
/** Audit assignments replace operational authority even after expiry or revocation. */
export function auditRestricted(s:State,a:Actor){return a.role!=='owner'&&s.auditgrants.some(g=>g.staffId===a.staffId)}
export function auditAccessCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('access.audit.'))return undefined
 need(c.a.role==='owner','Only the owner delegates audit authority',403)
 if(name==='access.audit.revoke'){
  keys(p,['id','revision','reason']);const old=get(c.s,'auditgrants',p.id);exact(old,p)
  return put(c,'auditgrants',{...old,revokedAt:c.now,revokedBy:c.a.id,revocationReason:text(p.reason,'revocation reason',500)},old)
 }
 need(name==='access.audit.grant','Unknown audit administration command',404)
 keys(p,['staffId','businessId','site','employeeIds','jurisdictions','classes','from','through','purpose','endsAt','wages','sensitivePurpose','consent'])
 need(p.consent===true,'Explicit owner authorization required',403)
 const person=c.s.staff.find(x=>x.id===p.staffId&&x.active&&!x.erased_at)
 need(person,'Active named person required',404)
 const business=get(c.s,'businesses',p.businessId),site=text(p.site,'site',80)
 need(c.s.locations.some(l=>l.site===site&&l.businessId===business.id),'Site must belong to the selected business',403)
 const list=(v:any,label:string)=>{need(Array.isArray(v)&&v.length>0&&v.length<=100&&new Set(v).size===v.length,`Choose explicit ${label}`);return v.map(x=>text(x,label))}
 const employeeIds=list(p.employeeIds,'employees'),jurisdictions=list(p.jurisdictions,'jurisdictions'),classes=list(p.classes,'report classes')
 need(employeeIds.every(id=>c.s.staff.some(x=>x.id===id&&!x.erased_at&&(x.site===site||c.s.orgmemberships.some(m=>m.staffId===id&&m.locationIds.some((lid:string)=>c.s.locations.some(l=>l.id===lid&&l.site===site)))))),'Employee outside selected site',403)
 need(jurisdictions.every(x=>['CA','IL','CHICAGO','TX','CO','unassigned'].includes(x)),'Unsupported jurisdiction')
 need(classes.every(x=>auditClasses.includes(x)),'Private or unsupported report class',403)
 need(typeof p.wages==='boolean','Choose separate wage authority')
 const sensitivePurpose=p.wages?text(p.sensitivePurpose,'necessary sensitive-data purpose',500):''
 need(!classes.includes('tip-credit')||p.wages,'Tip-credit reports require separate wage authority',403)
 const from=date(p.from,'from'),through=date(p.through,'through'),endsAt=instant(p.endsAt,'access end')
 need(through>=from&&Date.parse(through)-Date.parse(from)<=366*86400000,'Choose at most one year')
 need(endsAt>c.now,'Access end must be in the future')
 return put(c,'auditgrants',{staffId:person.id,businessId:business.id,site,employeeIds,jurisdictions,classes,from,through,purpose:text(p.purpose,'audit purpose',500),endsAt,wages:p.wages,sensitivePurpose,createdBy:c.a.id,createdAt:c.now,ownerAuthorized:true})
}
export function auditGrant(s:State,a:Actor,id:string,site:string,from:string,through:string,jurisdiction:string,staffId='',reportClass=''){
 const grant=s.auditgrants.find(g=>g.id===id&&g.staffId===a.staffId)
 need(grant&&!grant.revokedAt&&grant.endsAt>new Date().toISOString(),'Audit authority expired or revoked',403)
 need(grant.site===site&&s.locations.some(l=>l.site===site&&l.businessId===grant.businessId),'Audit site outside grant',403)
 need(from>=grant.from&&through<=grant.through&&through>=from,'Audit dates outside grant',403)
 need(grant.jurisdictions.includes(jurisdiction),'Audit jurisdiction outside grant',403)
 need(!staffId||grant.employeeIds.includes(staffId),'Audit employee outside grant',403)
 need(!reportClass||grant.classes.includes(reportClass),'Audit class outside grant',403)
 return grant
}
export function auditRowAllowed(s:State,g:Row,row:any){
 if(!g.classes.includes(row.category)||!g.employeeIds.includes(row.staffId)||!g.jurisdictions.includes(row.jurisdiction)||row.date<g.from||row.date>g.through)return false
 const windows=[row.facts,row.facts.captured,...(row.facts.editHistory??[]).flatMap((e:any)=>[e.before,e.after])].filter(Boolean)
 if(windows.some(w=>[w.start,w.end].filter(Boolean).some(at=>localDate(at,s.timezone)<g.from||localDate(at,s.timezone)>g.through)))return false
 if(row.category!=='tip-credit')return true
 if(!g.wages||!g.sensitivePurpose||row.facts.week<g.from||row.facts.weekThrough>g.through)return false
 return row.facts.sites.every((x:any)=>x.site===g.site)&&row.facts.sources.every((ref:any)=>{
  const source=s.timesheets.find(t=>t.id===ref.id&&t.revision===ref.revision)
  return source&&g.employeeIds.includes(source.staffId)&&siteOf(s,source)===g.site&&(!source.workSegments||source.workSegments.every((w:any)=>w.site===g.site))&&localDate(source.start,s.timezone)>=g.from&&localDate(source.end,s.timezone)<=g.through
 })
}

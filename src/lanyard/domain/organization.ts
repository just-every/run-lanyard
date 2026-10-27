import {type Context,type State,type Row,keys,text,need,get,exact,put,staff} from './model'
import {timezone} from './settings'

const history=(old:Row|undefined)=>old?[...(old.versions??[]),Object.fromEntries(Object.entries(old).filter(([k])=>k!=='versions'))]:[]
const ids=(value:unknown,label:string)=>{
 need(Array.isArray(value)&&value.length<=100,`Choose up to 100 ${label}`)
 const result=value.map(v=>text(v,label))
 need(new Set(result).size===result.length,`Duplicate ${label}`)
 return result
}
export const membership=(s:State,staffId:string)=>s.orgmemberships.find(r=>r.staffId===staffId)
export function eligibleLocation(s:State,staffId:string,site:string){
 const m=membership(s,staffId)
 return !m||m.locationIds.some((id:string)=>s.locations.some(l=>l.id===id&&l.site===site))
}
/** Organization records establish eligibility, never an administrative permission. */
export function organization(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('organization.'))return undefined
 need(c.a.role==='owner','Only the owner maintains the organization',403)
 if(name==='organization.member.save'){
  keys(p,['id','revision','staffId','locationIds','departmentIds'])
  const person=staff(c,p.staffId),old=membership(c.s,person.id)
  if(old){need(p.id===old.id,'Use the existing membership revision',409);exact(old,p)}else need(!p.id,'Membership not found',404)
  const locationIds=ids(p.locationIds,'locations'),departmentIds=ids(p.departmentIds,'departments')
  need(locationIds.length,'Choose at least one eligible location')
  need(locationIds.every(id=>c.s.locations.some(l=>l.id===id)),'Location not found',404)
  need(departmentIds.every(id=>c.s.departments.some(d=>d.id===id&&locationIds.includes(d.locationId))),'Department must belong to an eligible location')
  return put(c,'orgmemberships',{staffId:person.id,locationIds,departmentIds,by:c.a.id,at:c.now,versions:history(old)},old)
 }
 const kind=name==='organization.business.save'?'businesses':name==='organization.location.save'?'locations':name==='organization.department.save'?'departments':null
 need(kind,'Unknown organization command',404)
 keys(p,['id','revision','name',...(kind==='locations'?['businessId','site','timezone']:kind==='departments'?['locationId']:[])])
 const old=p.id?get(c.s,kind,p.id):undefined;if(old)exact(old,p)
 const label=text(p.name,'name',80),parent=kind==='locations'?{businessId:get(c.s,'businesses',p.businessId).id}:kind==='departments'?{locationId:get(c.s,'locations',p.locationId).id}:{}
 if(old)for(const [key,value] of Object.entries(parent))need(old[key]===value,'Parent cannot change; retain the historical organization',409)
 need(!c.s[kind].some(r=>r.id!==old?.id&&r.name.toLowerCase()===label.toLowerCase()&&Object.entries(parent).every(([key,value])=>r[key]===value)),'Name already used in this organization',409)
 let location={}
 if(kind==='locations'){
  const site=text(p.site,'cafe identifier',80),zone=timezone(p.timezone)
  need(!c.s.locations.some(l=>l.id!==old?.id&&l.site===site),'Cafe identifier already used',409)
  if(old)need(old.site===site&&old.timezone===zone,'Cafe identifier and timezone cannot change; historical work keeps its location',409)
  location={site,timezone:zone}
 }
 return put(c,kind,{name:label,...parent,...location,by:c.a.id,at:c.now,versions:history(old)},old)
}

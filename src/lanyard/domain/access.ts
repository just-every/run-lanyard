import {type Actor,type State,type Context,type Row,need,text,keys,get,exact,put} from './model'
import {siteOf} from './team'
export const catalog=['draft.view','draft.edit','schedule.publish','swap.approve','leave.approve','time.approve','punch.edit','wages.view','tips.manage','payroll.export','payroll.submit','people.manage','reports.view','integrations.manage','contacts.view'] as const
export const defaultRoles=['Scheduler','Site manager','Time approver','Payroll administrator','Read-only analyst']
const managerDefault=catalog.filter(p=>!['people.manage','integrations.manage','payroll.submit'].includes(p))
export function restricted(s:State,a:Actor){return a.role!=='owner'&&a.role!=='agent'&&s.accessgrants.some(g=>g.staffId===a.staffId&&!g.archivedAt)}
export function levelSite(s:State,l:Row,site:string){
 if(l.businessId)return s.locations.some(x=>x.site===site&&x.businessId===l.businessId)
 return l.site===site
}
export function permissions(s:State,a:Actor,site:string,staffId?:string):string[]{
 if(a.role==='owner')return [...catalog]
 if(a.role==='agent')return []
 if(!restricted(s,a))return a.role==='manager'&&s.staff.some(p=>p.id===a.staffId&&p.site===site)?managerDefault:[]
 return [...new Set(s.accessgrants.filter(g=>g.staffId===a.staffId&&g.site===site&&!g.revoked&&!g.archivedAt).flatMap(g=>{const l=s.accesslevels.find(l=>l.id===g.levelId);return l&&levelSite(s,l,site)&&(!l.departmentId||!staffId||s.orgmemberships.some(m=>m.staffId===staffId&&m.departmentIds.includes(l.departmentId)))?l.permissions:[]}))] as string[]
}
export function wholeSiteAllowed(s:State,a:Actor,permission:string,site:string){
 if(a.role==='owner')return true
 if(!restricted(s,a))return allowed(s,a,permission,site)
 return s.accessgrants.some(g=>g.staffId===a.staffId&&g.site===site&&!g.revoked&&!g.archivedAt&&s.accesslevels.some(l=>l.id===g.levelId&&!l.departmentId&&levelSite(s,l,site)&&l.permissions.includes(permission)))
}
export function allowed(s:State,a:Actor,permission:string,site:string,staffId?:string){return permissions(s,a,site,staffId).includes(permission)}
function administerSite(c:Context,site:string,staffId?:string){
 if(c.a.role==='owner')return
 need(!c.s.accessgrants.some(g=>g.staffId===c.a.staffId&&!g.revoked&&!g.archivedAt&&c.s.accesslevels.some(l=>l.id===g.levelId&&(l.businessId||l.departmentId))),'Only the owner administers organization-scoped levels',403)
 const home=c.s.staff.find(x=>x.id===c.a.staffId)?.site
 need(c.a.role==='manager'&&home===site,'Only your own cafe',403)
 if(staffId)need(c.s.staff.some(x=>x.id===staffId&&x.site===home),'Only people at your own cafe',403)
}
export function accessCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('access.'))return undefined
 need(c.a.role!=='agent'&&(c.a.role==='owner'||c.a.role==='manager'),'Access administrator required',403)
 if(name==='access.defaults.create'){
  need(c.a.role==='owner','Only the owner initializes role defaults',403);keys(p,['site']);const site=text(p.site,'site',80)
  need(c.s.locations.some(l=>l.site===site)||c.s.staff.some(x=>x.site===site),'Choose an existing cafe')
  need(!c.s.accesslevels.some(l=>l.site===site&&(l.defaultRole||defaultRoles.some(role=>role.toLowerCase()===l.name.toLowerCase()))),'A role default name already exists at this cafe',409)
  return defaultRoles.map(role=>put(c,'accesslevels',{site,name:role,defaultRole:role,permissions:[],changes:[{actor:c.a.id,at:c.now,before:[],after:[]}]}))
 }
 if(name==='access.restore'){
  need(c.a.role==='owner','Only the owner restores native authority',403)
  keys(p,['staffId']);const staffId=text(p.staffId,'person'),person=c.s.staff.find(x=>x.id===staffId)
  need(person&&!person.erased_at,'Person not found',404)
  const grants=c.s.accessgrants.filter(g=>g.staffId===staffId&&!g.archivedAt)
  need(grants.length,'This person already has native authority',409)
  const target:Actor={id:staffId,email:person.email,role:person.role,staffId},sites=[...new Set([person.site??'',...grants.map(g=>g.site)])].filter(Boolean)
  const before=Object.fromEntries(sites.map(site=>[site,permissions(c.s,target,site)]))
  for(const g of grants)put(c,'accessgrants',{...g,revoked:true,archivedAt:c.now,restoredBy:c.a.id},g)
  const after=Object.fromEntries(sites.map(site=>[site,permissions(c.s,target,site)]))
  for(const old of grants){const g=get(c.s,'accessgrants',old.id);g.changes=[...g.changes,{action:name,actor:c.a.id,at:c.now,before:before[g.site],after:after[g.site]}]}
  c.entity=staffId
  return {staffId,before,after}
 }
 if(name==='access.level.save'){
  keys(p,['id','revision','name','permissions','site','businessId','departmentId'])
  const businessId=text(p.businessId,'business',120,true),departmentId=text(p.departmentId,'department',120,true)
  need(!businessId||!departmentId,'Choose one organization scope')
  if(businessId||departmentId)need(c.a.role==='owner','Only the owner maintains organization-scoped levels',403)
  if(businessId)get(c.s,'businesses',businessId)
  const department=departmentId?get(c.s,'departments',departmentId):undefined
  const site=department?get(c.s,'locations',department.locationId).site:text(p.site,'site',80,!!businessId),old=p.id?get(c.s,'accesslevels',p.id):undefined
  if(old)need((old.businessId??'')===businessId&&(old.departmentId??'')===departmentId,'Cannot move an access level scope',409)
  if(!businessId)administerSite(c,site)
  if(old){exact(old,p);need(old.site===site,'Cannot move an access level',409)}
  need(businessId||c.s.locations.some(l=>l.site===site)||c.s.staff.some(x=>x.site===site),'Choose an existing cafe')
  need(Array.isArray(p.permissions)&&p.permissions.every((v:any)=>catalog.includes(v))&&new Set(p.permissions).size===p.permissions.length,'Choose catalog permissions')
  const held=permissions(c.s,c.a,site)
  need(c.a.role==='owner'||[...(old?.permissions??[]),...p.permissions].every((v:string)=>held.includes(v)),'Cannot create or change a level beyond your permissions',403)
  const name=text(p.name,'level name',80);need(!c.s.accesslevels.some(l=>l.id!==old?.id&&l.site===site&&(l.businessId??'')===businessId&&(l.departmentId??'')===departmentId&&l.name.toLowerCase()===name.toLowerCase()),'Level name already used',409)
  return put(c,'accesslevels',{site,name,businessId,departmentId,...(old?.defaultRole?{defaultRole:old.defaultRole}:{}),permissions:p.permissions,changes:[...(old?.changes??[]),{actor:c.a.id,at:c.now,before:old?.permissions??[],after:p.permissions}]},old)
 }
 if(name==='access.grant'){
  keys(p,['levelId','staffId','site']);const level=get(c.s,'accesslevels',p.levelId),site=text(p.site,'site',80)
  need(levelSite(c.s,level,site),'Level is scoped to another cafe',403)
  if(level.businessId||level.departmentId)need(c.a.role==='owner','Only the owner grants organization-scoped levels',403)
  administerSite(c,site,String(p.staffId))
  need(c.s.staff.some(x=>x.id===p.staffId&&x.active&&!x.erased_at),'Active person required')
  const target=c.s.staff.find(x=>x.id===p.staffId)!
  need(c.a.role==='owner'||target.role!=='manager'||c.s.accessgrants.some(g=>g.staffId===target.id&&!g.archivedAt),'Only the owner replaces native manager authority',403)
  need(level.permissions.every((v:string)=>allowed(c.s,c.a,v,site)),'Cannot grant permissions you do not hold',403)
  need(c.a.role==='owner'||c.a.staffId!==p.staffId,'Only the owner changes their own custom grants',403)
  need(!c.s.accessgrants.some(g=>!g.archivedAt&&!g.revoked&&g.levelId===level.id&&g.staffId===p.staffId&&g.site===site),'Grant already exists',409)
  return put(c,'accessgrants',{staffId:p.staffId,site,levelId:level.id,revoked:false,changes:[{actor:c.a.id,at:c.now,before:[],after:level.permissions}]})
 }
 if(name==='access.revoke'){
  keys(p,['id','revision']);const g=get(c.s,'accessgrants',p.id),level=get(c.s,'accesslevels',g.levelId);exact(g,p);need(!g.archivedAt,'Assignment is archived',409);administerSite(c,g.site,g.staffId)
  if(level.businessId||level.departmentId)need(c.a.role==='owner','Only the owner revokes organization-scoped levels',403)
  need(c.a.role==='owner'||c.a.staffId!==g.staffId,'Only the owner changes their own custom grants',403)
  need(level.permissions.every((v:string)=>allowed(c.s,c.a,v,g.site)),'Cannot revoke a level beyond your permissions',403)
  return put(c,'accessgrants',{...g,revoked:true,changes:[...g.changes,{actor:c.a.id,at:c.now,before:level.permissions,after:[]}]},g)
 }
 return undefined
}
const commandPermissions:Record<string,string>={'roster.prepare':'draft.edit','roster.publish':'schedule.publish','swap.decide':'swap.approve','leave.decide':'leave.approve','time.approve':'time.approve','time.approveMany':'time.approve','time.prepare':'punch.edit','time.edit':'punch.edit','time.return':'punch.edit','time.resolve':'punch.edit','payroll.prepare':'payroll.export','payroll.export':'payroll.export','payroll.acknowledge':'payroll.export'}
const personal=new Set(['schedule.notice.acknowledge','sick.request','sicktransfer.consent','sicktransfer.withdraw','pattern.save','time.confirm','clocklanguage.save','contact.save','availability.save','leave.request','shift.confirm','clock.in','clock.out','clock.breakStart','clock.breakEnd','clock.transfer','clock.report','time.request','time.acknowledge','time.resubmit','shift.callout','cover.respond','swap.propose','swap.respond','swap.withdraw','openshift.request','openshift.decline','period.signoff','feedback.submit','shiftwork.respond','fairness.request.save'])
function sitesFor(s:State,name:string,p:Record<string,any>):string[]{
 if(name==='roster.prepare')return [...new Set([...(Array.isArray(p.shifts)?p.shifts:[]),...s.shifts.filter(x=>['draft','published'].includes(x.status)&&s.rosters.some(r=>r.id===x.rosterId&&r.week===p.week&&['draft','published'].includes(r.status)))].map(x=>siteOf(s,x)))]
 if(name==='roster.publish'){const r=s.rosters.find(x=>x.id===p.id);return [...new Set(s.shifts.filter(x=>['draft','published'].includes(x.status)&&(x.rosterId===r?.id||s.rosters.some(y=>y.id===x.rosterId&&y.week===r?.week&&y.status==='published'))).map(x=>siteOf(s,x)))]}
 if(name==='swap.decide'){const w=s.swaps.find(x=>x.id===p.id);return w?[w.give.site,...(w.take?[w.take.site]:[])]:[]}
 if(name==='payroll.prepare'){const ts=s.timesheets.filter(x=>p.ids?.includes(x.id)||!p.ids);return [...new Set(ts.map(x=>siteOf(s,x)))]}
 if(name.startsWith('payroll.')){const b=s.batches.find(x=>x.id===p.id);return [...new Set((b?.lines??[]).map((x:any)=>siteOf(s,x)))] as string[]}
 if(name==='time.approveMany')return [...new Set((p.items??[]).map((x:any)=>siteOf(s,s.timesheets.find(t=>t.id===x.id)??{})))] as string[]
 const row=s.timesheets.find(x=>x.id===p.id)??s.leave.find(x=>x.id===p.id)??s.patterns.find(x=>x.id===p.id)??{staffId:p.staffId};return [...new Set([siteOf(s,row),...(p.site?[String(p.site)]:[]),...(p.corrects?[siteOf(s,s.timesheets.find(t=>t.id===p.corrects)??{})]:[])])]
}
/** Native managers review their home cafe; delegates enter only doors their current grants allow. */
export function authorizeCommand(c:Context,name:string,p:Record<string,any>){
 if(c.a.role==='manager'&&!restricted(c.s,c.a)&&['time.prepare','time.approve','time.edit','time.return','time.resolve','leave.decide','pattern.decide'].includes(name)){
  const sites=sitesFor(c.s,name,p),home=c.s.staff.find(person=>person.id===c.a.staffId)?.site??''
  need(sites.length&&sites.every(site=>site===home),'Only a manager of this cafe can review this record',403)
 }
 if(!restricted(c.s,c.a)||name.startsWith('access.')||name.startsWith('chat.'))return
 if(personal.has(name)){if(p.staffId)need(p.staffId===c.a.staffId,'Only your own record',403);c.a={...c.a,nativeRole:c.a.role,role:'staff'};return}
 const permission=commandPermissions[name];need(permission,'This command is unavailable to custom levels',403)
 if(name==='time.approveMany'){need(c.s.accessgrants.some(g=>g.staffId===c.a.staffId&&!g.revoked&&!g.archivedAt&&allowed(c.s,c.a,'time.approve',g.site)),'Time approval permission required',403);c.a={...c.a,nativeRole:c.a.role,role:'manager'};return}
 const sites=sitesFor(c.s,name,p);need(sites.length&&sites.every(site=>allowed(c.s,c.a,permission,site)),'Permission not granted at this cafe',403)
 const targets=commandTargets(c.s,name,p)
 need(targets.every(x=>allowed(c.s,c.a,permission,siteOf(c.s,x),x.staffId)),'Permission not granted for this department',403)
 if(permission==='payroll.export')need(targets.every(x=>allowed(c.s,c.a,'wages.view',siteOf(c.s,x),x.staffId)),'Payroll requires wage permission',403)
 c.a={...c.a,nativeRole:c.a.role,role:'manager'}
}
export function commandTargets(s:State,name:string,p:Record<string,any>):Record<string,any>[]{
 if(name==='roster.prepare')return [...(Array.isArray(p.shifts)?p.shifts:[]),...s.shifts.filter(x=>['draft','published'].includes(x.status)&&s.rosters.some(r=>r.id===x.rosterId&&r.week===p.week&&['draft','published'].includes(r.status)))]
 if(name==='roster.publish'){const r=s.rosters.find(x=>x.id===p.id);return s.shifts.filter(x=>['draft','published'].includes(x.status)&&(x.rosterId===r?.id||s.rosters.some(y=>y.id===x.rosterId&&y.week===r?.week&&y.status==='published')))}
 if(name==='swap.decide'){const w=s.swaps.find(x=>x.id===p.id);return w?[{site:w.give.site,staffId:w.fromId},{site:w.give.site,staffId:w.toId},...(w.take?[{site:w.take.site,staffId:w.fromId},{site:w.take.site,staffId:w.toId}]:[])]:[]}
 if(name==='payroll.prepare')return s.timesheets.filter(x=>p.ids?.includes(x.id)||!p.ids)
 if(name.startsWith('payroll.'))return s.batches.find(x=>x.id===p.id)?.lines??[]
 if(name==='time.approveMany')return (p.items??[]).flatMap((x:any)=>s.timesheets.find(t=>t.id===x.id)??[])
 return [s.timesheets.find(x=>x.id===p.id)??s.leave.find(x=>x.id===p.id)??{staffId:p.staffId,site:p.site},...(p.corrects?[s.timesheets.find(t=>t.id===p.corrects)??{}]:[])]
}
/** Generated payroll can include adjustments beyond the selected time; fence every resulting line. */
export function authorizeResult(c:Context,name:string,result:any){
 if(!restricted(c.s,c.a)||!name.startsWith('payroll.'))return
 need((result.lines??[]).every((x:any)=>allowed(c.s,c.a,'payroll.export',siteOf(c.s,x),x.staffId)&&allowed(c.s,c.a,'wages.view',siteOf(c.s,x),x.staffId)),'Payroll contains sources outside your permissions',403)
}
export function accessView(s:State,a:Actor){
 const own=a.role==='owner',grants=s.accessgrants.filter(g=>own||g.staffId===a.staffId),ids=new Set(grants.map(g=>g.levelId))
 const sites=own?[...new Set([...s.staff.map(p=>p.site),...s.locations.map(l=>l.site)].filter(Boolean))]:[...new Set([s.staff.find(p=>p.id===a.staffId)?.site,...grants.filter(g=>!g.revoked&&!g.archivedAt).map(g=>g.site)].filter(Boolean))]
 return {catalog,defaultRoles,heldPermissions:[...new Set(sites.flatMap(site=>permissions(s,a,site)))],levels:s.accesslevels.filter(l=>own||ids.has(l.id)),grants,sites,people:own?s.staff.filter(p=>p.active&&!p.erased_at).map(p=>({id:p.id,name:p.name})):[],drafts:[],swaps:[]}
}
export function wageRedact(v:any):any{
 if(Array.isArray(v))return v.map(wageRedact)
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!/(rate|wage|cost|cents|payroll|budget|salary)/i.test(k)).map(([k,x])=>[k,wageRedact(x)]))
 return v
}

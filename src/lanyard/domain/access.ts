import {type Actor,type State,type Context,type Row,need,text,keys,get,exact,put} from './model'
import {siteOf} from './team'
export const catalog=['draft.view','draft.edit','schedule.publish','swap.approve','leave.approve','time.approve','punch.edit','wages.view','tips.manage','payroll.export','payroll.submit','people.manage','reports.view','integrations.manage','contacts.view'] as const
const managerDefault=catalog.filter(p=>!['people.manage','integrations.manage','payroll.submit'].includes(p))
export function restricted(s:State,a:Actor){return a.role!=='owner'&&a.role!=='agent'&&s.accessgrants.some(g=>g.staffId===a.staffId)}
export function permissions(s:State,a:Actor,site:string):string[]{
 if(a.role==='owner')return [...catalog]
 if(a.role==='agent')return []
 if(!restricted(s,a))return a.role==='manager'&&s.staff.some(p=>p.id===a.staffId&&p.site===site)?managerDefault:[]
 return [...new Set(s.accessgrants.filter(g=>g.staffId===a.staffId&&g.site===site&&!g.revoked).flatMap(g=>s.accesslevels.find(l=>l.id===g.levelId)?.permissions??[]))] as string[]
}
export function allowed(s:State,a:Actor,permission:string,site:string){return permissions(s,a,site).includes(permission)}
function administerSite(c:Context,site:string,staffId?:string){
 if(c.a.role==='owner')return
 const home=c.s.staff.find(x=>x.id===c.a.staffId)?.site
 need(c.a.role==='manager'&&home===site,'Only your own cafe',403)
 if(staffId)need(c.s.staff.some(x=>x.id===staffId&&x.site===home),'Only people at your own cafe',403)
}
export function accessCommand(c:Context,name:string,p:Record<string,any>){
 if(!name.startsWith('access.'))return undefined
 need(c.a.role!=='agent'&&(c.a.role==='owner'||c.a.role==='manager'),'Access administrator required',403)
 if(name==='access.level.save'){
  keys(p,['id','revision','name','permissions','site'])
  const site=text(p.site,'site',80),old=p.id?get(c.s,'accesslevels',p.id):undefined
  administerSite(c,site)
  if(old){exact(old,p);need(old.site===site,'Cannot move an access level',409)}
  need(c.s.staff.some(x=>x.site===site),'Choose an existing cafe')
  need(Array.isArray(p.permissions)&&p.permissions.every((v:any)=>catalog.includes(v))&&new Set(p.permissions).size===p.permissions.length,'Choose catalog permissions')
  const held=permissions(c.s,c.a,site)
  need(c.a.role==='owner'||[...(old?.permissions??[]),...p.permissions].every((v:string)=>held.includes(v)),'Cannot create or change a level beyond your permissions',403)
  const name=text(p.name,'level name',80);need(!c.s.accesslevels.some(l=>l.id!==old?.id&&l.site===site&&l.name.toLowerCase()===name.toLowerCase()),'Level name already used',409)
  return put(c,'accesslevels',{site,name,permissions:p.permissions,changes:[...(old?.changes??[]),{actor:c.a.id,at:c.now,before:old?.permissions??[],after:p.permissions}]},old)
 }
 if(name==='access.grant'){
  keys(p,['levelId','staffId','site']);const level=get(c.s,'accesslevels',p.levelId),site=text(p.site,'site',80)
  need(site===level.site,'Level is scoped to another cafe',403)
  administerSite(c,site,String(p.staffId))
  need(c.s.staff.some(x=>x.id===p.staffId&&x.active&&!x.erased_at),'Active person required')
  const target=c.s.staff.find(x=>x.id===p.staffId)!
  need(c.a.role==='owner'||target.role!=='manager'||c.s.accessgrants.some(g=>g.staffId===target.id),'Only the owner replaces native manager authority',403)
  need(level.permissions.every((v:string)=>allowed(c.s,c.a,v,site)),'Cannot grant permissions you do not hold',403)
  need(c.a.role==='owner'||c.a.staffId!==p.staffId,'Only the owner changes their own custom grants',403)
  need(!c.s.accessgrants.some(g=>!g.revoked&&g.levelId===level.id&&g.staffId===p.staffId&&g.site===site),'Grant already exists',409)
  return put(c,'accessgrants',{staffId:p.staffId,site,levelId:level.id,revoked:false,changes:[{actor:c.a.id,at:c.now,before:[],after:level.permissions}]})
 }
 if(name==='access.revoke'){
  keys(p,['id','revision']);const g=get(c.s,'accessgrants',p.id),level=get(c.s,'accesslevels',g.levelId);exact(g,p);administerSite(c,g.site,g.staffId)
  need(c.a.role==='owner'||c.a.staffId!==g.staffId,'Only the owner changes their own custom grants',403)
  need(level.permissions.every((v:string)=>allowed(c.s,c.a,v,g.site)),'Cannot revoke a level beyond your permissions',403)
  return put(c,'accessgrants',{...g,revoked:true,changes:[...g.changes,{actor:c.a.id,at:c.now,before:level.permissions,after:[]}]},g)
 }
 return undefined
}
const commandPermissions:Record<string,string>={'roster.prepare':'draft.edit','roster.publish':'schedule.publish','swap.decide':'swap.approve','leave.decide':'leave.approve','time.approve':'time.approve','time.approveMany':'time.approve','time.prepare':'punch.edit','time.edit':'punch.edit','time.return':'punch.edit','time.resolve':'punch.edit','payroll.prepare':'payroll.export','payroll.export':'payroll.export','payroll.acknowledge':'payroll.export'}
const personal=new Set(['pattern.save','time.confirm','clocklanguage.save','contact.save','availability.save','leave.request','shift.confirm','clock.in','clock.out','clock.breakStart','clock.breakEnd','clock.transfer','clock.report','time.request','time.acknowledge','time.resubmit','shift.callout','cover.respond','swap.propose','swap.respond','swap.withdraw','openshift.request','openshift.decline','period.signoff','feedback.submit','shiftwork.respond','fairness.request.save'])
function sitesFor(s:State,name:string,p:Record<string,any>):string[]{
 if(name==='roster.prepare')return [...new Set([...(Array.isArray(p.shifts)?p.shifts:[]),...s.shifts.filter(x=>s.rosters.some(r=>r.id===x.rosterId&&r.week===p.week&&['draft','published'].includes(r.status)))].map(x=>siteOf(s,x)))]
 if(name==='roster.publish'){const r=s.rosters.find(x=>x.id===p.id);return [...new Set(s.shifts.filter(x=>x.rosterId===r?.id||s.rosters.some(y=>y.id===x.rosterId&&y.week===r?.week&&y.status==='published')).map(x=>siteOf(s,x)))]}
 if(name==='swap.decide'){const w=s.swaps.find(x=>x.id===p.id);return w?[w.give.site,...(w.take?[w.take.site]:[])]:[]}
 if(name==='payroll.prepare'){const ts=s.timesheets.filter(x=>p.ids?.includes(x.id)||!p.ids);return [...new Set(ts.map(x=>siteOf(s,x)))]}
 if(name.startsWith('payroll.')){const b=s.batches.find(x=>x.id===p.id);return [...new Set((b?.lines??[]).map((x:any)=>siteOf(s,x)))] as string[]}
 if(name==='time.approveMany')return [...new Set((p.items??[]).map((x:any)=>siteOf(s,s.timesheets.find(t=>t.id===x.id)??{})))] as string[]
 const row=s.timesheets.find(x=>x.id===p.id)??s.leave.find(x=>x.id===p.id)??{staffId:p.staffId};return [...new Set([siteOf(s,row),...(p.site?[String(p.site)]:[]),...(p.corrects?[siteOf(s,s.timesheets.find(t=>t.id===p.corrects)??{})]:[])])]
}
/** Restricted delegates enter only implemented public doors. Unknown administrative commands deny. */
export function authorizeCommand(c:Context,name:string,p:Record<string,any>){
 if(!restricted(c.s,c.a)||name.startsWith('access.')||name.startsWith('chat.'))return
 if(personal.has(name)){if(p.staffId)need(p.staffId===c.a.staffId,'Only your own record',403);c.a={...c.a,nativeRole:c.a.role,role:'staff'};return}
 const permission=commandPermissions[name];need(permission,'This command is unavailable to custom levels',403)
 const sites=sitesFor(c.s,name,p);need(sites.length&&sites.every(site=>allowed(c.s,c.a,permission,site)),'Permission not granted at this cafe',403)
 // Current domain managers operate at one home cafe. Multi-cafe delegated domains remain denied.
 const home=c.s.staff.find(x=>x.id===c.a.staffId)?.site??''
 need(sites.every(site=>site===home),'Delegated commands currently require your home cafe',403)
 if(permission==='payroll.export')need(allowed(c.s,c.a,'wages.view',home),'Payroll requires wage permission',403)
 c.a={...c.a,nativeRole:c.a.role,role:'manager'}
}
export function accessView(s:State,a:Actor){
 const own=a.role==='owner',grants=s.accessgrants.filter(g=>own||g.staffId===a.staffId),ids=new Set(grants.map(g=>g.levelId))
 return {catalog,levels:s.accesslevels.filter(l=>own||ids.has(l.id)),grants,sites:own?[...new Set(s.staff.map(p=>p.site).filter(Boolean))]:[s.staff.find(p=>p.id===a.staffId)?.site].filter(Boolean),people:own?s.staff.filter(p=>p.active&&!p.erased_at).map(p=>({id:p.id,name:p.name})):[],drafts:[],swaps:[]}
}
export function wageRedact(v:any):any{
 if(Array.isArray(v))return v.map(wageRedact)
 if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!/(rate|wage|cost|cents|payroll|budget|salary)/i.test(k)).map(([k,x])=>[k,wageRedact(x)]))
 return v
}

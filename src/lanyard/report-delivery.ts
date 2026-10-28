import {type Bindings} from '../auth.server'
import {operatorMail} from '../mail.server.mjs'
import {type Context,type Row,canonical,get,need,put,sha} from './domain/model'
import {actor,commit,load} from './domain/storage'
import {deliveryPeriod,deliveryReader} from './domain/report-schedules'
import {operationalReport,operationalCsv} from './domain/reports'

async function currentOwner(env:Bindings) {
 const row=await env.DB.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1").first<{id:string;email:string}>()
 need(row,'Active owner required',403)
 return actor(env.DB,{userId:row.id,email:row.email,isOwner:true})
}
async function context(env:Bindings,now:string):Promise<{c:Context;before:Awaited<ReturnType<typeof load>>}> {
 const a=await currentOwner(env),before=await load(env.DB)
 return {before,c:{a,s:structuredClone(before),db:env.DB,now,secret:env.SESSION_SECRET,sql:[],entity:''}}
}
async function persist(c:Context,before:Awaited<ReturnType<typeof load>>,action:string) {
 const id=crypto.randomUUID();await commit(c,before,action,id,await sha(id),{recorded:true})
}
// Claim before submitting once. A crash or uncertain response is never retried
// automatically, since provider acceptance cannot be made atomic with D1.
export async function deliverReports(env:Bindings,now:string) {
 const pending=(await load(env.DB)).reportschedules.filter(r=>r.enabled&&r.nextDue<=now)
 for(const candidate of pending){
  const {c,before}=await context(env,now),schedule=get(c.s,'reportschedules',candidate.id)
  if(!schedule.enabled||schedule.nextDue>now)continue
  const due=schedule.nextDue,id=await sha(canonical([schedule.id,schedule.revision,due]))
  if(c.s.reportdeliveries.some(r=>r.id===id))continue
  const token=crypto.randomUUID()+crypto.randomUUID(),filter={site:schedule.site,kind:schedule.kind,job:schedule.job,person:schedule.person,...deliveryPeriod(c.s,due,schedule.periodDays)}
  let reader,blocked:string|null=null
  try{reader=await deliveryReader(env.DB,c.s,c.a,schedule,env.SESSION_SECRET);operationalReport(c.s,reader,new URLSearchParams(filter),now)}catch{blocked='Current recipient authority requires owner review'}
  if(env.MAIL_PROVIDER!=='sendgrid'||!env.MAIL_FROM||!env.MAIL_API_KEY)blocked='SendGrid is not configured; no mail submitted'
  const delivery:Row={id,revision:1,scheduleId:schedule.id,scheduleRevision:schedule.revision,recipientId:schedule.recipientId,site:schedule.site,filter,due,attemptedAt:now,expiresAt:new Date(Date.parse(now)+86400000).toISOString(),tokenHash:await sha(token),status:blocked?'blocked':'uncertain',reason:blocked??'Submission claimed; provider outcome not yet recorded',providerId:null,revokedAt:null}
  c.s.reportdeliveries.push(delivery);c.entity=id
  const step=schedule.cadenceDays*86400000,nextDue=new Date(Date.parse(due)+(Math.floor((Date.parse(now)-Date.parse(due))/step)+1)*step).toISOString()
  // Advancing the clock does not change the approval revision or invalidate links.
  c.s.reportschedules=c.s.reportschedules.map(r=>r.id===schedule.id?{...r,nextDue}:r)
  await persist(c,before,'report.delivery.attempt')
  if(blocked||!reader)continue
  let status='uncertain',reason='Provider outcome unknown; no automatic retry',providerId:string|null=null
  try{
   // Recheck after claiming, before any outbound request. Nothing private is in
   // email: even a forwarded or old message requires the intended live session.
   const fresh=await load(env.DB),approved=get(fresh,'reportschedules',schedule.id),claimed=get(fresh,'reportdeliveries',id)
   need(approved.revision===schedule.revision&&!claimed.revokedAt,'Report authorization changed',403)
   const recipient=await deliveryReader(env.DB,fresh,await currentOwner(env),approved,env.SESSION_SECRET)
   const link=env.AUTH_ORIGIN+'/api/lanyard/report-deliveries/'+id+'.csv?token='+encodeURIComponent(token)
   const result=await operatorMail(env)!.send({deliveryId:id,html:`<p>Your scheduled operational report is ready.</p><p><a href="${link}">Download your report</a> using your own signed-in account. This link expires in 24 hours and can be revoked.</p><p>No report data is included in this email. Provider acceptance does not establish mailbox delivery.</p>`,headers:{},from:env.MAIL_FROM!,to:[recipient.email],subject:'Your scheduled Lanyard report',text:'Your scheduled operational report is ready. Sign in with your own account to download current authorized sources. This link expires in 24 hours and can be revoked.\n\n'+link+'\n\nNo report data is included in this email. Provider acceptance does not establish mailbox delivery.'})
   status=result.status;reason=result.status==='accepted'?'Provider accepted; mailbox delivery unconfirmed':'Provider did not confirm acceptance; no automatic retry';providerId=result.providerMessageId??null
  }catch{reason='Submission unavailable or uncertain; no automatic retry'}
  const final=await context(env,now),old=get(final.c.s,'reportdeliveries',id)
  put(final.c,'reportdeliveries',{...old,status,reason,providerId,completedAt:now},old)
  await persist(final.c,final.before,'report.delivery.result')
 }
}
export async function reportDeliveryCsv(env:Bindings,identity:import('./domain/model').Actor,id:string,token:string,now:string) {
 const s=await load(env.DB),r=get(s,'reportdeliveries',id),schedule=get(s,'reportschedules',r.scheduleId)
 need(r.recipientId===identity.id&&r.tokenHash===await sha(token)&&!r.revokedAt&&r.expiresAt>now&&r.status==='accepted'&&schedule.revision===r.scheduleRevision,'Report link is unavailable',404)
 const reader=await deliveryReader(env.DB,s,await currentOwner(env),schedule,env.SESSION_SECRET)
 need(reader.id===identity.id,'Not found',404)
 const report=operationalReport(s,reader,new URLSearchParams(r.filter),now)
 await env.DB.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),identity.id,identity.role,'reports.download',r.id,now).run()
 return operationalCsv(report)
}

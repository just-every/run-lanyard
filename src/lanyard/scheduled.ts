import {deliverReports} from './report-delivery'
import {type Bindings} from '../auth.server'
import {actor,load,commit} from './domain/storage'
import {reconcileNotices} from './domain/notices'
import {type Context,canonical,sha} from './domain/model'

/** Seed cron entry: D1's version guard makes overlapping ticks/commands atomic. */
export async function lanyardScheduled(controller:Pick<ScheduledController,'scheduledTime'>,env:Bindings) {
 const row=await env.DB.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1").first<{id:string;email:string}>()
 if(!row)return
 const a=await actor(env.DB,{userId:row.id,email:row.email,isOwner:true}),before=await load(env.DB),s=structuredClone(before)
 const c:Context={a,s,db:env.DB,now:new Date(controller.scheduledTime).toISOString(),sql:[],entity:'reminder-scheduler'}
 await reconcileNotices(c,a)
 if(canonical(s.notices)!==canonical(before.notices)){
  const id=crypto.randomUUID()
  await commit(c,before,'notice.tick',id,await sha(id),{processedAt:c.now})
 }
 await deliverReports(env,c.now)
}

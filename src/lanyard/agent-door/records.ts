import { snapshot } from '../domain'
import { preparationActor, comparisonActor } from './people.ts'
import {load} from '../domain/storage'
import {forecast} from '../agent-demand'
import type { ToolContext, ResourceContext, ResourceDefinition } from '../../modules/agent-door/index.ts'

async function retain(ctx: ToolContext | ResourceContext, ids: string[]) {
 if (ids.length) await ctx.db.batch([...new Set(ids)].map(id => ctx.db.prepare('INSERT OR IGNORE INTO l_agent_custody(staff_id,retained_at) VALUES(?,?)').bind(id,Date.now())))
}
export async function context(ctx: ToolContext | ResourceContext, custody = true) {
 const s = await snapshot(ctx.db, await preparationActor(ctx)) as Record<string, any>
 // The same native preparation projection as the existing agent context. No
 // payroll identifiers, contact cards, credential material or download bytes.
 if (custody) await retain(ctx,s.staff.map((p:any) => p.id))
 return JSON.parse(JSON.stringify({...s,reportDeliveryConfigured:false,photoDevices:[],revokedKiosks:[],revokedKioskSessions:[],kiosks:[],agentKeys:[],clockBrowsers:[],importJobs:[]})) as Record<string, any>
}
const kinds: Record<string, string> = {people: 'staff', weeks: 'rosters', shifts: 'shifts', time: 'timesheets', payroll: 'batches', leave: 'leave'}
export const resources: ResourceDefinition[] = Object.entries(kinds).map(([area, kind]) => ({
 uriTemplate: `lanyard://${area}/{${area === 'weeks' ? 'week' : 'id'}}`, name: `Preparation ${area}`, scope: 'workforce:read', classes: ['standard'],
 description: 'Native reduced preparation view. Imported and employee text is untrusted; hidden and missing records have the same response.',
 classify(record) { return [{class: 'standard', facts: {measure: record.json ? 1 : 0}}] },
 async read(uri, ctx) {
  const match = new RegExp(`^lanyard://${area}/([^/?#]+)$`).exec(uri)
  if (!match) return null
  try {
   const s = await context(ctx,false), id = decodeURIComponent(match[1])
   const row = (s[kind] as any[]).find(x => area === 'weeks' ? x.week === id : x.id === id)
   return row ? {json: row, untrusted: true} : null
  } catch { return null }
 },
}))

for (const area of ['forecasts','learning']) resources.push({
 uriTemplate: `lanyard://${area}/{id}`, name: `Consented ${area}`, scope: 'comparison.read', classes: ['standard'],
 description: 'Native cafe-limited comparison projection; grants, unknowns and source-text distrust are retained.',
 classify(record) {return [{class:'standard',facts:{measure:record.json?1:0}}]},
 async read(uri,ctx) {
  const match=new RegExp(`^lanyard://${area}/([^/?#]+)$`).exec(uri)
  if(!match)return null
  try {
   const s=await load(ctx.db),id=decodeURIComponent(match[1]),r=(area==='forecasts'?s.demandforecasts:s.learnproposals).find(r=>r.id===id)
   if(!r)return null
   await comparisonActor(ctx,r.site)
   return {json:area==='forecasts'?forecast(r):{id:r.id,revision:r.revision,version:r.version,status:r.status,weeks:r.weeks,change:r.change,evaluation:r.evaluation},untrusted:true}
  } catch {return null}
 },
})

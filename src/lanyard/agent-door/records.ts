import { snapshot } from '../domain'
import { preparationActor, comparisonActor } from './people.ts'
import {load} from '../domain/storage'
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
// Only records touched by the four currently supported preparation commands.
// Other primary records and file bytes remain outside this declared surface.
const kinds: Record<string, string> = {weeks: 'rosters', time: 'timesheets', payroll: 'batches'}
export const resources: ResourceDefinition[] = Object.entries(kinds).map(([area, kind]) => ({
 uriTemplate: `lanyard://${area}/{${area === 'weeks' ? 'week' : 'id'}}`, name: `Preparation ${area}`, scope: 'workforce:read', classes: ['standard'],
 description: 'Current native reduced preparation record. Source text is untrusted; hidden and missing records have the same response.',
 classify(record) { return [{class: 'standard', facts: {measure: record.json ? 1 : 0}}] },
 async read(uri, ctx) {
  const match = new RegExp(`^lanyard://${area}/([^/?#]+)$`).exec(uri)
  if (!match || !ctx.scopes.includes('workforce:read')) return null
  try {
   const s = await context(ctx,false), id = decodeURIComponent(match[1])
   const rows = (s[kind] as any[]).filter(x => area === 'weeks' ? x.week === id : x.id === id)
   // A week can retain superseded postings as well as its current draft.
   const row = area === 'weeks' ? rows.find(x => x.status === 'draft') ?? rows.find(x => x.status === 'published') : rows[0]
   if (!row) return null
   const shifts = area === 'weeks' ? s.shifts.filter((x:any) => x.rosterId === row.id && x.status !== 'replaced-draft') : []
   const record = area === 'weeks' ? {...row,shifts} : row
   const ids = area === 'weeks' ? shifts.map((x:any) => x.staffId) : area === 'time' ? [row.staffId] : row.lines.map((x:any) => x.staffId)
   await retain(ctx,ids.filter(Boolean))
   return {json: record, untrusted: true}
  } catch { return null }
 },
}))

resources.push({
 uriTemplate: 'lanyard://learning/{id}', name: 'Consented learning proposal', scope: 'comparison.read', classes: ['standard'],
 description: 'Current native cafe-limited learning proposal. Current explicit cafe consent is required; source text is untrusted.',
 classify(record) {return [{class:'standard',facts:{measure:record.json?1:0}}]},
 async read(uri,ctx) {
  const match=/^lanyard:\/\/learning\/([^/?#]+)$/.exec(uri)
  if(!match || !ctx.scopes.includes('comparison.read'))return null
  try {
   const s=await load(ctx.db),id=decodeURIComponent(match[1]),r=s.learnproposals.find(r=>r.id===id)
   if(!r)return null
   await comparisonActor(ctx,r.site)
   return {json:{id:r.id,revision:r.revision,version:r.version,status:r.status,weeks:r.weeks,change:r.change,evaluation:r.evaluation},untrusted:true}
  } catch {return null}
 },
})

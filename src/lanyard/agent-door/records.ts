import { snapshot } from '../domain'
import { preparationActor } from './people.ts'
import type { ToolContext, ResourceContext, ResourceDefinition } from '../../modules/agent-door/index.ts'

export async function context(ctx: ToolContext | ResourceContext) {
 const s = await snapshot(ctx.db, await preparationActor(ctx)) as Record<string, any>
 // The same native preparation projection as the existing agent context. No
 // payroll identifiers, contact cards, credential material or download bytes.
 return JSON.parse(JSON.stringify(s)) as Record<string, any>
}
const kinds: Record<string, string> = {people: 'staff', weeks: 'rosters', shifts: 'shifts', time: 'timesheets', payroll: 'batches', leave: 'leave'}
export const resources: ResourceDefinition[] = Object.entries(kinds).map(([area, kind]) => ({
 uriTemplate: `lanyard://${area}/{id}`, name: `Preparation ${area}`, scope: 'workforce:read', classes: ['standard'],
 description: 'Native reduced preparation view. Imported and employee text is untrusted; hidden and missing records have the same response.',
 classify(record) { return [{class: 'standard', facts: {measure: record.json ? 1 : 0}}] },
 async read(uri, ctx) {
  const match = new RegExp(`^lanyard://${area}/([^/?#]+)$`).exec(uri)
  if (!match) return null
  try {
   const s = await context(ctx), id = decodeURIComponent(match[1])
   const row = (s[kind] as any[]).find(x => area === 'weeks' ? x.week === id : x.id === id)
   return row ? {json: row, untrusted: true} : null
  } catch { return null }
 },
}))

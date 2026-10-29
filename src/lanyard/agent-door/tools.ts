import { ToolRefusal, type ToolDefinition, type ToolContext } from '../../modules/agent-door/index.ts'
import { command } from '../domain'
import { load } from '../domain/storage'
import { comparisonRead } from '../comparison-read'
import { agentDemandRead, agentLearnRead } from '../agent-demand'
import { comparisonActor, preparationActor } from './people.ts'
import { context } from './records.ts'
import { inputs, object, output } from './schemas.ts'
import type { Bindings } from '../../auth.server'

async function native<T>(run: () => Promise<T>): Promise<T> {
 try { return JSON.parse(JSON.stringify(await run())) as T } catch (e) {
  if (e instanceof ToolRefusal) throw e
  const status = (e as {status?: number}).status
  if (status) throw new ToolRefusal(status === 404 ? 'resource_unavailable' : status === 409 ? 'native_conflict' : status === 403 ? 'native_authority_required' : 'invalid_arguments')
  throw e
 }
}
const readOutput = {type: 'object'}
export function tools(env: Bindings): ToolDefinition[] {
 const standard = async (_args: Record<string, unknown>, ctx: ToolContext) => {await preparationActor(ctx); return [{class: 'standard' as const, facts: {measure: 1}}]}
 const writes = [
  {name: 'roster.prepare', title: 'Prepare a schedule draft', inputSchema: inputs.roster, clauses: ['AGENT-001','ROSTER-002','SCHEDULE-001']},
  {name: 'time.prepare', title: 'Prepare time for human review', inputSchema: inputs.time, clauses: ['AGENT-001','TIME-002']},
  {name: 'payroll.prepare', title: 'Prepare an hours batch', inputSchema: inputs.payroll, clauses: ['AGENT-001','PAYROLL-001']},
  {name: 'learn.propose', title: 'Record an evidence-bound growth proposal', inputSchema: inputs.propose, clauses: ['AGENT-001','LEARN-001','TRADEOFF-001']},
 ].map((item): ToolDefinition => ({
  name: 'lanyard.' + item.name, title: item.title, description: item.title + '. Preparation only; native human decisions remain separate.',
  inputSchema: item.inputSchema, outputSchema: output, scope: item.name === 'learn.propose' ? 'comparison.read' : 'workforce:prepare', readOnly: false, untrusted: true, classes: ['standard'], clauses: item.clauses,
  async classify(args, ctx) {
   const a = item.name === 'learn.propose' ? await comparisonActor(ctx, String(args.site)) : await preparationActor(ctx)
   const s = await load(ctx.db)
   const ids = item.name === 'roster.prepare' ? (args.shifts as any[]).map(x => x.staffId) : item.name === 'time.prepare' ? [args.staffId] : []
   if (ids.some(id => !s.staff.some(p => p.id === id && p.active && !p.erased_at))) throw new ToolRefusal('resource_unavailable')
   void a
   return [{class: 'standard', facts: {measure: item.name === 'roster.prepare' ? (args.shifts as any[]).length : item.name === 'payroll.prepare' ? (args.ids as unknown[] | undefined)?.length ?? s.timesheets.filter(t => t.status === 'approved' && !s.claims.some(c => c.time_id === t.id && c.time_revision === t.revision)).length : 1}}]
  },
  async revision(_args, ctx) {return (await load(ctx.db)).version},
  async summary(args, ctx) {
   await preparationActor(ctx)
   const s = await load(ctx.db), ids = item.name === 'roster.prepare' ? (args.shifts as any[]).map(x => x.staffId) : item.name === 'time.prepare' ? [args.staffId] : []
   const people = ids.map(id => s.staff.find(p => p.id === id)?.name ?? 'Unavailable person')
   return {target: {name: item.name === 'roster.prepare' ? `Schedule draft ${args.week}` : item.name === 'learn.propose' ? `Learning proposal for ${args.site}` : item.title}, items: people.length ? people : item.name === 'payroll.prepare' ? (args.ids as string[] | undefined) ?? s.timesheets.filter(t => t.status === 'approved').map(t => t.id) : [String(args.digest)]}
  },
  async run(args, ctx) {
   const a = item.name === 'learn.propose' ? await comparisonActor(ctx, String(args.site)) : await preparationActor(ctx)
   const result = await native(() => command(ctx.db, a, item.name, args, env.SESSION_SECRET, undefined, env.FILES))
   const row = (result as any).result, area = item.name === 'roster.prepare' ? 'weeks' : item.name === 'time.prepare' ? 'time' : item.name === 'payroll.prepare' ? 'payroll' : null
   if (area) ctx.emit(item.name, `lanyard://${area}/${encodeURIComponent(area === 'weeks' ? row.week : row.id)}`, {id: row.id, revision: row.revision})
   return {result, ...(area ? {resources: [{uri: `lanyard://${area}/${encodeURIComponent(area === 'weeks' ? row.week : row.id)}`, name: item.title}]} : {})}
  },
 }))
 const reads: ToolDefinition[] = [{
  name: 'lanyard.context.read', title: 'Read reduced preparation context', description: 'Inspect native staffing and draft facts without contact, payroll identifiers or wage rates.', scope: 'workforce:read', readOnly: true,
  inputSchema: object({}), outputSchema: {type: 'object', required: ['version','staff','rosters','shifts','timesheets','batches'], properties: {version: {type: 'integer'}, staff: {type: 'array'}, rosters: {type: 'array'}, shifts: {type: 'array'}, timesheets: {type: 'array'}, batches: {type: 'array'}}},
  classes: ['standard'], clauses: ['AGENT-001'], classify: standard, untrusted: true, async run(_args, ctx) {return {result: await native(() => context(ctx))}},
 }, ...[
  {name: 'tradeoff.compare', title: 'Read a consented comparison', inputSchema: inputs.comparison, clauses: ['TRADEOFF-001'], read: (args: Record<string, unknown>, ctx: ToolContext) => native(async () => comparisonRead(ctx.db, await comparisonActor(ctx, String(args.site)), String(args.week), String(args.site), Number(args.weeks ?? 8)))},
  {name: 'demand.read', title: 'Read a consented forecast', inputSchema: inputs.demand, clauses: ['DEMAND-001','LEARN-001'], read: (args: Record<string, unknown>, ctx: ToolContext) => native(async () => agentDemandRead(ctx.db, await comparisonActor(ctx, String(args.site)), String(args.site), String(args.date)))},
  {name: 'learn.read', title: 'Read consented learning evidence', inputSchema: inputs.learning, clauses: ['LEARN-001','TRADEOFF-001'], read: (args: Record<string, unknown>, ctx: ToolContext) => native(async () => agentLearnRead(ctx.db, await comparisonActor(ctx, String(args.site)), String(args.site), Number(args.weeks ?? 8)))},
 ].map((item): ToolDefinition => ({
  name: 'lanyard.' + item.name, title: item.title, description: item.title + '. Requires a current native comparison.read grant for this cafe.', inputSchema: item.inputSchema, outputSchema: readOutput, scope: 'comparison.read', readOnly: true, classes: ['standard'], clauses: item.clauses,
  async classify(args, ctx) {await comparisonActor(ctx, String(args.site));return [{class: 'standard', facts: {measure: 1}}]},
  async run(args, ctx) {return {result: await item.read(args, ctx)}}, untrusted: true,
 }))]
 return [...writes, ...reads]
}

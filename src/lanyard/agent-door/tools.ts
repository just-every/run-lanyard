import { ToolRefusal, type ToolDefinition, type ToolContext } from '../../modules/agent-door/index.ts'
import { command } from '../domain'
import { load } from '../domain/storage'
import { learnEvaluate, learnDigest } from '../domain/learn-propose'
import { comparisonRead } from '../comparison-read'
import { agentDemandRead, agentLearnRead } from '../agent-demand'
import { comparisonActor, preparationActor } from './people.ts'
import { context } from './records.ts'
import { action, actions } from './catalogue.ts'
import type { Bindings } from '../../auth.server'

async function native<T>(run: () => Promise<T>): Promise<T> {
 try { return JSON.parse(JSON.stringify(await run())) as T } catch (e) {
  if (e instanceof ToolRefusal) throw e
  const status = (e as {status?: number}).status
  if (status) throw new ToolRefusal(status === 404 ? 'resource_unavailable' : status === 409 ? 'native_conflict' : status === 403 ? 'native_authority_required' : 'invalid_arguments')
  throw e
 }
}
export function tools(env: Bindings): ToolDefinition[] {
 const standard = async (_args: Record<string, unknown>, ctx: ToolContext) => {await preparationActor(ctx); return [{class: 'standard' as const, facts: {measure: 1}}]}
 const writes = actions.filter(item => !item.readOnly).map((metadata): ToolDefinition => {
 const name = metadata.name.slice('lanyard.'.length), item = {...metadata, name}
 return {
  ...metadata, untrusted: true,
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
   const s = await load(ctx.db), name = (id: unknown) => s.staff.find(p => p.id === id)?.name ?? 'Unavailable person'
   if (item.name === 'learn.propose') {
    const actor = await comparisonActor(ctx, String(args.site))
    const evidence = learnEvaluate(s, {...actor, role:'owner'}, String(args.site), Number(args.weeks), new Date(ctx.now()).toISOString())
    if (await learnDigest(evidence) !== args.digest || evidence.status !== 'proposal' || !evidence.proposal) throw new ToolRefusal('native_conflict')
    return {target:{name:`Learning proposal for ${args.site}`},items:[`Growth ${evidence.proposal.from}% to ${evidence.proposal.to}%`,evidence.proposal.explanation]}
   }
   const items = item.name === 'roster.prepare'
    ? (args.shifts as any[]).map(row => `${name(row.staffId)}: ${row.start} to ${row.end}; unpaid break ${row.breakMinutes} minutes; ${row.site ?? ''} ${row.job ?? ''}`)
    : item.name === 'time.prepare'
     ? [`${name(args.staffId)}: ${args.start} to ${args.end}; unpaid break ${args.breakMinutes} minutes${args.corrects ? `; correction of ${args.corrects}` : ''}`]
     : s.timesheets.filter(t => t.status === 'approved' && !s.claims.some(c => c.time_id === t.id && c.time_revision === t.revision) && (!args.ids || (args.ids as unknown[]).includes(t.id))).map(t => `${name(t.staffId)}: ${t.start} to ${t.end}; ${t.minutes} approved minutes; source ${t.id} revision ${t.revision}`)
   return {target:{name:item.name === 'roster.prepare' ? `Schedule draft ${args.week}` : item.title},items}

  },
  async run(args, ctx) {
   const a = item.name === 'learn.propose' ? await comparisonActor(ctx, String(args.site)) : await preparationActor(ctx)
   const result = await native(() => command(ctx.db, a, item.name, args, env.SESSION_SECRET, undefined, env.FILES))
   const row = (result as any).result, area = item.name === 'roster.prepare' ? 'weeks' : item.name === 'time.prepare' ? 'time' : item.name === 'payroll.prepare' ? 'payroll' : 'learning'
   if (area) ctx.emit(item.name, `lanyard://${area}/${encodeURIComponent(area === 'weeks' ? row.week : row.id)}`, {id: row.id, revision: row.revision})
   return {result, ...(area ? {resources: [{uri: `lanyard://${area}/${encodeURIComponent(area === 'weeks' ? row.week : row.id)}`, name: item.title}]} : {})}
  },
 }})
 const reads: ToolDefinition[] = [{
  ...action('context.read'),
  classify: standard, untrusted: true, async run(_args, ctx) {return {result: await native(() => context(ctx))}},
 }, ...[
  {name: 'tradeoff.compare', read: (args: Record<string, unknown>, ctx: ToolContext) => native(async () => comparisonRead(ctx.db, await comparisonActor(ctx, String(args.site)), String(args.week), String(args.site), Number(args.weeks ?? 8)))},
  {name: 'demand.read', read: (args: Record<string, unknown>, ctx: ToolContext) => native(async () => agentDemandRead(ctx.db, await comparisonActor(ctx, String(args.site)), String(args.site), String(args.date)))},
  {name: 'learn.read', read: (args: Record<string, unknown>, ctx: ToolContext) => native(async () => agentLearnRead(ctx.db, await comparisonActor(ctx, String(args.site)), String(args.site), Number(args.weeks ?? 8)))},
 ].map((item): ToolDefinition => ({
  ...action(item.name),
  async classify(args, ctx) {await comparisonActor(ctx, String(args.site));return [{class: 'standard', facts: {measure: 1}}]},
  async run(args, ctx) {return {result: await item.read(args, ctx)}}, untrusted: true,
 }))]
 return [...writes, ...reads]
}

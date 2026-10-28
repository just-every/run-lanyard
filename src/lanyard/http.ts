import {reportDeliveryCsv} from './report-delivery'
import {auditRestricted} from './domain/audit-access'
import {retainedAuditRead} from './domain/audit-retention'
import {operationalReport,operationalCsv,reportSites} from './domain/reports'
import {auditRead} from './domain/audit-report'
import {laborCostReport} from './domain/labor-cost'
import {aiSource} from './domain/ai-schedules'
import {type AiConfiguration} from './domain/ai-provider'
import {policyForm} from './policy-form'
import {sickCsv,sickReports} from './domain/sick'
import {localDate} from './domain/settings'
import {kioskResponse,kioskAdmin,kioskPin} from './kiosk'
import {chatRead,chatFile,chatMembershipAudit} from './domain/chat'
import {load} from './domain/storage'
import {customAccessRead} from './domain'
import { runtimeBindings, type Bindings } from '../auth.server'
import { learningRead, fairnessCompare, fairnessRead, shiftAttachment, tipCreditRead, acaRead, previewSchedule, coverageRead, attendanceBoard, batchFile, autoRulePreview, command, contactRead, dashboardRead, intervalsRead, demandRead, learnProposalRead, salesRead, logbookRead, noteAttachment, overtimeAlerts, scheduleHistory, schedulePdf, snapshot, type Actor } from './domain'
import { importCommand } from './movein'
import { agentKeys, credentialCommand, fail, principal } from './credentials'
import { renderApp } from './ui'
import { clockBrowserCommand, clockBrowsers, clockCookie, networkOf } from './clockbrowsers'
import { comparisonRead } from './comparison-read'
import {agentDemandRead,agentLearnRead} from './agent-demand'
import { timezone as zone } from './domain/settings'

const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin' }
const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
const pages = new Set(['/app', '/app/schedule', '/app/time', '/app/payroll', '/app/people', '/app/settings', '/app/import', '/app/agent', '/app/wall', '/app/access', '/app/chat'])
// The screen a form returns to, with its own query (week, cafe, day) but never another origin or path.
function returnTo(value: string | null): string {
  if (!value?.startsWith('/app')) return '/app'
  const url = new URL(value, 'http://app.invalid')
  return pages.has(url.pathname) || url.pathname === '/app/demand' ? url.pathname + url.search : '/app'
}

async function customMode(env:Bindings,who:Actor){
  if(who.role==='owner'||who.role==='agent')return false
  return Boolean(await env.DB.prepare("SELECT 1 FROM l_records WHERE kind='accessgrants' AND json_extract(data,'$.staffId')=? AND json_extract(data,'$.archivedAt') IS NULL LIMIT 1").bind(who.staffId??'').first())
}

async function state(request:Request,env: Bindings, who: Actor, withChat=false) {
  // A new installation takes the time zone its owner gave at setup until anything is saved.
  if (env.VENUE_TIMEZONE) await env.DB.prepare('UPDATE l_meta SET timezone=? WHERE id=1 AND version=0 AND timezone<>?').bind(zone(env.VENUE_TIMEZONE), zone(env.VENUE_TIMEZONE)).run()
  // Independent reads go to D1 together, so a page waits for one round trip instead of several in a row.
  const [snap, keys, browsers, jobs] = await Promise.all([snapshot(env.DB, who, env.SESSION_SECRET, new URL(request.url).searchParams.get('week')??undefined), agentKeys(env, who), clockBrowsers(env, who), who.role === 'owner' ? env.DB.prepare("SELECT id,state,checkpoint,total,fingerprint,error FROM ik_jobs WHERE destination='lanyard:staff' AND namespace='lanyard.staff.csv.v1' AND mapping_version='staff-csv-v1' AND principal_id=? ORDER BY rowid DESC LIMIT 30").bind(who.id).all() : null])
  const revokedKiosks=who.role==='owner'||who.role==='manager'?(await env.DB.prepare('SELECT id,site FROM l_kiosk_devices WHERE revoked_at IS NOT NULL OR locked=1').all<{id:string;site:string}>()).results.filter(d=>who.role==='owner'||d.site===(snap as any).staff.find((p:any)=>p.id===who.staffId)?.site).map(d=>d.id):[]
  const photoDevices=who.role==='agent'?[]:(await networkOf(request,env)).browsers.map(b=>({site:b.site,type:b.type}))
  return { ...snap, photoDevices,revokedKiosks,kiosks:who.role==='owner'?(await env.DB.prepare('SELECT id,site,label,photo,locked,revoked_at FROM l_kiosk_devices').all()).results:[], ...(withChat?{chat:chatRead(await load(env.DB),who)}:{}), agentKeys: keys, clockBrowsers: browsers, importJobs: jobs ? jobs.results : [] }
}

async function execute(request: Request, env: Bindings, who: Actor, name: string, input: Record<string, unknown>) {
  if(name==='kiosk.pin')return kioskPin(env,who,input)
  if(name==='kiosk.enroll'||name==='kiosk.revoke')return kioskAdmin(env,who,name,input)
  if (name.startsWith('agent.') || name === 'staff.invite') return credentialCommand(request, env, who, name, input)
  if (name.startsWith('import.')) return importCommand(env.DB, who, name, input)
  if (name.startsWith('clockbrowser.')) return clockBrowserCommand(env, who, name, input)
  // CLOCK-007: a punch carries its network identity (edge client IP and enrolled-browser cookie).
  return command(env.DB, who, name, input, env.SESSION_SECRET, ['clock.in','clock.out','clock.breakStart','clock.breakEnd'].includes(name) ? await networkOf(request, env) : undefined, env.FILES,undefined,env as Bindings&AiConfiguration)
}

/** CLOCK-007: an enrolment's token goes only into this response's HttpOnly cookie, never into the page or JSON. */
function withClockCookie(response: Response, result: unknown) {
  const token = (result as { token?: string } | null)?.token
  if (token) response.headers.append('set-cookie', clockCookie(token))
  return response
}

async function inputBody(request: Request): Promise<Record<string, unknown>> {
  // JOURNAL-001 keeps its 1 MB attachment; LOG-001 accepts five 10 MB files.
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const log = new URL(request.url).searchParams.get('name') === 'log.save', maxFile = log ? 10_000_000 : 1_000_000
    if (Number(request.headers.get('content-length') ?? 0) > (log ? 50_100_000 : 1_500_000)) fail('Request is too large', 413)
    const form = await request.formData(), input: Record<string, unknown> = {}
    for (const [key, value] of form) {
      if (typeof value === 'string') input[key] = key === 'mentions' ? [...((input[key] as string[] | undefined) ?? []), value] : value
      else if (value.size) {
        if (value.size > maxFile) fail(log ? 'Attachments are 10 MB at most' : 'Attachments are 1 MB at most', 413)
        if (log && (key !== 'attachments' || ((input.attachments as unknown[] | undefined)?.length ?? 0) >= 5)) fail('Provide at most five attachments', 400)
        if (log) { input.attachments = [...((input.attachments as unknown[] | undefined) ?? []), { name: value.name || 'attachment', type: value.type || 'application/octet-stream', blob: value }]; continue }
        const bytes = new Uint8Array(await value.arrayBuffer()), chunks: string[] = []
        for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
        const file = { name: value.name || 'attachment', type: value.type || 'application/octet-stream', data: btoa(chunks.join('')) }
        input[key] = file
      }
    }
    for(const key of ['revision','shiftRevision'])if(key in input)input[key]=Number(input[key])
    if(form.has('completed'))input.completed=form.getAll('completed');else if(new URL(request.url).searchParams.get('name')==='shiftwork.respond')input.completed=[]
    return input
  }
  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > 200_000) fail('Request is too large', 413)
  if (request.headers.get('content-type')?.includes('application/json')) {
    let input; try { input = JSON.parse(raw) } catch { fail('Invalid JSON') }
    if (!input || Array.isArray(input) || typeof input !== 'object') fail('Expected an object')
    return input
  }
  if (!request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) fail('Use JSON or a form', 415)
  const params = new URLSearchParams(raw), input: Record<string, unknown> = Object.fromEntries(params)
  policyForm(input,params)
  if(new URL(request.url).searchParams.get('name')==='organization.member.save')for(const key of ['locationIds','departmentIds'])input[key]=params.getAll(key)
  if(params.has('draftStaff')){
    const row={staffId:String(input.draftStaff),start:String(input.draftStart),end:String(input.draftEnd),breakMinutes:Number(input.draftBreak),site:String(input.draftSite),job:String(input.draftJob??'')}
    if(params.has('existingShifts')){let rows;try{rows=JSON.parse(String(input.existingShifts))}catch{fail('Reload the draft before editing')};const index=Number(input.draftIndex);if(!Array.isArray(rows)||!Number.isInteger(index)||index<0||index>=rows.length)fail('Reload the draft before editing');rows[index]={...rows[index],...row};input.shifts=rows}else input.shifts=[row]
    for(const k of ['draftStaff','draftStart','draftEnd','draftBreak','draftSite','draftJob','existingShifts','draftIndex'])delete input[k]
  }
  if(params.has('shiftChoice')){const choice=String(input.shiftChoice);if(choice){const [id,revision]=choice.split('|');input.shiftId=id;input.shiftRevision=Number(revision)}delete input.shiftChoice}
  if(params.has('members'))input.members=params.getAll('members')
  if('shiftRevision' in input)input.shiftRevision=Number(input.shiftRevision)
  if (params.has('permissions')||new URL(request.url).searchParams.get('name')==='access.level.save') input.permissions=params.getAll('permissions')
  if (params.has('scopes')) input.scopes = params.getAll('scopes')
  if (params.has('cafes')) input.cafes = params.getAll('cafes')
  if (params.has('comparisonConsent')) input.comparisonConsent = params.get('comparisonConsent') === 'on'
  if (params.has('tags') || new URL(request.url).searchParams.get('name') === 'fairness.policy.save') input.tags = params.getAll('tags')
  if (params.has('days')) input.days = params.getAll('days')
  if (params.has('hidden')) input.hidden = params.getAll('hidden')
  if (params.has('flags')) input.flags = params.getAll('flags')
  if (params.has('pool')) input.pool = params.getAll('pool')
  if (params.has('ranking')) input.ranking = params.getAll('ranking')
  if (params.has('mentions')) input.mentions = params.getAll('mentions')
  if (params.has('staffIds')) input.staffIds = params.getAll('staffIds')
  if (params.has('tippedJobs')) input.tippedJobs = params.getAll('tippedJobs')
  // CONTACT-001: the form's rows of name, relationship and phone; blank rows are dropped.
  if (params.has('contactName')) {
    const names = params.getAll('contactName'), relations = params.getAll('contactRelationship'), phones = params.getAll('contactPhone')
    input.contacts = names.map((name, i) => ({ name, relationship: relations[i] ?? '', phone: phones[i] ?? '' })).filter(x => x.name || x.relationship || x.phone)
    for (const key of ['contactName', 'contactRelationship', 'contactPhone']) delete input[key]
  }
  for (const key of ['revision', 'shiftRevision', 'breakMinutes', 'minutes', 'closeOpenHours']) if (key in input) input[key] = Number(input[key])
  if(params.has('completed'))input.completed=params.getAll('completed');else if(new URL(request.url).searchParams.get('name')==='shiftwork.respond')input.completed=[]
  if(params.has('taskLines')){input.tasks=String(input.taskLines).split(/\r?\n/).map(v=>v.trim()).filter(Boolean);delete input.taskLines}
  if(params.has('taskText')){input.tasks=params.getAll('taskText').filter(v=>v.trim());delete input.taskText}
  if(params.has('segmentUntil')){const until=params.getAll('segmentUntil'),job=params.getAll('segmentJob'),area=params.getAll('segmentArea');input.segments=until.map((v,i)=>({until:Number(v),job:job[i],area:area[i]})).filter((v,i)=>until[i]||v.job||v.area);for(const k of ['segmentUntil','segmentJob','segmentArea'])delete input[k]}
  for (const key of ['shifts', 'ids', 'items', 'rows']) if (typeof input[key]==='string'&&input[key]) { try { input[key] = JSON.parse(String(input[key])) } catch { fail(`Invalid ${key}`) } }
  if ('active' in input) input.active = input.active === 'on' || input.active === 'true' || input.active === '1'
  return input
}

export async function lanyardResponse(request: Request, original: Bindings): Promise<Response | null> {
  const url = new URL(request.url), path = url.pathname
  if (!path.startsWith('/api/lanyard/') && path !== '/app' && !path.startsWith('/app/')) return null
  const env = runtimeBindings(original), isAgent = path.startsWith('/api/lanyard/agent/')
  let who: Actor | undefined
  let auditOnly=false
  let policyInput: Record<string, unknown> | undefined
  let workerInput: Record<string, unknown> | undefined
  const back = returnTo(url.searchParams.get('returnTo'))
  try {
    if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host') !== url.host)) fail('Wrong application origin', 403)
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405)
    // Bearer-only agent routes have no ambient browser authority. Human mutations require Origin.
    if (request.method === 'POST' && !isAgent && (request.headers.get('origin') !== env.AUTH_ORIGIN || request.headers.get('sec-fetch-site') === 'cross-site')) fail('Cross-site request refused', 403)
    // The schedule was called the roster; old links keep working.
    if (path === '/app/roster' && request.method === 'GET') return new Response(null, { status: 301, headers: { ...headers, location: '/app/schedule' + url.search } })
    const kiosk=await kioskResponse(request,env);if(kiosk)return kiosk
    who = await principal(request, env, isAgent)
    auditOnly=auditRestricted(await load(env.DB),who)
    if(auditOnly&&(request.method!=='GET'||!['/app/audit','/api/lanyard/audit','/api/lanyard/audit.csv'].includes(path)))fail('Audit authority grants only report reads and downloads',403)
    if (request.method === 'GET') {
      const custom=await customMode(env,who)
      if(custom&&!auditOnly&&!['/api/lanyard/intervals','/app/intervals','/app','/app/schedule','/app/time','/app/access','/api/lanyard/state','/api/lanyard/access','/app/chat','/api/lanyard/chat'].includes(path)&&!path.startsWith('/api/lanyard/chat/messages/')&&!/^\/api\/lanyard\/kiosk-photos\/[\w-]+$/.test(path)&&!/^\/(app|api\/lanyard)\/contacts\/[\w-]+$/.test(path)&&!/^\/api\/lanyard\/batches\/[\w-]+\.(csv|tsv|txt|xlsx|iif)$/.test(path))fail('This read is unavailable to custom levels',403)
      const retainedAudit=path.match(/^\/api\/lanyard\/audit-packets\/([\w-]+)(\.csv)?$/)
      if(retainedAudit){
       const packet=await retainedAuditRead(env.DB,who,retainedAudit[1],Boolean(retainedAudit[2]))
       return retainedAudit[2]?new Response(packet as string,{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="lanyard-retained-audit.csv"'}}):json(packet)
      }
      if(['/app/audit','/api/lanyard/audit','/api/lanyard/audit.csv'].includes(path)){
       const today=new Date().toISOString().slice(0,10),from=url.searchParams.get('from')??today.slice(0,4)+'-01-01',through=url.searchParams.get('through')??today
       const report=await auditRead(env.DB,who,url.searchParams.get('site')??'',from,through,url.searchParams.get('jurisdiction')??'all',path.endsWith('.csv')?'csv':'json',{grantId:url.searchParams.get('grantId')??'',staffId:url.searchParams.get('staffId')??'',reportClass:url.searchParams.get('reportClass')??''})
       if(path.endsWith('.csv'))return new Response(report as string,{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="lanyard-audit.csv"'}})
       return path==='/app/audit'?renderApp(auditOnly?{auditOnly:true,actor:{id:who.id,email:who.email,role:'auditor',staffId:who.staffId},settings:{timezone:(report as any).timezone},staff:[]}:await state(request,env,who),path+url.search,{result:{audit:report}}):json(report)
      }
      if(path==='/api/lanyard/chat-membership')return json(chatMembershipAudit(await load(env.DB),who))
      if(path==='/app/chat'||path==='/api/lanyard/chat'){
       const chat=chatRead(await load(env.DB),who,url.searchParams.get('q')??'',url.searchParams.get('threadId')??'')
       return path==='/app/chat'?renderApp(await state(request,env,who),path+url.search,{result:{chat}}):json(chat)
      }
      const chatAttachment=path.match(/^\/api\/lanyard\/chat\/messages\/([\w-]+)\/files\/([\w-]+)$/)
      if(chatAttachment){const f=chatFile(await load(env.DB),who,chatAttachment[1],chatAttachment[2]);return new Response(f.bytes,{headers:{...headers,'content-type':'application/octet-stream','content-disposition':`attachment; filename="${f.name.replace(/[^\w. -]/g,'_')}"`}})}
      const photo=path.match(/^\/api\/lanyard\/kiosk-photos\/([\w-]+)$/)
      if(photo){const f=await env.DB.prepare('SELECT staff_id,bytes FROM l_kiosk_photos WHERE id=?').bind(photo[1]).first<any>();if(!f||who.role==='agent'||who.role!=='owner'&&who.staffId!==f.staff_id)fail('Not found',404);return new Response(new Uint8Array(f.bytes),{headers:{...headers,'content-type':'image/jpeg','content-disposition':'inline; filename="punch.jpg"'}})}
      if(path==='/api/lanyard/sick-balances.csv'||path==='/api/lanyard/sick-balances'){
       if(who.role!=='owner')fail('Owner required',403)
       const current=await load(env.DB),today=localDate(new Date().toISOString(),current.timezone),on=url.searchParams.get('asOf')??today
       if(!/^\d{4}-\d{2}-\d{2}$/.test(on)||!Number.isFinite(Date.parse(on+'T00:00:00Z'))||new Date(on+'T00:00:00Z').toISOString().slice(0,10)!==on||on>today)fail('Use a valid past or current as-of date',400)
       if(!path.endsWith('.csv'))return json(sickReports(current,on))
       await env.DB.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),who.id,who.role,'sick.download','balances',new Date().toISOString()).run()
       return new Response(sickCsv(current,on),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="lanyard-leave-balances.csv"'}})
      }
      const aiImage=path.match(/^\/api\/lanyard\/ai-schedules\/([\w-]+)\/source$/)
      if(aiImage){const image=aiSource(await load(env.DB),who,aiImage[1]),binary=atob(image.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new Response(bytes,{headers:{...headers,'content-type':image.type,'content-disposition':`inline; filename="${image.name.replace(/[^\w. -]/g,'_')}"`}})}
      if(path==='/api/lanyard/access')return json(await customAccessRead(env.DB,who))
      if(path==='/app/access')return renderApp(await state(request,env,who),path,{result:{access:await customAccessRead(env.DB,who)}})
      if (pages.has(path)) {
        const view:any=await state(request,env,who)
        if(path==='/app/schedule'&&!custom&&['owner','manager'].includes(who.role)) {
          const {weekModel}=await import('./ui/week'),w=weekModel(view,Date.now(),url.searchParams,true)
          const site=who.role==='manager'?view.staff.find((p:any)=>p.id===view.actor.staffId)?.site??'':w.site
          const weeks=Number(url.searchParams.get('fairWeeks')??8),fairness=await fairnessRead(env.DB,who,w.week,site,weeks)
          let comparison,comparisonError:string|undefined
          if(url.searchParams.has('fairCompare'))try{comparison=await fairnessCompare(env.DB,who,w.week,site,weeks)}catch(error){if(Number((error as any)?.status)!==400)throw error;comparisonError=(error as Error).message}
          return renderApp(view,path+url.search,{error:comparisonError,result:{fairness,fairnessCompare:comparison,cost:url.searchParams.get('site')==='all'?undefined:laborCostReport(await load(env.DB),who,w.week,site,new Date().toISOString(),w.view==='draft')}})
        }
        return renderApp(view,path+url.search)
      }
      if (path === '/api/lanyard/agent/demand') return json(await agentDemandRead(env.DB,who,url.searchParams.get('site')??'',url.searchParams.get('date')??''))
      if (path === '/api/lanyard/agent/learning/proposals') return json(await agentLearnRead(env.DB,who,url.searchParams.get('site')??'',Number(url.searchParams.get('weeks')??8)))
      if (path === '/api/lanyard/agent/fairness/compare') return json(await comparisonRead(env.DB,who,url.searchParams.get('week')??'',url.searchParams.get('site')??'',Number(url.searchParams.get('weeks')??8)))
      const delivery=path.match(/^\/api\/lanyard\/report-deliveries\/([\w-]+)\.csv$/)
      if(delivery){
       const csv=await reportDeliveryCsv(env,who,delivery[1],url.searchParams.get('token')??'',new Date().toISOString())
       return new Response(csv,{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="lanyard-operational.csv"'}})
      }
      if(path==='/app/reports'||path==='/api/lanyard/reports'||path==='/api/lanyard/reports.csv') {
       const source=await load(env.DB),params=new URLSearchParams(url.searchParams),now=new Date().toISOString()
       if(path==='/app/reports'){
        const today=localDate(now,source.timezone)
        if(!params.has('site'))params.set('site',reportSites(source,who)[0]??'')
        if(!params.has('through'))params.set('through',today)
        if(!params.has('from'))params.set('from',new Date(Date.parse(today+'T00:00:00Z')-13*86400000).toISOString().slice(0,10))
       }
       const report=operationalReport(source,who,params,now)
       if(path==='/app/reports')return renderApp(await state(request,env,who),path+url.search,{result:{operational:report}})
       if(!path.endsWith('.csv'))return json(report)
       await env.DB.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),who.id,who.role,'reports.download','operational',new Date().toISOString()).run()
       return new Response(operationalCsv(report),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="lanyard-operational.csv"'}})
      }
      if(path==='/api/lanyard/cost')return json(laborCostReport(await load(env.DB),who,url.searchParams.get('week')??'',url.searchParams.get('site')??'',url.searchParams.get('asOf')??new Date().toISOString(),url.searchParams.get('view')==='draft'))
      if (path === '/api/lanyard/fairness/compare') return json(await fairnessCompare(env.DB,who,url.searchParams.get('week')??'',url.searchParams.get('site')??'',Number(url.searchParams.get('weeks')??8)))
      if (path === '/api/lanyard/fairness') return json(await fairnessRead(env.DB,who,url.searchParams.get('week')??'',url.searchParams.get('site')??'',Number(url.searchParams.get('weeks')??8)))
      // CONTACT-001: the audited emergency contact card, as a screen and as JSON.
      const card = path.match(/^\/(app|api\/lanyard)\/contacts\/([\w-]+)$/)
      if (card?.[1] === 'app') { const contactCard = await contactRead(env.DB, who, card[2]); return renderApp(await state(request,env,who), path, { result: { contactCard } }) }
      if (card) return json(await contactRead(env.DB, who, card[2]))
      if (path === '/api/lanyard/state' || path === '/api/lanyard/agent/context') return json(await state(request,env,who))
      const aca = path.match(/^\/api\/lanyard\/aca\/([\w-]+)(\.csv)?$/)
      if (aca) {
        const report=await acaRead(env.DB,who,aca[1],url.searchParams.get('asOf')??new Date().toISOString(),aca[2]?'csv':'json')
        return aca[2]?new Response(report as string,{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="lanyard-aca-${aca[1]}.csv"`}}):json(report)
      }
      // TIPS-002: a workweek's tip-credit checks, and its make-up pay inputs as a CSV.
      if (path === '/api/lanyard/tipcredit') return json(await tipCreditRead(env.DB, who, url.searchParams.get('week') ?? '', 'json'))
      if (path === '/api/lanyard/tipcredit.csv') { const week = url.searchParams.get('week') ?? ''; return new Response(await tipCreditRead(env.DB, who, week, 'csv') as string, { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lanyard-tip-credit-${week}.csv"` } }) }
      const file = path.match(/^\/api\/lanyard\/batches\/([\w-]+)\.(csv|tsv|txt|xlsx|iif)$/)
      if (file) {const download=await batchFile(env.DB,who,file[1],file[2]);return new Response(download.body,{headers:{...headers,'content-type':download.contentType,'content-disposition':`attachment; filename="lanyard-${file[1]}.${download.extension}"`}})}
      if (path === '/api/lanyard/intervals' || path === '/app/intervals') {
        const report = await intervalsRead(env.DB, who, url.searchParams.get('site') ?? '', url.searchParams.get('date') ?? '', Number(url.searchParams.get('size') ?? 60))
        return path === '/app/intervals' ? renderApp(await state(request,env,who), path + url.search, { result: { report } }) : json(report)
      }
      if (path === '/api/lanyard/demand' || path === '/app/demand') {
        const report = await demandRead(env.DB, who, url.searchParams.get('site') ?? '', url.searchParams.get('date') ?? '')
        return path === '/app/demand' ? renderApp(await state(request,env,who), path + url.search, { result: { demand: report, learning: await learnProposalRead(env.DB, who, report.site, 8) } }) : json(report)
      }
      const ruled = path.match(/^\/api\/lanyard\/autorules\/([\w-]+)\/preview$/)
      if (ruled) return json(await autoRulePreview(env.DB, who, ruled[1]))
      if (path === '/api/lanyard/learning/proposals') return json(await learnProposalRead(env.DB, who, url.searchParams.get('site') ?? '', Number(url.searchParams.get('weeks') ?? 8)))
      if (path === '/api/lanyard/learning') return json(await learningRead(env.DB, who, url.searchParams.get('week') ?? '', url.searchParams.get('site') ?? '', Number(url.searchParams.get('weeks') ?? 8)))
      if (path === '/api/lanyard/sales') return json(await salesRead(env.DB, who, url.searchParams.get('week') ?? '', url.searchParams.get('site') ?? ''))
      if (path === '/api/lanyard/dashboard') return json(await dashboardRead(env.DB, who, url.searchParams.get('asOf') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'), url.searchParams.get('site') ?? ''))
      if (path === '/api/lanyard/logbook') return json(await logbookRead(env.DB, who, 'search', '', { site: url.searchParams.get('site') ?? '', category: url.searchParams.get('category') ?? '', month: url.searchParams.get('month') ?? '' }))
      const logged = path.match(/^\/api\/lanyard\/logbook\/([\w-]+)\/(export|files\/([\w-]+))$/)
      if (logged && logged[2] === 'export') { const { name, body } = await logbookRead(env.DB, who, 'export', logged[1]) as { name: string; body: string }; return new Response(body, { headers: { ...headers, 'content-type': 'text/plain; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` } }) }
      if (logged) { const { bytes, name, type } = await logbookRead(env.DB, who, 'file', logged[1], { fileId: logged[3] }, env.FILES) as { bytes: Uint8Array<ArrayBuffer>; name: string; type: string }; return new Response(bytes, { headers: { ...headers, 'content-type': type, 'content-disposition': `attachment; filename="${name.replace(/[^\w. -]/g, '_')}"`, 'x-content-type-options': 'nosniff' } }) }
      const handover=path.match(/^\/api\/lanyard\/handover\/([\w-]+)\/files\/([\w-]+)$/)
      if(handover){const file=await shiftAttachment(env.DB,who,handover[1],handover[2]);return new Response(file.bytes,{headers:{...headers,'content-type':file.type,'content-disposition':`attachment; filename="${file.name.replace(/[^\w. -]/g,'_')}"`}})}
      const attached = path.match(/^\/api\/lanyard\/notes\/([\w-]+)\/files\/([\w-]+)$/)
      if (attached) { const { bytes, name, type } = await noteAttachment(env.DB, who, attached[1], attached[2]); return new Response(bytes, { headers: { ...headers, 'content-type': type, 'content-disposition': `attachment; filename="${name.replace(/[^\w. -]/g, '_')}"`, 'x-content-type-options': 'nosniff' } }) }
      if (path === '/api/lanyard/overtime') return json(await overtimeAlerts(env.DB, who, url.searchParams.get('week') ?? '', url.searchParams.get('asOf') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z')))
      if (path === '/api/lanyard/coverage') return json({ rows: await coverageRead(env.DB, who, url.searchParams.get('asOf') ?? new Date().toISOString(), url.searchParams.get('site') ?? '') })
      if (path === '/api/lanyard/attendance') return json(await attendanceBoard(env.DB, who, url.searchParams.get('asOf') ?? new Date().toISOString().replace(/\.\d+Z$/, 'Z'), url.searchParams.get('site') ?? ''))
      const story = path.match(/^\/api\/lanyard\/shifts\/([\w-]+)\/history$/)
      if (story) return json(await scheduleHistory(env.DB, who, 'shift', story[1]))
      const weekly = path.match(/^\/api\/lanyard\/weeks\/(\d{4}-\d{2}-\d{2})\/(compare|changes\.csv)$/)
      if (weekly?.[2] === 'compare') return json(await scheduleHistory(env.DB, who, 'compare', weekly[1], url.searchParams.get('from') ?? '', url.searchParams.get('to') ?? ''))
      if (weekly) return new Response(await scheduleHistory(env.DB, who, 'log', weekly[1]) as string, { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="lanyard-changes-${weekly[1]}.csv"` } })
      const printed = path.match(/^\/api\/lanyard\/postings\/([\w-]+)\.pdf$/)
      if (printed) { const { bytes, name } = await schedulePdf(env.DB, who, printed[1]); return new Response(bytes, { headers: { ...headers, 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${name}"` } }) }
    } else {
      if(path==='/api/lanyard/schedule/review'&&await customMode(env,who))fail('Use the scoped draft command',403)
      if (path === '/api/lanyard/schedule/review') return json(await previewSchedule(env.DB, who, await inputBody(request)))
      if (path === '/app/action') {
        const input = await inputBody(request), name = url.searchParams.get('name') ?? ''
        if (['policy.worker.preview','policy.worker.save'].includes(name) && new URL(back,url.origin).pathname === '/app/settings') workerInput = input
        if (['policy.preview','policy.save'].includes(name) && new URL(back,url.origin).pathname === '/app/settings') policyInput = input
        if (name === 'staff.save' && !('active' in input)) input.active = false
        const result = await execute(request, env, who, name, input), { token, ...shown } = result as Record<string, unknown>
        if(name==='kiosk.enroll'){const response=new Response(null,{status:303,headers:{...headers,location:'/app/kiosk'}});response.headers.append('set-cookie',String((result as any).cookie));return response}
        let displayed:any=name === 'import.preview' || name === 'sales.preview' ? { ...shown, csv: input.csv, mapping: input.mapping, site: input.site } : name.startsWith('clockbrowser.') ? shown : result
        if(name==='policy.worker.save') displayed={workerInput:input}
        if(name==='policy.worker.preview') displayed={workerInput:input,workerPreview:{review:(result as any).result??result,input}}
        if(name==='policy.preview') displayed={policyInput:input,policyPreview:{review:(result as any).result??result,input}}
        if(name.startsWith('fairness.')&&['owner','manager'].includes(who.role)) {
          const q=new URL(back,url.origin).searchParams
          displayed={...displayed,fairness:await fairnessRead(env.DB,who,String(input.week??q.get('week')??''),String(input.site??q.get('site')??''),Number(input.weeks??q.get('fairWeeks')??8))}
        }
        if((name.startsWith('demand')||name.startsWith('learn'))&&['owner','manager'].includes(who.role)&&new URL(back,url.origin).pathname==='/app/demand') {
          const q=new URL(back,url.origin).searchParams,site=q.get('site')??String(input.site??''),demand=await demandRead(env.DB,who,site,q.get('date')??'')
          displayed={demand,learning:await learnProposalRead(env.DB,who,demand.site,8)}
        }
        if(new URL(back,url.origin).pathname==='/app/access')displayed={access:await customAccessRead(env.DB,who)}
        const response=withClockCookie(await renderApp(await state(request,env,who,back.startsWith('/app/chat')), back, { message: name==='policy.preview'?'Preview ready. Review the changes below before applying.':'Saved.', result: displayed }), name.startsWith('clockbrowser.') ? result : null)
        if(name==='kiosk.enroll')response.headers.append('set-cookie',String((result as any).cookie))
        return response
      }
      if (path === '/api/lanyard/command' || path === '/api/lanyard/agent/command') {
        const body = await inputBody(request)
        if (typeof body.name !== 'string' || !body.input || typeof body.input !== 'object' || Array.isArray(body.input)) fail('Provide a command name and input object')
        if (isAgent && !['roster.prepare', 'time.prepare', 'payroll.prepare', 'learn.propose'].includes(String(body.name))) fail('Agents can only prepare drafts', 403)
        const result = await execute(request, env, who, String(body.name), body.input as Record<string, unknown>)
        if (String(body.name).startsWith('clockbrowser.')) { const { token, ...shown } = result as Record<string, unknown>; return withClockCookie(json(shown), result) }
        if(String(body.name)==='kiosk.enroll'){const {cookie,...shown}=result as any;const response=json(shown);response.headers.append('set-cookie',cookie);return response}
        return json(result)
      }
    }
    return json({ error: 'Not found' }, 404)
  } catch (error) {
    const status = Number((error as any)?.status) || 500
    const message = status < 500 ? (error as Error).message : 'Could not save this change. Refresh and try again.'
    if (path === '/app/action' && who && !auditOnly) return renderApp(await state(request,env,who,back.startsWith('/app/chat')), back, { error: message, ...((policyInput||workerInput)?{result:{policyInput,workerInput}}:{}) })
    if (pages.has(path) && status === 401) return new Response(null, { status: 303, headers: { ...headers, location: '/signin?returnTo=' + encodeURIComponent(path) } })
    return json({ error: message }, status)
  }
}

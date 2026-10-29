import {command} from './domain'
import {load} from './domain/storage'
import {keys,need,sha} from './domain/model'
import {partnerPrincipal} from './partner-credentials'
import {currentPartner} from './partner-scope'

export async function partnerApi(request:Request,db:D1Database) {
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/lanyard\/partner\/([^/]+)\/(context|roster-drafts)$/)
 need(match,'Partner route not found',404)
 const a=await partnerPrincipal(request,db,match![1])
 if(match![2]==='context'){
  need(request.method==='GET','Method not allowed',405)
  const s=await load(db),site=a.partner!.site,staff=s.staff.filter(p=>p.active&&!p.erased_at&&p.site===site),ids=new Set(staff.map(p=>p.id))
  await currentPartner(db,a)
  return {apiVersion:a.partner!.version,scope:'roster.prepare',site,contextVersion:s.version,timezone:s.timezone,
   staff:staff.map(({id,name,position,site})=>({id,name,position,site})),
   availability:s.availability.filter(w=>ids.has(w.staffId)).map(({staffId,start,end})=>({staffId,start,end})),
   jobs:s.jobs.map(({id,name})=>({id,name}))}
 }
 need(request.method==='POST','Method not allowed',405)
 need(request.headers.get('content-type')?.split(';')[0].trim()==='application/json','Use JSON',415)
 const identity=request.headers.get('idempotency-key')??''
 need(/^[A-Za-z0-9-]{8,100}$/.test(identity),'Provide an Idempotency-Key of 8 to 100 letters, digits or hyphens')
 const raw=new Uint8Array(await request.arrayBuffer())
 need(raw.byteLength<=200_000,'Request is too large',413)
 let body:any
 try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{need(false,'Invalid JSON')}
 need(body&&typeof body==='object'&&!Array.isArray(body),'Expected an object')
 keys(body,['contextVersion','week','shifts'])
 need(Number.isSafeInteger(body.contextVersion)&&body.contextVersion>=0,'Provide contextVersion from a current partner context')
 const commandId='partner-'+await sha(JSON.stringify([a.partner!.keyId,a.partner!.version,identity])),digest=await sha(raw)
 return command(db,a,'roster.prepare',{week:body.week,shifts:body.shifts},undefined,undefined,undefined,undefined,undefined,{commandId,digest,contextVersion:body.contextVersion})
}

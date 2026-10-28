import {approvedTipPools,pooledDeclarations,tipPoolCurrent} from './tip-pools'
// TIPS-002: tip credit and minimum-wage make-up checks. The owner (payroll administrator until
// TEAM-001/ACCESS-003) records a cafe's tip-credit setup from an inclusive venue date: its US state,
// the minimum wage that applies there (employer-entered, at least the federal $7.25; Lanyard keeps
// no state or local rates) and the jobs whose work produces tips. A state that bars a tip credit
// refuses the setup. Each workweek (Monday to Sunday on the venue calendar until PAY-009) a person
// with approved minutes in a tipped job at a cafe with a setup in force is checked: those minutes at
// the cafe's minimum wage against the same minutes at their retained job rates plus the CLOCK-006
// cash tips declared on those punches. A shortfall is a make-up pay input; minutes in the cafe's
// other jobs are reported as non-tipped duty time for the employer's own dual-jobs treatment.
import {type Actor,type Context,type Row,type State,keys,text,need,exact,put} from './model'
import {date,dayAfter,mayReadPerson} from './aca'
import {cents} from './people'
import {workweek} from './payschedules'
import {tipPieces} from './tip-work'

export const STATES:Record<string,string>={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'}
/** States whose law bars a tip credit: tipped employees there are paid the full minimum wage in cash. */
export const NO_TIP_CREDIT=['CA','WA','OR','NV','MN','AK','MT']
/** The federal minimum wage (FLSA, 29 U.S.C. 206), the floor for any cafe's entered minimum wage. */
export const FEDERAL_MINIMUM=725
const MONDAY=(d:string)=>dayAfter(d,-((new Date(d+'T00:00:00Z').getUTCDay()+6)%7))
const pay=(minutes:number,rate:number)=>Math.round(minutes*rate/60)

/** The cafe's setup version in force on a venue date: the latest one starting on or before it. */
export function setupOn(s:State,site:string,day:string) {
 return s.tipcredits.find(r=>r.site===site)?.versions.filter((v:any)=>v.from<=day).at(-1)
}
export function tipCredit(c:Context,name:string,p:Record<string,any>) {
 if(name!=='tipcredit.save')return undefined
 need(c.a.role==='owner','Only the payroll administrator (the owner) can do this',403)
 keys(p,['id','revision','site','state','minimumWage','from','tippedJobs'])
 const site=text(p.site,'cafe',80),state=text(p.state,'state',2).toUpperCase()
 need(Object.hasOwn(STATES,state),'Choose a US state or DC')
 need(!NO_TIP_CREDIT.includes(state),`${STATES[state]} bars a tip credit: pay tipped employees there at least the full minimum wage in cash`,409)
 const minimum=cents(p.minimumWage);need(minimum!==null&&minimum>=FEDERAL_MINIMUM,'Enter the minimum wage that applies at this cafe: at least the federal $7.25')
 const from=date(p.from,'effective date'),list=Array.isArray(p.tippedJobs)?p.tippedJobs:p.tippedJobs?[p.tippedJobs]:[]
 need(list.length>0&&list.length<=100,'Choose the jobs whose work produces tips')
 const tippedJobs=[...new Set(list.map((v:unknown)=>text(v,'tipped job',80)))];need(tippedJobs.every(id=>c.s.jobs.some(j=>j.id===id)),'Job not found',404)
 const old=c.s.tipcredits.find(r=>r.site===site)
 if(old){need(p.id===old.id,'This cafe already has a tip-credit setup; change it from a date instead',409);exact(old,p)}else need(!p.id,'Tip-credit setup not found',404)
 // A version from the same date replaces that version; earlier ones keep checking their weeks.
 const versions=[...(old?.versions??[]).filter((v:any)=>v.from!==from),{from,state,minimumWageCents:minimum,tippedJobs,savedBy:c.a.id,savedAt:c.now}].sort((a:any,b:any)=>a.from.localeCompare(b.from))
 return put(c,'tipcredits',{site,versions},old)
}

/** Each checked person-week for the given Mondays that this reader may read (the person's wages: the owner, or a manager of their home cafe). */
export function tipChecks(s:State,a:Actor,weeks:string[]) {
 if(!s.tipcredits.length)return []
 const pooled=pooledDeclarations(s),rows=new Map<string,any>(),job=(id:string)=>s.jobs.find(j=>j.id===id)?.name??(id||'No job')
 const row=(staffId:string,week:string)=>{const k=staffId+'|'+week;if(!rows.has(k))rows.set(k,{week,staffId,tippedMinutes:0,requiredCents:0,cashWageCents:0,tipsCents:0,declaredTipsCents:0,allocatedTipsCents:0,poolReviewRequired:false,rateMissing:false,sites:new Map<string,any>(),nonTipped:new Map<string,any>(),sources:[],tipSources:[]});return rows.get(k)}
 for(const t of s.timesheets) {
  if(t.status!=='approved')continue
  let tipWeek:string|null=null;const touched=new Set<string>()
  for(const x of tipPieces(s,t)) {
   const v=setupOn(s,x.site,x.date),week=workweek(s,t.staffId,x.date);if(!v)continue
   const tipped=v.tippedJobs.includes(x.job);if(tipped)tipWeek??=week
   if(!weeks.includes(week))continue
   const r=row(t.staffId,week);touched.add(week);r.sites.set(x.site,{site:x.site,state:v.state,stateName:STATES[v.state],from:v.from,minimumWageCents:v.minimumWageCents})
   if(tipped) {
    r.tippedMinutes+=x.minutes;r.requiredCents+=pay(x.minutes,v.minimumWageCents)
    if(x.cents===null)r.rateMissing=true;else r.cashWageCents+=pay(x.minutes,x.cents)
   } else {const k=x.job+'|'+x.site,n=r.nonTipped.get(k);r.nonTipped.set(k,{job:x.job,jobName:job(x.job),site:x.site,minutes:(n?.minutes??0)+x.minutes})}
  }
  for(const week of touched)row(t.staffId,week).sources.push({timesheetId:t.id,revision:t.revision,start:t.start})
  // CLOCK-006 cash tips stay on the punch's own timesheet (its lineage root) and count in the week of its first tipped minute.
  const root=s.timesheets.find(x=>x.id===t.rootId)??t,tips=(root.answers??[]).filter((x:any)=>x.kind==='tips'&&typeof x.value==='number')
  if(!pooled.has(root.id)&&tipWeek&&tips.length&&weeks.includes(tipWeek)){const r=row(t.staffId,tipWeek);for(const x of tips){r.tipsCents+=x.value;r.declaredTipsCents+=x.value;r.tipSources.push({timesheetId:root.id,start:t.start,question:x.text,cents:x.value})}}
 }
 for(const pool of approvedTipPools(s))for(const a of pool.allocations){
  const week=workweek(s,a.staffId,pool.date),r=rows.get(a.staffId+'|'+week)
  if(r&&weeks.includes(week)&&setupOn(s,pool.site,pool.date)?.tippedJobs.includes(a.job)){r.poolReviewRequired||=!tipPoolCurrent(s,pool);r.tipsCents+=a.cents;r.allocatedTipsCents+=a.cents;r.tipSources.push({poolId:pool.id,revision:pool.revision,start:pool.date,timesheetId:'',cents:a.cents})}
 }
 return [...rows.values()].filter(r=>r.tippedMinutes>0&&(a.role==='owner'||mayReadPerson(s,a,r.staffId))).map(r=>{const person=s.staff.find(p=>p.id===r.staffId)
  const order=(x:any,y:any)=>x.start.localeCompare(y.start)||x.timesheetId.localeCompare(y.timesheetId)
  return {...r,sources:r.sources.sort(order),tipSources:r.tipSources.sort(order),name:person?.name??'Former staff',payrollId:person?.payroll_id??null,sites:[...r.sites.values()],nonTipped:[...r.nonTipped.values()],nonTippedMinutes:[...r.nonTipped.values()].reduce((n:number,x:any)=>n+x.minutes,0),
   makeUpCents:r.rateMissing||r.poolReviewRequired?null:Math.max(0,r.requiredCents-r.cashWageCents-r.tipsCents)}
 }).sort((x,y)=>y.week.localeCompare(x.week)||x.name.localeCompare(y.name))
}
const usd=(v:number|null)=>v===null?'':(v/100).toFixed(2)
const cell=(v:unknown)=>{let t=String(v??'');if(/^[\s]*[=+\-@\t\r]/.test(t))t="'"+t;return /[",\r\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t}
/** The make-up pay inputs as a file for the payroll provider; Lanyard does not pay them. */
export function tipCsv(rows:any[]) {
 const pools=rows.some(r=>r.allocatedTipsCents>0)
 return 'week_start,payroll_id,name,tipped_minutes,minimum_wage_due_usd,cash_wage_usd,declared_tips_usd,make_up_pay_input_usd,non_tipped_minutes'+(pools?',allocated_tips_usd':'')+'\r\n'+rows.map(r=>[r.week,r.payrollId,r.name,r.tippedMinutes,usd(r.requiredCents),usd(r.cashWageCents),usd(r.declaredTipsCents),r.poolReviewRequired?'pool review required':r.rateMissing?'rate missing':usd(r.makeUpCents),r.nonTippedMinutes,...(pools?[usd(r.allocatedTipsCents)]:[])].map(cell).join(',')).join('\r\n')+'\r\n'
}

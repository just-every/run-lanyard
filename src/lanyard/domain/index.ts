import {offerTimingRead} from './learn-offers'
import {generateDemand,demandGenerationCommand,generationPublication} from './demand-generator'
import {currentPartner} from '../partner-scope'
import {partnerRoster,partnerDraft,partnerReplay,type PartnerRequest} from './partner-roster'
import {tipPoolCommand} from './tip-pools'
import {reportScheduleCommand} from './report-schedules'
import {recordRetentionCommand} from './record-retention'
import {auditAccessCommand,auditRestricted} from './audit-access'
import {retainAudit} from './audit-retention'
import {organization} from './organization'
import {fairworkCommand} from './fairwork'
import {aiCommand,aiSchedulesFor} from './ai-schedules'
import {type AiConfiguration} from './ai-provider'
import {unbase64} from './payxlsx'
import {fileExtension} from './paytemplates'
import {privacyCommand} from './privacy'
import {policyWorkerCommand} from './policy-coverage'
import {policyCommand} from './policy-commands'
import {geofenceCommand,locationBefore,locationReceipt,locationReplay,locationsForTime} from './geofence'
import {photoCommand,photoBefore,photoReceipt,photosForTime} from './photos'
import {sickCommand,sickReports} from './sick'
import {minorCommand,checkMinorAssignments} from './minors'
import {differentialCommand} from './differentials'
import {clockLanguage,kioskCheck,kioskReceipt} from './kiosk'
import {chatCommand} from './chat'
import {accessCommand,authorizeCommand,authorizeResult,commandTargets,wholeSiteAllowed,restricted,accessView,wageRedact,allowed} from './access'
import {noticeCommand,reconcileNotices,noticesFor,scheduleNoticeCommand,reconcileScheduleNotices,scheduleNoticesFor} from './notices'
import {demandRule,demandCommand} from './demand'
import {demandReport} from './demand-compare'
import {learnCommand,learnEvaluate,learnDigest} from './learn-propose'
import {learningReport} from './learning'
import {fairnessCommands} from './fairness-policy'
import {compareFairness,fairnessPrepare} from './fairness-optimizer'
import {preferenceReport} from './fairness'
import {type Actor,type Context,type State,kinds,object,text,need,sha,canonical,get,manager,instant} from './model'
import {actor,live,load,saved,commit} from './storage'
import {offline,issuesFor} from './offline'
import {people} from './people'
import {shiftWork,workFor,answersFor} from './shiftwork'
import {checkSegmentAssignments} from './worksegments'
import {handoverFile} from './shiftworkfiles'
import {roster,draftWeek} from './roster'
import {scheduleReview} from './schedule-review'
import {time} from './time'
import {transfers} from './transfers'
import {payroll} from './payroll'
import {settings} from './settings'
import {cover} from './cover'
import {coverageCases} from './coverage'
import {forecast} from './forecast'
import {team,teamFor,siteOf} from './team'
import {approvals} from './approvals'
import {clockRules} from './clockrules'
import {leaveRules,allowedDates} from './leaverules'
import {localDate} from './settings'
import {postings} from './postings'
import {mealRules} from './mealrules'
import {templates} from './templates'
import {patterns} from './patterns'
import {postingPdf} from '../print'
import {type Event,readable} from './activity'
import {earnings,earnSettings,earningsOf} from './earnings'
import {rounding} from './rounding'
import {feedback,feedbackFor} from './feedback'
import {journal,notesFor,noteFile} from './journal'
import {swaps,swapOptions} from './swaps'
import {closeRules,provisional} from './closerules'
import {clockNets} from './clocknets'
import {openShifts,openFor} from './openshifts'
import {review} from './review'
import {breaks} from './breaks'
import {overtime,project,cost,alertsFor,upcoming} from './overtime'
import {weekOf} from './openshifts'
import {history,shiftHistory,compare,changeLog,recentChanges} from './history'
import {questions,injuriesFor} from './questions'
import {attendance,board} from './attendance'
import {offerRules,accessToHours} from './offerorder'
import {cutoffCommand,cutoffReports} from './cutoff'
import {periodFor,periods,guardPeriods,signoffCurrent} from './periods'
import {logbook,logFor,searchLog,incidentText,logFile} from './logbook'
import {dashboard} from './dashboard'
import {contacts,mayRead,contactCard} from './contacts'
import {sales,salesSite,salesWeek} from './sales'
import {dayparts,intervalReport} from './intervals'
import {autoRules,autoApprove,preview as autoPreview} from './autorules'
import {aca,plansFor,mayReadPerson} from './aca'
import {acaReports,acaCsv} from './aca-report'
import {workforce,withoutRates,hideRates} from './workforce'
import {tipCredit,tipChecks,tipCsv} from './tipcredit'
import {paySchedules,workweek,overtimeInputs} from './payschedules'
import {premiumCurrent} from './premiums'
import {premiumCommand} from './premium-commands'
import {holidayCalendar} from './holiday-calendar'
import {holidayPay} from './holiday-pay'
import {holidayReviews} from './holidays'
export {actor}
export type {Actor} from './model'
const commands=['learn.offer.propose','learn.offer.decide','learn.offer.revert','demand.generate.prepare','cutoff.save','schedule.notice.acknowledge','tip.pool.prepare','tip.pool.approve','report.schedule.save','report.schedule.pause','report.delivery.revoke','privacy.recordDuty','privacy.records.review','access.audit.grant','access.audit.revoke','audit.retain','organization.business.save','organization.location.save','organization.department.save','organization.member.save','fairwork.save','fairwork.preview','ai.consent','ai.extract','ai.review','ai.prepare','ai.erase','payroll.input.save','payroll.template.save','privacy.review','privacy.retention','privacy.hold','privacy.export','privacy.erase','policy.save','policy.preview','policy.review','policy.worker.preview','policy.worker.save','geofence.save','location.review','location.hold','location.erase','photo.save','photo.hold','photo.erase','sicktransfer.prepare','sicktransfer.withdraw','sicktransfer.consent','sicktransfer.decide','sickpolicy.save','sickworker.save','sick.request','sick.decide','sick.correct','minor.save','differential.save','clocklanguage.save','chat.create','chat.removeMember','chat.leave','chat.send','chat.acknowledge','access.level.save','access.defaults.create','access.grant','access.revoke','access.restore','learn.propose','learn.decide','learn.revert','demandrule.save','demand.save','demand.override','noticerule.save','fairness.policy.save','fairness.cohort.save','fairness.request.save','fairness.prepare','premiumrule.save','premium.prepare','premium.decide','holiday.seed','holiday.save','holidayrule.save','holidaypay.approve','holidaypay.correct','paygroup.save','paygroup.period','clock.report','clock.recover','clockissue.resolve','cover.reopen','autorule.save','autorule.authorize','autorule.pause','autorule.revoke','daypart.save','sales.save','sales.preview','sales.import','contact.save','log.save','log.read','period.save','period.signoff','period.lock','period.reopen','period.close','offerrule.save','openshift.decline','settings.save','staff.save','staff.erase','availability.save','leave.request','leave.decide','roster.prepare','roster.publish','shift.confirm','clock.in','clock.out','time.prepare','time.approve','payroll.prepare','payroll.export','payroll.acknowledge','forecast.save','shift.callout','cover.respond','cover.approve','team.visibility','time.approveMany','clockrule.save','leaverule.save','schedule.post','mealrule.save','template.save','template.apply','roster.copy','recurrence.save','recurrence.apply','availability.policy','pattern.save','pattern.decide','earnings.save','roundrule.save','feedback.submit','feedback.reply','feedback.settings','note.save','swap.propose','swap.respond','swap.withdraw','swap.decide','closerule.save','time.confirm','clocknet.save','openshift.post','openshift.request','openshift.approve','time.edit','time.return','time.resubmit','time.request','time.acknowledge','time.resolve','breakrule.save','clock.breakStart','clock.breakEnd','clock.transfer','overtime.substitute','shift.change','shift.cancel','question.save','injury.resolve','attendrule.save','attendance.acknowledge','tipcredit.save']
function fresh(a:Actor,s:State) {
 if(a.role==='owner'||a.role==='agent')return a
 const person=s.staff.find(v=>v.id===a.staffId&&v.email.toLowerCase()===a.email.toLowerCase()&&v.active&&!v.erased_at)
 need(person,'Staff access revoked',403);return {...a,role:person.role}
}
export async function command(db:D1Database,identity:Actor,name:string,input:unknown,secret?:string,net?:Context['net'],files?:R2Bucket,kiosk?:Context['kiosk'],aiConfig?:AiConfiguration,partnerRequest?:PartnerRequest):Promise<object> {
 need(commands.includes(name)||['aca.plan.save','aca.credit.save','job.save','workforce.save','shiftwork.save','shiftwork.respond'].includes(name),'Unknown command',404);const a=await live(db,identity),p=object(input)
 if(a.partner){need(name==='roster.prepare'&&partnerRequest,'Partner credentials prepare roster drafts only',403);await currentPartner(db,a)}
 if(a.role==='agent')need(['roster.prepare','time.prepare','payroll.prepare','learn.propose'].includes(name),'Agents may prepare drafts only; a human manager must approve',403)
 need(!auditRestricted(await load(db),a),'Audit readers cannot perform operational mutations',403)
 const commandId=partnerRequest?.commandId??(name.startsWith('clock.')?text(p.commandId,'commandId',120):crypto.randomUUID()),digest=partnerRequest?.digest??await sha(canonical({name,input:p,...(kiosk?{kioskDevice:kiosk.deviceId,photoDigest:kiosk.photo?await sha(kiosk.photo):null,photoFailure:kiosk.photoFailure??null}:{})}))
 // Kiosk authority is rechecked before returning a saved result.
 const previous=kiosk?null:await saved(db,commandId,a,digest);if(previous){if(a.partner){const state=await load(db);partnerReplay(state,a,previous);await currentPartner(db,a)}locationReplay(await load(db),previous,net);return previous}
 const before=await load(db),s=structuredClone(before),c:Context={a:fresh(a,s),s,db,now:new Date().toISOString(),sql:[],entity:'',secret,net,files,kiosk,rollback:[]}
 try {
 await kioskCheck(c,name,p)
 if(kiosk){const previous=await saved(db,commandId,a,digest);if(previous)return previous}
 if(a.partner)partnerRoster(s,a,p,partnerRequest!)
 authorizeCommand(c,name,p)
 const pendingLocation=locationBefore(c,name,p)
 const pendingPhoto=photoBefore(c,name,p)
 let result:any=await tipPoolCommand(c,name,p)
 if(result===undefined)result=await reportScheduleCommand(c,name,p)
 if(result===undefined)result=auditAccessCommand(c,name,p)
 if(result===undefined)result=await aiCommand(c,name,p,aiConfig)
 if(result===undefined)result=await retainAudit(c,name,p)
 if(result===undefined)result=organization(c,name,p)
 if(result===undefined)result=fairworkCommand(c,name,p)
 if(result===undefined)result=recordRetentionCommand(c,name,p)
 if(result===undefined)result=await privacyCommand(c,name,p)
 if(result===undefined)result=await policyWorkerCommand(c,name,p)
 if(result===undefined)result=await policyCommand(c,name,p)
 if(result===undefined)result=await geofenceCommand(c,name,p)
 if(result===undefined)result=await photoCommand(c,name,p)
 if(result===undefined)result=sickCommand(c,name,p)
 if(result===undefined)result=minorCommand(c,name,p)
 if(result===undefined)result=differentialCommand(c,name,p)
 if(result===undefined)result=clockLanguage(c,name,p)
 if(result===undefined)result=await chatCommand(c,name,p)
 if(result===undefined)result=accessCommand(c,name,p)
 if(result===undefined)result=scheduleNoticeCommand(c,name,p)
 if(name==='schedule.notice.acknowledge'&&before.schedulenotices.some(n=>n.id===p.id&&n.acknowledgedAt))return {ok:true,result,version:before.version}
 if(result===undefined)result=noticeCommand(c,name,p)
 if(result===undefined)result=demandRule(c,name,p)
 if(result===undefined)result=await demandCommand(c,name,p)
 if(result===undefined)result=await learnCommand(c,name,p)
 if(result===undefined)result=fairnessCommands(c,name,p)
 if(result===undefined)result=await fairnessPrepare(c,name,p)
 if(result===undefined)result=await demandGenerationCommand(c,name,p)
 await generationPublication(c,name,p)
 if(result===undefined)result=premiumCommand(c,name,p)
 if(result===undefined)result=holidayCalendar(c,name,p)
 if(result===undefined)result=holidayPay(c,name,p)
 if(result===undefined)result=paySchedules(c,name,p)
 if(result===undefined)result=settings(c,name,p)
 if(result===undefined)result=await people(c,name,p)
 if(result===undefined)result=roster(c,name,p)
 if(result===undefined)result=await shiftWork(c,name,p)
 if(result===undefined)result=time(c,name,p)
 if(result===undefined)result=transfers(c,name,p)
 if(result===undefined)result=await offline(c,name,p)
 if(result===undefined)result=await payroll(c,name,p)
 if(result===undefined)result=cover(c,name,p)
 if(result===undefined)result=forecast(c,name,p)
 if(result===undefined)result=team(c,name,p)
 if(result===undefined)result=approvals(c,name,p)
 if(result===undefined)result=clockRules(c,name,p)
 if(result===undefined)result=leaveRules(c,name,p)
 if(result===undefined)result=postings(c,name,p)
 if(result===undefined)result=mealRules(c,name,p)
 if(result===undefined)result=templates(c,name,p)
 if(result===undefined)result=patterns(c,name,p)
 if(result===undefined)result=earnings(c,name,p)
 if(result===undefined)result=rounding(c,name,p)
 if(result===undefined)result=await feedback(c,name,p)
 if(result===undefined)result=await journal(c,name,p)
 if(result===undefined)result=swaps(c,name,p)
 if(result===undefined)result=closeRules(c,name,p)
 if(result===undefined)result=clockNets(c,name,p)
 if(result===undefined)result=openShifts(c,name,p)
 if(result===undefined)result=breaks(c,name,p)
 if(result===undefined)result=overtime(c,name,p)
 if(result===undefined)result=history(c,name,p)
 if(result===undefined)result=questions(c,name,p)
 if(result===undefined)result=attendance(c,name,p)
 if(result===undefined)result=offerRules(c,name,p)
 if(result===undefined)result=cutoffCommand(c,name,p)
 if(result===undefined)result=periods(c,name,p)
 if(result===undefined)result=await logbook(c,name,p)
 if(result===undefined)result=contacts(c,name,p)
 if(result===undefined)result=await sales(c,name,p)
 if(result===undefined)result=dayparts(c,name,p)
 if(result===undefined)result=await autoRules(c,name,p)
 if(result===undefined)result=aca(c,name,p)
 if(result===undefined)result=workforce(c,name,p)
 if(result===undefined)result=tipCredit(c,name,p)
 need(result!==undefined,'Unknown command',404)
 authorizeResult(c,name,result)
 result=locationReceipt(c,name,p,result,pendingLocation)
 result=photoReceipt(c,name,p,result,pendingPhoto)
 const capture=kioskReceipt(c,name,p,result);if(capture)result={...capture.result,kioskReceipt:capture.receipt}
 if(['roster.publish','shift.change','cover.approve','swap.decide','overtime.substitute','openshift.approve'].includes(name)){checkSegmentAssignments(s,before);checkMinorAssignments(s,before)}
 // AUTO-001: an active rule approves the clean punched time this command submitted.
 if(!a.partner&&!name.startsWith('ai.'))autoApprove(c,before)
 // TIME-004: whatever the command, time in a locked or closed pay period is rechecked before the write.
 guardPeriods(c,before)
 if(a.role==='agent'&&name==='roster.prepare')result={...result,shifts:result.shifts.map(withoutRates)}
 if(a.role==='agent'&&name==='payroll.prepare') {
  const {csvPreview,csv,lines,...safe}=result as Record<string,any>
  result={...safe,lines:lines.map(({payrollId,rateBasis,...line}:any)=>withoutRates(line))}
 }
 if(!['owner','manager'].includes(a.role)) {
  result=hideRates(result)
  // Retained calibration rules stay behind the native review door, including command receipts.
  const personalOffer=({offerRule,roundId,site,response,...o}:any)=>o
  if(name==='shift.callout')result={...result,offers:result.offers.map(personalOffer)}
  if(name==='cover.respond')result=personalOffer(result)
 }
 if(restricted(s,a)&&!commandTargets(s,name,p).every(x=>allowed(s,a,'wages.view',siteOf(s,x),x.staffId)))result=wageRedact(result)
 if(a.partner)result=partnerDraft(result)
 await reconcileScheduleNotices(c,before,name,p)
 const ownerRow=await db.prepare("SELECT id,email FROM oa_operators WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1").first<{id:string;email:string}>()
 if(ownerRow)await reconcileNotices(c,await actor(db,{userId:ownerRow.id,email:ownerRow.email,isOwner:true}))
 return await commit(c,before,name,commandId,digest,result)
 } catch(error) {
  for(const rollback of c.rollback??[])await rollback()
  throw error
 }
}
export async function snapshot(db:D1Database,identity:Actor,secret?:string,earningsWeek?:string):Promise<object> {
 const a0=await live(db,identity),events=a0.role==='agent'?null:db.prepare('SELECT id,actor_id AS actorId,actor_role AS actorRole,action,entity_id AS entityId,at FROM l_events ORDER BY at DESC,id DESC').all<Event>()
 const s=await load(db),native=fresh(a0,s),a=restricted(s,native)?{...native,role:'staff' as const}:native,manages=['owner','manager'].includes(a.role),agent=a.role==='agent'
 const staff=s.staff.filter(p=>manages||agent||p.id===a.staffId).map(p=>agent?{id:p.id,name:p.name,active:!!p.active,position:p.position,site:p.site}:{id:p.id,name:p.name,email:p.email,payrollId:p.payroll_id,role:p.role,active:!!p.active,revision:p.version,erasedAt:p.erased_at,position:p.position,site:p.site,...(mayReadPerson(s,a,p.id)||(p.id===a.staffId&&earnSettings(s.earnings).estimates)?{hourlyRateCents:p.rate_cents}:{})})
 const requested=earningsWeek&&/^\d{4}-\d{2}-\d{2}$/.test(earningsWeek)&&new Date(earningsWeek+'T00:00:00Z').getUTCDay()===1&&new Date(earningsWeek+'T00:00:00Z').toISOString().slice(0,10)===earningsWeek?earningsWeek:undefined
 const today=localDate(new Date().toISOString(),s.timezone),offset=(new Date(today+'T00:00:00Z').getUTCDay()+6)%7
 const shown=requested??new Date(Date.parse(today+'T00:00:00Z')-offset*86400000).toISOString().slice(0,10)
 const result:Record<string,any>={actor:{id:a.id,email:agent?undefined:a.email,name:agent?undefined:identity.name,role:a.role,staffId:a.staffId},version:s.version,settings:{timezone:s.timezone},staff}
 result.ownEarnings=!agent&&a.staffId?{...earningsOf(a.staffId,shown,s.timezone,s.shifts,s.timesheets,s.staff.find(p=>p.id===a.staffId)?.rate_cents??null,earnSettings(s.earnings),s),requestedWeek:shown}:null
 for(const k of kinds)result[k]=s[k]
 for(const k of ['businesses','locations','departments','orgmemberships'] as const)result[k]=a.role==='owner'?s[k]:[]
 result.aischedules=aiSchedulesFor(s,a)
 for(const k of ['reportschedules','reportdeliveries'] as const)result[k]=a.role==='owner'?s[k]:[]
 result.recordduties=a.role==='owner'?s.recordduties:[]
 result.auditgrants=a.role==='owner'?s.auditgrants:[]
 result.auditpackets=a.role==='owner'?s.auditpackets.map(({report,csv,...summary})=>summary):[]
 result.cutoffs=a.role==='owner'?s.cutoffs:[]
 result.cutoffReports=a.role==='owner'?await cutoffReports(s,a,new Date().toISOString(),db):[]
 result.periodSignoffState=Object.fromEntries(s.periods.map(p=>[p.id,Object.fromEntries(p.signoffs.map((x:any)=>[x.by+'|'+x.role,signoffCurrent(s,p,x)]))]))
 result.paytemplates=a.role==='owner'?s.paytemplates:[]
 result.payinputs=a.role==='owner'?s.payinputs:[]
 result.tippools=a.role==='owner'?s.tippools:[]
 for(const k of ['privacypolicies','privacyholds','privacyresults'] as const)result[k]=a.role==='owner'?s[k]:[]
 result.notices=noticesFor(s,a,new Date().toISOString())
 result.schedulenotices=scheduleNoticesFor(s,a)
 // DEMAND-001: assumptions and saved forecast versions are read with SALES-001's scope; staff and agents none.
 for(const k of ['forecasts','demandrules','demandforecasts','learnproposals','learnoffers'] as const)result[k]=manages?s[k].filter(r=>salesSite(s,a,r.site)):[]
 result.noticerules=manages?s.noticerules.filter(r=>salesSite(s,a,r.site)):[]
 for(const k of ['fairnesspolicies','fairnesscohorts'] as const)result[k]=manages?s[k].filter(r=>salesSite(s,a,r.site)):[]
 result.fairnessrequests=agent?[]:s.fairnessrequests.filter(r=>r.staffId===a.staffId||manages&&mayReadPerson(s,a,r.staffId))
 result.scheduleReviews=manages?s.rosters.filter(r=>r.status==='draft').map(r=>scheduleReview(s,r.week,a)):[]
 result.acaPlans=plansFor(s,a)
 result.acaCredits=manages?s.acaCredits.filter(r=>mayReadPerson(s,a,r.staffId)):[]
 result.acaReports=manages?acaReports(s,a,new Date().toISOString()):[]
 result.rateSnapshots=manages?s.rateSnapshots.filter(r=>mayReadPerson(s,a,r.staffId)):[]
 result.workforce=agent?[]:s.workforce.filter(r=>r.staffId===a.staffId||manages&&mayReadPerson(s,a,r.staffId)).map(r=>!manages&&!earnSettings(s.earnings).estimates?{...r,rates:[],versions:r.versions.map(({rates,...v}:any)=>v)}:r)
 result.paygroups=agent?[]:s.paygroups.filter(g=>manages||g.staffIds.includes(a.staffId)).map(g=>manages?g:{...g,staffIds:[a.staffId]})
 result.premiumrules=agent?[]:s.premiumrules.filter(r=>a.role==='owner'||r.site===(s.staff.find(p=>p.id===a.staffId)?.site??''))
 result.premiuminputs=agent?[]:s.premiuminputs.filter(r=>r.staffId===a.staffId||manages&&mayReadPerson(s,a,r.staffId)).map(r=>({...r,current:premiumCurrent(s,r)}))
 if(!manages&&!earnSettings(s.earnings).estimates)result.premiuminputs=result.premiuminputs.map(hideRates)
 result.photopolicies=agent?[]:s.photopolicies.filter(p=>a.role==='owner'||p.site===(s.staff.find(w=>w.id===a.staffId)?.site??'')||s.shifts.some(x=>x.staffId===a.staffId&&x.status==='published'&&x.site===p.site)).map(({versions,...p})=>p)
 result.photonotices=agent?[]:s.photonotices.filter(p=>a.role==='owner'||p.staffId===a.staffId)
 result.photoreceipts=agent?[]:s.photoreceipts.filter(p=>a.role==='owner'||p.staffId===a.staffId)
 result.photoholds=a.role==='owner'?s.photoholds:[]
 result.policies=a.role==='owner'?s.policies:[]
 for(const k of ['fairworkpolicies','fairworkreviews'] as const)result[k]=a.role==='owner'?s[k]:[]
 result.geofences=a.role==='owner'?s.geofences:agent?[]:s.geofences.filter(p=>p.site===(s.staff.find(w=>w.id===a.staffId)?.site??'')||s.shifts.some(x=>x.staffId===a.staffId&&x.status==='published'&&x.site===p.site))
 result.georeceipts=agent?[]:s.georeceipts.filter(r=>a.role==='owner'||r.staffId===a.staffId)
 result.sickpolicies=a.role==='owner'?s.sickpolicies:agent?[]:s.sickpolicies.filter(p=>p.site===(s.staff.find(x=>x.id===a.staffId)?.site??'')||sickReports(s,localDate(new Date().toISOString(),s.timezone),a.staffId).some(r=>r.policyId===p.id&&r.sources.length)).map(({versions,coverage,workerCoverage,by,at,...p})=>p)
 result.sicktransfers=a.role==='owner'?s.sicktransfers:agent?[]:s.sicktransfers.filter(t=>t.donorId===a.staffId)
 result.sickuses=a.role==='owner'?s.sickuses:agent?[]:s.sickuses.filter(u=>u.staffId===a.staffId)
 if(a.role!=='owner'&&!earnSettings(s.earnings).estimates)result.sickuses=result.sickuses.map(wageRedact)
 result.sickBalances=a.role==='owner'?sickReports(s,localDate(new Date().toISOString(),s.timezone)):agent?[]:sickReports(s,localDate(new Date().toISOString(),s.timezone),a.staffId)
 if(a.role!=='owner'&&!earnSettings(s.earnings).estimates)result.sickBalances=result.sickBalances.map(wageRedact)
 if(a.role!=='owner')result.batches=result.batches.filter((b:any)=>!b.exportTemplate&&!b.lines.some((l:any)=>l.sickLine))
 result.minors=a.role==='owner'?s.minors:[]
 result.differentials=manages?s.differentials.filter(r=>a.role==='owner'||!r.site||r.site===(s.staff.find(p=>p.id===a.staffId)?.site??'')):[]
 result.holidays=agent?[]:s.holidays.filter(r=>a.role==='owner'||r.site===(s.staff.find(p=>p.id===a.staffId)?.site??''))
 result.holidayrules=agent?[]:s.holidayrules.filter(r=>a.role==='owner'||r.site===(s.staff.find(p=>p.id===a.staffId)?.site??''))
 result.holidaypay=agent?[]:s.holidaypay.filter(r=>r.staffId===a.staffId||manages&&mayReadPerson(s,a,r.staffId))
 if(!manages&&!earnSettings(s.earnings).estimates)result.holidaypay=result.holidaypay.map(hideRates)
 result.holidayReviews=manages?holidayReviews(s,new Date().toISOString()).filter(r=>r&&mayReadPerson(s,a,r.staffId)):[]
 result.payOvertime=manages?await overtimeInputs({a,s,db,now:new Date().toISOString(),sql:[],entity:''}):[]
 result.clockissues=issuesFor(s,a)
 result.shiftwork=workFor(s,a)
 result.taskanswers=answersFor(s,a)
 if(!manages&&!agent) {
  for(const k of ['availability','leave','clocks','timesheets','patterns'] as const)result[k]=s[k].filter(r=>r.staffId===a.staffId)
  // Staff see their own published shifts, the ones they called out of and the ones offered to them, never others' hours.
  // COVER-004: a tiered replacement offer reaches the person at its opening time.
  {const now=new Date().toISOString();result.offers=s.offers.filter(o=>o.staffId===a.staffId&&(!o.opensAt||o.opensAt<=now))};const offered=new Set(result.offers.map((o:any)=>o.shiftId))
  result.shifts=s.shifts.filter(r=>r.status==='published'&&(r.staffId===a.staffId||r.callout?.staffId===a.staffId||offered.has(r.id))).map(({callout,...r})=>callout?{...r,callout:{staffId:callout.staffId===a.staffId?callout.staffId:undefined,note:callout.staffId===a.staffId?callout.note:undefined,at:callout.at,covered:Boolean(callout.coveredBy)}}:r)
  const ids=new Set(result.shifts.map((r:any)=>r.rosterId));result.rosters=s.rosters.filter(r=>ids.has(r.id));result.batches=[];result.forecasts=[];result.postings=[];result.templates=[];result.recurrences=[]
  // ROSTER-004: coworkers' published shifts at their cafe, as name, position and start/end only; who is hidden stays private.
  result.team=teamFor(s,a.staffId!);result.teamviews=[]
  // LEAVE-002: the dates they may not request (blackouts, limits already full), never who is off.
  result.leaveDates=allowedDates(s.staff,s.leave,s.leaverules,s.timezone,a.staffId!,localDate(new Date().toISOString(),s.timezone));result.leaverules=[]
 }
 if(agent) {
  result.clocks=[];result.teamviews=[];result.leave=s.leave.filter(r=>r.status==='approved').map(r=>({id:r.id,staffId:r.staffId,start:r.start,end:r.end,status:r.status,revision:r.revision}))
  result.timesheets=s.timesheets.map(({reason,submittedBy,approvedBy,network,answers,editHistory,minorCheck,...r})=>r)
  result.batches=s.batches.filter(b=>!b.exportTemplate&&!b.lines.some((l:any)=>l.sickLine)).map(({csv,csvPreview,lines,reference,...r})=>({...r,lines:lines.map(({payrollId,rateBasis,...l}:any)=>withoutRates(l))}))
 }
 // COVER-001: managers read every swap; a person reads the swaps they are in, with both names, and their own swap choices.
 const named=(w:any)=>({...w,fromName:s.staff.find(p=>p.id===w.fromId)?.name??'Former staff',toName:s.staff.find(p=>p.id===w.toId)?.name??'Former staff'})
 result.swaps=agent?[]:s.swaps.filter(w=>manages||w.fromId===a.staffId||w.toId===a.staffId).map(named)
 result.swapOptions=a.staffId&&!agent?swapOptions(s,a.staffId,new Date().toISOString()):[]
 // COVER-002: managers read every open shift and request; a person reads the open shifts they may request (with their own rate when visible) and their requests.
 if(!manages){result.openshifts=agent?[]:openFor(s,a.staffId!,earnSettings(s.earnings).estimates,new Date().toISOString());result.pickups=agent?[]:s.pickups.filter(x=>x.staffId===a.staffId)}
 // COST-002: managers see projected overtime alerts, and each pending pickup's and swap's projected cost before approval.
 if(manages) {
  const now=new Date().toISOString(),shiftOf=(id:string)=>s.shifts.find(x=>x.id===id)
  result.overtime=upcoming(s,a,now)
  // CLOCK-004: the live attendance board for the manager's cafe (every cafe for the owner).
  result.attendance=board(s,a,now)
  result.coverageCases=coverageCases(s,a,now)
  // DASH-001: today's and this week's operations for the manager's cafe (every cafe for the owner).
  result.dashboard=dashboard(s,a,now)
  // COVER-004: each open shift's access-to-hours standing where its cafe has the rule on.
  result.openshifts=result.openshifts.map((o:any)=>{const x=accessToHours(s,o as any,now);return x?{...o,accessToHours:x}:o})
  result.pickups=result.pickups.map((x:any)=>{const o=s.openshifts.find(v=>v.id===x.openShiftId);return x.status==='requested'&&o?{...x,cost:cost(project(s,x.staffId,localDate(o.start,s.timezone),now,[{...o,staffId:x.staffId} as any]))}:x})
  result.swaps=result.swaps.map((w:any)=>{if(!['proposed','accepted'].includes(w.status))return w;const give=shiftOf(w.give.shiftId),take=w.take?shiftOf(w.take.shiftId):undefined
   const moves=[...(give?[{to:w.toId,shift:give,skip:take?[take.id]:[]}]:[]),...(take&&give?[{to:w.fromId,shift:take,skip:[give.id]}]:[])]
   return {...w,cost:moves.map(m=>cost(project(s,m.to,localDate(m.shift.start,s.timezone),now,[m.shift],m.skip)))}})
 }
 // Retained learning facts grant no new offer-log access to agents or foreign readers.
 result.offers=result.offers.map((o:any)=>{if(manages&&salesSite(s,a,o.site??siteOf(s,s.shifts.find(r=>r.id===o.shiftId)??{})))return o;const {offerRule,roundId,site,response,...personal}=o;return personal})
 // COVER-003: pending offers expire at shift end; history stays intact.
 result.offers=result.offers.map((o:any)=>{const x=s.shifts.find(x=>x.id===o.shiftId);return x?{...o,legacy:!Number.isInteger(o.shiftRevision),expiresAt:x.end,status:['sent','accepted'].includes(o.status)&&x.end<=new Date().toISOString()?'expired':o.status}:o})
 if(!manages)result.coverageCases=[]
 // CLOCK-004: who is handling an attendance alert is for managers only.
 if(!manages)result.attendacks=[]
 // COVER-004: employment type and start date: managers read everyone's, a person their own; agents none.
 result.employment=agent?[]:s.employment.filter(r=>manages||r.staffId===a.staffId)
 if(!manages)result.offerrules=[]
 // TIME-004: a person reads each pay period with only their own signoff and locked rows.
 if(!manages)result.periods=s.periods.map(r=>periodFor(a,r))
 // CLOCK-006: injury answers and their follow-ups only for the employee, the owner and that cafe's managers.
 result.injuries=injuriesFor(s,a)
 // SCHEDULE-006: shift history from last week on (managers every line; an employee the lines they were assigned).
 if(!agent){const now=new Date().toISOString();result.shiftChanges=recentChanges(s,a,new Date(Date.parse(weekOf(s,now)+'T00:00:00Z')-7*86400000).toISOString().slice(0,10))}
 // MOBILE-002 uses the same retained work-cafe boundary for desktop and phone review.
 if(a.role==='manager'){
  const home=s.staff.find(p=>p.id===a.staffId)?.site??''
  for(const k of ['timesheets','leave','patterns','availability'] as const)result[k]=result[k].filter((r:any)=>siteOf(s,r)===home)
  result.swaps=result.swaps.filter((r:any)=>r.give.site===home&&(!r.take||r.take.site===home))
  result.openshifts=result.openshifts.filter((r:any)=>r.site===home)
  result.pickups=result.pickups.filter((r:any)=>s.openshifts.some(o=>o.id===r.openShiftId&&o.site===home))
  result.clocks=result.clocks.filter((r:any)=>siteOf(s,s.shifts.find(x=>x.id===r.shiftId)??r)===home)
 }
 // TIME-009: managers see each waiting timesheet's approval review.
 if(manages)result.timesheets=result.timesheets.map((t:any)=>t.status==='submitted'?{...t,review:review(s,t)}:t)
 if(a.role==='owner')result.timesheets=result.timesheets.map((t:any)=>({...t,photoReview:photosForTime(s,t)}))
 if(!agent)result.timesheets=result.timesheets.map((t:any)=>{const locations=a.role==='owner'||t.staffId===a.staffId?locationsForTime(s,t):[];return locations.length?{...t,locationReview:locations}:t})
 // TIME-007: each open punch past its point shows its provisional end; the person sees it as their reminder.
 {const now=new Date().toISOString();result.clocks=result.clocks.map((k:any)=>{const mark=provisional(s,k,now);return mark?{...k,provisional:mark}:k})}
 // FEEDBACK-001: each reader's own slice; an anonymous author is never named.
 result.feedback=await feedbackFor(s,a,secret);if(agent)result.feedbackopts=[]
 // JOURNAL-001: notes by cafe and role; an employee reads only notes made visible to them.
 result.notes=notesFor(s,a)
 // LOG-001: the owner reads every cafe's logbook, a manager their cafe's; staff and agents none.
 result.logbook=logFor(s,a)
 // CONTACT-001: everyone reads only their own emergency contacts here; others' open only through the audited card read.
 result.contacts=agent?[]:s.contacts.filter(r=>r.staffId===a.staffId)
 // SALES-001: the owner reads every cafe's entered sales, a manager their home cafe's; staff and agents none.
 result.sales=manages?s.sales.filter(r=>salesSite(s,a,r.site)):[]
 // REPORT-003: dayparts and their targets with the same readers as sales.
 // AUTO-001: rules are the owner's; managers see them to know which time a rule may approve.
 if(!manages)result.autorules=[]
 if(a.role==='owner'){const now=new Date().toISOString();result.autorulePreviews=await Promise.all(s.autorules.filter(r=>r.status!=='revoked').map(r=>autoPreview(s,r,now)))}
 result.dayparts=manages?s.dayparts.filter(r=>!r.removed&&salesSite(s,a,r.site)):[]
 // TIPS-002: cafe tip-credit setups and the last five workweeks' checks for the owner and managers (rows for people whose wages they may read).
 result.tipcredits=manages?s.tipcredits:[]
 {const week=weekOf(s,new Date().toISOString());result.tipChecks=manages?tipChecks(s,a,Array.from({length:35},(_,n)=>new Date(Date.parse(week+'T00:00:00Z')-n*86400000).toISOString().slice(0,10))):[]}
 const scopedRates=(r:any)=>manages&&mayReadPerson(s,a,r.staffId)?r:{...withoutRates(r),differentialBasis:!agent&&r.staffId===a.staffId&&earnSettings(s.earnings).estimates?(r.differentialBasis??[]).map((p:any)=>({date:p.date,minutes:p.minutes,costCents:p.costCents,baseCostCents:p.baseCostCents,additions:p.additions.map(()=>({}))})):[],holidayBasis:!agent&&r.staffId===a.staffId?(earnSettings(s.earnings).estimates?r.holidayBasis:hideRates(r.holidayBasis??[])):[]}
 result.shifts=result.shifts.map(scopedRates);result.timesheets=result.timesheets.map(scopedRates)
 if(a.role==='manager')result.batches=result.batches.map((b:any)=>({...b,lines:b.lines.map(scopedRates)}))
 if(!manages)result.jobs=s.jobs.map(({versions,...r})=>r)
 // AUDIT-001: each role reads only its own slice of the activity list.
 result.events=events?readable(s,a,(await events).results):[]
 result.clocklanguages=agent?[]:s.clocklanguages.filter(r=>r.staffId===a.staffId);result.kioskreceipts=agent?[]:s.kioskreceipts.filter(r=>a.role==='owner'||r.staffId===a.staffId);result.accesslevels=[];result.accessgrants=[];result.chatthreads=[];result.chatmessages=[];result.chatreads=[]
 result.access=agent?null:accessView(s,native)
 return result
}
export async function batchFile(db:D1Database,identity:Actor,id:string,requestedExtension?:string):Promise<{body:string|Uint8Array<ArrayBuffer>;extension:string;contentType:string}> {
 const a=await live(db,identity),s=await load(db),b=get(s,'batches',id);if(restricted(s,a))need(b.lines.length&&b.lines.every((x:any)=>allowed(s,a,'payroll.export',siteOf(s,x),x.staffId)&&allowed(s,a,'wages.view',siteOf(s,x),x.staffId)),'Payroll file permission required',403);else manager(fresh(a,s));need(a.role==='owner'||!b.exportTemplate&&!b.lines.some((l:any)=>l.sickLine),'Only the owner reads mapped or private paid-leave payroll',403);need(['exported','acknowledged'].includes(b.status),'Batch has not been exported',409);need(typeof b.csv==='string'&&await sha(b.fileBase64?unbase64(b.fileBase64):b.csv)===b.sha256,'Stored payroll file integrity check failed',409)
 if(requestedExtension)need(requestedExtension===fileExtension(b.exportTemplate),'Use the original exported file type',409)
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'payroll.download',b.id,new Date().toISOString()).run()
 const extension=fileExtension(b.exportTemplate)
 return {body:b.fileBase64?Uint8Array.from(unbase64(b.fileBase64)):b.csv,extension,contentType:extension==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':extension==='tsv'?'text/tab-separated-values; charset=utf-8':['txt','iif'].includes(extension)?'text/plain; charset=utf-8':'text/csv; charset=utf-8'}
}
/** SCHEDULE-005: the PDF of one posting, rebuilt from the rows it recorded, for owners and managers. */
export async function schedulePdf(db:D1Database,identity:Actor,id:string):Promise<{bytes:Uint8Array<ArrayBuffer>;name:string}> {
 const a=await live(db,identity);manager(a);const s=await load(db);manager(fresh(a,s));const p=get(s,'postings',id)
 return {bytes:postingPdf(p,p.filter.staffId?s.staff.find(v=>v.id===p.filter.staffId)?.name??null:null),name:`lanyard-schedule-${p.week}-r${p.rosterRevision}-${p.id.slice(0,8)}.pdf`}
}
/** COST-002: overtime alerts for one workweek (its Monday) as of an instant, for the owner and the managers it concerns. */
export async function overtimeAlerts(db:D1Database,identity:Actor,week:string,asOf:string) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&weekOf(s,week+'T12:00:00Z')===week,'Choose a week by its Monday (YYYY-MM-DD)')
 return {week,asOf,alerts:alertsFor(s,f,week,instant(asOf,'asOf'))}
}
/** CLOCK-004: the attendance board as of an instant, for the owner and the managers of the cafes on it. */
export async function attendanceBoard(db:D1Database,identity:Actor,asOf:string,site:string) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 return {asOf,rows:board(s,f,instant(asOf,'asOf'),site)}
}
/** SCHEDULE-006 reads: one shift's history, two week revisions compared, and the week's change log CSV. */
export async function scheduleHistory(db:D1Database,identity:Actor,kind:'shift'|'compare'|'log',id:string,from='',to='') {
 const a=await live(db,identity);need(a.role!=='agent','Not found',404);const s=await load(db),f=fresh(a,s)
 return kind==='shift'?shiftHistory(s,f,id):kind==='compare'?compare(s,f,id,from,to):changeLog(s,f,id)
}
/** JOURNAL-001: a note's attachment, for a reader who may read the note. */
export async function noteAttachment(db:D1Database,identity:Actor,noteId:string,fileId:string) {
 const a=await live(db,identity),s=await load(db);return noteFile(db,s,fresh(a,s),noteId,fileId)
}
/** LOG-001 reads: a logbook search, an incident's text export and an entry's attachment, for the owner and that cafe's managers. */
export async function logbookRead(db:D1Database,identity:Actor,kind:'search'|'export'|'file',id='',q:{site?:string;category?:string;month?:string;fileId?:string}={},files?:R2Bucket) {
 const a=await live(db,identity),s=await load(db),f=fresh(a,s)
 if(kind==='search')return searchLog(s,f,q)
 if(kind==='export')return incidentText(s,f,id)
 return logFile(db,s,f,id,q.fileId??'',files)
}
/** DASH-001: the operations dashboard as of an instant, for the owner (every cafe or one) and a manager (their cafe). */
export async function dashboardRead(db:D1Database,identity:Actor,asOf:string,site:string) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 return dashboard(s,f,instant(asOf,'asOf'),site)
}
/** CONTACT-001: a person's emergency contact card; every view and every refused attempt is an activity event naming the reader and the person. */
export async function contactRead(db:D1Database,identity:Actor,staffId:string) {
 const a=await live(db,identity),s=await load(db),f=a.role==='agent'?a:fresh(a,s),ok=mayRead(s,f,staffId)&&(f.staffId===staffId||!restricted(s,f)||allowed(s,f,'contacts.view',s.staff.find(p=>p.id===staffId)?.site??'',staffId))
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,f.role,ok?'contact.view':'contact.refused',staffId,new Date().toISOString()).run()
 need(ok,'Not found',404)
 return contactCard(s,staffId)
}
/** SALES-001: one cafe's week of entered sales beside its scheduled labor, for the owner and that cafe's managers. */
export async function salesRead(db:D1Database,identity:Actor,week:string,site:string) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&weekOf(s,week+'T12:00:00Z')===week,'Choose a week by its Monday (YYYY-MM-DD)')
 const cafe=f.role==='owner'?site:s.staff.find(p=>p.id===f.staffId)?.site??'';need(salesSite(s,f,cafe),'Not found',404)
 return salesWeek(s,week,cafe)
}
/** REPORT-003: one cafe's day by interval (15, 30 or 60 minutes), for the owner and that cafe's managers. */
export async function intervalsRead(db:D1Database,identity:Actor,site:string,date:string,size:number) {
 const a=await live(db,identity),s=await load(db),f=fresh(a,s)
 if(restricted(s,f)){
  need(wholeSiteAllowed(s,f,'reports.view',site),'Report permission required for the whole cafe',403)
  const report=intervalReport(s,site,date,size,new Date().toISOString()),wagesVisible=wholeSiteAllowed(s,f,'wages.view',site)
  if(!wagesVisible)for(const x of report.intervals){for(const group of [x.scheduled,x.actual]){(group as any).cents=null;group.laborPercent=null;for(const position of Object.values(group.byPosition))(position as any).cents=null};(x as any).exceeded=null}
  return {...report,wagesVisible}
 }
 manager(f);const cafe=f.role==='owner'?site:s.staff.find(p=>p.id===f.staffId)?.site??'';need(salesSite(s,f,cafe),'Not found',404)
 return intervalReport(s,cafe,date,size,new Date().toISOString())
}
/** DEMAND-001: a cafe day's forecast, saved versions and outcome, for the owner and that cafe's managers. */
export async function demandRead(db:D1Database,identity:Actor,site:string,date:string) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 const home=s.staff.find(p=>p.id===f.staffId)?.site??'',cafe=f.role==='owner'?site:home,now=new Date().toISOString()
 need(f.role==='owner'||site===''||site===home,'Not found',404)
 return demandReport(s,f,cafe,date||localDate(now,s.timezone),now)
}
/** LEARN-001: the measured evidence and any proposal for one cafe's demand assumptions, for the owner and that cafe's managers; it writes nothing. */
export async function learnProposalRead(db:D1Database,identity:Actor,site:string,weeks:number) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 const home=s.staff.find(p=>p.id===f.staffId)?.site??''
 need(f.role==='owner'||site===''||site===home,'Not found',404)
 const e=learnEvaluate(s,f,f.role==='owner'?site:home,weeks,new Date().toISOString())
 return {...e,digest:await learnDigest(e),proposals:s.learnproposals.filter(r=>r.site===e.site).sort((x,y)=>y.version-x.version)}
}
/** Human-only native timing review; comparison scopes grant no offer-log access. */
export async function learnOfferRead(db:D1Database,identity:Actor,site:string,percentile:unknown) {
 const a=await live(db,identity),s=await load(db),f=fresh(a,s)
 return offerTimingRead(s,f,site,percentile,new Date().toISOString())
}
/** AUTO-001: what a rule would approve now and why the rest stays for a human; it writes nothing. */
export async function autoRulePreview(db:D1Database,identity:Actor,id:string) {
 const a=await live(db,identity);need(a.role==='owner','Owner required',403);const s=await load(db)
 return autoPreview(s,get(s,'autorules',id),new Date().toISOString())
}

/** COVER-003: the manager's coverage cases at an explicit reporting instant. */
export async function coverageRead(db:D1Database,identity:Actor,asOf:string,site:string) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 return coverageCases(s,f,instant(asOf,'asOf'),site)
}

/** Read-only review of unsaved rows through the current native manager authority. */
export async function previewSchedule(db:D1Database,identity:Actor,input:unknown) {
 const a=await live(db,identity),s=await load(db);manager(fresh(a,s));const p=object(input)
 const c={a,s,db,now:new Date().toISOString(),sql:[],entity:''} as import('./model').Context
 draftWeek(c,p.week,p.shifts)
 return scheduleReview(s,String(p.week),a)
}

/** ACA-001: native role/scoped report and an hours file for the filer; no provider action. */
export async function acaRead(db:D1Database,identity:Actor,id:string,asOf:string,format:'json'|'csv') {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 const at=instant(asOf,'asOf');need(at<=new Date().toISOString(),'ACA reports cannot finalize a future reporting date')
 const report=acaReports(s,f,at).find(r=>r.plan.id===id);need(report,'Not found',404)
 if(format==='json')return report
 const csv=acaCsv(report)
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,a.role,'aca.download',id,new Date().toISOString()).run()
 return csv
}

/** TIPS-002: one workweek's tip-credit checks and make-up pay inputs (JSON, or the CSV whose download is recorded), for the owner and managers of each person's home cafe. */
export async function tipCreditRead(db:D1Database,identity:Actor,week:string,format:'json'|'csv') {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 need(/^\d{4}-\d{2}-\d{2}$/.test(week)&&Number.isFinite(Date.parse(week))&&(weekOf(s,week+'T12:00:00Z')===week||s.paygroups.some(g=>g.staffIds.some((id:string)=>workweek(s,id,week)===week))),'Choose a workweek start (YYYY-MM-DD)')
 const rows=tipChecks(s,f,[week])
 if(format==='json')return {week,rows}
 await db.prepare('INSERT INTO l_events(id,actor_id,actor_role,action,entity_id,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),a.id,f.role,'tipcredit.download',week,new Date().toISOString()).run()
 return tipCsv(rows)
}

export async function shiftAttachment(db:D1Database,identity:Actor,answerId:string,fileId:string) {
 const a=await live(db,identity),s=await load(db);return handoverFile(db,answersFor(s,fresh(a,s)),answerId,fileId)
}

/** FAIR-001: read-only preference inputs under the existing cafe report authority. */
export async function fairnessRead(db:D1Database,identity:Actor,week:string,site:string,weeks:number) {
 const a=await live(db,identity),s=await load(db),f=fresh(a,s)
 return preferenceReport(s,f,week,site,weeks)
}

/** FAIR-001: native scoped alternatives; comparison has no writes. */
export async function fairnessCompare(db:D1Database,identity:Actor,week:string,site:string,weeks:number) {
 const a=await live(db,identity),s=await load(db);return compareFairness(s,fresh(a,s),week,site,weeks)
}

/** LEARN-001: native manager forecast outcomes, using the existing SALES-001 cafe scope. */
export async function learningRead(db:D1Database,identity:Actor,week:string,site:string,weeks:number) {
 const a=await live(db,identity);manager(a);const s=await load(db),f=fresh(a,s);manager(f)
 return learningReport(s,f,week,site,weeks,new Date().toISOString())
}

export async function customAccessRead(db:D1Database,identity:Actor){
 const a=await live(db,identity),s=await load(db),v:any=accessView(s,a)
 if(a.role==='agent')return v
 const can=(permission:string,x:any)=>allowed(s,a,permission,siteOf(s,x),x.staffId)
 v.people=s.staff.filter(p=>p.active&&!p.erased_at&&v.sites.some((site:string)=>(p.site===site||s.orgmemberships.some(m=>m.staffId===p.id&&m.locationIds.some((id:string)=>s.locations.some(l=>l.id===id&&l.site===site))))&&(can('draft.view',{site,staffId:p.id})||can('draft.edit',{site,staffId:p.id})))).map(p=>({id:p.id,name:p.name}))
 v.waitingTime=s.timesheets.filter(x=>x.status==='submitted'&&x.staffId!==a.staffId&&can('time.approve',x)).map(x=>({...wageRedact(x),personName:s.staff.find(p=>p.id===x.staffId)?.name??'Former person'}))
 const pay=(x:any)=>can('payroll.export',x)&&can('wages.view',x)
 v.exportableTime=s.timesheets.filter(x=>x.status==='approved'&&pay(x)&&!s.claims.some(cl=>cl.time_id===x.id&&cl.time_revision===x.revision)).map(x=>({...wageRedact(x),personName:s.staff.find(p=>p.id===x.staffId)?.name??'Former person'}))
 v.batches=s.batches.filter(b=>!b.exportTemplate&&!b.lines.some((x:any)=>x.sickLine)&&b.lines.length&&b.lines.every(pay))
 v.reportSites=v.sites.filter((site:string)=>wholeSiteAllowed(s,a,'reports.view',site))
 v.jobs=s.jobs.map(j=>({id:j.id,name:j.name}))
 v.draftSites=v.sites.filter((site:string)=>allowed(s,a,'draft.edit',site))
 v.drafts=s.rosters.filter(r=>r.status==='draft').flatMap(r=>{const shifts=s.shifts.filter(x=>x.rosterId===r.id&&x.status==='draft');return shifts.length&&shifts.every(x=>can('draft.view',x)||can('draft.edit',x))?[{...r,shifts}]:[]})
 v.swaps=s.swaps.filter(w=>commandTargets(s,'swap.decide',{id:w.id}).every(x=>can('swap.approve',x)))
 return a.role==='owner'?v:wageRedact(v)
}

export async function demandGenerationRead(db:D1Database,identity:Actor,p:Record<string,any>){const a=await live(db,identity),s=await load(db);return generateDemand(s,fresh(a,s),p)}

import assert from 'node:assert/strict'
import {days,monday,local,pin} from './workforce-journey.mjs'

export async function learningApi(h) {
 const manager=await h.person('Priya','manager'),staff=await h.person('Alex'),foreign=await h.person('Omar','manager')
 await h.cmd('staff.save',{...pin(foreign),name:foreign.name,email:foreign.email,payrollId:foreign.payrollId,active:true,role:'manager',site:'Elsewhere'})
 const week=days(monday(new Date().toISOString().slice(0,10)),-7)
 const first=await h.cmd('forecast.save',{week,site:'',days:Array(7).fill(1000),budgetPercent:25},manager.cookie,200,{'x-test-now':String(Date.parse(local(days(week,-1),'12:00')))})
 // A later revision cannot improve the measured result by rewriting the forecast after service.
 await h.cmd('forecast.save',{week,site:'',days:Array(7).fill(1200),budgetPercent:25},manager.cookie,200,{'x-test-now':String(Date.parse(local(days(week,7),'12:00')))})
 const entries=[]
 for(const [offset,value] of [[0,'900'],[1,'1100'],[2,'0']])entries.push(await h.cmd('sales.save',{site:'',date:days(week,offset),metric:'sales',value},manager.cookie))
 await h.cmd('sales.save',{site:'',date:days(week,3),hour:9,metric:'sales',value:'100'},manager.cookie)
 for(let hour=0;hour<24;hour++)await h.cmd('sales.save',{site:'',date:days(week,4),hour,metric:'sales',value:'50'},manager.cookie)
 // A published shift with no observed punch remains an unresolved signal, not proven absence.
 await h.cmd('availability.save',{staffId:staff.id,start:local(week,'00:00'),end:local(days(week,7),'00:00')})
 const draft=await h.cmd('roster.prepare',{week,shifts:[{staffId:staff.id,start:local(week,'09:00'),end:local(week,'17:00'),breakMinutes:30}]},manager.cookie)
 await h.cmd('roster.publish',pin(draft),manager.cookie)
 await h.cmd('attendrule.save',{site:'',graceMinutes:5,noShowMinutes:15})
 const path=`/api/lanyard/learning?week=${week}&weeks=1&site=`
 const read=async(cookie=manager.cookie)=>{const r=await h.send(path,undefined,cookie);assert.equal(r.status,200,r.text);return r.value}
 let report=await read()
 assert.deepEqual(report.days.map(d=>d.errorCents),[-10000,10000,-100000,null,20000,null,null])
 assert.deepEqual(report.summary,{observedDays:4,unknownDays:3,meanAbsoluteErrorCents:35000})
 assert.deepEqual(report.days[0].forecastSource,{id:first.id,revision:first.revision,savedAt:first.savedAt,days:Array(7).fill(1000)})
 assert.equal(report.days[2].actualCents,0,'an explicitly recorded zero is observed')
 assert.deepEqual(report.days[3].reasons,['incomplete-hourly-sales'])
 assert.deepEqual(report.days[5].reasons,['sales-not-recorded'])
 assert.equal(report.days[4].salesSources.length,24)
 assert.equal(report.days[0].attendance.unresolvedNoShows.length,1);assert.equal(report.days[0].attendance.unresolvedNoShows[0].knownAbsent,false)
 assert.ok(report.days.every(d=>d.providerHistory.status==='unknown'))
 assert.deepEqual((await read(h.owner)).summary,report.summary)
 const corrected=await h.cmd('sales.save',{...pin(entries[0]),site:'',date:week,metric:'sales',value:'950'},manager.cookie)
 report=await read();assert.equal(report.days[0].errorCents,-5000)
 assert.deepEqual([report.days[0].salesSources[0].revision,report.days[0].salesSources[0].versions.length],[corrected.revision,1])
 // The report itself writes nothing, never prepares a schedule, and makes no policy decision.
 const before=await h.state();await read();const after=await h.state()
 assert.deepEqual([after.version,after.rosters,after.shifts,after.forecasts],[before.version,before.rosters,before.shifts,before.forecasts])
 assert.equal((await h.send(path,undefined,staff.cookie)).status,403)
 assert.equal((await h.send(path,undefined,foreign.cookie)).status,404)
 assert.equal((await h.send(path)).status,401)
 const key=await h.cmd('agent.create',{label:'No learning grant'})
 assert.equal((await h.send(path,undefined,'',{authorization:`Bearer ${key.token}`})).status,401)
 for(const query of ['week='+week+'&weeks=27','week=2026-99-99&weeks=1'])assert.equal((await h.send('/api/lanyard/learning?'+query,undefined,manager.cookie)).status,400)
 // A source recorded only after the service day is never back-filled as a forecast.
 const oldWeek=days(week,-7)
 await h.cmd('forecast.save',{week:oldWeek,site:'',days:Array(7).fill(100),budgetPercent:25},manager.cookie)
 const late=await h.send(`/api/lanyard/learning?week=${oldWeek}&weeks=1`,undefined,manager.cookie)
 assert.ok(late.value.days.every(d=>d.forecastCents===null&&d.errorCents===null&&d.reasons.includes('forecast-entered-after-service-start')&&d.attendance.unknown))
 const futureWeek=days(week,14),future=await h.send(`/api/lanyard/learning?week=${futureWeek}&weeks=1`,undefined,manager.cookie)
 assert.equal(future.value.summary.meanAbsoluteErrorCents,null);assert.ok(future.value.days.every(d=>d.reasons.includes('service-day-not-complete')&&d.errorCents===null))
}

// Public manual-sales and forecast doors feed OPT-001's saved demand comparison.
import assert from 'node:assert/strict'
import {days,local} from './workforce-journey.mjs'
export async function planningFixture(h,f) {
 const csv='date,hour,site,sales\n'+[7,14].flatMap(n=>[8,18].map(hour=>`${days(f.week,-n)},${hour},Ocean Beach,100`)).join('\n')
 const preview=await h.cmd('sales.preview',{csv,site:''});await h.cmd('sales.import',{csv,site:'',fingerprint:preview.fingerprint})
 await h.cmd('demandrule.save',{site:'Ocean Beach',staleDays:60,roles:'Counter|50|0'})
 const stamp={'x-test-now':String(Date.parse(local(days(f.week,-1),'12:00')))}
 const demand=await h.send(`/api/lanyard/demand?site=Ocean%20Beach&date=${f.week}`,undefined,h.owner,stamp)
 assert.equal(demand.status,200,demand.text)
 const version=await h.cmd('demand.save',{site:'Ocean Beach',date:f.week,digest:demand.value.live.digest},h.owner,200,stamp)
 const budget={week:f.week,site:'Ocean Beach',days:[1000,0,0,0,0,0,0],budgetPercent:30}
 await h.cmd('forecast.save',budget,f.foreign.cookie,404);await h.cmd('forecast.save',budget,f.alex.cookie,403)
 await h.cmd('forecast.save',{week:f.week,site:'Ocean Beach',days:[1000,0,0,0,0,0,0],budgetPercent:30})
 for(const cookie of [f.foreign.cookie,f.alex.cookie])assert.equal((await h.state(cookie)).forecasts.some(x=>x.site==='Ocean Beach'),false)
 const key=await h.cmd('agent.create',{label:'Preparation only planner'})
 const context=await h.send('/api/lanyard/agent/context',undefined,'',{authorization:`Bearer ${key.token}`});assert.deepEqual(context.value.forecasts,[])
 return {version,stamp}
}

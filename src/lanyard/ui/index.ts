import {themeFrame} from '../../base/theme-frame'
import {h,manager,owner,venue} from './shared'
import {topbar,type Tab} from './shell'
import {weekModel} from './week'
import {schedule} from './schedule'
import {time} from './time'
import {payroll} from './payroll'
import {people} from './people'
import {movein,agent} from './admin'
// Both faces are on every screen; preloading them starts the downloads with the stylesheets instead of after them.
const fontPreloads=['/fonts/inter/inter-latin-wght-normal.woff2','/fonts/source-serif-4/source-serif-4-latin-opsz-italic.woff2'].map(href=>`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`).join('')
const styles=['/app/shell.css','/app/schedule.css','/app/screens.css'].map(href=>`<link rel="stylesheet" href="${href}">`).join('')
const titles:Record<string,string>={schedule:'Schedule',time:'Time',payroll:'Payroll',people:'People',import:'Import staff',agent:'Agent access'}
export async function renderApp(state:any,path:string,extras:{message?:string,error?:string,result?:any}={},now=Date.now()):Promise<Response> {
 const url=new URL(path,'http://app.invalid'),q=url.searchParams,tab=url.pathname.split('/')[2]||'schedule',back=url.pathname+url.search
 const tabs:Tab[]=[{key:'schedule',label:'Schedule'},{key:'time',label:'Time'},...(manager(state)?[{key:'payroll',label:'Payroll'},{key:'people',label:'People'}]:[])]
 const allowed=tabs.some(t=>t.key===tab)||(owner(state)&&['import','agent'].includes(tab))
 const frame=await themeFrame({href:'/rer-theme.css',productName:'Lanyard',accentColor:'#9B1B3A'})
 const w=weekModel(state,now,q,tab==='schedule')
 const content=!allowed?'<div class="title-row"><h1>Page unavailable</h1></div><p>Your role cannot open this page.</p><p><a class="text-link" href="/app/schedule">Open the schedule</a></p>':tab==='time'?time(state,w,now,back):tab==='payroll'?payroll(state,now):tab==='people'?people(state,now,w.site,q):tab==='import'?movein(state,extras,now):tab==='agent'?agent(state,extras,now):schedule(state,w,extras,now,back,q)
 const notice=`${extras.error?`<div class="notice error" role="alert">${h(extras.error)}</div>`:''}${extras.message?`<div class="notice" role="status">${h(extras.message)}</div>`:''}`
 const html=`<!doctype html><html lang="en-US"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(titles[tab]??'Lanyard')} · Lanyard</title>${frame.head}${fontPreloads}<link rel="stylesheet" href="/fonts/fonts.css">${styles}<script src="/lanyard.js" defer></script></head><body class="lanyard-app" data-timezone="${h(venue(state))}"><a class="skip" href="#main">Skip to content</a>${topbar(state,tabs,tab,w,q)}<main id="main" data-page="${h(tab)}">${notice}${content}</main></body></html>`
 return new Response(html,{status:allowed?200:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':`default-src 'self'; ${frame.policy}; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,'referrer-policy':'same-origin','x-content-type-options':'nosniff'}})
}

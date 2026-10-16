import {themeFrame} from '../../base/theme-frame'
import {h,manager,owner,venue} from './shared'
import {roster} from './roster'
import {time} from './time'
import {payroll} from './payroll'
import {people} from './people'
import {movein,agent} from './admin'
// Both faces are on every screen; preloading them starts the downloads with the stylesheets instead of after them.
const fontPreloads=['/fonts/work-sans/work-sans-latin-wght-normal.woff2','/fonts/piazzolla/piazzolla-latin-standard-normal.woff2'].map(href=>`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`).join('')
export async function renderApp(state:any,path:string,extras:{message?:string,error?:string,result?:any}={}):Promise<Response> {
 const tab=path.split('?')[0].split('/')[2] || 'roster'
 const tabs=[['roster','Roster'],['time','Time'],...(manager(state)?[['payroll','Payroll'],['people','People']]:[]),...(owner(state)?[['import','Import'],['agent','Agent access']]:[])]
 const allowed=tabs.some(([name])=>name===tab)
 const frame=await themeFrame({href:'/rer-theme.css',productName:'Lanyard',accentColor:'#167A33'})
 const content=!allowed?'<h1>Page unavailable</h1><p>Your role cannot access this page.</p><p><a href="/app/roster">Open roster</a></p>':tab==='time'?time(state):tab==='payroll'?payroll(state):tab==='people'?people(state):tab==='import'?movein(state,extras):tab==='agent'?agent(state,extras):roster(state,extras)
 const html=`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(tabs.find(([name])=>name===tab)?.[1]??'Lanyard')} · Lanyard</title>${frame.head}${fontPreloads}<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/lanyard.css"><script src="/lanyard.js" defer></script></head><body class="lanyard-app" data-timezone="${h(venue(state))}"><a class="skip" href="#main">Skip to content</a><div class="app-band" aria-hidden="true"></div><header class="app-header"><a class="brand-home" href="/app">${frame.brand.replace('class="rer-brand"', 'class="rer-brand" data-rer-name')}</a><div class="identity"><span>${h(state.actor.email)}</span><span class="role">${h(state.actor.role)}</span>${owner(state)?'<a href="/auth/settings/identity">Sign-in settings</a>':''}<button type="button" data-signout class="signout">Sign out</button></div></header><div class="navigation"><nav aria-label="Lanyard">${tabs.map(([key,label])=>`<a href="/app/${h(key)}" ${key===tab?'aria-current="page"':''}>${h(label)}</a>`).join('')}</nav><p class="venue-time">Venue time: <strong>${h(venue(state))}</strong></p></div><main id="main" data-page="${h(tab)}">${extras.error?`<div class="notice error" role="alert">${h(extras.error)}</div>`:''}${extras.message?`<div class="notice" role="status">${h(extras.message)}</div>`:''}${content}</main><footer>Lanyard · Staff, rosters, time and payroll</footer></body></html>`
 return new Response(html,{status:allowed?200:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':`default-src 'self'; ${frame.policy}; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,'referrer-policy':'same-origin','x-content-type-options':'nosniff'}})
}

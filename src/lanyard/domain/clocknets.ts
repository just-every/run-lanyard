// CLOCK-007: the owner's web time clock rule per cafe. A punch is checked against the cafe's
// approved public IP ranges (IPv4 or IPv6 CIDR) and enrolled browsers; from neither it is
// refused or accepted and flagged, as configured. Only the network identity is recorded:
// the client IP the edge reports and which approval matched, never other device data.
import {type Context,type State,keys,text,integer,need,fail,put} from './model'

export type Net={ip:string;browsers:{id:string;site:string}[]}
const MODES=['off','refuse','flag']

/** An address as [family, bigint], or null. */
function address(v:string):[4|6,bigint]|null {
 if(/^\d{1,3}(\.\d{1,3}){3}$/.test(v)){const p=v.split('.').map(Number);return p.every(n=>n<=255)?[4,p.reduce((n,x)=>n*256n+BigInt(x),0n)]:null}
 if(!/^[0-9a-f:]+$/i.test(v)||!v.includes(':'))return null
 const halves=v.split('::');if(halves.length>2)return null
 const head=halves[0]?halves[0].split(':'):[],tail=halves.length===2&&halves[1]?halves[1].split(':'):[],fill=8-head.length-tail.length
 if(halves.length===1?head.length!==8:fill<1)return null
 const groups=[...head,...Array(halves.length===2?fill:0).fill('0'),...tail]
 if(!groups.every(g=>/^[0-9a-f]{1,4}$/i.test(g)))return null
 return [6,groups.reduce((n,g)=>n*65536n+BigInt(parseInt(g,16)),0n)]
}
/** "203.0.113.0/24" or "2001:db8::/32" (a bare address is a single host), normalized. */
export function range(v:string) {
 const [ip,bits,...rest]=v.trim().split('/'),a=address(ip??'');need(a&&!rest.length,`Invalid IP range: ${v.trim().slice(0,60)}`)
 const width=a[0]===4?32:128,prefix=bits===undefined?width:Number(bits);need(/^\d+$/.test(bits??String(width))&&prefix>=0&&prefix<=width,`Invalid IP range: ${v.trim().slice(0,60)}`)
 return {family:a[0],prefix,base:(a[1]>>BigInt(width-prefix)),text:`${ip.toLowerCase()}/${prefix}`}
}
function inRange(ip:string,r:string) {
 const a=address(ip),x=range(r);if(!a||a[0]!==x.family)return false
 return (a[1]>>BigInt((x.family===4?32:128)-x.prefix))===x.base
}
/** A punch at the cafe: allowed with its network recorded, flagged "off-network punch", or refused. No rule (or off) records nothing. */
export function checkNetwork(s:State,site:string,net:Net|undefined):{network?:Record<string,any>;exceptions:string[]} {
 const rule=s.clocknets.find(r=>r.site===site);if(!rule||rule.mode==='off')return {exceptions:[]}
 const ip=net?.ip??'',browser=net?.browsers.find(b=>b.site===site)
 const via=rule.ranges.some((r:string)=>inRange(ip,r))?'approved range':browser?'enrolled browser':null
 const network={ip,via,...(via==='enrolled browser'?{browserId:browser!.id}:{})}
 if(via)return {network,exceptions:[]}
 if(rule.mode==='refuse')fail(`Clock-in and clock-out at ${site||'this cafe'} work only from its approved networks or enrolled browsers.`,409)
 return {network,exceptions:['off-network punch']}
}
export function clockNets(c:Context,name:string,p:Record<string,any>) {
 if(name!=='clocknet.save')return undefined
 need(c.a.role==='owner','Owner required',403);keys(p,['site','mode','ranges','revision'])
 const site=text(p.site,'site',80,true),old=c.s.clocknets.find(r=>r.site===site)
 if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Clock network rule changed; reload before saving',409)
 need(MODES.includes(p.mode),'Choose off, refuse or flag');need(typeof (p.ranges??'')==='string'&&String(p.ranges??'').length<=4000,'Invalid IP ranges')
 const ranges=[...new Set(String(p.ranges??'').split(/[\s,]+/).filter(Boolean).map(v=>range(v).text))];need(ranges.length<=50,'At most 50 IP ranges')
 return put(c,'clocknets',{site,mode:p.mode,ranges,savedBy:c.a.id,savedAt:c.now},old)
}

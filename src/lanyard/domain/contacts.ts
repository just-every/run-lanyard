// CONTACT-001: emergency contacts. Until PAYSYNC-001 and HR-001 bring an authority switch, Lanyard is
// the authority: each linked person keeps up to three of their own (name, relationship, US phone). The
// owner and the managers of the person's home cafe (until TEAM-001) read them only through the audited
// card read; every view and every refused attempt writes an activity event naming the reader and person.
import {type Actor,type Context,type State,keys,text,integer,need,self,put} from './model'

export const MAX_CONTACTS=3
/** A US number with its area code (10 digits, or 11 starting with 1), kept as +1 and ten digits. */
function phone(v:unknown) {
 const d=text(v,'phone',30).replace(/\D/g,''),n=d.length===11&&d[0]==='1'?d.slice(1):d
 need(/^[2-9]\d{2}[2-9]\d{6}$/.test(n),'Enter a US phone number with its area code');return '+1'+n
}
export function contacts(c:Context,name:string,p:Record<string,any>) {
 if(name!=='contact.save')return undefined
 keys(p,['contacts','revision']);const staffId=self(c.a)!,old=c.s.contacts.find(r=>r.staffId===staffId)
 if(old)need(integer(p.revision,'revision',1,Number.MAX_SAFE_INTEGER)===old.revision,'Emergency contacts changed; reload before saving',409)
 need(Array.isArray(p.contacts)&&p.contacts.length<=MAX_CONTACTS,`Add up to ${MAX_CONTACTS} emergency contacts`)
 const list=p.contacts.map((x:any)=>{need(x&&typeof x==='object'&&!Array.isArray(x),'Invalid contact');keys(x,['name','relationship','phone']);return {name:text(x.name,'contact name',80),relationship:text(x.relationship,'relationship',40),phone:phone(x.phone)}})
 return put(c,'contacts',{staffId,contacts:list,savedAt:c.now},old)
}
/** Who may open a person's contact card: the person, the owner, and a manager of the person's home cafe. */
export function mayRead(s:State,a:Actor,staffId:string) {
 const person=s.staff.find(p=>p.id===staffId&&!p.erased_at);if(!person||a.role==='agent')return false
 if(a.staffId===staffId||a.role==='owner')return true
 const home=s.staff.find(p=>p.id===a.staffId)?.site??''
 return a.role==='manager'&&Boolean(home)&&person.site===home
}
export function contactCard(s:State,staffId:string) {
 const person=s.staff.find(p=>p.id===staffId)!
 return {staffId,name:person.name,site:person.site,contacts:s.contacts.find(r=>r.staffId===staffId)?.contacts??[]}
}

// Disposable conformance data through the production owner/setup and workforce
// HTTP lifecycle. No direct database writes, alternate auth or test routes.
import assert from 'node:assert/strict'
export default async function ({request,origin,claim,displayName,returnTo}) {
 const bootstrap=await request(origin+claim.path,{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token:claim.token,displayName,returnTo})})
 assert.equal(bootstrap.status,303)
 const cookie=bootstrap.headers.getSetCookie().map(x=>x.split(';',1)[0]).join('; ')
 const post=async(path,body)=>{
  const r=await request(origin+path,{method:'POST',redirect:'manual',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify(body)})
  assert.equal(r.status,200);return (await r.json()).result
 }
 await request(origin+'/setup',{method:'POST',redirect:'manual',headers:{origin,cookie,'content-type':'application/x-www-form-urlencoded'},body:'confirm=yes'})
 const cmd=(name,input)=>post('/api/lanyard/command',{name,input})
 await cmd('settings.save',{timezone:'UTC'})
 for(const [name,site] of [['Alex Rivera','Ocean Beach'],['Priya Shah','Ocean Beach'],['Omar Reed','Ocean Beach']]) {
  const p=await cmd('staff.save',{name,email:name.split(' ')[0].toLowerCase()+'@synthetic.example.invalid',payrollId:name.split(' ')[0],active:true,role:'staff',site,position:'Barista'})
  await cmd('availability.save',{staffId:p.id,start:'2026-01-01T00:00:00Z',end:'2026-12-31T00:00:00Z'})
  const time=await cmd('time.prepare',{staffId:p.id,start:'2026-01-05T10:00:00Z',end:'2026-01-05T12:00:00Z',breakMinutes:0,reason:'Synthetic conformance work, separate from agent preparation'})
  await cmd('time.approve',{id:time.id,revision:time.revision})
 }
 await cmd('agent.create',{label:'Company forecast coordinator',scopes:['comparison.read'],cafes:['Ocean Beach'],comparisonConsent:true,companyAgents:true})
 // The original native final owner response retains its genuine session cookie.
 return bootstrap
}

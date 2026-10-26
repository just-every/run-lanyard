import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const account='b20c0ca9cab0c2b70e13d7cf724b89bd'
export async function cloud(method,path,token,body){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`,{
  method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
  ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000),
 })
 const result=await response.json()
 assert.ok(response.ok&&result.success,`Cloudflare ${method} ${path.split('?')[0]} failed (${response.status}; codes ${(result.errors??[]).map(e=>e.code).join(', ')})`)
 return result.result
}
export async function mint(){
 assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account)
 const groups=await cloud('GET','/tokens/permission_groups?per_page=1000',process.env.CF_MINTER)
 const names=['Workers Scripts Write','D1 Write','Workers R2 Storage Write']
 const permissions=names.map(name=>{const group=groups.find(g=>g.name===name);assert.ok(group,`Missing permission ${name}`);return {id:group.id}})
 return cloud('POST','/tokens',process.env.CF_MINTER,{
  name:'lanyard-hosted-installation-proof',expires_on:new Date(Date.now()+3600000).toISOString().replace(/\.\d{3}Z$/,'Z'),
  policies:[{effect:'allow',resources:{[`com.cloudflare.api.account.${account}`]:'*'},permission_groups:permissions}],
 })
}
export async function verifiedSender(sender){
 const read=async path=>{
  const response=await fetch('https://api.sendgrid.com/v3'+path,{headers:{authorization:`Bearer ${process.env.MAIL_API_KEY}`},signal:AbortSignal.timeout(30000)})
  assert.equal(response.status,200,`SendGrid ${path} read failed`)
  return response.json()
 }
 const [senders,domains]=await Promise.all([read('/verified_senders'),read('/whitelabel/domains')])
 const domain=sender.split('@')[1]
 assert.ok(senders.results.some(s=>s.verified&&s.from_email.toLowerCase()===sender.toLowerCase())||domains.some(d=>d.valid&&d.domain.toLowerCase()===domain.toLowerCase()),'MAIL_FROM has no verified sender or authenticated domain')
}
export async function signInLink(origin,since){
 assert.ok(process.env.MAILBOX_RECEIPT_URL,'The fleet QA mailbox reader is required')
 const end=Date.now()+90000
 while(Date.now()<end){
  const url=new URL(process.env.MAILBOX_RECEIPT_URL)
  for(const [key,value] of Object.entries({to:process.env.HOSTED_QA_INBOX,since,contains:new URL(origin).host}))url.searchParams.set(key,value)
  const response=await fetch(url,{signal:AbortSignal.timeout(15000)})
  assert.equal(response.status,200,'Fleet QA mailbox read failed')
  const mail=(await response.json()).receipts?.[0]
  if(mail){
   url.pathname=`/receipts/${encodeURIComponent(mail.id)}/raw`
   const rawResponse=await fetch(url,{signal:AbortSignal.timeout(15000)})
   assert.equal(rawResponse.status,200,'Fleet QA message read failed')
   const decoded=spawnSync('python3',[fileURLToPath(new URL('./hosted-installation-mail.py',import.meta.url)),origin],{input:Buffer.from(await rawResponse.arrayBuffer()),encoding:'utf8'})
   assert.equal(decoded.status,0,'QA message has no native sign-in link')
   const link=decoded.stdout.trim()
   assert.ok(link.startsWith(origin+'/auth/'),'QA message must point to this installation')
   console.log('hosted installation: fleet QA sign-in email received')
   return link
  }
  await new Promise(resolve=>setTimeout(resolve,5000))
 }
 throw new Error('No fleet QA sign-in email received in 90 seconds')
}

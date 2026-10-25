import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {setTimeout as delay} from 'node:timers/promises'

// Command output can contain a private local sign-in link. Keep it in memory.
export async function command(cwd,program,args,env,expected=0){
 const child=spawn(program,args,{cwd,env,stdio:['ignore','pipe','pipe']})
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk})
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)})
 assert.equal(code,expected,`${args[0]} failed with exit ${code}: ${output.replace(/^.*(?:RER_OPEN|RER_SIGN_IN|#key=).*$/gm,'[private sign-in link omitted]').slice(-5000)}`)
 return output
}
export async function serve(cwd,cli,env,mode='dev'){
 const child=spawn(process.execPath,[cli,mode,'--foreground','--idle-timeout','300','--no-queue'],{cwd,env,stdio:['ignore','pipe','pipe']})
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk})
 const stop=async()=>{if(child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(resolve=>child.once('close',resolve))}
 try{
  for(let i=0;i<1200;i++){
   assert.equal(child.exitCode,null,`${mode} exited before readiness`)
   const origin=output.match(/RER_READY (http:\/\/\S+)/)?.[1],open=output.match(/RER_OPEN (http:\/\/\S+)/)?.[1]
   if(origin&&(open||mode==='preview'))return {origin,open,stop}
   await delay(250)
  }
  throw Error(`${mode} did not become ready in five minutes`)
 }catch(error){await stop();throw error}
}

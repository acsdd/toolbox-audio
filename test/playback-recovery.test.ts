import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { createNavidrome } = require('../scripts/navidrome.cjs')
const storage={isEncryptionAvailable:()=>true,encryptString:(s:string)=>Buffer.from(s),decryptString:(b:Buffer)=>b.toString()}
test('cancel aborts pending provider requests and preserves the saved server', async () => {
  const directory=mkdtempSync(join(tmpdir(),'audiowave-recovery-'))
  let pending=false,aborted=false
  const service=createNavidrome({file:join(directory,'fixture.bin'),secureStorage:storage,fetchImpl:async (_:unknown,options:any)=>{
    if(!pending)return Response.json({'subsonic-response':{status:'ok'}})
    return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('fixture-private-url'))},{once:true}))
  }})
  try{
    await service.connect({url:'https://fixture.invalid',username:'fixture',password:'fixture'})
    assert.equal(typeof service.cancel,'function')
    pending=true;const request=service.albums();service.cancel()
    await assert.rejects(request,/cancelled/i);assert.equal(aborted,true);assert.equal(service.status().connected,true)
  }finally{rmSync(directory,{recursive:true,force:true})}
})
test('authentication and transient source failures give safe actionable errors without forgetting credentials',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'audiowave-recovery-'));let failure=0
  const service=createNavidrome({file:join(directory,'fixture.bin'),secureStorage:storage,fetchImpl:async()=>failure?new Response('private-upstream-token',{status:failure}):Response.json({'subsonic-response':{status:'ok'}})})
  try{
    await service.connect({url:'https://fixture.invalid',username:'fixture',password:'fixture'})
    for(const code of [401,403]){failure=code;await assert.rejects(service.albums(),/reconnect/i);assert.equal(service.status().connected,true)}
    failure=503;await assert.rejects(service.albums(),/HTTP 503/);assert.equal(service.status().connected,true)
  }finally{rmSync(directory,{recursive:true,force:true})}
})

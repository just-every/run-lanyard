/* A single location observation belongs to a consented in or out punch. */
(() => {
 window.LanyardPunchLocation={async capture(clock,name,capturedAt){
  const fields=clock.querySelector('[data-punch-location]')
  if(!fields||!['clock.in','clock.out'].includes(name))return {}
  if(!fields.querySelector('[name=locationNoticeSeen]').checked)throw new Error('Read and acknowledge the location notice before capture.')
  const failure=value=>({location:{noticeSeen:true,failure:value}})
  if(!fields.querySelector('[name=locationConsent]').checked)return failure('consent declined')
  if(!navigator.geolocation)return failure('unavailable')
  try{
   const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:10000}))
   if(!Number.isFinite(position.timestamp)||Math.abs(position.timestamp-Date.parse(capturedAt))>60000)return failure('unavailable')
   const {latitude,longitude,accuracy}=position.coords
   return {location:{latitude,longitude,accuracyMeters:accuracy,observedAt:new Date(position.timestamp).toISOString(),noticeSeen:true,consent:true}}
  }catch(error){return failure(error.code===1?'permission denied':'unavailable')}
 }}
})()

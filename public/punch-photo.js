/* A camera opens only after punch consent; every track stops in finally. */
(() => {
 async function still(video){
  let stream
  try{
   stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:320},height:{ideal:240}},audio:false})
   video.srcObject=stream;video.hidden=false;await video.play()
   await new Promise(resolve=>video.requestVideoFrameCallback?video.requestVideoFrameCallback(resolve):requestAnimationFrame(resolve))
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;canvas.getContext('2d').drawImage(video,0,0,320,240)
   const photo=canvas.toDataURL('image/jpeg',0.65).split(',')[1]
   if(photo.length>134000)throw new Error('Photo is too large')
   return {photo}
  }catch(error){return {photoFailure:error.name==='NotAllowedError'?'camera denied':'camera failed'}}
  finally{stream?.getTracks().forEach(track=>track.stop());video.srcObject=null;video.hidden=true}
 }
 window.LanyardPunchPhoto={still,async capture(clock,name){
  const fields=clock.querySelector('[data-punch-photo]')
  if(!fields||name==='clock.transfer'||name.startsWith('clock.break')&&fields.dataset.photoBreaks!=='true')return {}
  const notice=fields.querySelector('[name=photoNoticeSeen]').checked,consent=fields.querySelector('[name=photoConsent]').checked
  if(!notice)throw new Error('Read and acknowledge the photo notice before capture.')
  if(!consent)return {photoNoticeSeen:true,photoConsent:false,photoFailure:'photo consent declined'}
  return {photoNoticeSeen:true,photoConsent:true,...await still(fields.querySelector('video'))}
 }}
})()

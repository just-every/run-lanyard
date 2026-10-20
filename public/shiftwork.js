// SCHEDULE-004: extend or remove job/area rows without leaving the handover form.
document.addEventListener('click',event=>{
 const add=event.target.closest('[data-add-area]'),remove=event.target.closest('[data-remove-area]')
 if(add){const form=add.closest('form'),list=form.querySelector('[data-area-list]');if(list.children.length<20)list.append(form.querySelector('[data-area-template]').content.cloneNode(true))}
 if(remove)remove.closest('[data-area-row]').remove()
})

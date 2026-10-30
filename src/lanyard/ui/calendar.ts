import {h,card,form,hidden,titleRow} from './shared'

export function calendarSettings(s:any,extras:any) {
 if(!s.actor.staffId||!s.calendar)return ''
 const current=s.calendar,issued=extras.result?.calendar?.url,back='/app/settings',revision=hidden('revision',current.revision)
 const consent='<label class="check"><input type="checkbox" name="consent" value="yes" required> I understand anyone with this private link can read my published assignments.</label>'
 const controls=current.active?form('calendar.rotate',back,revision+consent,'Replace private link')+form('calendar.revoke',back,revision,'Revoke calendar access'):form('calendar.issue',back,revision+consent,'Create private link')
 const link=issued?`<div role="status"><p><strong>Copy your private link now. It is shown only once.</strong></p><label>Private subscription link<input type="url" readonly value="${h(issued)}" style="width:100%;font-size:14px"></label></div>`:''
 return card('My calendar',`<p>${current.active?'Your private subscription is active.':'No active private subscription.'}</p><p>Subscribe by URL in Google Calendar or Outlook Calendar. Only your published assignments are included. Drafts, coworkers and private notes stay out.</p><p>Google and Microsoft control refresh timing and may retain downloaded events. This is a read-only subscription, not immediate two-way scheduling. Replacing or revoking the link stops future reads of the old link immediately.</p>${link}${controls}`,'','my-calendar')
}
export function personalSettings(s:any,extras:any,now:number){return titleRow('Settings',s,now)+calendarSettings(s,extras)}

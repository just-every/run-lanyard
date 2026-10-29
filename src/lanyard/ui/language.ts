import {html,t as tr} from '../localization'
import {languageOf} from '../localization'
import {card,form,h,titleRow} from './shared'
export function personalLanguageSettings(s:any){
 if(!s.actor.staffId)return ''
 return (s.actor.role==='owner'?'':titleRow(tr(s,'Settings'),s,Date.now()))+card(tr(s,'My language'),form('clocklanguage.save',s.actor.role==='owner'?'/app/settings':'/app/settings/language',html(s)`<label>My language<select name="language"><option value="en" ${languageOf(s)==='en'?'selected':''}>English</option><option value="es" ${languageOf(s)==='es'?'selected':''}>Español</option></select></label><p>This is your own preference for the staff journey and shared clock. It does not change text written by people.</p>`,tr(s,'Save language')))
}
